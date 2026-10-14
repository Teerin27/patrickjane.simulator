import { useCallback, useEffect, useRef } from 'react'
import type { Notice } from '../hooks/useInterrogation'
import type { Msg, SessionStatus } from '../types'
import Stamp from './Stamp'
import Typer from './Typer'

export default function ChatPanel({
  messages,
  speaker,
  thinking,
  typingId,
  notice,
  lawyeredUp,
  status,
  onTypingDone,
}: {
  messages: Msg[]
  /** Who is being questioned, for the "is thinking" line. */
  speaker: string
  thinking: boolean
  typingId: number | null
  notice: Notice | null
  /** This suspect has used their last question. */
  lawyeredUp: boolean
  status: SessionStatus
  onTypingDone: () => void
}) {
  const chat = useRef<HTMLDivElement>(null)

  const scrollDown = useCallback(() => {
    const el = chat.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  const typing = typingId !== null
  const stamped = !typing && !thinking && (status !== 'ACTIVE' || lawyeredUp)
  useEffect(scrollDown, [messages, thinking, notice, stamped, scrollDown])
  return (
    <div
      ref={chat}
      // a click anywhere in the chat skips the typewriter, since a local model can write a long answer
      onClick={() => typing && onTypingDone()}
      className="scroll flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto border border-ink bg-night-900 p-[3px]"
    >
      {messages.map((m) => {
        const you = m.from === 'you'
        const tone = you
          ? 'bg-brass-400 self-end'
          : m.kind === 'contradiction'
            ? 'bg-blood-800 text-paper-100'
            : m.kind === 'truth'
              ? 'bg-truth-700 text-paper-100'
              : 'bg-paper-200'
        return (
          <div key={m.id} className={`max-w-[88%] border border-ink px-[3px] py-[1px] ${tone}`}>
            {m.kind === 'contradiction' && (
              <div>
                <Stamp tone="contradiction">Contradiction!</Stamp>
              </div>
            )}
            {m.kind === 'truth' && (
              <div>
                <Stamp tone="evidence">New evidence</Stamp>
              </div>
            )}
            {you ? m.text : <Typer text={m.text} run={m.id === typingId} onTick={scrollDown} onDone={onTypingDone} />}
          </div>
        )
      })}
      {thinking && (
        <div role="status" className="self-start border border-ink bg-paper-200 px-[3px]">
          <span className="label text-paper-400">{speaker} is thinking</span>
          <span className="blink">...</span>
        </div>
      )}
      {notice && (
        <div role="alert" className={`border px-[3px] py-[1px] ${notice.kind === 'error' ? 'border-blood-500 bg-night-950 text-paper-100' : 'border-paper-300 bg-night-950 text-paper-100'}`}>
          {notice.kind === 'error' && <span className="text-blood-500">!! </span>}
          {notice.text}
        </div>
      )}
      {stamped && (
        <div className="flex justify-center py-[1px]">
          {status === 'SOLVED' ? <Stamp tone="closed">Case closed</Stamp> : status === 'COLD' ? <Stamp tone="cold">Case gone cold</Stamp> : <Stamp tone="locked">Lawyered up</Stamp>}
        </div>
      )}
    </div>
  )
}
