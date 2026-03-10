'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Screen =
  | 'home' | 'signup' | 'login-email' | 'login-password'
  | 'signup-email' | 'forgot' | 'sent' | 'verify'
  | 'otp' | 'reset-password'

function mapError(msg: string, mode: 'signin' | 'signup') {
  const m = msg.toLowerCase()
  if (m.includes('rate limit'))           return mode === 'signup' ? 'Too many signups. Try again later.' : 'Too many attempts. Wait a minute and try again.'
  if (m.includes('already registered'))   return 'An account with this email already exists. Try signing in.'
  if (m.includes('invalid login'))        return 'Invalid email or password. Please try again.'
  if (m.includes('email not confirmed'))  return 'Please confirm your email before signing in.'
  return msg
}

function isSupabaseHookTimeout(msg: string) {
  return msg.toLowerCase().includes('failed to reach hook within maximum time')
}

function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeClosed() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/>
      <path d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2c-7.7 0-14.4 4.4-17.7 10.7z" fill="#FF3D00"/>
      <path d="M24 46c5.5 0 10.5-2 14.3-5.4l-6.6-5.6C29.7 36.8 27 38 24 38c-6 0-11.1-4-13-9.5L4 34.1C7.3 41.4 15 46 24 46z" fill="#4CAF50"/>
      <path d="M44.5 20H24v8.5h11.8c-.9 2.9-2.8 5.4-5.3 7.1l6.6 5.6C41.1 38 45 32 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  background: #000;
  min-height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  overflow-x: hidden;
}

/* ── Starfield bg ── */
.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #000;
  overflow: hidden;
}
.bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at  6%  6%, rgba(255,255,255,0.8) 0%, transparent 100%),
    radial-gradient(1px 1px at 18% 12%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 31%  4%, rgba(255,255,255,0.7) 0%, transparent 100%),
    radial-gradient(1px 1px at 44% 19%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 57%  8%, rgba(255,255,255,0.6) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 70%  3%, rgba(255,255,255,0.9) 0%, transparent 100%),
    radial-gradient(1px 1px at 82% 15%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 93% 22%, rgba(255,255,255,0.6) 0%, transparent 100%),
    radial-gradient(1px 1px at  3% 28%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 12% 38%, rgba(255,255,255,0.3) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 25% 32%, rgba(255,255,255,0.6) 0%, transparent 100%),
    radial-gradient(1px 1px at 38% 44%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at 52% 36%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 65% 28%, rgba(255,255,255,0.3) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 77% 40%, rgba(255,255,255,0.7) 0%, transparent 100%),
    radial-gradient(1px 1px at 88% 33%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1px 1px at  8% 52%, rgba(255,255,255,0.3) 0%, transparent 100%),
    radial-gradient(1px 1px at 48% 56%, rgba(255,255,255,0.5) 0%, transparent 100%),
    radial-gradient(1px 1px at 91% 48%, rgba(255,255,255,0.4) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 35% 60%, rgba(255,255,255,0.6) 0%, transparent 100%);
}

