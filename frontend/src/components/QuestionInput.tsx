import { useState } from 'react'
import type { Preset } from '../types'

export default function QuestionInput({
  presets,
  used,
  disabled,
  placeholder,
  onPreset,
  onAsk,
}: {
  presets: Preset[]
  used: string[]
  disabled: boolean
  placeholder: string
  onPreset: (i: number) => void
  onAsk: (text: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState('')

  // The draft stays in the box until the suspect has answered, so a failed request costs the player no typing
  const send = async () => {
    const t = draft.trim()
    if (!t || disabled) return
    if (await onAsk(t)) setDraft('')
  }

  return (
    <div className="flex flex-col gap-[2px] p-[1px]">
      <div className="grid grid-cols-2 gap-x-[2px]">
        {presets.map((p, i) => (
          <button key={p.label} className="btn label h-[11px]" disabled={disabled || used.includes(p.label)} onClick={() => onPreset(i)}>
            {used.includes(p.label) ? 'x ' : '? '}
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-[2px]">
        <input
          value={draft}
          maxLength={48}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={placeholder}
          className="h-[13px] min-w-0 flex-1 border border-[#1A1414] bg-[#F4ECD8] px-[2px] font-[inherit] text-[8px] leading-[7px] text-[#1A1414] placeholder:text-[#8A6E4B] caret-[#C27C1E]"
        />
        <button className="btn amber label h-[13px] w-[22px] !text-center" disabled={!draft.trim() || disabled} onClick={() => void send()}>
          ASK
        </button>
      </div>
    </div>
  )
}
