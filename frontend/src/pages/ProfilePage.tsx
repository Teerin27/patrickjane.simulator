import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'
import ConfirmModal from '../components/ConfirmModal'
import Field from '../components/Field'
import PageFrame from '../components/PageFrame'
import { usePixelScreen } from '../components/PixelScreen'
import Sprite from '../components/Sprite'
import { placeholderStats } from '../data/placeholderStats'
import { useAuth } from '../hooks/useAuth'
import { toFormErrors, type FormErrors } from '../lib/api'
import type { Account } from '../types'

const NO_ERRORS: FormErrors = { fields: {} }

export default function ProfilePage() {
  return (
    <PageFrame>
      <ProfileContent />
    </PageFrame>
  )
}

function ProfileContent() {
  const { auth, logout, deleteAccount, retry } = useAuth()
  const navigate = useNavigate()
  const { wide } = usePixelScreen()
  // Set before logging out or deleting, so the signed-out redirect below goes to the menu
  // instead of the login screen (which is where a dead token should send the player).
  const leaving = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  if (auth.status === 'loading') return <Card title="Detective file">LOADING...</Card>
  if (auth.status === 'offline') {
    return (
      <Card title="Server offline">
        <p className="leading-[7px]">Your sign-in is saved, but the server is not answering.</p>
        <button type="button" className="btn amber label h-[13px] !text-center" onClick={retry}>
          TRY AGAIN
        </button>
      </Card>
    )
  }
  if (auth.status === 'out') return leaving.current ? <Navigate to="/" replace /> : <Navigate to="/login" state={{ from: '/profile' }} replace />

  const player = auth.player

  const doLogout = async () => {
    leaving.current = true
    await logout()
    navigate('/', { replace: true })
  }

  const doDelete = async () => {
    setDeleting(true)
    setDeleteError(undefined)
    leaving.current = true
    try {
      await deleteAccount()
    } catch (err) {
      leaving.current = false
      setDeleteError(toFormErrors(err).form ?? 'Could not delete the account')
      setDeleting(false)
    }
  }

  return (
    <>
      <div className={`my-auto grid w-full max-w-[420px] gap-[6px] self-center ${wide ? 'grid-cols-2 items-start' : 'grid-cols-1'}`}>
        <div className="flex flex-col gap-[6px]">
          <Dossier player={player} />
          {/* key: start the form over if the account underneath changes */}
          <AccountForm key={player.id} player={player} />
        </div>
        <div className="flex flex-col gap-[6px]">
          <PasswordForm />
          <Card title="Session">
            <button type="button" className="btn dark label h-[13px] !text-center" onClick={doLogout}>
              LOG OUT
            </button>
          </Card>
          <Card title="Danger zone" danger>
            <p className="leading-[7px]">Deleting your account removes it for good.</p>
            <button
              type="button"
              className="btn crimson label h-[13px] !text-center"
              onClick={() => {
                setDeleteError(undefined)
                setConfirmDelete(true)
              }}
            >
              DELETE ACCOUNT
            </button>
          </Card>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal title="Delete account?" confirmLabel="DELETE FOREVER" busy={deleting} error={deleteError} onConfirm={doDelete} onCancel={() => setConfirmDelete(false)}>
          <p>
            This permanently deletes <span className="text-blood-800">{player.username}</span> and signs you out everywhere. It cannot be undone.
          </p>
        </ConfirmModal>
      )}
    </>
  )
}

function Card({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section className="panel flex w-full flex-col gap-[3px] p-[3px]">
      <h2 className={`h ${danger ? 'text-blood-800' : 'text-night-800'}`}>{title}</h2>
      {children}
    </section>
  )
}

