import type { Pin } from '../types'

export default function CaseNotes({ pins }: { pins: Pin[] }) {
  return (
    <div className="min-h-0 flex-1 border border-[#1A1414] bg-[#F4ECD8] p-[2px]">
      <div className="label text-[#7A1E2A]">Case notes ({pins.length})</div>
      <ul className="scroll h-[44px] overflow-y-auto">
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
