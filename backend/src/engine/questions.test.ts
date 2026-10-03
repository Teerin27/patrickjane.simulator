import { describe, expect, it } from 'vitest'
import { MAX_QUESTIONS, createSuspectState, isLawyeredUp, spendQuestion } from './questions.js'

describe('spendQuestion', () => {
  it('decrements questionsRemaining by 1 without mutating the input', () => {
    const s = createSuspectState('doyle')
    const r = spendQuestion(s)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.questionsRemaining).toBe(MAX_QUESTIONS - 1)
    expect(s.questionsRemaining).toBe(MAX_QUESTIONS)
  })

  it('allows exactly MAX_QUESTIONS questions, then lawyers up', () => {
    let s = createSuspectState('doyle')
    for (let i = 0; i < MAX_QUESTIONS; i++) {
      const r = spendQuestion(s)
      expect(r.ok).toBe(true)
      if (r.ok) s = r.state
    }
    expect(isLawyeredUp(s)).toBe(true)
    expect(spendQuestion(s)).toEqual({ ok: false, reason: 'LAWYERED_UP' })
  })
})
