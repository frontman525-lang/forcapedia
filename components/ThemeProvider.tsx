'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} })

export const useTheme = () => useContext(ThemeContext)

function applyTheme(t: Theme) {
  const el = document.documentElement
  if (t === 'light') {
    el.classList.add('light')
    el.style.background = '#F7F5F0'
    document.body.style.background = '#F7F5F0'
    document.body.style.color = '#1A1D26'
  } else {
    el.classList.remove('light')
    el.style.background = '#131314'
    document.body.style.background = '#131314'
    document.body.style.color = '#F0EDE8'
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('fp-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved)
      applyTheme(saved)
    }
  }, [])

  const toggle = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('fp-theme', next)
      applyTheme(next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
