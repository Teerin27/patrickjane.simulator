import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { caseFileSchema } from '../caseFile/schema.js'
import { validateCaseFile } from '../caseFile/validate.js'
import type { LlmProvider, LlmRequest } from '../llm/provider.js'
import { assemble, CaseGenError, generateCase, stageOf, type Progress } from './generate.js'
import { castProblems, castSchema, evidenceStageSchema, jsonSchemaFor, nightProblems, nightSchema, type Cast, type EvidenceStage, type Night } from './stages.js'

// Every fixture below is a deep copy, so a test that breaks one cannot damage the next
const sample = loadSampleCase()
const copy = <T>(v: T): T => structuredClone(v)

// The three stage outputs a perfect model would write for the sample case
const goodCast = (): Cast =>
  copy({
    title: sample.title,
    briefing: sample.briefing,
    suspects: sample.suspects.map((s) => ({ ...s, persona: sample.truth.suspects[s.id]!.persona })),
  })
const goodNight = (): Night =>
  copy({
    story: sample.truth.story,
    timeline: sample.truth.timeline,
    motive: sample.truth.motive,
    method: sample.truth.method,
    verdictCorrect: sample.verdictCorrect,
    verdictWrong: sample.verdictWrong,
    suspects: Object.entries(sample.truth.suspects).map(([id, t]) => ({
      id,
      trueWhereabouts: t.trueWhereabouts,
      // the model writes truth and exposedNote for EVERY claim, empty for a true one
      claims: t.claims.map((c) => ({ ...c, truth: c.truth ?? '', exposedNote: c.exposedNote ?? '' })),
      secrets: t.secrets,
    })),
  })
const goodEvidence = (): EvidenceStage =>
  copy({
    evidence: sample.evidence.map(({ tag: _tag, ...e }) => e),
    edges: sample.truth.edges,
  })

type Script = { cast?: unknown[]; night?: unknown[]; evidence?: unknown[] }

/** A fake model that answers each stage from a list (the last entry repeats), and records every request. */
function fakeModel(script: Script = {}) {
  const requests: { stage: 'cast' | 'night' | 'evidence'; req: LlmRequest }[] = []
  const used = { cast: 0, night: 0, evidence: 0 }
  const answers = {
    cast: script.cast ?? [goodCast()],
    night: script.night ?? [goodNight()],
    evidence: script.evidence ?? [goodEvidence()],
  }
  const provider: LlmProvider = {
    async generate(req) {
      const stage = req.system.includes('# STAGE 1 OF 3') ? 'cast' : req.system.includes('# STAGE 2 OF 3') ? 'night' : 'evidence'
      requests.push({ stage, req })
      const list = answers[stage]
      const answer = list[Math.min(used[stage]++, list.length - 1)]
      return typeof answer === 'string' ? answer : JSON.stringify(answer)
    },
  }
  return { provider, requests, count: (stage: string) => requests.filter((r) => r.stage === stage).length }
}

const options = { culpritId: 'doyle', seed: 1 }

