import Sprite from './Sprite'
import type { Evidence } from '../types'

export default function EvidencePanel({
  evidence,
  selected,
  used,
  surname,
  disabled,
  onToggle,
  onPresent,
}: {
  evidence: Evidence[]
  selected: Evidence | undefined
  used: string[]
  surname: string
  disabled: boolean
  onToggle: (id: string) => void
  onPresent: () => void
}) {
  return (
    <aside className="panel flex h-full w-[84px] shrink-0 flex-col gap-[3px]">
      <h2 className="h">Evidence</h2>
      <div className="grid grid-cols-2 gap-[2px]">
        {evidence.map((e) => {
          const on = selected?.id === e.id
          return (
            <button key={e.id} onClick={() => onToggle(e.id)} aria-pressed={on} className={`btn flex h-[32px] flex-col items-center justify-center !p-0 ${on ? 'on' : ''}`}>
              <Sprite name={e.sprite} />
              <span className="label">{used.includes(e.id) ? 'DONE' : e.tag}</span>
            </button>
          )
        })}
      </div>
      <div className="min-h-0 flex-1 border border-[#1A1414] bg-[#F4ECD8] p-[2px]">
        {selected ? (
          <>
            <div className="label text-[#7A1E2A]">{selected.name}</div>
            <p>{selected.note}</p>
          </>
        ) : (
          <p className="text-[#8A6E4B]">Select an exhibit, then present it to {surname}.</p>
        )}
      </div>
      <button className="btn crimson label h-[15px] !text-center" disabled={!selected || disabled} onClick={onPresent}>
        Present!
      </button>
      <div className="label flex justify-between text-[8px]">
        <span className="flex items-center gap-[2px] text-[#7A1E2A]">
          <i className="pip !bg-[#C8323C]" />
          Contra
        </span>
        <span className="flex items-center gap-[2px] text-[#2D6466]">
          <i className="pip !bg-[#4FA3A0]" />
          Truth
        </span>
      </div>
    </aside>
  )
}
