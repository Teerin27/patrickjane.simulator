import type { SuspectTruth } from '../caseFile/schema.js'
import type { TurnDecision } from '../engine/turn.js'
import { checkReaction, checkReply, type Forbidden } from './guard.js'
import { admissionText } from './promptBuilder.js'
import { LlmError, type LlmProvider, type LlmRequest } from './provider.js'

export type ChatReply = {
  reply: string
  /** `fallback` means the model failed or kept breaking the rules, and scripted text was used instead. */
  source: 'llm' | 'fallback'
  attempts: number
  /** Why each rejected attempt was rejected. Worth logging: it is how you learn what the model gets wrong. */
  rejections: string[]
  /** What the model actually said in each rejected attempt, for the server log only. Never shown to the player or the model. */
  rejectedReplies: string[]
}

const MAX_ATTEMPTS = 3

/** Ask again, telling the model what was wrong with its last attempt (never repeating the rejected text). */
const correction = (req: LlmRequest, reason: string): LlmRequest => ({
  ...req,
  system: `${req.system}\n\n# CORRECTION\nYour last reply was rejected because ${reason}. Answer again and follow every rule.`,
  temperature: 0.5,
})

/**
 * A line to speak when the model cannot, for an open turn: in character, reveals nothing.
 * (Dictated turns never need one: their admission is written text, see generateAdmission.)
 */
export function fallbackReply(truth: SuspectTruth, seed: number): string {
  const lines = truth.persona.fallbackLines
  return lines[seed % lines.length]!
}

/**
 * Ask the model for one in-character reply to an open turn and make sure it is fit to show. Retries when the
 * guard rejects the reply, gives up immediately when the model itself is unavailable, and always returns
 * something playable.
 */
export async function generateSuspectReply(
  provider: LlmProvider,
  input: {
    prompt: LlmRequest
    forbidden: Forbidden[]
    /** Text the reply may repeat without it being a leak (the player's message, exhibits shown, the suspect's story). */
    allowedText: string
    speaker: string
    /** Statements of lies already exposed, which the reply must not repeat (see retiredLies). */
    retired?: string[]
    /** The suspect has already confessed to the murder, so the reply must not deny it. */
    confessed?: boolean
    fallback: string
    maxAttempts?: number
  },
): Promise<ChatReply> {
  const rejections: string[] = []
  const rejectedReplies: string[] = []
  const maxAttempts = input.maxAttempts ?? MAX_ATTEMPTS

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const req = rejections.length ? correction(input.prompt, rejections[rejections.length - 1]!) : input.prompt

    let raw: string
    try {
      raw = await provider.generate(req)
    } catch (err) {
      // The model is down or too slow: trying again would only make the player wait longer
      if (!(err instanceof LlmError)) throw err
      return { reply: input.fallback, source: 'fallback', attempts: attempt, rejections: [...rejections, err.message], rejectedReplies }
    }

    const verdict = checkReply(raw, { forbidden: input.forbidden, allowedText: input.allowedText, speaker: input.speaker, retired: input.retired, confessed: input.confessed })
    if (verdict.ok) return { reply: verdict.reply, source: 'llm', attempts: attempt, rejections, rejectedReplies }
    rejections.push(verdict.reason)
    rejectedReplies.push(raw)
  }
  return { reply: input.fallback, source: 'fallback', attempts: maxAttempts, rejections, rejectedReplies }
}

/**
 * The reply for a dictated turn (a lie broke, or a secret cracked): a short reaction from the model, then the
 * case author's own written admission, word for word. The facts therefore never depend on the model.
 * If the model fails, the admission goes out alone: the game never blocks, and never contradicts the engine.
 */
export async function generateAdmission(
  provider: LlmProvider,
  input: {
    prompt: LlmRequest
    forbidden: Forbidden[]
    speaker: string
    decision: Pick<TurnDecision, 'brokenNow' | 'revealedNow'>
    maxAttempts?: number
  },
): Promise<ChatReply> {
  const admission = admissionText(input.decision)
  const rejections: string[] = []
  const rejectedReplies: string[] = []
  const maxAttempts = input.maxAttempts ?? 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const req = rejections.length ? correction(input.prompt, rejections[rejections.length - 1]!) : input.prompt
    let raw: string
    try {
      raw = await provider.generate(req)
    } catch (err) {
      if (!(err instanceof LlmError)) throw err
      return { reply: admission, source: 'fallback', attempts: attempt, rejections: [...rejections, err.message], rejectedReplies }
    }

    const verdict = checkReaction(raw, { forbidden: input.forbidden, speaker: input.speaker })
    if (verdict.ok) {
      const reaction = /[.!?…]$/.test(verdict.reply) ? verdict.reply : `${verdict.reply}.`
      return { reply: `${reaction} ${admission}`, source: 'llm', attempts: attempt, rejections, rejectedReplies }
    }
    rejections.push(verdict.reason)
    rejectedReplies.push(raw)
  }
  return { reply: admission, source: 'fallback', attempts: maxAttempts, rejections, rejectedReplies }
}