describe('generateCase', () => {
  it('writes a valid case from three stages, asking the casegen model for schema-shaped JSON', async () => {
    const model = fakeModel()
    const { caseFile, repairs } = await generateCase(model.provider, options)

    expect(repairs).toBe(0)
    expect(validateCaseFile(caseFile)).toEqual([])
    expect(caseFileSchema.safeParse(caseFile).success).toBe(true)
    expect(caseFile.culpritId).toBe('doyle')
    expect(model.requests.map((r) => r.stage)).toEqual(['cast', 'night', 'evidence'])
    for (const { req } of model.requests) {
      expect(req.task).toBe('casegen')
      expect(req.json).toMatchObject({ type: 'object' })
    }
  })

  it('tells the model who the killer is, and which ids it must use', async () => {
    const model = fakeModel()
    await generateCase(model.provider, options)
    const night = model.requests.find((r) => r.stage === 'night')!.req.system
    expect(night).toContain('THE KILLER IS "doyle"')
    const evidence = model.requests.find((r) => r.stage === 'evidence')!.req.system
    expect(evidence).toContain('ID TABLE')
    expect(evidence).toContain('alibi (LIE)')
    expect(evidence).toContain('murder [murder')
  })

  it('picks the killer itself, repeatably, when none is named', async () => {
    const ids = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const model = fakeModel()
      await generateCase(model.provider, { seed }).catch(() => undefined) // sample data fits only one killer: we only look at the pick
      const night = model.requests.find((r) => r.stage === 'night')!.req.system
      ids.add(/THE KILLER IS "(\w+)"/.exec(night)![1]!)
    }
    expect(ids.size).toBeGreaterThan(1) // not always the first suspect
    const again = fakeModel()
    await generateCase(again.provider, { seed: 3 }).catch(() => undefined)
    const first = fakeModel()
    await generateCase(first.provider, { seed: 3 }).catch(() => undefined)
    expect(again.requests[1]!.req.system).toBe(first.requests[1]!.req.system)
  })

  it('uses the case number it is given, and builds the slug from it', async () => {
    const { caseFile } = await generateCase(fakeModel().provider, { ...options, number: 'Case 0007' })
    expect(caseFile.number).toBe('Case 0007')
    expect(caseFile.slug).toBe('case-0007-patricjane-sim')
  })

  it('tells the cast stage which names are taken, and which looks it may choose from', async () => {
    const model = fakeModel()
    await generateCase(model.provider, { ...options, avoidNames: ['Lorraine Voss', 'Voss', 'doyle'] })
    const cast = model.requests.find((r) => r.stage === 'cast')!.req.system
    expect(cast).toContain('do NOT reuse any first name, surname or id')
    expect(cast).toContain('Lorraine Voss, Voss, doyle')
    expect(cast).toContain('hairStyle (short, slick, long, bun, curly, bob, bald)')
    expect(cast).toContain('make the three look clearly different from each other')
  })

  it('does not mention taken names when there are none', async () => {
    const model = fakeModel()
    await generateCase(model.provider, options)
    expect(model.requests.find((r) => r.stage === 'cast')!.req.system).not.toContain('do NOT reuse')
  })

  it('lists every drawable exhibit sprite, with what each is for, in the evidence stage', async () => {
    const model = fakeModel()
    await generateCase(model.provider, options)
    const evidence = model.requests.find((r) => r.stage === 'evidence')!.req.system
    for (const sprite of ['gun', 'knife', 'photo', 'bottle', 'ledger', 'ring', 'cloth', 'hat', 'watch', 'matchbook', 'key', 'letter', 'ticket', 'glass']) {
      expect(evidence, sprite).toContain(sprite)
    }
    expect(evidence).toContain('gun = revolver or pistol')
  })

  it('assigns exhibit tags, the case number and the slug itself', async () => {
    const { caseFile } = await generateCase(fakeModel().provider, options)
    expect(caseFile.evidence.map((e) => e.tag)).toEqual(['EXH.A', 'EXH.B', 'EXH.C', 'EXH.D'])
    expect(caseFile.number).toMatch(/^Case \d{4}$/)
    expect(caseFile.slug).toMatch(/^case-\d{4}-patricjane-sim$/)
  })

  it('refuses a named killer who is not among the suspects', async () => {
    await expect(generateCase(fakeModel().provider, { culpritId: 'nobody' })).rejects.toThrow(/not one of the suspects/)
  })
})

describe('generateCase: asking again when a stage is malformed', () => {
  it('re-asks a stage whose answer is not JSON', async () => {
    const model = fakeModel({ cast: ['{"title": "Cut off mid-sen', goodCast()] })
    await generateCase(model.provider, options)
    expect(model.count('cast')).toBe(2)
    expect(model.requests.filter((r) => r.stage === 'cast')[1]!.req.system).toContain('not valid JSON')
  })

  it('re-asks a stage whose JSON does not fit the shape, quoting what was wrong', async () => {
    const broken = { ...goodNight(), suspects: goodNight().suspects.slice(0, 2) }
    const model = fakeModel({ night: [broken, goodNight()] })
    await generateCase(model.provider, options)
    expect(model.count('night')).toBe(2)
    expect(model.requests.filter((r) => r.stage === 'night')[1]!.req.system).toContain('suspects:')
  })

  it('gives up on a stage that never fits', async () => {
    const model = fakeModel({ cast: ['nope'] })
    await expect(generateCase(model.provider, { ...options, maxStageAttempts: 2 })).rejects.toThrow(CaseGenError)
    expect(model.count('cast')).toBe(2)
  })
})

