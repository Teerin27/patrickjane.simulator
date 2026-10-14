import type { ReactNode } from 'react'
import { Link } from 'react-router'
import Sprite from './Sprite'
import { placeholderStats } from '../data/placeholderStats'
import { useAuth } from '../hooks/useAuth'

const CARD = 'btn dark flex min-w-0 items-center gap-[4px] !p-[2px]'

// Top-left of the main menu: who is playing, and the way into the profile page (or the login screen).
// The name is the real signed-in player. (DUMMY) rank and solved count come from data/placeholderStats.ts.
export default function UserProfileCard() {
  const { auth, retry } = useAuth()

  switch (auth.status) {
    case 'in':
      return (
        <Link to="/profile" className={CARD} aria-label={`Open profile: ${auth.player.username}`}>
          <Avatar />
          <Lines top={auth.player.username}>
            {placeholderStats.rank} · {placeholderStats.casesSolved} SOLVED
          </Lines>
        </Link>
      )
    case 'out':
      return (
        <Link to="/login" className={CARD} aria-label="Sign in or register">
          <Avatar />
          <Lines top="Sign in">or register</Lines>
        </Link>
      )
    case 'offline':
      return (
        <button type="button" className={CARD} onClick={retry} aria-label="Server offline, try again">
          <Avatar />
          <Lines top="Offline">tap to retry</Lines>
        </button>
      )
    default:
      return (
        <div className={`${CARD} !cursor-default`} aria-busy="true">
          <Avatar />
          <Lines top="...">checking file</Lines>
        </div>
      )
  }
}

const Avatar = () => (
  <span className="grid size-[18px] shrink-0 place-items-center bg-night-800 outline outline-1 outline-ink">
    <Sprite name="detective" />
  </span>
)

const Lines = ({ top, children }: { top: string; children: ReactNode }) => (
  <span className="flex min-w-0 flex-col gap-[2px] pr-[2px]">
    <span className="h truncate">{top}</span>
    <span className="label text-brass-400">{children}</span>
  </span>
)
