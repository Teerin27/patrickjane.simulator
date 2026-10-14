import { describe, expect, it } from 'vitest'
import { CASES_DIR, listCaseFiles, loadCaseFile, loadSampleCase } from './load.js'
import { caseFileSchema, type CaseFile } from './schema.js'
import { perfectPlay, validateCaseFile } from './validate.js'

/** A fresh, mutable copy of the sample case for each test to break in its own way. */
const sample = () => structuredClone(loadSampleCase())
const codes = (c: CaseFile) => validateCaseFile(c).map((i) => i.code)

describe('every case file in /cases', () => {
  it('is well-formed and passes every case-writing rule', () => {
    const files = listCaseFiles(CASES_DIR)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) expect(validateCaseFile(loadCaseFile(file)), file).toEqual([])
  })
})

describe('validateCaseFile', () => {
  it('accepts the sample case', () => {
    expect(validateCaseFile(sample())).toEqual([])
  })

  describe('references', () => {
    it('rejects a culprit who is not a suspect', () => {
      const c = sample()
      c.culpritId = 'ghost'
      expect(codes(c)).toContain('CULPRIT_UNKNOWN')
    })

    it('rejects a suspect without ground truth, and ground truth without a suspect', () => {
      const missing = sample()
      delete missing.truth.suspects.pike
      expect(codes(missing)).toContain('MISSING_TRUTH')

      const extra = sample()
      extra.truth.suspects.ghost = structuredClone(extra.truth.suspects.pike!)
      expect(codes(extra)).toContain('UNKNOWN_TRUTH')
    })

    it('rejects an edge that points at something that does not exist', () => {
      const c = sample()
      c.truth.edges.push({ kind: 'contradicts', evidenceId: 'nope', suspectId: 'doyle', claimId: 'nope', weight: 10 })
      expect(codes(c)).toEqual(expect.arrayContaining(['EDGE_UNKNOWN_EVIDENCE', 'EDGE_UNKNOWN_CLAIM']))
    })

    it('rejects duplicate ids', () => {
      const c = sample()
      c.evidence.push({ ...c.evidence[0]! })
      expect(codes(c)).toContain('DUPLICATE_ID')
    })
  })

  describe('rule 1: every suspect lies', () => {
    it('rejects a suspect who tells only the truth', () => {
      const c = sample()
      for (const claim of c.truth.suspects.pike!.claims) claim.isLie = false
      expect(codes(c)).toContain('NO_LIE')
    })
  })

  describe('rule 3: no dead ends', () => {
    it('rejects a lie nothing contradicts', () => {
      const c = sample()
      c.truth.edges = c.truth.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'lorraine'))
      expect(codes(c)).toContain('LIE_NOT_EXPOSABLE')
    })

    it('rejects a secret no exhibit can expose', () => {
      const c = sample()
      c.truth.edges = c.truth.edges.filter((e) => !(e.kind === 'reveals' && e.suspectId === 'pike'))
      expect(codes(c)).toContain('SECRET_UNREACHABLE')
    })

    it('rejects an exhibit linked to nobody', () => {
      const c = sample()
      c.evidence.push({ id: 'decoy', tag: 'EXH.Z', name: 'Decoy', sprite: 'key', note: 'Goes nowhere.' })
      expect(codes(c)).toContain('EVIDENCE_UNUSED')
    })

    it('rejects lies and secrets the guard could not protect', () => {
      const c = sample()
      c.truth.suspects.doyle!.claims[0]!.leakMarkers = []
      c.truth.suspects.doyle!.secrets[0]!.leakMarkers = []
      expect(codes(c).filter((x) => x === 'NO_LEAK_MARKERS')).toHaveLength(2)
    })

    it('rejects markers that never appear in the text they are supposed to detect', () => {
      const c = sample()
      c.truth.suspects.doyle!.claims[0]!.leakMarkers = ['submarine']
      c.truth.suspects.doyle!.secrets[0]!.leakMarkers = ['submarine']
      expect(codes(c).filter((x) => x === 'MARKER_NOT_IN_TRUTH')).toHaveLength(2)
    })

    it('rejects a case that cannot be won by playing it: composure never gets low enough', () => {
      const c = sample()
      c.truth.suspects.doyle!.secrets[0]!.maxComposure = 5 // 25 is the lowest a perfect player reaches
      const locked = validateCaseFile(c).find((i) => i.code === 'PLAY_SECRET_LOCKED')!
      // the complaint says exactly where the numbers stand, so it can be fixed without guessing
      expect(locked.message).toContain('ends at composure 25')
      expect(locked.message).toContain('"murder" only cracks at 5 or lower')
    })

    it('rejects an exhibit that "contradicts" a claim that is true', () => {
      const c = sample()
      // re-point the only exhibit against Voss's lie at her truthful alibi
      c.truth.edges = c.truth.edges.map((e) => (e.kind === 'contradicts' && e.claimId === 'office' ? { ...e, claimId: 'alibi' } : e))
      expect(codes(c)).toEqual(expect.arrayContaining(['CONTRADICTS_TRUTH', 'LIE_NOT_EXPOSABLE']))
    })
  })

  describe('rule 2: only the culprit is provable', () => {
    it('needs exactly one murder secret', () => {
      const none = sample()
      none.truth.suspects.doyle!.secrets[0]!.kind = 'personal'
      expect(codes(none)).toContain('MURDER_COUNT')

      const two = sample()
      two.truth.suspects.pike!.secrets[0]!.kind = 'murder'
      expect(codes(two)).toContain('MURDER_COUNT')
    })

    it('rejects a murder secret held by an innocent', () => {
      const c = sample()
      c.culpritId = 'pike'
      expect(codes(c)).toContain('MURDER_NOT_CULPRIT')
    })

    it('rejects a case that rests on a single exhibit', () => {
      const c = sample()
      c.truth.edges = c.truth.edges.filter((e) => !(e.kind === 'reveals' && e.evidenceId === 'key'))
      expect(codes(c)).toContain('CHAIN_TOO_SHORT')
    })

    it('rejects a needed exhibit that does not point at the culprit', () => {
      const c = sample()
      c.truth.edges = c.truth.edges.filter((e) => !(e.kind === 'implicates' && e.evidenceId === 'key'))
      expect(codes(c)).toContain('CHAIN_NOT_POINTING')
    })

    it('rejects a needed exhibit that also points at someone else', () => {
      const c = sample()
      c.truth.edges.push({ kind: 'implicates', evidenceId: 'ticket', suspectId: 'pike', weight: 10 })
      expect(codes(c)).toContain('CHAIN_AMBIGUOUS')
    })
  })
})