describe('generateCase: repairing a draft that breaks the rules', () => {
  it('fixes an evidence problem inside the evidence stage, re-asking with the exact complaint', async () => {
    // Pike's lie is no longer contradicted by anything
    const bad = goodEvidence()
    bad.edges = bad.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'pike'))
    const model = fakeModel({ evidence: [bad, goodEvidence()] })

    const events: Progress[] = []
    const { caseFile, repairs } = await generateCase(model.provider, { ...options, onProgress: (p) => events.push(p) })

    expect(repairs).toBe(0) // never needed the whole-draft repair
    expect(validateCaseFile(caseFile)).toEqual([])
    expect(model.count('cast')).toBe(1)
    expect(model.count('night')).toBe(1)
    expect(model.count('evidence')).toBe(2)
    const retry = model.requests.filter((r) => r.stage === 'evidence')[1]!.req
    expect(retry.system).toContain('LIE_NOT_EXPOSABLE')
    expect(retry.system).toContain("pike's lie \"trouble\"")
    expect(retry.temperature).toBe(0.5)
    expect(events.some((e) => e.stage === 'evidence' && e.status === 'retry')).toBe(true)
  })

  it('fixes a threshold that is a few points off by arithmetic, without asking the model again', async () => {
    const off = goodNight()
    off.suspects.find((s) => s.id === 'doyle')!.secrets[0]!.maxComposure = 20 // perfect play ends at 25
    const model = fakeModel({ night: [off] })

    const { caseFile, repairs } = await generateCase(model.provider, options)

    expect(repairs).toBe(0)
    expect(model.count('night')).toBe(1)
    expect(model.count('evidence')).toBe(1)
    expect(caseFile.truth.suspects.doyle!.secrets[0]!.maxComposure).toBe(25)
    expect(validateCaseFile(caseFile)).toEqual([])
  })

  it('fixes a night that breaks a rule inside the night stage, without writing evidence on top of it', async () => {
    const bad = goodNight()
    for (const c of bad.suspects.find((s) => s.id === 'pike')!.claims) c.isLie = false
    const model = fakeModel({ night: [bad, goodNight()] })

    const { repairs } = await generateCase(model.provider, options)

    expect(repairs).toBe(0)
    expect(model.count('cast')).toBe(1)
    expect(model.count('night')).toBe(2)
    expect(model.count('evidence')).toBe(1) // the faulty night never reached the evidence stage
    expect(model.requests.filter((r) => r.stage === 'night')[1]!.req.system).toContain('"pike" never lies')
  })

  it('moves on with the best shaped answer when a stage cannot fix itself, and lets the whole-draft check decide', async () => {
    const stubborn = goodEvidence()
    stubborn.edges = stubborn.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'pike'))
    // three failed attempts in the evidence stage, then the whole-draft repair re-asks it once more
    const model = fakeModel({ evidence: [stubborn, stubborn, stubborn, goodEvidence()] })

    const { repairs } = await generateCase(model.provider, options)

    expect(repairs).toBe(1)
    expect(model.count('evidence')).toBe(4)
    expect(model.count('night')).toBe(1)
  })

  it('walks back to the night stage when evidence keeps failing, because the cause may be upstream', async () => {
    const stubborn = goodEvidence()
    stubborn.edges = stubborn.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'pike'))
    const model = fakeModel({ evidence: [stubborn, stubborn, stubborn, stubborn, stubborn, stubborn, goodEvidence()] })

    const { repairs } = await generateCase(model.provider, options)

    expect(repairs).toBe(2)
    expect(model.count('night')).toBe(2) // the second repair restarted from the night
    expect(model.count('cast')).toBe(1)
  })

  it('shows the model its own previous answer when it asks again, so it changes only what was wrong', async () => {
    const bad = goodNight()
    for (const c of bad.suspects.find((s) => s.id === 'pike')!.claims) c.isLie = false
    const model = fakeModel({ night: [bad, goodNight()] })

    await generateCase(model.provider, options)

    const [first, retry] = model.requests.filter((r) => r.stage === 'night').map((r) => r.req.system)
    expect(first).not.toContain('Your previous attempt')
    expect(retry).toContain('Change ONLY what the problems require')
    expect(retry).toContain(JSON.stringify(nightSchema.parse(bad))) // the previous answer as parsed, compact
  })

  it('also shows the earlier stage output when the whole-draft repair sends a stage back', async () => {
    const stubborn = goodEvidence()
    stubborn.edges = stubborn.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'pike'))
    const model = fakeModel({ evidence: [stubborn, stubborn, stubborn, goodEvidence()] })

    await generateCase(model.provider, options)

    const fourth = model.requests.filter((r) => r.stage === 'evidence')[3]!.req.system
    expect(fourth).toContain(JSON.stringify(stubborn))
  })

  it('does not include a previous answer when there was none worth showing (the first attempt, or unparseable JSON)', async () => {
    const model = fakeModel({ cast: ['{"title": "Cut off mid-sen', goodCast()] })
    await generateCase(model.provider, options)
    const retry = model.requests.filter((r) => r.stage === 'cast')[1]!.req.system
    expect(retry).toContain('not valid JSON')
    expect(retry).not.toContain('Your previous attempt was this')
  })

  it('stops after the repair budget and says what is still wrong, with the last draft', async () => {
    const bad = goodEvidence()
    bad.edges = bad.edges.filter((e) => !(e.kind === 'contradicts' && e.suspectId === 'pike'))
    const model = fakeModel({ evidence: [bad] })

    const err = await generateCase(model.provider, { ...options, maxRepairs: 2 }).catch((e) => e)

    expect(err).toBeInstanceOf(CaseGenError)
    expect(err.message).toContain('2 repair rounds')
    expect(err.problems.join(' ')).toContain('LIE_NOT_EXPOSABLE')
    expect((err.draft as { truth: unknown }).truth).toBeDefined()
  })

  it('reports each stage as it starts and finishes', async () => {
    const events: Progress[] = []
    await generateCase(fakeModel().provider, { ...options, onProgress: (p) => events.push(p) })
    expect(events.map((e) => `${e.stage}:${e.status}`)).toEqual([
      'cast:start', 'cast:done', 'night:start', 'night:done', 'evidence:start', 'evidence:done', 'check:start', 'check:done',
    ])
  })

  it('hands each parsed stage to the caller, so a long run leaves something to inspect', async () => {
    const seen: string[] = []
    await generateCase(fakeModel().provider, { ...options, onStageOutput: (stage) => seen.push(stage) })
    expect(seen).toEqual(['cast', 'night', 'evidence'])
  })
})