/* ── Mars ── */
.mars-container {
  position: fixed;
  bottom: -87vw;
  left: 50%;
  transform: translateX(-50%);
  width: 110vw;
  height: 110vw;
  max-width: 1500px;
  max-height: 1500px;
  z-index: 2;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, black 24%, black 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 10%, black 24%, black 100%);
  animation: marsRise 2.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: 0.1s;
}
@keyframes marsRise {
  from { transform: translateX(-50%) translateY(6%); opacity: 0.3; }
  to   { transform: translateX(-50%) translateY(0);  opacity: 1; }
}
.mars {
  width: 100%; height: 100%; border-radius: 50%; position: relative;
  background:
    radial-gradient(ellipse 75% 22% at 50% 4%, rgba(210,130,60,0.55) 0%, transparent 100%),
    radial-gradient(ellipse 30% 18% at 14% 10%, rgba(120,40,15,0.6) 0%, transparent 100%),
    radial-gradient(ellipse 30% 18% at 86% 8%, rgba(185,75,25,0.45) 0%, transparent 100%),
    radial-gradient(ellipse 75% 5% at 50% 20%, rgba(50,10,3,0.55) 0%, transparent 100%),
    radial-gradient(ellipse 100% 45% at 50% 32%, rgba(160,55,18,0.45) 0%, transparent 100%),
    radial-gradient(ellipse 130% 65% at 50% 6%, #C8501A 0%, #A83A10 12%, #8C280C 28%, #6E1A07 48%, #3E0D04 70%, #150401 100%);
  box-shadow:
    inset 0 0 50px 8px rgba(0,0,0,0.18),
    inset -20px -10px 70px 0 rgba(0,0,0,0.22),
    inset 0 8px 40px 0 rgba(200,110,40,0.12),
    0 0  55px  25px rgba(180, 65, 15, 0.65),
    0 0 130px  65px rgba(155, 48, 10, 0.38),
    0 0 320px 130px rgba(130, 35,  5, 0.18),
    0 0 600px 250px rgba(100, 25,  0, 0.09);
}
.mars::before {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  background:
    radial-gradient(ellipse 3% 2.2% at 17% 30%, rgba(0,0,0,0.3) 0%, transparent 100%),
    radial-gradient(ellipse 2% 1.6% at 52% 24%, rgba(0,0,0,0.22) 0%, transparent 100%),
    radial-gradient(ellipse 4% 3%   at 68% 38%, rgba(0,0,0,0.2)  0%, transparent 100%),
    radial-gradient(ellipse 1.8% 1.4% at 36% 60%, rgba(0,0,0,0.22) 0%, transparent 100%),
    radial-gradient(ellipse 5% 3.5% at 12% 56%, rgba(0,0,0,0.18) 0%, transparent 100%),
    radial-gradient(ellipse 7% 5% at 43% 38%, rgba(0,0,0,0.12) 0%, transparent 100%),
    linear-gradient(115deg, rgba(255,140,60,0.06) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.2) 72%, rgba(0,0,0,0.5) 88%, rgba(0,0,0,0.7) 100%);
}
.mars::after {
  content: ''; position: absolute; inset: -1px; border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255,180,80,0.15), 0 0 30px 8px rgba(220,100,30,0.25);
}

/* ── PAGE ── */
.page {
  position: relative; z-index: 10; min-height: 100vh;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  padding: clamp(1.5rem, 5vw, 2rem) 1rem;
  animation: pageIn 0.5s ease both;
}
@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.logo-center { text-align: center; margin-bottom: 2.5rem; text-decoration: none; display: block; }
.wordmark {
  font-family: var(--font-serif, Georgia, serif);
  font-size: clamp(2.1rem, 7vw, 2.75rem);
  font-weight: 300; color: #F0EDE8;
  letter-spacing: 0.005em; line-height: 1;
}
.wordmark em { font-style: italic; color: #C9A96E; }

.col { width: 100%; max-width: 362px; }

/* ── BUTTONS ── */
.btn-white {
  width: 100%; padding: 14px 20px; border-radius: 100px; border: none;
  background: #FFFFFF; color: #0A0908;
  font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 500;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 10px; letter-spacing: 0.005em;
  transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
  margin-bottom: 10px;
}
.btn-white:hover { background: #f0f0f0; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(255,255,255,0.12); }
.btn-white:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.btn-cta {
  width: 100%; padding: 14px 20px; border-radius: 100px; border: none;
  background: #F0EDE8; color: #0A0908;
  font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 500;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 10px; transition: background 0.15s, transform 0.12s; margin-bottom: 10px;
}
.btn-cta:hover { background: #fff; transform: translateY(-1px); }
.btn-cta:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.btn-dark {
  width: 100%; padding: 14px 20px; border-radius: 100px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.055); color: #F0EDE8;
  font-family: 'Inter', sans-serif; font-size: 14.5px; font-weight: 400;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  gap: 10px; transition: background 0.15s, border-color 0.15s, transform 0.12s;
  margin-bottom: 10px;
}
.btn-dark:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); transform: translateY(-1px); }
.btn-dark:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

.sep { width: 100%; height: 1px; background: rgba(255,255,255,0.07); margin: 4px 0 18px; }

/* ── INPUTS ── */
.lbl { display: block; font-size: 13.5px; font-weight: 400; color: #F0EDE8; margin-bottom: 6px; letter-spacing: 0.005em; }
.inp {
  width: 100%; padding: 13px 16px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04); color: #F0EDE8;
  font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 300;
  outline: none; transition: border-color 0.15s, background 0.15s; margin-bottom: 1.25rem;
}
.inp::placeholder { color: rgba(240,237,232,0.2); }
.inp:focus { border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); }
.inp.pr { padding-right: 46px; }

