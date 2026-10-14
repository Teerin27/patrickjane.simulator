import { useState } from 'react'
import { explainError } from '../hooks/useInterrogation'
import type { Suspect, Verdict, Who } from '../types'
import Stamp from './Stamp'

type View = { step: 'pick' } | { step: 'sending'; name: string } | { step: 'done'; verdict: Verdict } | { step: 'error'; message: string }

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-[2px]" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="pip !h-[7px] !w-[7px]" style={i < count ? { background: '#F2B33D' } : undefined} />
      ))}
    </div>
  )
}

/**
 * Name the killer. The server decides whether that is right and sends the verdict text with it;
 * nothing about the culprit is known here until it answers.
 */
export default function AccuseModal({
  suspects,
  onAccuse,
  onClose,
  onNewCase,
}: {
  suspects: Suspect[]
  onAccuse: (id: Who) => Promise<Verdict>
  /** Close the modal and keep looking around the finished case. */
  onClose: () => void
  onNewCase: () => void
}) {
  const [view, setView] = useState<View>({ step: 'pick' })

  const accuse = async (s: Suspect) => {
    setView({ step: 'sending', name: s.fullName })
    try {
      setView({ step: 'done', verdict: await onAccuse(s.id) })
    } catch (err) {
      setView({ step: 'error', message: explainError(err) })
    }
  }

  return (
    <div className="dither absolute inset-0 z-10 grid place-items-center">
      <div className="panel w-[180px]" role="dialog" aria-label="Accusation">
        {view.step === 'pick' && (
          <div className="flex flex-col gap-[3px]">
            <h2 className="h text-blood-800">Who did it?</h2>
            <p>Name the killer. You only get one shot.</p>
            {suspects.map((x) => (
              <button key={x.id} className="btn amber label h-[11px]" onClick={() => void accuse(x)}>
                {x.short}
              </button>
            ))}
            <button className="btn label h-[11px] !text-center" onClick={onClose}>
              BACK TO THE CASE
            </button>
          </div>
        )}

        {view.step === 'sending' && (
          <div className="flex flex-col gap-[3px]" role="status">
            <h2 className="h text-blood-800">Accusing...</h2>
            <p>
              Pointing at {view.name}
              <span className="blink">...</span>
            </p>
          </div>
        )}

        {view.step === 'error' && (
          <div className="flex flex-col gap-[3px]" role="alert">
            <h2 className="h text-blood-800">No verdict</h2>
            <p>{view.message}</p>
            <button className="btn label h-[11px] !text-center" onClick={() => setView({ step: 'pick' })}>
              TRY AGAIN
            </button>
            <button className="btn label h-[11px] !text-center" onClick={onClose}>
              BACK TO THE CASE
            </button>
          </div>
        )}

        {view.step === 'done' && (
          <div className="flex flex-col gap-[3px]">
            <div className="flex items-center justify-between gap-[4px]">
              <h2 className={`h ${view.verdict.status === 'SOLVED' ? 'text-truth-700' : 'text-blood-500'}`}>{view.verdict.status === 'SOLVED' ? 'Case closed' : 'Wrong man'}</h2>
              <Stamp tone={view.verdict.status === 'SOLVED' ? 'closed' : 'cold'}>{view.verdict.status === 'SOLVED' ? 'Closed' : 'Gone cold'}</Stamp>
            </div>
            {view.verdict.status === 'SOLVED' && (
              <div className="flex items-center gap-[4px]">
                <Stars count={view.verdict.stars} />
                <span className="label text-paper-400">{view.verdict.questionsUsed} questions</span>
              </div>
            )}
            <p>{view.verdict.explanation}</p>
            <button className="btn teal label h-[11px] !text-center" onClick={onNewCase}>
              NEW CASE
            </button>
            <button className="btn label h-[11px] !text-center" onClick={onClose}>
              REVIEW THE FILES
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
