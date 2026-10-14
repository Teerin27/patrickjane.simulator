// Engine types are plain data so the engine never depends on Prisma, Express or the LLM.

export type Mood = 'calm' | 'nervous' | 'angry' | 'broken'

export type SuspectState = {
  suspectId: string
  composure: number
  questionsRemaining: number
  mood: string
  /** Ids of the claims this suspect has stated and is now bound to. */
  commitments: string[]
  /** Ids of the claims the player has disproved. Always a subset of `commitments`. */
  brokenClaims: string[]
  confrontedEvidence: string[]
  /** Ids of the secrets that have come out (including a murder confession). */
  revealedSecrets: string[]
}

export type Intent = 'question' | 'confrontation' | 'accusation' | 'smalltalk'
export type ReplyKind = 'ask' | 'contradiction' | 'truth' | 'deflect'
