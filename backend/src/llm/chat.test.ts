import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { createSuspectState } from '../engine/questions.js'
import type { TurnDecision } from '../engine/turn.js'
import { fallbackReply, generateAdmission, generateSuspectReply } from './chat.js'
import { forbiddenMarkers } from './guard.js'
import { LlmError, type LlmProvider, type LlmRequest } from './provider.js'

const { truth } = loadSampleCase()

/** A provider that answers from a script, one entry per call, and records what it was asked. */
function scripted(...answers: (string | Error)[]) {
  const calls: LlmRequest[] = []
  const provider: LlmProvider = {
    async generate(req) {
      calls.push(req)
      const next = answers[Math.min(calls.length - 1, answers.length - 1)]!
      if (next instanceof Error) throw next
      return next
    },
  }
  return { provider, calls }
}

const base = (fallback = 'FALLBACK') => ({
  prompt: { system: 'SYSTEM', messages: [{ role: 'user' as const, content: 'Where were you?' }], task: 'chat' as const },
  forbidden: forbiddenMarkers(truth, 'doyle', createSuspectState('doyle')),
  allowedText: '',
  speaker: 'Doyle',
  fallback,
})

describe('generateSuspectReply', () => {
  it('returns a clean reply on the first try', async () => {
    const { provider, calls } = scripted('I never left the bar.')
    const r = await generateSuspectReply(provider, base())
    expect(r).toEqual({ reply: 'I never left the bar.', source: 'llm', attempts: 1, rejections: [], rejectedReplies: [] })
    expect(calls).toHaveLength(1)
  })

  it('retries when the guard rejects, telling the model why, and keeps the good answer', async () => {
    const { provider, calls } = scripted('I was at Union Station.', 'Behind the bar, all night.')
    const r = await generateSuspectReply(provider, base())
    expect(r.source).toBe('llm')
    expect(r.attempts).toBe(2)
    expect(r.reply).toBe('Behind the bar, all night.')
    expect(r.rejections).toHaveLength(1)
    expect(r.rejectedReplies).toEqual(['I was at Union Station.']) // kept for the log
    expect(calls[1]!.system).toContain('# CORRECTION')
    expect(calls[1]!.system).toContain('rejected because')
    expect(calls[1]!.system).not.toContain('Union Station') // never feeds the leak back to the model
    expect(calls[1]!.temperature).toBe(0.5)
  })

  it('falls back to the scripted line after the model keeps breaking the rules', async () => {
    const { provider, calls } = scripted('I was at Union Station.')
    const r = await generateSuspectReply(provider, base('Scripted line.'))
    expect(r).toMatchObject({ reply: 'Scripted line.', source: 'fallback', attempts: 3 })
    expect(r.rejections).toHaveLength(3)
    expect(calls).toHaveLength(3)
  })

  it('falls back at once, without retrying, when the model is unavailable', async () => {
    const { provider, calls } = scripted(new LlmError('Cannot reach Ollama'))
    const r = await generateSuspectReply(provider, base('Scripted line.'))
    expect(r).toMatchObject({ reply: 'Scripted line.', source: 'fallback', attempts: 1 })
    expect(r.rejections).toEqual(['Cannot reach Ollama'])
    expect(calls).toHaveLength(1)
  })

  it('does not swallow bugs that are not model failures', async () => {
    const { provider } = scripted(new TypeError('programmer error'))
    await expect(generateSuspectReply(provider, base())).rejects.toThrow('programmer error')
  })

  it('honours a smaller attempt budget', async () => {
    const { provider, calls } = scripted('I was at Union Station.')
    await generateSuspectReply(provider, { ...base(), maxAttempts: 1 })
    expect(calls).toHaveLength(1)
  })
})

describe('fallbackReply', () => {
  const doyle = truth.suspects.doyle!

  it('speaks an in-character line that reveals nothing', () => {
    expect(doyle.persona.fallbackLines).toContain(fallbackReply(doyle, 0))
  })

  it('varies the line with the seed, and never runs off the end of the list', () => {
    const lines = new Set([0, 1, 2, 3, 4, 5].map((s) => fallbackReply(doyle, s)))
    expect(lines.size).toBe(doyle.persona.fallbackLines.length)
  })
})

describe('generateAdmission: a reaction from the model, the admission from the case file', () => {
  const doyle = truth.suspects.doyle!
  const alibi = doyle.claims.find((c) => c.id === 'alibi')!
  const murder = doyle.secrets[0]!
  const lieBroken = { brokenNow: [alibi], revealedNow: [] }
  const confession = { brokenNow: [], revealedNow: [murder] }
  const input = (decision: Pick<TurnDecision, 'brokenNow' | 'revealedNow'>) => ({
    prompt: { system: 'SYSTEM', messages: [{ role: 'user' as const, content: 'Explain this.' }], task: 'chat' as const },
    forbidden: forbiddenMarkers(truth, 'doyle', createSuspectState('doyle')),
    speaker: 'Doyle',
    decision,
  })

  it('puts the written admission after the model reaction, word for word', async () => {
    const { provider } = scripted('Fine. You win, detective.')
    const r = await generateAdmission(provider, input(lieBroken))
    expect(r.source).toBe('llm')
    expect(r.reply).toBe(`Fine. You win, detective. ${alibi.truth}`)
  })

  it('confesses with the secret own text, adding a full stop to the reaction if it has none', async () => {
    const { provider } = scripted('Damn you')
    const r = await generateAdmission(provider, input(confession))
    expect(r.reply).toBe(`Damn you. ${murder.description}`)
  })

  it('lets a confession stand in for the lies it covers', async () => {
    const { provider } = scripted('Damn you.')
    const r = await generateAdmission(provider, input({ brokenNow: [alibi], revealedNow: [murder] }))
    expect(r.reply).toBe(`Damn you. ${murder.description}`)
  })

  it('retries a reaction that denies, then uses the good one', async () => {
    const { provider, calls } = scripted("That ticket isn't mine.", 'Fine.')
    const r = await generateAdmission(provider, input(lieBroken))
    expect(r.attempts).toBe(2)
    expect(r.reply).toBe(`Fine. ${alibi.truth}`)
    expect(calls[1]!.system).toContain('# CORRECTION')
  })

  it('speaks the admission alone when the model keeps getting the reaction wrong', async () => {
    const { provider } = scripted('I left at 11:45.')
    const r = await generateAdmission(provider, input(lieBroken))
    expect(r).toMatchObject({ source: 'fallback', reply: alibi.truth, attempts: 2 })
    expect(r.rejectedReplies).toHaveLength(2)
  })

  it('speaks the admission alone when the model is unavailable, so the game never stalls or contradicts the engine', async () => {
    const { provider, calls } = scripted(new LlmError('Cannot reach Ollama'))
    const r = await generateAdmission(provider, input(confession))
    expect(r).toMatchObject({ source: 'fallback', reply: murder.description, attempts: 1 })
    expect(calls).toHaveLength(1)
  })

  it('does not swallow bugs that are not model failures', async () => {
    const { provider } = scripted(new TypeError('programmer error'))
    await expect(generateAdmission(provider, input(lieBroken))).rejects.toThrow('programmer error')
  })
})
