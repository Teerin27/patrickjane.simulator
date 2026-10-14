import { Link } from 'react-router'
import Sprite from './Sprite'

type Mode = { id: string; to: string; title: string; blurb: string; sprite: string; primary?: boolean }

// Single player goes to /play, which loads the case list from the API: it resumes the saved investigation,
// opens the only case straight away, or shows a case picker when the server has several.
// (MOCK) /multiplayer is a placeholder page.
const MODES: Mode[] = [
  { id: 'single', to: '/play', title: 'Single player', blurb: 'Crack the case alone', sprite: 'magnifier', primary: true },
  { id: 'multi', to: '/multiplayer', title: 'Multiplayer', blurb: 'Coming soon', sprite: 'duo' },
]

export default function PlayModeSelect() {
  return (
    <nav aria-label="Play mode" className="flex w-full max-w-[200px] flex-col gap-[4px]">
      {MODES.map((m) => (
        <Link key={m.id} to={m.to} className={`btn group flex items-center gap-[5px] !p-[3px] ${m.primary ? 'amber' : ''}`}>
          <span className="grid size-[20px] shrink-0 place-items-center bg-night-900 outline outline-1 outline-ink">
            <Sprite name={m.sprite} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="h">{m.title}</span>
            <span className="label text-night-800">{m.blurb}</span>
          </span>
          <span aria-hidden className="h text-blood-800 group-hover:text-ink">
            &gt;
          </span>
        </Link>
      ))}
    </nav>
  )
}
