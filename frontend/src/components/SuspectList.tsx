import { MAX_Q } from '../lib/rules'
import Portrait from './Portrait'
import type { Suspect, Who } from '../types'

// row: three folders side by side (narrow screens) instead of a stack
export default function SuspectList({ suspects, active, left, onSelect, row = false }: { suspects: Suspect[]; active: Who; left: Record<Who, number>; onSelect: (id: Who) => void; row?: boolean }) {
  return (
    <div className={`flex gap-[2px] ${row ? 'flex-row' : 'flex-col'}`}>
      {suspects.map((x) => {
        const on = x.id === active
        return (
          <button
            key={x.id}
            onClick={() => onSelect(x.id)}
            aria-pressed={on}
            className={`btn flex items-center !p-0 ${row ? 'min-w-0 flex-1 flex-col gap-[1px] pb-[1px]' : 'h-[36px] gap-[2px]'} ${on ? 'on' : ''}`}
          >
            <Portrait who={x.id} look={x.look} mood="calm" size={32} animate={false} />
            <span className={`block ${row ? 'text-center' : ''}`}>
              <span className="label block">{x.short}</span>
              <span className="label block text-[#8A6E4B]">{x.role}</span>
              <span className={`label block ${left[x.id] <= 3 ? 'text-[#C8323C]' : ''}`}>Q {String(left[x.id]).padStart(2, '0')}/{MAX_Q}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