.field { position: relative; }
.eye-btn {
  position: absolute; right: 14px; top: 14px;
  background: none; border: none; color: rgba(240,237,232,0.3);
  cursor: pointer; padding: 2px; display: flex; align-items: center; transition: color 0.15s;
}
.eye-btn:hover { color: rgba(240,237,232,0.7); }

.forgot-row { display: flex; justify-content: flex-end; margin: -0.75rem 0 1.25rem; }
.link-sm {
  background: none; border: none; font-family: 'Inter', sans-serif;
  font-size: 13px; font-weight: 400; color: rgba(240,237,232,0.45);
  cursor: pointer; padding: 0; transition: color 0.15s;
}
.link-sm:hover { color: #F0EDE8; }

.toggle { font-size: 13px; font-weight: 300; color: rgba(240,237,232,0.38); margin-top: 1.1rem; text-align: center; }
.toggle-btn {
  background: none; border: none; font-family: 'Inter', sans-serif;
  font-size: 13px; font-weight: 500; color: #F0EDE8; cursor: pointer; padding: 0; transition: opacity 0.15s;
}
.toggle-btn:hover { opacity: 0.6; }

.err {
  font-size: 12.5px; color: #F08080; line-height: 1.55;
  padding: 9px 13px;
  background: rgba(240,128,128,0.055);
  border: 1px solid rgba(240,128,128,0.14);
  border-radius: 8px; margin-bottom: 14px;
}

/* ── Success/info box — for "check inbox" screens ── */
.info-box {
  font-size: 12.5px; color: rgba(240,237,232,0.6); line-height: 1.6;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px; margin-bottom: 14px; text-align: left;
}

.sent-icon {
  width: 58px; height: 58px; border-radius: 50%;
  background: rgba(126,200,164,0.07);
  border: 1px solid rgba(126,200,164,0.2);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1.5rem;
}

.footer {
  position: fixed; bottom: 1.5rem; left: 0; right: 0;
  text-align: center; font-size: 12px; font-weight: 300;
  color: rgba(240,237,232,0.28); letter-spacing: 0.01em;
  z-index: 20; pointer-events: none;
}
.footer a { color: rgba(240,237,232,0.48); text-decoration: none; pointer-events: all; transition: color 0.15s; }
.footer a:hover { color: #F0EDE8; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade { animation: fadeUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* ── OTP digit boxes ── */
.otp-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 1.5rem; }
.otp-box {
  width: 46px; height: 54px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.04);
  color: #F0EDE8;
  font-family: 'Inter', sans-serif;
  font-size: 22px; font-weight: 500;
  text-align: center;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  caret-color: #C9A96E;
}
.otp-box:focus { border-color: rgba(201,169,110,0.6); background: rgba(255,255,255,0.07); }
.otp-box.filled { border-color: rgba(255,255,255,0.3); }

