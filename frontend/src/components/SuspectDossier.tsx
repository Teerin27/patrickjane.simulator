import type { ReactNode } from 'react'
import Portrait from './Portrait'
import QuestionCounter from './QuestionCounter'
import type { Mood, Suspect } from '../types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="label mb-[1px] border-b border-paper-300 text-paper-400">{title}</h3>
      {children}
    </section>
  )
}

function Personal({ suspect }: { suspect: Suspect }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-[3px]">
      <dt className="label text-paper-400">Lives</dt>
      <dd>{suspect.address}</dd>
      <dt className="label text-paper-400">Tie</dt>
      <dd>{suspect.tie}</dd>
    </dl>
  )
}

// What the suspect says they were doing, hour by hour
function Whereabouts({ suspect }: { suspect: Suspect }) {
  return (
    <ol className="flex flex-col gap-[1px]">
      {suspect.whereabouts.map((w) => (
        <li key={w.time} className="flex gap-[3px]">
          <span className="label w-[34px] shrink-0 text-blood-800">{w.time}</span>
          <span>{w.place}</span>
        </li>
      ))}
    </ol>
  )
}

const MoodTag = ({ mood }: { mood: Mood }) => (
  <div className="label mt-[2px] text-paper-400">
    Mood: <span className={mood === 'calm' ? 'text-ink' : 'text-blood-500'}>{mood}</span>
  </div>
)

/**
 * A suspect's police file: personal details, where they say they were, and their statement.
 * file: the full page for the case-files scene (big: double-size portrait). compact: the scrolling
 * summary beside the chat.
 */
export default function SuspectDossier({ suspect, mood, left, variant, big = false, onInterrogate }: { suspect: Suspect; mood: Mood; left: number; variant: 'file' | 'compact'; big?: boolean; onInterrogate?: () => void }) {
  if (variant === 'compact')
    return (
      <div className="scroll flex h-full min-h-0 flex-col gap-[3px] overflow-y-auto">
        <div>
          <h2 className="h text-blood-800">{suspect.fullName}</h2>
          <div className="label">
            {suspect.role} · age {suspect.age}
          </div>
          <QuestionCounter left={left} />
          <MoodTag mood={mood} />
        </div>
        <Section title="Personal">
          <Personal suspect={suspect} />
        </Section>
        <Section title="Whereabouts">
          <Whereabouts suspect={suspect} />
        </Section>
        <Section title="Statement">
          <p>&ldquo;{suspect.alibi}&rdquo;</p>
        </Section>
      </div>
    )

  return (
    <article className="panel flex min-h-0 flex-col gap-[3px]">
      <div className="flex shrink-0 gap-[4px]">
        <div className="shrink-0 self-start outline outline-1 outline-ink">
          <Portrait who={suspect.id} look={suspect.look} mood={mood} size={big ? 128 : 64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="label mb-[2px] text-paper-400">Police file</div>
          <h2 className="h mb-[2px] text-blood-800">{suspect.fullName}</h2>
          <div className="label mb-[2px]">
            {suspect.role} · age {suspect.age}
          </div>
          <Personal suspect={suspect} />
        </div>
      </div>
      <div className="scroll flex min-h-0 flex-col gap-[3px] overflow-y-auto">
        <Section title="Whereabouts, as stated">
          <Whereabouts suspect={suspect} />
        </Section>
        <Section title="Statement">
          <p>&ldquo;{suspect.alibi}&rdquo;</p>
        </Section>
      </div>
      <footer className="flex shrink-0 items-end justify-between gap-[4px]">
        <div>
          <QuestionCounter left={left} />
          <MoodTag mood={mood} />
        </div>
        {onInterrogate && (
          <button className="btn amber label h-[15px] shrink-0 !px-[5px] !text-center" onClick={onInterrogate}>
            Interrogate &gt;
          </button>
        )}
      </footer>
    </article>
  )
}
