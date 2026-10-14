import type { Pin } from '../types'

export default function CaseNotes({ pins, className = '' }: { pins: Pin[]; className?: string }) {
  return (
    <div className={`flex min-h-0 flex-col border border-[#1A1414] bg-[#F4ECD8] p-[2px] ${className}`}>
      <div className="label text-[#7A1E2A]">Case notes ({pins.length})</div>
      <ul className="scroll min-h-[24px] flex-1 overflow-y-auto">
        {pins.length === 0 && <li className="text-[#8A6E4B]">Nothing yet.</li>}
        {pins.map((p, i) => (
          <li key={i} className={`mb-[1px] border-l-2 pl-[2px] ${p.kind === 'contradiction' ? 'border-[#C8323C]' : 'border-[#4FA3A0]'}`}>
            {p.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
