import Portrait from './Portrait'
import type { Suspect, Who } from '../types'

export default function SuspectList({ suspects, active, left, onSelect }: { suspects: Suspect[]; active: Who; left: Record<Who, number>; onSelect: (id: Who) => void }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {suspects.map((x) => {
        const on = x.id === active
        return (
          <button key={x.id} onClick={() => onSelect(x.id)} aria-pressed={on} className={`btn flex h-[36px] items-center gap-[2px] !p-0 ${on ? 'on' : ''}`}>
            <Portrait who={x.id} mood="calm" size={32} animate={false} />
            <span className="block">
              <span className="label block">{x.short}</span>
              <span className="label block text-[#8A6E4B]">{x.role}</span>
              <span className={`label block ${left[x.id] <= 3 ? 'text-[#C8323C]' : ''}`}>Q {String(left[x.id]).padStart(2, '0')}/10</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
