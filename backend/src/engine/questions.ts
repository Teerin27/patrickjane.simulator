import type { SuspectState } from './types.js'

export const MAX_QUESTIONS = 10
export const INITIAL_COMPOSURE = 100

export function createSuspectState(suspectId: string): SuspectState {
  return {
    suspectId,
    composure: INITIAL_COMPOSURE,
    questionsRemaining: MAX_QUESTIONS,
    mood: 'calm',
    commitments: [],
    confrontedEvidence: [],
    revealedSecrets: [],
  }
}

export type SpendResult = { ok: true; state: SuspectState } | { ok: false; reason: 'LAWYERED_UP' }

/** Asking a question or presenting evidence costs 1. At 0 the suspect has lawyered up. */
export function spendQuestion(state: SuspectState): SpendResult {
  if (state.questionsRemaining <= 0) return { ok: false, reason: 'LAWYERED_UP' }
  return { ok: true, state: { ...state, questionsRemaining: state.questionsRemaining - 1 } }
}

export const isLawyeredUp = (state: SuspectState) => state.questionsRemaining <= 0
