'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

/* ─── Types ─────────────────────────────────────── */
type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertItem {
  id: number
  message: string
  type: AlertType
}

interface AlertContextValue {
  showAlert: (message: string, type?: AlertType) => void
}

/* ─── Context ────────────────────────────────────── */
const AlertContext = createContext<AlertContextValue>({
  showAlert: () => {},
})

export function useAlert() {
  return useContext(AlertContext)
}

/* ─── Config ─────────────────────────────────────── */
const CONFIG: Record<AlertType, { bar: string; label: string; icon: string }> = {
  success: { bar: '#6FCF97', label: 'Success',  icon: '✓' },
  error:   { bar: '#F47C7C', label: 'Error',    icon: '✕' },
  warning: { bar: '#F7C97E', label: 'Warning',  icon: '!' },
  info:    { bar: '#7EB8F7', label: 'Info',     icon: 'i' },
}

/* ─── Provider ───────────────────────────────────── */
export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const counterRef = useRef(0)

  const removeAlert = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  const showAlert = useCallback((message: string, type: AlertType = 'info') => {
    const id = ++counterRef.current
    setAlerts(prev => [...prev, { id, message, type }])
    setTimeout(() => removeAlert(id), 4200)
  }, [removeAlert])

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {/* Alert Container — fixed top-right, never blocks content */}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '380px',
          width: 'calc(100vw - 3rem)',
          pointerEvents: 'none',
        }}
      >
        {alerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onRemove={removeAlert}
          />
        ))}
      </div>
    </AlertContext.Provider>
  )
}

/* ─── Individual Alert Card ──────────────────────── */
function AlertCard({
  alert,
  onRemove,
}: {
  alert: AlertItem
  onRemove: (id: number) => void
}) {
  const c = CONFIG[alert.type]

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'all',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        background: 'rgba(10,11,14,0.97)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
        animation: 'alertIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '1rem 1.25rem',
      }}
    >
      {/* Left colour bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: '3px',
        background: c.bar,
        borderRadius: '16px 0 0 16px',
      }} />

      {/* Icon */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        flexShrink: 0,
        marginTop: '1px',
        background: `${c.bar}22`,
        color: c.bar,
        fontFamily: 'var(--font-mono)',
      }}>
        {c.icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '2px',
          fontFamily: 'var(--font-mono)',
          color: c.bar,
        }}>
          {c.label}
        </p>
        <p style={{
          fontSize: '13.5px',
          lineHeight: 1.5,
          color: 'rgba(240,237,232,0.82)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 300,
        }}>
          {alert.message}
        </p>
      </div>

      {/* Close */}
      <button
        onClick={() => onRemove(alert.id)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.35)',
          cursor: 'pointer',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          transition: 'background 0.2s, color 0.2s',
        }}
        onMouseEnter={e => {
          const t = e.currentTarget
          t.style.background = 'rgba(255,255,255,0.12)'
          t.style.color = 'rgba(255,255,255,0.7)'
        }}
        onMouseLeave={e => {
          const t = e.currentTarget
          t.style.background = 'rgba(255,255,255,0.06)'
          t.style.color = 'rgba(255,255,255,0.35)'
        }}
      >
        ✕
      </button>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: '3px', right: 0,
        height: '2px',
        background: `${c.bar}55`,
        borderRadius: '0 0 16px 16px',
        animation: 'alertProgress 4s linear forwards',
      }} />
    </div>
  )
}