describe('perfectPlay', () => {
  it('cracks the culprit in four questions and breaks both of their lies', () => {
    const { state, questions } = perfectPlay(sample(), 'doyle')
    expect(questions).toBe(4)
    expect(state.brokenClaims.sort()).toEqual(['alibi', 'keys'])
    expect(state.revealedSecrets).toEqual(['murder'])
  })

  it('exposes an innocent’s lie and secret without ever producing a murder confession', () => {
    const { state } = perfectPlay(sample(), 'pike')
    expect(state.brokenClaims).toEqual(['trouble'])
    expect(state.revealedSecrets).toEqual(['blackmail'])
  })
})

describe('caseFileSchema', () => {
  it('requires a lie to carry the truth it hides', () => {
    const c = sample()
    delete c.truth.suspects.doyle!.claims[0]!.truth
    expect(caseFileSchema.safeParse(c).success).toBe(false)
  })

  it('only allows sprites the frontend can draw', () => {
    const c = sample()
    ;(c.evidence[0] as { sprite: string }).sprite = 'rocket'
    expect(caseFileSchema.safeParse(c).success).toBe(false)
    ;(c.evidence[0] as { sprite: string }).sprite = 'gun'
    expect(caseFileSchema.safeParse(c).success).toBe(true)
  })

  it('needs every suspect to have a look the portrait renderer can draw', () => {
    const missing = sample()
    delete (missing.suspects[0] as Partial<{ look: unknown }>).look
    expect(caseFileSchema.safeParse(missing).success).toBe(false)

    const wrong = sample()
    ;(wrong.suspects[0]!.look as { hairStyle: string }).hairStyle = 'mohawk'
    expect(caseFileSchema.safeParse(wrong).success).toBe(false)

    const noGlasses = sample()
    delete (noGlasses.suspects[0]!.look as Partial<{ glasses: boolean }>).glasses
    expect(caseFileSchema.safeParse(noGlasses).success).toBe(false)
  })

  it('lowercases trigger keywords so matching is case-insensitive', () => {
    const c = sample()
    c.truth.suspects.doyle!.claims[0]!.triggers = ['Midnight']
    expect(caseFileSchema.parse(c).truth.suspects.doyle!.claims[0]!.triggers).toEqual(['midnight'])
  })
})
