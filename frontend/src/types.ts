import type { Appearance, Mood } from './lib/pixel'

export type { Appearance, Mood }

/** A suspect's id as the case file spells it ("lorraine", "doyle", ...). Cases are data, so this is just a string. */
export type Who = string

// What the server calls a reply (see engine/types.ts ReplyKind). The client only styles by it, never decides it.
export type Kind = 'ask' | 'contradiction' | 'truth' | 'deflect'
export type Msg = { id: number; from: 'you' | 'them'; text: string; kind?: Kind }
export type Pin = { who: Who; text: string; kind: Kind }

// ---- public case: GET /api/cases, GET /api/cases/:id ----------------------------------------------
// Public police-file data only. Ground truth (who lied, who did it) never reaches the client.
/** A suspect as the case list shows them: enough for a face and a label. */
export type SuspectCard = { id: Who; short: string; role: string; look: Appearance }
/** One entry of GET /api/cases, in case order ("Case 0001", "Case 0002", ...). */
export type CaseSummary = { id: string; slug: string; title: string; number: string; briefing: string; suspects: SuspectCard[] }

// One claim from a suspect's statement to police: where they say they were, and when
export type Whereabout = { time: string; place: string }
export type Suspect = {
  id: Who
  /** How the suspect is drawn (see lib/pixel.ts renderAppearance). */
  look: Appearance
  short: string
  surname: string
  role: string
  alibi: string
  /** First thing they say when you sit down. */
  opener: string
  fullName: string
  age: number
  address: string
  tie: string
  whereabouts: Whereabout[]
}
export type Evidence = { id: string; tag: string; name: string; sprite: string; note: string }
// The full file of one case. Its suspects carry everything the list's cards do, and more.
export type PublicCase = Omit<CaseSummary, 'suspects'> & { suspects: Suspect[]; evidence: Evidence[] }

// ---- play session: /api/sessions ------------------------------------------------------------------
export type SessionStatus = 'ACTIVE' | 'SOLVED' | 'COLD'
/** Per-suspect state, owned by the server. The client shows it and never computes it. */
export type SuspectView = {
  suspectId: Who
  composure: number
  questionsRemaining: number
  mood: string
  confrontedEvidence: string[]
  revealedSecrets: string[]
}
export type SessionView = {
  id: string
  caseId: string
  status: SessionStatus
  discoveredEvidence: string[]
  accusedId: string | null
  suspects: SuspectView[]
}

/** POST /api/sessions/:id/interrogate */
export type TurnResult = {
  reply: string
  kind: Kind
  /** One line for the case notes when a lie was just exposed. */
  note?: string
  lawyeredUp: boolean
  /** The suspect's parting line, sent when this turn used their last question. */
  closer?: string
  suspect: SuspectView
}

/** POST /api/sessions/:id/accuse */
export type Verdict = { status: 'SOLVED' | 'COLD'; stars: 0 | 1 | 2 | 3; questionsUsed: number; explanation: string }

export type Preset = { label: string; q: string }

export type AccuseState = 'closed' | 'open'

// The two gameplay scenes: reading the suspects' files, or sitting across from them
export type Scene = 'files' | 'room'

// The signed-in player's own account, as GET /api/auth/me returns it (dates are ISO strings)
export type Account = { id: string; username: string; email: string; createdAt: string; updatedAt: string }
export type LoginResult = { token: string; expiresAt: string; player: Account }

// Progress shown next to the player. (DUMMY) The backend does not track these yet; see data/placeholderStats.ts.
export type PlayerStats = { rank: string; casesSolved: number }
