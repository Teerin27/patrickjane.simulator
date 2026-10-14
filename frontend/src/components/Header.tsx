import Sprite from './Sprite'
import type { Scene } from '../types'

const TABS: { id: Scene; short: string; long: string }[] = [
  { id: 'files', short: 'FILES', long: 'FILES' },
  { id: 'room', short: 'ROOM', long: 'INTERROGATION' },
]

// @container: the header trims itself (title, case number, clock) to the width it is given
export default function Header({
  title,
  caseNumber,
  clock,
  scene,
  onScene,
  onAccuse,
  accuseDisabled = false,
  onMenu,
}: {
  title: string
  caseNumber: string
  clock: string
  scene: Scene
  onScene: (s: Scene) => void
  onAccuse: () => void
  accuseDisabled?: boolean
  onMenu: () => void
}) {
  return (
    <header className="@container flex h-[22px] shrink-0 items-center justify-between gap-[6px] px-[6px]">
      <div className="hidden min-w-0 items-center gap-[5px] @min-[320px]:flex">
        <Sprite name="magnifier" />
        <h1 className="h text-brass-400">{title}</h1>
        <span className="label hidden text-paper-300 @min-[480px]:inline">{caseNumber}</span>
      </div>

      <nav aria-label="Scene" className="flex gap-[2px]">
        {TABS.map((t) => (
          <button key={t.id} className={`btn label h-[13px] !px-[4px] !text-center ${scene === t.id ? 'on' : ''}`} aria-pressed={scene === t.id} title={t.long} onClick={() => onScene(t.id)}>
            <span className="@min-[380px]:hidden">{t.short}</span>
            <span className="hidden @min-[380px]:inline">{t.long}</span>
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-[5px]">
        <span className="label hidden text-paper-100 @min-[420px]:inline">{clock}</span>
        <button className="btn h-[13px] w-[30px] !pl-[3px] !text-center" onClick={onMenu}>
          MENU
        </button>
        <button className="btn crimson h-[13px] w-[52px] !pl-[3px] !text-center" disabled={accuseDisabled} onClick={onAccuse}>
          ACCUSE!
        </button>
      </div>
    </header>
  )
}
