import Sprite from './Sprite'
import { exhibitSprite } from '../lib/pixel'
import type { Evidence } from '../types'

// onPresent set: interrogation mode (select an exhibit, then present it to the suspect).
// onPresent omitted: locker mode for the case files (select an exhibit to read its note).
// cols: exhibits per row; 4 packs them into one row for short panels.
// shown: ids of the exhibits this suspect has already been shown (from the server). Showing one again is allowed:
// it only does something once the suspect has committed to the statement it contradicts.
export default function EvidencePanel({
  evidence,
  selected,
  shown,
  surname,
  disabled = false,
  cols = 2,
  className = '',
  onToggle,
  onPresent,
}: {
  evidence: Evidence[]
  selected: Evidence | undefined
  shown: string[]
  surname: string
  disabled?: boolean
  cols?: 2 | 4
  className?: string
  onToggle: (id: string) => void
  onPresent?: () => void
}) {
  return (
    <aside className={`panel flex min-h-0 flex-col gap-[3px] ${className}`}>
      <h2 className="h">{onPresent ? 'Evidence' : 'Locker'}</h2>
      <div className={`grid gap-[2px] ${cols === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {evidence.map((e) => {
          const on = selected?.id === e.id
          return (
            <button key={e.id} onClick={() => onToggle(e.id)} aria-pressed={on} className={`btn flex h-[32px] min-w-0 flex-col items-center justify-center !p-0 ${on ? 'on' : ''}`}>
              <Sprite name={exhibitSprite(e.sprite, e.name)} />
              <span className="label">{shown.includes(e.id) ? 'SHOWN' : e.tag}</span>
            </button>
          )
        })}
      </div>
      <div className="scroll min-h-[24px] flex-1 overflow-y-auto border border-[#1A1414] bg-[#F4ECD8] p-[2px]">
        {selected ? (
          <>
            <div className="label text-[#7A1E2A]">{selected.name}</div>
            <p>{selected.note}</p>
            {shown.includes(selected.id) && <p className="text-blood-800">Already shown to {surname}.</p>}
          </>
        ) : (
          <p className="text-[#8A6E4B]">{onPresent ? `Select an exhibit, then present it to ${surname}.` : 'Select an exhibit to read its note.'}</p>
        )}
      </div>
      {onPresent && (
        <>
          <button className="btn crimson label h-[15px] shrink-0 !text-center" disabled={!selected || disabled} onClick={onPresent}>
            Present!
          </button>
          <div className="label flex shrink-0 justify-between text-[8px]">
            <span className="flex items-center gap-[2px] text-[#7A1E2A]">
              <i className="pip !bg-[#C8323C]" />
              Contra
            </span>
            <span className="flex items-center gap-[2px] text-[#2D6466]">
              <i className="pip !bg-[#4FA3A0]" />
              Truth
            </span>
          </div>
        </>
      )}
    </aside>
  )
}
