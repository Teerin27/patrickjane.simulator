import type { ReactNode } from 'react'

// Rubber stamps: CONTRADICTION!, NEW EVIDENCE, LAWYERED UP, CASE CLOSED, GONE COLD.
// A flat 1px frame in the stamp's own colour, no rotation or blur (those would break the pixel grid).
const TONES = {
  contradiction: 'border-brass-300 text-brass-300',
  evidence: 'border-truth-300 text-truth-300',
  locked: 'border-paper-100 bg-blood-500 text-paper-100',
  closed: 'border-paper-100 bg-truth-700 text-paper-100',
  cold: 'border-paper-100 bg-night-800 text-paper-100',
} as const

export type StampTone = keyof typeof TONES

export default function Stamp({ tone, children, className = '' }: { tone: StampTone; children: ReactNode; className?: string }) {
  return <span className={`label inline-block border px-[2px] ${TONES[tone]} ${className}`}>{children}</span>
}
