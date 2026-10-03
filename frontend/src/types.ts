import type { Mood, Who } from './lib/pixel'

export type { Mood, Who }

export type Kind = 'ask' | 'contradiction' | 'truth' | 'deflect'
export type Msg = { id: number; from: 'you' | 'them'; text: string; kind?: Kind }
export type Reaction = { text: string; kind: Kind; mood: Mood; note?: string }
export type Pin = { who: Who; text: string; kind: Kind }

export type Suspect = { id: Who; short: string; surname: string; role: string; alibi: string }
export type Evidence = { id: string; tag: string; name: string; sprite: string; note: string }
export type Preset = { label: string; q: string; a: string }

export type AccuseState = 'closed' | 'pick' | Who
