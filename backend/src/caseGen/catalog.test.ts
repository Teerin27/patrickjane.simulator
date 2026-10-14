import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { caseIndex, namesInCases, nextCaseNumber, THEMES, themeFor } from './catalog.js'

describe('nextCaseNumber', () => {
  it('starts at Case 0001 when there are no cases', () => {
    expect(nextCaseNumber([])).toBe('Case 0001')
  })

  it('follows the highest number, zero-padded', () => {
    expect(nextCaseNumber(['Case 0001'])).toBe('Case 0002')
    expect(nextCaseNumber(['Case 0003', 'Case 0001', 'Case 0002'])).toBe('Case 0004')
    expect(nextCaseNumber(['Case 0009'])).toBe('Case 0010')
  })

  it('fills nothing in: gaps stay gaps, the series only moves forward', () => {
    expect(nextCaseNumber(['Case 0001', 'Case 0005'])).toBe('Case 0006')
  })

  it('ignores titles that are not numbers', () => {
    expect(nextCaseNumber(['Special Edition', 'Case 0002', 'case ten'])).toBe('Case 0003')
  })
})

describe('caseIndex', () => {
  it('reads the number out of the label', () => {
    expect(caseIndex('Case 0007')).toBe(7)
    expect(caseIndex('case 12')).toBe(12)
    expect(caseIndex('Special Edition')).toBe(0)
  })
})

describe('themeFor', () => {
  it('gives neighbouring cases different settings', () => {
    expect(themeFor(1)).not.toBe(themeFor(2))
    expect(themeFor(2)).not.toBe(themeFor(3))
  })

  it('is repeatable, and comes back round once the list runs out', () => {
    expect(themeFor(5)).toBe(themeFor(5))
    expect(themeFor(THEMES.length + 1)).toBe(themeFor(1))
  })

  it('copes with a case number of zero', () => {
    expect(themeFor(0)).toBe(themeFor(1))
  })

  it('has no setting twice', () => {
    expect(new Set(THEMES).size).toBe(THEMES.length)
  })
})

describe('namesInCases', () => {
  it('lists every full name, surname and id once', () => {
    const names = namesInCases([loadSampleCase()])
    expect(names).toEqual(expect.arrayContaining(['Lorraine Voss', 'Voss', 'lorraine', 'Dr. Edmund Pike', 'Michael Doyle']))
    expect(new Set(names).size).toBe(names.length)
  })

  it('does not repeat a name that two cases share', () => {
    const sample = loadSampleCase()
    const names = namesInCases([sample, sample])
    expect(names.filter((n) => n === 'Voss')).toHaveLength(1)
  })

  it('is empty for no cases', () => {
    expect(namesInCases([])).toEqual([])
  })
})
