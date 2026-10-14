import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import Field from '../components/Field'
import PageFrame from '../components/PageFrame'
import { useAuth } from '../hooks/useAuth'
import { toFormErrors, type FormErrors } from '../lib/api'

type Mode = 'signin' | 'register'
const TABS: { id: Mode; label: string }[] = [
  { id: 'signin', label: 'SIGN IN' },
  { id: 'register', label: 'REGISTER' },
]

const NO_ERRORS: FormErrors = { fields: {} }

export default function LoginPage() {
  return (
    <PageFrame>
      <LoginPanel />
    </PageFrame>
  )
}

function LoginPanel() {
  const { auth, login, register } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)

  // Already signed in (or just became so): go back to where the player came from
  if (auth.status === 'in') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />
  if (auth.status === 'loading') return <Notice>CHECKING YOUR FILE...</Notice>

  const registering = mode === 'register'

  const switchMode = (next: Mode) => {
    setMode(next)
    setErrors(NO_ERRORS)
    setPassword('')
    setConfirm('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (registering && password !== confirm) return setErrors({ fields: { confirm: 'Passwords do not match' } })
    setErrors(NO_ERRORS)
    setBusy(true)
    try {
      if (registering) await register(username, email, password)
      else await login(username, password)
    } catch (err) {
      setErrors(toFormErrors(err, { USERNAME_TAKEN: 'username', EMAIL_TAKEN: 'email' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel my-auto flex w-full max-w-[200px] flex-col gap-[4px] self-center p-[3px]">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-x-[2px]">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={mode === t.id} className={`btn label h-[13px] !text-center ${mode === t.id ? 'on' : ''}`} onClick={() => switchMode(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <h1 className="h text-blood-800">{registering ? 'New detective' : 'Welcome back'}</h1>
      <p className="leading-[7px]">{registering ? 'Open a detective file. Your account keeps it safe.' : 'Sign in to pick up where you left off.'}</p>

      <form onSubmit={submit} className="flex flex-col gap-[3px]" noValidate>
        <Field
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          maxLength={64}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors.fields.username}
          hint={registering ? '3-20 letters, digits or _' : undefined}
          disabled={busy}
        />
        {registering && <Field label="Email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.fields.email} disabled={busy} />}
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.fields.password}
          hint={registering ? 'At least 8 characters' : undefined}
          disabled={busy}
        />
        {registering && <Field label="Repeat password" name="confirm" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.fields.confirm} disabled={busy} />}

        {errors.form && (
          <p role="alert" className="text-blood-800">
            {errors.form}
          </p>
        )}
        <button type="submit" className="btn amber label h-[13px] !text-center" disabled={busy || !username || !password}>
          {busy ? 'PLEASE WAIT...' : registering ? 'CREATE ACCOUNT' : 'SIGN IN'}
        </button>
      </form>
    </section>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <section className="panel my-auto w-full max-w-[200px] self-center p-[3px]">
      <p className="h text-night-800">{children}</p>
    </section>
  )
}