describe('stageOf', () => {
  it.each([
    ['LIE_NOT_EXPOSABLE', 3],
    ['SECRET_UNREACHABLE', 3],
    ['EVIDENCE_UNUSED', 3],
    ['CHAIN_AMBIGUOUS', 3],
    ['PLAY_SECRET_LOCKED', 3],
    ['EDGE_UNKNOWN_CLAIM', 3],
    ['NO_LIE', 2],
    ['NO_LEAK_MARKERS', 2],
    ['MURDER_COUNT', 2],
    ['MISSING_TRUTH', 2],
    ['CULPRIT_UNKNOWN', 1],
  ] as const)('%s belongs to stage %i', (code, stage) => {
    expect(stageOf({ code, message: 'x' })).toBe(stage)
  })

  it('sorts duplicate ids by what was duplicated', () => {
    expect(stageOf({ code: 'DUPLICATE_ID', message: 'Duplicate evidence id: key' })).toBe(3)
    expect(stageOf({ code: 'DUPLICATE_ID', message: 'Duplicate suspect id: pike' })).toBe(1)
    expect(stageOf({ code: 'DUPLICATE_ID', message: 'Suspect "pike" has duplicate claim id: alibi' })).toBe(2)
  })
})

describe('assemble and the stage schemas', () => {
  it('attaches each suspect’s persona to their ground truth and strips it from the public file', () => {
    const draft = assemble({ cast: goodCast(), night: goodNight(), evidence: goodEvidence(), culpritId: 'doyle', number: 'Case 0417' }) as any
    expect(draft.truth.suspects.doyle.persona.voice).toContain('bartender patter')
    expect(draft.suspects[0]).not.toHaveProperty('persona')
    expect(caseFileSchema.safeParse(draft).success).toBe(true)
  })

  it.each([
    ['cast', castSchema],
    ['night', nightSchema],
    ['evidence', evidenceStageSchema],
  ] as const)('the %s stage can be sent to the model as a JSON Schema', (_name, schema) => {
    const json = jsonSchemaFor(schema) as { type: string; properties: object }
    expect(json.type).toBe('object')
    expect(Object.keys(json.properties).length).toBeGreaterThan(0)
  })

  it('makes the model write truth and exposedNote for every claim, and a lie must not leave truth empty', () => {
    const lieWithoutTruth = goodNight()
    lieWithoutTruth.suspects[0]!.claims.find((c) => c.isLie)!.truth = ''
    expect(nightSchema.safeParse(lieWithoutTruth).success).toBe(false)

    const missingKey = goodNight()
    delete (missingKey.suspects[0]!.claims[0] as Partial<{ truth: string }>).truth
    expect(nightSchema.safeParse(missingKey).success).toBe(false)

    const json = JSON.stringify(jsonSchemaFor(nightSchema))
    expect(json).toMatch(/"required":\[[^\]]*"truth"/)
  })

  it('stores a true claim without the empty strings the model had to write', () => {
    const draft = assemble({ cast: goodCast(), night: goodNight(), evidence: goodEvidence(), culpritId: 'doyle', number: 'Case 0417' }) as any
    const truthful = draft.truth.suspects.doyle.claims.find((c: { id: string }) => c.id === 'victor')
    expect(truthful).not.toHaveProperty('truth', '')
    expect(truthful.truth).toBeUndefined()
    expect(truthful.exposedNote).toBeUndefined()
    expect(caseFileSchema.safeParse(draft).success).toBe(true)
  })

  it('makes the model fill in leakMarkers: the key is required, and a lie or a secret must not leave it empty', () => {
    const lieWithoutMarkers = goodNight()
    lieWithoutMarkers.suspects[0]!.claims.find((c) => c.isLie)!.leakMarkers = []
    expect(nightSchema.safeParse(lieWithoutMarkers).success).toBe(false)

    const secretWithoutMarkers = goodNight()
    secretWithoutMarkers.suspects[0]!.secrets[0]!.leakMarkers = []
    expect(nightSchema.safeParse(secretWithoutMarkers).success).toBe(false)

    // a truthful claim may have none
    const truthful = goodNight()
    expect(truthful.suspects.flatMap((s) => s.claims).some((c) => !c.isLie && c.leakMarkers.length === 0)).toBe(true)
    expect(nightSchema.safeParse(truthful).success).toBe(true)

    // and the JSON Schema sent to the model lists the key as required, so it cannot be left out
    const json = JSON.stringify(jsonSchemaFor(nightSchema))
    expect(json).toMatch(/"required":\[[^\]]*"leakMarkers"/)
  })

  it('accepts the sample case’s own stage outputs, so the model is asked for a shape that can be satisfied', () => {
    expect(castSchema.safeParse(goodCast()).success).toBe(true)
    expect(nightSchema.safeParse(goodNight()).success).toBe(true)
    expect(evidenceStageSchema.safeParse(goodEvidence()).success).toBe(true)
  })
})

