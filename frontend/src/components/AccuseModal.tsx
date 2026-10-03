import type { AccuseState, Suspect, Who } from '../types'

export default function AccuseModal({
  state,
  suspects,
  culprit,
  verdict,
  onChange,
}: {
  state: Exclude<AccuseState, 'closed'>
  suspects: Suspect[]
  culprit: Who
  verdict: { correct: string; wrong: string }
  onChange: (s: AccuseState) => void
}) {
  const right = state === culprit
  return (
    <div className="dither absolute inset-0 z-10 grid place-items-center">
      <div className="panel w-[170px]">
        {state === 'pick' ? (
          <div className="flex flex-col gap-[3px]">
            <h2 className="h text-[#7A1E2A]">Who did it?</h2>
            <p>Name the killer. You only get one shot.</p>
            {suspects.map((x) => (
              <button key={x.id} className="btn amber label h-[11px]" onClick={() => onChange(x.id)}>
                {x.short}
              </button>
            ))}
            <button className="btn label h-[11px] !text-center" onClick={() => onChange('closed')}>
              BACK TO THE CASE
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
            <h2 className={`h ${right ? 'text-[#2D6466]' : 'text-[#C8323C]'}`}>{right ? 'Case closed' : 'Wrong man'}</h2>
            <p>{right ? verdict.correct : verdict.wrong}</p>
            <button className="btn teal label h-[11px] !text-center" onClick={() => onChange('closed')}>
              CONTINUE
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
