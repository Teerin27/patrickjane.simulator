import { MAX_QUESTIONS } from './questions.js'
import type { SuspectState } from './types.js'

export type Verdict = { status: 'SOLVED' | 'COLD'; stars: 0 | 1 | 2 | 3; questionsUsed: number }

export const questionsUsed = (suspects: SuspectState[]) => suspects.reduce((n, s) => n + MAX_QUESTIONS - s.questionsRemaining, 0)

/** 3 stars for using at most a third of the total question budget, 2 for two thirds, else 1. */
export function starRating(used: number, suspectCount: number): 1 | 2 | 3 {
  const budget = suspectCount * MAX_QUESTIONS
  if (used <= budget / 3) return 3
  if (used <= (budget * 2) / 3) return 2
  return 1
}

export function judgeAccusation(culpritId: string, accusedId: string, suspects: SuspectState[]): Verdict {
  const used = questionsUsed(suspects)
  if (accusedId !== culpritId) return { status: 'COLD', stars: 0, questionsUsed: used }
  return { status: 'SOLVED', stars: starRating(used, suspects.length), questionsUsed: used }
}