describe('castProblems', () => {
  const taken = ['Lorraine Voss', 'Voss', 'lorraine', 'Dr. Edmund Pike', 'Michael Doyle']

  it('is happy with the sample cast when nothing is taken', () => {
    expect(castProblems(goodCast())).toEqual([])
  })

  it('catches a surname, a first name or an id that another case already has', () => {
    const cast = goodCast()
    cast.suspects[0]!.fullName = 'Elara Voss'
    cast.suspects[0]!.surname = 'Voss'
    cast.suspects[0]!.id = 'elara'
    const problems = castProblems(cast, taken)
    expect(problems.join(' ')).toContain('"Elara Voss" (id "elara") reuses "voss"')
  })

  it('compares whole words: avoiding "Voss" does not forbid "Vossberg"', () => {
    const cast = goodCast()
    for (const s of cast.suspects) Object.assign(s, { id: `x${s.id}`, surname: `${s.surname}berg`, fullName: `Max ${s.surname}berg` })
    expect(castProblems(cast, ['Voss', 'Pike', 'Doyle'])).toEqual([])
  })

  it('ignores case', () => {
    const cast = goodCast()
    cast.suspects[1]!.fullName = 'EDMUND PIKE'
    expect(castProblems(cast, taken).join(' ')).toContain('reuses "edmund", "pike"')
  })

  it('wants every suspect to have a different id', () => {
    const cast = goodCast()
    cast.suspects[1]!.id = cast.suspects[0]!.id
    expect(castProblems(cast).join(' ')).toContain('the same id')
  })

  it('re-asks the cast stage, with the complaint, when it reuses a name', async () => {
    const reused = goodCast()
    reused.suspects[0]!.fullName = 'Elara Voss'
    const model = fakeModel({ cast: [reused, goodCast()] })
    // the sample cast is itself made of "taken" names, so use names the second answer does not contain
    await generateCase(model.provider, { ...options, avoidNames: ['Elara'] }).catch(() => undefined)
    const casts = model.requests.filter((r) => r.stage === 'cast')
    expect(casts.length).toBeGreaterThanOrEqual(2)
    expect(casts[1]!.req.system).toContain('reuses "elara"')
  })
})

