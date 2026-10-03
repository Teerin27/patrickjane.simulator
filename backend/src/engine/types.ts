// Engine types are plain data so the engine never depends on Prisma, Express or the LLM.

export type Mood = 'calm' | 'nervous' | 'angry' | 'broken'

export type SuspectState = {
  suspectId: string
  composure: number
  questionsRemaining: number
  mood: string
  commitments: string[]
  confrontedEvidence: string[]
  revealedSecrets: string[]
}

export type Intent = 'question' | 'confrontation' | 'accusation' | 'smalltalk'
export type ReplyKind = 'ask' | 'contradiction' | 'truth' | 'deflect'