// Who you are. Name and join date come from the account; rank and solved cases are placeholders.
function Dossier({ player }: { player: Account }) {
  const since = new Date(player.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <section className="panel flex w-full flex-col gap-[3px] p-[3px]">
      <div className="flex items-center gap-[4px]">
        <span className="grid size-[24px] shrink-0 place-items-center bg-night-900 outline outline-1 outline-ink">
          <Sprite name="detective" />
        </span>
        <div className="flex min-w-0 flex-col gap-[2px]">
          <h1 className="h truncate text-blood-800">{player.username}</h1>
          <span className="label text-night-800">Member since {since}</span>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-[4px] gap-y-[1px]">
        <dt className="label text-night-800">Rank</dt>
        <dd className="flex items-center gap-[3px]">
          <span className="label">{placeholderStats.rank}</span>
          <Placeholder />
        </dd>
        <dt className="label text-night-800">Cases solved</dt>
        <dd className="flex items-center gap-[3px]">
          <span className="label">{placeholderStats.casesSolved}</span>
          <Placeholder />
        </dd>
      </dl>
    </section>
  )
}

// (DUMMY) marks values the backend does not track yet
function Placeholder() {
  return (
    <span className="label border border-blood-500 px-[1px] text-blood-800" title="Not tracked by the server yet">
      PLACEHOLDER
    </span>
  )
}

function AccountForm({ player }: { player: Account }) {
  const { updateAccount } = useAuth()
  const [username, setUsername] = useState(player.username)
  const [email, setEmail] = useState(player.email)
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // The server stores both lowercase and trimmed; compare the same way so "Bob " is not a change
  const patch = {
    ...(username.trim().toLowerCase() !== player.username && { username }),
    ...(email.trim().toLowerCase() !== player.email && { email }),
  }
  const dirty = Object.keys(patch).length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !dirty) return
    setBusy(true)
    setSaved(false)
    setErrors(NO_ERRORS)
    try {
      const next = await updateAccount(patch)
      setUsername(next.username)
      setEmail(next.email)
      setSaved(true)
    } catch (err) {
      setErrors(toFormErrors(err, { USERNAME_TAKEN: 'username', EMAIL_TAKEN: 'email' }))
    } finally {
      setBusy(false)
    }
  }

  const edit = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value)
    setSaved(false)
  }

  return (
    <Card title="Account">
      <form onSubmit={submit} className="flex flex-col gap-[3px]" noValidate>
        <Field label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} value={username} onChange={edit(setUsername)} error={errors.fields.username} hint="3-20 letters, digits or _" disabled={busy} />
        <Field label="Email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={edit(setEmail)} error={errors.fields.email} disabled={busy} />
        {errors.form && (
          <p role="alert" className="text-blood-800">
            {errors.form}
          </p>
        )}
        {saved && (
          <p role="status" className="text-truth-700">
            SAVED.
          </p>
        )}
        <button type="submit" className="btn amber label h-[13px] !text-center" disabled={busy || !dirty}>
          {busy ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </form>
    </Card>
  )
}

function PasswordForm() {
  const { updateAccount } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setSaved(false)
    if (next !== confirm) return setErrors({ fields: { confirm: 'Passwords do not match' } })
    setErrors(NO_ERRORS)
    setBusy(true)
    try {
      await updateAccount({ password: next, currentPassword: current })
      setCurrent('')
      setNext('')
      setConfirm('')
      setSaved(true)
    } catch (err) {
      // the server names the new password "password" and the old one "currentPassword"
      setErrors(toFormErrors(err, { WRONG_PASSWORD: 'currentPassword' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="flex flex-col gap-[3px]" noValidate>
        <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" maxLength={128} value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.fields.currentPassword} disabled={busy} />
        <Field label="New password" name="password" type="password" autoComplete="new-password" maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} error={errors.fields.password} hint="At least 8 characters" disabled={busy} />
        <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.fields.confirm} disabled={busy} />
        {errors.form && (
          <p role="alert" className="text-blood-800">
            {errors.form}
          </p>
        )}
        {saved && (
          <p role="status" className="text-truth-700">
            PASSWORD CHANGED. OTHER DEVICES ARE SIGNED OUT.
          </p>
        )}
        <button type="submit" className="btn amber label h-[13px] !text-center" disabled={busy || !current || !next || !confirm}>
          {busy ? 'SAVING...' : 'CHANGE PASSWORD'}
        </button>
      </form>
    </Card>
  )
}
