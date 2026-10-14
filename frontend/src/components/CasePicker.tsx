import { Link } from 'react-router'
import type { CaseSummary } from '../types'
import Portrait from './Portrait'

// "The Blue Lantern jazz club, 1947. Club owner ... was found shot." -> just the first sentence, kept short
const teaser = (briefing: string) => {
  const first = briefing.split(/(?<=[.!?])\s/)[0] ?? briefing
  return first.length > 96 ? `${first.slice(0, 93).trimEnd()}...` : first
}

/** Shown when the server has more than one case: pick which file to open. Cases come in order: Case 1, 2, 3... */
export default function CasePicker({ cases, onChoose }: { cases: CaseSummary[]; onChoose: (id: string) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[6px] p-[8px]">
      <header className="shrink-0">
        <Link to="/" className="btn dark inline-flex h-[20px] items-center !px-[5px]">
          <span className="h">&lt; Menu</span>
        </Link>
      </header>
      <main className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex w-full max-w-[236px] flex-col gap-[4px] self-center">
          <h1 className="h text-brass-400">Open a case file</h1>
          {cases.map((c) => (
            <button key={c.id} className="btn amber flex flex-col items-stretch gap-[3px] !p-[4px] text-left" onClick={() => onChoose(c.id)}>
              <span className="flex items-baseline justify-between gap-[4px]">
                <span className="label text-blood-800">{c.number.toUpperCase()}</span>
                <span aria-hidden className="h text-blood-800">
                  &gt;
                </span>
              </span>
              <span className="h truncate">{c.title}</span>
              <span className="label line-clamp-2 text-night-800">{teaser(c.briefing)}</span>
              <span className="flex gap-[4px]">
                {c.suspects.map((s) => (
                  <span key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-[1px]">
                    <Portrait who={s.id} look={s.look} mood="calm" size={32} animate={false} />
                    <span className="label w-full truncate text-center">{s.short}</span>
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
