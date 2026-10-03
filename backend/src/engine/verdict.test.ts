import { describe, expect, it } from 'vitest'
import { createSuspectState } from './questions.js'
import { judgeAccusation, starRating } from './verdict.js'

const withUsed = (id: string, used: number) => ({ ...createSuspectState(id), questionsRemaining: 10 - used })

describe('starRating', () => {
  it('rewards fewer questions (3 suspects = 30 question budget)', () => {
    expect(starRating(0, 3)).toBe(3)
    expect(starRating(10, 3)).toBe(3)
    expect(starRating(11, 3)).toBe(2)
    expect(starRating(20, 3)).toBe(2)
    expect(starRating(21, 3)).toBe(1)
  })
})

describe('judgeAccusation', () => {
  const suspects = [withUsed('voss', 2), withUsed('pike', 3), withUsed('doyle', 4)]

  it('solves the case when the culprit is accused', () => {
    expect(judgeAccusation('doyle', 'doyle', suspects)).toEqual({ status: 'SOLVED', stars: 3, questionsUsed: 9 })
  })

  it('goes cold on a wrong accusation', () => {
    expect(judgeAccusation('doyle', 'pike', suspects)).toEqual({ status: 'COLD', stars: 0, questionsUsed: 9 })
  })
})
