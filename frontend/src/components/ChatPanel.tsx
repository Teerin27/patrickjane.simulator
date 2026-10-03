import { useCallback, useEffect, useRef } from 'react'
import Typer from './Typer'
import type { Msg } from '../types'

export default function ChatPanel({ messages, thinking, typingId, onTypingDone }: { messages: Msg[]; thinking: boolean; typingId: number | null; onTypingDone: () => void }) {
  const chat = useRef<HTMLDivElement>(null)

  const scrollDown = useCallback(() => {
    const el = chat.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
  useEffect(scrollDown, [messages, thinking, scrollDown])

  return (
    <div ref={chat} className="scroll flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto border border-[#1A1414] bg-[#1B2033] p-[3px]">
      {messages.map((m) => {
        const you = m.from === 'you'
        const tone = you
          ? 'bg-[#F2B33D] self-end'
          : m.kind === 'contradiction'
            ? 'bg-[#7A1E2A] text-[#F4ECD8]'
            : m.kind === 'truth'
              ? 'bg-[#2D6466] text-[#F4ECD8]'
              : 'bg-[#E6D5AE]'
        return (
          <div key={m.id} className={`max-w-[134px] border border-[#1A1414] px-[3px] py-[1px] ${tone}`}>
            {m.kind === 'contradiction' && <div className="label text-[#FFD97A]">!! Contradiction</div>}
            {m.kind === 'truth' && <div className="label text-[#8FD6D2]">** Truth</div>}
            {you ? m.text : <Typer text={m.text} run={m.id === typingId} onTick={scrollDown} onDone={onTypingDone} />}
          </div>
        )
      })}
      {thinking && (
        <div className="w-[16px] border border-[#1A1414] bg-[#E6D5AE] px-[3px]">
          <span className="blink">...</span>
        </div>
      )}
    </div>
  )
}