describe('nightProblems', () => {
  const ctx = { culpritId: 'doyle', suspectIds: ['lorraine', 'pike', 'doyle'] }

  it('is happy with the sample night', () => {
    expect(nightProblems(goodNight(), ctx)).toEqual([])
  })

  it('wants every suspect to lie', () => {
    const night = goodNight()
    for (const c of night.suspects.find((s) => s.id === 'lorraine')!.claims) c.isLie = false
    expect(nightProblems(night, ctx)).toEqual(['"lorraine" never lies. Give "lorraine" at least one claim with isLie true, and the truth it hides'])
  })

  it('wants one murder secret, held by the killer only', () => {
    const noMurder = goodNight()
    noMurder.suspects.find((s) => s.id === 'doyle')!.secrets[0]!.kind = 'personal'
    expect(nightProblems(noMurder, ctx).join(' ')).toContain('needs exactly one secret with kind "murder" (found 0)')

    const innocentMurderer = goodNight()
    innocentMurderer.suspects.find((s) => s.id === 'pike')!.secrets[0]!.kind = 'murder'
    expect(nightProblems(innocentMurderer, ctx).join(' ')).toContain('"pike" is innocent of the murder')
  })

  it('wants exactly the suspects from the cast, no more and no fewer', () => {
    const night = goodNight()
    night.suspects[0]!.id = 'ghost'
    const text = nightProblems(night, ctx).join(' ')
    expect(text).toContain('there is no entry for "lorraine"')
    expect(text).toContain('"ghost" is not one of the suspects')
  })

  it('wants claim ids to be unique per suspect', () => {
    const night = goodNight()
    const doyle = night.suspects.find((s) => s.id === 'doyle')!
    doyle.claims[1]!.id = doyle.claims[0]!.id
    expect(nightProblems(night, ctx).join(' ')).toContain('two claims with the same id')
  })
})
