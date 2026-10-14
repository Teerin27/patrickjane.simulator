import { describe, expect, it } from 'vitest'
import { balanceCase, MAX_SLIP, MAX_TUNED } from './balance.js'
import { loadSampleCase } from './load.js'
import type { CaseFile } from './schema.js'
import { perfectPlay, validateCaseFile } from './validate.js'

const sample = () => structuredClone(loadSampleCase())
const murderThreshold = (c: CaseFile) => c.truth.suspects.doyle!.secrets[0]!.maxComposure
const setMurder = (c: CaseFile, maxComposure: number) => {
  c.truth.suspects.doyle!.secrets[0]!.maxComposure = maxComposure
  return c
}

describe('balanceCase', () => {
  it('leaves a case that is already balanced exactly as it was', () => {
    const c = sample()
    expect(balanceCase(c)).toBe(c) // not even a copy
  })

  it('raises a threshold that perfect play misses by a few points', () => {
    // perfect play against Doyle ends at composure 25: a confession at 20 is five points out of reach
    const c = setMurder(sample(), 20)
    expect(validateCaseFile(c).map((i) => i.code)).toContain('PLAY_SECRET_LOCKED')

    const tuned = balanceCase(c)
    expect(murderThreshold(tuned)).toBe(25)
    expect(validateCaseFile(tuned)).toEqual([])
  })

  it('does not touch the case it was given', () => {
    const c = setMurder(sample(), 20)
    const before = JSON.stringify(c)
    balanceCase(c)
    expect(JSON.stringify(c)).toBe(before)
  })

  it('fixes an innocent’s secret the same way', () => {
    const c = sample()
    c.truth.suspects.pike!.secrets[0]!.maxComposure = 50 // perfect play ends at 60
    const tuned = balanceCase(c)
    expect(tuned.truth.suspects.pike!.secrets[0]!.maxComposure).toBe(60)
    expect(validateCaseFile(tuned)).toEqual([])
  })

  it('fixes several secrets at once, without one affecting the other', () => {
    const c = setMurder(sample(), 20)
    c.truth.suspects.pike!.secrets[0]!.maxComposure = 50
    const tuned = balanceCase(c)
    expect(murderThreshold(tuned)).toBe(25)
    expect(tuned.truth.suspects.pike!.secrets[0]!.maxComposure).toBe(60)
  })

  it('refuses to fix a slip that is too big: that is missing evidence pressure, not rounding', () => {
    const c = setMurder(sample(), 25 - (MAX_SLIP + 1) < 0 ? 0 : 25 - (MAX_SLIP + 1)) // 9 below: slip of 16
    expect(25 - murderThreshold(c)).toBeGreaterThan(MAX_SLIP)
    expect(murderThreshold(balanceCase(c))).toBe(murderThreshold(c))
    expect(validateCaseFile(balanceCase(c)).map((i) => i.code)).toContain('PLAY_SECRET_LOCKED')
  })

  it('never lets the killer be made to crack above the ceiling, however small the slip', () => {
    // make perfect play against Doyle end high by weakening every edge against him, then ask for a threshold just under it
    const c = sample()
    c.truth.edges = c.truth.edges.map((e) => (e.suspectId === 'doyle' && (e.kind === 'contradicts' || e.kind === 'implicates') ? { ...e, weight: e.kind === 'contradicts' ? 5 : 1 } : e))
    const reached = perfectPlay(c, 'doyle').state.composure
    expect(reached).toBeGreaterThan(MAX_TUNED.murder)
    setMurder(c, reached - 3)
    expect(murderThreshold(balanceCase(c))).toBe(reached - 3) // left alone: a killer who cracks this early is not "balanced"
  })

  it('allows an innocent’s secret a higher ceiling than the killer’s', () => {
    expect(MAX_TUNED.personal).toBeGreaterThan(MAX_TUNED.murder)
  })

  it('returns a case with broken references as it came instead of throwing', () => {
    const c = sample()
    c.truth.edges.push({ kind: 'contradicts', evidenceId: 'nope', suspectId: 'doyle', claimId: 'nope', weight: 10 })
    expect(() => balanceCase(c)).not.toThrow()
  })
})