/* ── Mobile safety ── */
@media (max-width: 380px) {
  .page { justify-content: flex-start; padding-top: 3rem; padding-bottom: 5rem; }
  .logo-center { margin-bottom: 2rem; }
  .btn-white, .btn-cta, .btn-dark { font-size: 14px; padding: 13px 16px; }
  .otp-box { width: 40px; height: 48px; font-size: 20px; gap: 7px; }
}
`

function LoginContent() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const supabase    = createClient()

  // ?next= param — where to redirect after successful auth
  const nextUrl = searchParams.get('next') ?? '/'

  const [screen, setScreen]     = useState<Screen>('home')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [slowSend, setSlowSend] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // OTP state
  const [otpDigits, setOtpDigits]         = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const [otpType, setOtpType]             = useState<'signup' | 'forgot'>('forgot')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(nextUrl)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function go(s: Screen) {
    setError(null); setPassword(''); setConfirm(''); setShowPass(false)
    if (s === 'home' || s === 'signup') setEmail('')
    setScreen(s)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}` },
    })
  }

  function handleLoginEmailNext(e: { preventDefault(): void }) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Enter a valid email address.'); return }
    setError(null); setScreen('login-password')
  }

  async function handleSignIn(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!password) { setError('Enter your password.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) { setError(mapError(error.message, 'signin')); setLoading(false); return }
    router.replace(nextUrl)
  }

  async function handleSignUp(e: { preventDefault(): void }) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Enter a valid email address.'); return }
    if (!password) { setError('Enter your password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: {
        // After confirming, redirect back to wherever the user was heading
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    })
    setLoading(false)
    if (error) { setError(mapError(error.message, 'signup')); return }
    // Session means email confirmation is disabled — go straight in
    if (data.session) { router.replace(nextUrl); return }
    // Confirmation required — show the OTP screen (hook sends 6-digit code)
    setOtpType('signup')
    goOtp()
  }

  async function handleForgot(e: { preventDefault(): void }) {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em) { setError('Enter your email address.'); return }
    setLoading(true); setSlowSend(false); setError(null)
    const slowTimer = setTimeout(() => setSlowSend(true), 1400)
    const { error } = await supabase.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: false },
    })
    clearTimeout(slowTimer)
    setLoading(false); setSlowSend(false)
    if (error) {
      if (isSupabaseHookTimeout(error.message || '')) { setOtpType('forgot'); goOtp(); return }
      setError(error.message); return
    }
    setOtpType('forgot')
    goOtp()
  }

  function goOtp() {
    setOtpDigits(['', '', '', '', '', ''])
    setError(null)
    setScreen('otp')
    startResendCooldown()
  }

  function startResendCooldown() {
    setResendCooldown(30)
    const t = setInterval(() => {
      setResendCooldown(n => { if (n <= 1) { clearInterval(t); return 0 } return n - 1 })
    }, 1000)
  }

  function handleOtpInput(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[i] = digit
    setOtpDigits(next)
    if (digit && i < 5) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    if (!digits.length) return
    e.preventDefault()
    const next = [...otpDigits]
    digits.forEach((d, idx) => { if (idx < 6) next[idx] = d })
    setOtpDigits(next)
    const focusIdx = Math.min(digits.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  async function handleVerifyOtp(e: { preventDefault(): void }) {
    e.preventDefault()
    const token = otpDigits.join('')
    if (token.length < 6) { setError('Enter all 6 digits.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: otpType === 'signup' ? 'signup' : 'email',
    })
    setLoading(false)
    if (error) { setError('Invalid or expired code. Try again.'); return }
    if (otpType === 'signup') {
      // Account confirmed and signed in — go straight to the app
      router.replace(nextUrl)
    } else {
      // Forgot password — let user set new password inline
      setPassword(''); setConfirm('')
      setScreen('reset-password')
    }
  }

  async function handleSetPassword(e: { preventDefault(): void }) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.replace(nextUrl)
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return
    setError(null); setLoading(true)
    if (otpType === 'signup') {
      await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
    } else {
      await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } })
    }
    setLoading(false)
    setOtpDigits(['', '', '', '', '', ''])
    startResendCooldown()
    otpRefs.current[0]?.focus()
  }

  const Logo = () => (
    <Link href="/" className="logo-center">
      <div className="wordmark">Forca<em>pedia</em></div>
    </Link>
  )

  // ── Envelope icon reused in both "sent" + "verify" screens ──────────────────
  const EnvelopeIcon = () => (
    <div className="sent-icon" style={{ marginTop: '0.5rem' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7EC8A4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    </div>
  )

  return (
    <>
      <style>{CSS}</style>
      <div className="bg" />
      <div className="mars-container"><div className="mars" /></div>

      <div className="page">
        <div className="col">

          {/* ══ HOME ══ */}
          {screen === 'home' && (
            <div className="fade" key="home">
              <Logo />
              <button className="btn-white" onClick={handleGoogle}><GoogleIcon /> Login with Google</button>
              <button className="btn-dark"  onClick={() => go('login-email')}><MailIcon /> Login with email</button>
              <div className="sep" />
              <p className="toggle">
                Don't have an account?{' '}
                <button className="toggle-btn" onClick={() => go('signup')}>Sign up</button>
              </p>
            </div>
          )}

          {/* ══ SIGNUP ══ */}
          {screen === 'signup' && (
            <div className="fade" key="signup">
              <Logo />
              <button className="btn-white" onClick={handleGoogle}><GoogleIcon /> Sign up with Google</button>
              <button className="btn-dark"  onClick={() => go('signup-email')}><MailIcon /> Sign up with email</button>
              <div className="sep" />
              <p className="toggle">
                Already have an account?{' '}
                <button className="toggle-btn" onClick={() => go('home')}>Sign in</button>
              </p>
            </div>
          )}

          {/* ══ LOGIN: Email step ══ */}
          {screen === 'login-email' && (
            <div className="fade" key="login-email">
              <Logo />
              <form onSubmit={handleLoginEmailNext}>
                <label className="lbl" htmlFor="l-em">Email</label>
                <input id="l-em" className="inp" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email" autoFocus disabled={loading} placeholder="you@example.com" />
                {error && <div className="err">{error}</div>}
                <button className="btn-cta" type="submit">Next</button>
                <button className="btn-dark" type="button" onClick={() => go('home')}>Go back</button>
              </form>
              <p className="toggle" style={{ marginTop: '1.25rem' }}>
                Don't have an account?{' '}
                <button className="toggle-btn" onClick={() => go('signup')}>Sign up</button>
              </p>
            </div>
          )}

          {/* ══ LOGIN: Password step ══ */}
          {screen === 'login-password' && (
            <div className="fade" key="login-password">
              <Logo />
              <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.38)', marginBottom: '1.5rem', fontWeight: 300 }}>
                {email}
              </p>
              <form onSubmit={handleSignIn}>
                <label className="lbl" htmlFor="l-pw">Password</label>
                <div className="field">
                  <input id="l-pw" className="inp pr"
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" autoFocus disabled={loading} placeholder="Your password" />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                    {showPass ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>
                <div className="forgot-row">
                  <button type="button" className="link-sm" onClick={() => go('forgot')}>Forgot password?</button>
                </div>
                {error && <div className="err">{error}</div>}
                <button className="btn-cta" type="submit" disabled={loading || !password}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <button className="btn-dark" type="button" onClick={() => go('login-email')}>Go back</button>
              </form>
            </div>
          )}

          {/* ══ SIGNUP: Email + Password form ══ */}
          {screen === 'signup-email' && (
            <div className="fade" key="signup-email">
              <Logo />
              <form onSubmit={handleSignUp}>
                <label className="lbl" htmlFor="su-em">Email</label>
                <input id="su-em" className="inp" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email" disabled={loading} autoFocus placeholder="you@example.com" />

                <label className="lbl" htmlFor="su-pw">Password</label>
                <div className="field">
                  <input id="su-pw" className="inp pr"
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters" autoComplete="new-password" disabled={loading} />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                    {showPass ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>

                <label className="lbl" htmlFor="su-cf">Confirm password</label>
                <input id="su-cf" className="inp"
                  type={showPass ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password" disabled={loading} placeholder="Re-enter password" />

                {error && <div className="err">{error}</div>}
                <button className="btn-cta" type="submit" disabled={loading || !email.trim() || !password}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
                <button className="btn-dark" type="button" onClick={() => go('signup')}>Go back</button>
              </form>
              <p className="toggle" style={{ marginTop: '1.25rem' }}>
                Already have an account?{' '}
                <button className="toggle-btn" onClick={() => go('home')}>Sign in</button>
              </p>
            </div>
          )}

          {/* ══ VERIFY EMAIL — shown after signup when confirmation is required ══ */}
          {screen === 'verify' && (
            <div className="fade" key="verify" style={{ textAlign: 'center' }}>
              <Logo />
              <EnvelopeIcon />
              <p style={{ fontSize: '1.1rem', color: '#F0EDE8', fontWeight: 400, marginBottom: '0.5rem' }}>
                Check your inbox
              </p>
              <p style={{ fontSize: '13.5px', color: 'rgba(240,237,232,0.4)', marginBottom: '0.3rem', fontWeight: 300 }}>
                We sent a confirmation link to
              </p>
              <p style={{ fontSize: '14px', color: '#F0EDE8', fontWeight: 500, marginBottom: '1.5rem', wordBreak: 'break-all' }}>
                {email}
              </p>
              <div className="info-box">
                Click the link in that email to activate your account.
                Once confirmed you'll be taken straight back into Forcapedia.
                <br /><br />
                Can't find it? Check your <strong>spam</strong> or <strong>promotions</strong> folder.
              </div>
              <button className="btn-dark" style={{ width: 'auto', padding: '11px 28px', margin: '0 auto' }}
                onClick={() => go('home')}>
                Back to sign in
              </button>
            </div>
          )}

          {/* ══ FORGOT PASSWORD ══ */}
          {screen === 'forgot' && (
            <div className="fade" key="forgot">
              <Logo />
              <p style={{ fontSize: '13.5px', color: 'rgba(240,237,232,0.4)', marginBottom: '1.5rem', fontWeight: 300, lineHeight: 1.55 }}>
                Enter your email and we'll send a 6-digit code.
              </p>
              <form onSubmit={handleForgot}>
                <label className="lbl" htmlFor="fp-rs">Email</label>
                <input id="fp-rs" className="inp" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" disabled={loading} autoFocus />
                {error && <div className="err">{error}</div>}
                <button className="btn-cta" type="submit" disabled={loading || !email.trim()}>
                  {loading ? (slowSend ? 'Still sending…' : 'Sending…') : 'Send code'}
                </button>
                <button className="btn-dark" type="button" onClick={() => go('login-password')}>Go back</button>
              </form>
            </div>
          )}

          {/* ══ OTP ENTRY ══ */}
          {screen === 'otp' && (
            <div className="fade" key="otp" style={{ textAlign: 'center' }}>
              <Logo />
              <p style={{ fontSize: '13.5px', color: 'rgba(240,237,232,0.4)', marginBottom: '0.3rem', fontWeight: 300 }}>
                We sent a 6-digit code to
              </p>
              <p style={{ fontSize: '14px', color: '#F0EDE8', fontWeight: 500, marginBottom: '1.75rem', wordBreak: 'break-all' }}>
                {email}
              </p>
              <form onSubmit={handleVerifyOtp}>
                <div className="otp-row" onPaste={handleOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      className={`otp-box${d ? ' filled' : ''}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={d}
                      autoFocus={i === 0}
                      disabled={loading}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                    />
                  ))}
                </div>
                {error && <div className="err" style={{ textAlign: 'left' }}>{error}</div>}
                <button className="btn-cta" type="submit" disabled={loading || otpDigits.join('').length < 6}>
                  {loading ? 'Verifying…' : 'Verify code'}
                </button>
              </form>
              <p style={{ fontSize: '13px', color: 'rgba(240,237,232,0.35)', marginTop: '1rem' }}>
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : <button className="link-sm" onClick={handleResendOtp}>Resend code</button>
                }
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                <button className="link-sm" onClick={() => go(otpType === 'signup' ? 'signup-email' : 'forgot')}>
                  Use a different email
                </button>
              </p>
            </div>
          )}

          {/* ══ RESET PASSWORD (after OTP verified) ══ */}
          {screen === 'reset-password' && (
            <div className="fade" key="reset-password">
              <Logo />
              <p style={{ fontSize: '13.5px', color: 'rgba(240,237,232,0.4)', marginBottom: '1.5rem', fontWeight: 300, lineHeight: 1.55 }}>
                Choose a new password for your account.
              </p>
              <form onSubmit={handleSetPassword}>
                <label className="lbl" htmlFor="rp-pw">New password</label>
                <div className="field">
                  <input id="rp-pw" className="inp pr"
                    type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password" autoFocus disabled={loading} placeholder="Min 6 characters" />
                  <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                    {showPass ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>
                <label className="lbl" htmlFor="rp-cf">Confirm password</label>
                <input id="rp-cf" className="inp"
                  type={showPass ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password" disabled={loading} placeholder="Re-enter password" />
                {error && <div className="err">{error}</div>}
                <button className="btn-cta" type="submit" disabled={loading || !password || !confirm}>
                  {loading ? 'Updating…' : 'Set new password'}
                </button>
              </form>
            </div>
          )}

          {/* ══ RESET LINK SENT ══ */}
          {screen === 'sent' && (
            <div className="fade" key="sent" style={{ textAlign: 'center' }}>
              <Logo />
              <EnvelopeIcon />
              <p style={{ fontSize: '1.1rem', color: '#F0EDE8', fontWeight: 400, marginBottom: '0.5rem' }}>Check your inbox</p>
              <p style={{ fontSize: '13.5px', color: 'rgba(240,237,232,0.4)', marginBottom: '0.3rem', fontWeight: 300 }}>
                We sent a password reset link to
              </p>
              <p style={{ fontSize: '14px', color: '#F0EDE8', fontWeight: 500, marginBottom: '1.5rem', wordBreak: 'break-all' }}>
                {email}
              </p>
              <div className="info-box">
                The link expires in 1 hour. If you don't see it, check your{' '}
                <strong>spam</strong> or <strong>promotions</strong> folder.{' '}
                <button className="link-sm" style={{ textDecoration: 'underline', fontSize: '12.5px' }}
                  onClick={() => go('forgot')}>
                  Try again
                </button>
              </div>
              <button className="btn-dark" style={{ width: 'auto', padding: '11px 28px', margin: '0 auto' }}
                onClick={() => go('home')}>
                Back to sign in
              </button>
            </div>
          )}

        </div>
      </div>

      <div className="footer">
        By continuing, you agree to Forcapedia's{' '}
        <Link href="/terms">Terms of Service</Link>
        {' '}and{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
