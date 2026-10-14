import type { Intent } from './types.js'

// (DUMMY) Rule-based stand-in for the intent classifier. ML roadmap stage 1 replaces this with a model
// behind the same signature. Rules are deliberately conservative: when unsure, it is a plain question.

const ACCUSATION = /\b(you did it|you killed|you shot|you murdered|you are the (killer|murderer)|you're the (killer|murderer)|i accuse|confess)\b/i
const SMALLTALK = /^\s*(hi|hello|hey|good (evening|morning|night)|thanks?|thank you|cheers|how are you|nice (place|club))\b/i

export function classifyIntent(message: string, evidenceId?: string): Intent {
  if (evidenceId) return 'confrontation'
  if (ACCUSATION.test(message)) return 'accusation'
  if (SMALLTALK.test(message)) return 'smalltalk'
  return 'question'
}
