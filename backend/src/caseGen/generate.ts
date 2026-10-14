import { balanceCase } from '../caseFile/balance.js'
import { caseFileSchema, type CaseFile } from '../caseFile/schema.js'
import { validateCaseFile, type Issue } from '../caseFile/validate.js'
import type { LlmProvider } from '../llm/provider.js'
import {
  castProblems,
  castPrompt,
  castSchema,
  evidencePrompt,
  evidenceStageSchema,
  jsonSchemaFor,
  nightProblems,
  nightPrompt,
  nightSchema,
  STAGES,
  type Cast,
  type Culprit,
  type EvidenceStage,
  type Night,
} from './stages.js'

// Writes a whole case with a local model, then PROVES it is playable.
//
// The model is a creative writer here, not a judge: it never decides whether its own case is good. Every
// draft goes through the same deterministic checks as a hand-written case (validateCaseFile, which plays each
// suspect through the real engine). When a check fails, the exact complaints go back to the model and only the
// stage that caused them is written again.

export type Progress = { stage: 'cast' | 'night' | 'evidence' | 'check'; status: 'start' | 'done' | 'retry'; attempt: number; detail?: string; ms?: number }

export type GenerateOptions = {
  /** A one-line flavour hint, e.g. "a riverboat casino in 1948". */
  theme?: string
  /** Which suspect is the killer. By default one is picked from `seed`, so the model cannot favour the first name. */
  culpritId?: string
  /** "Case 0007". Defaults to a random number. */
  number?: string
  /** Names already used by other cases' suspects: the model is told not to reuse them. */
  avoidNames?: string[]
  /** Makes the choice of killer and the case number repeatable. */
  seed?: number
  /** How many times the whole draft may be sent back for repair. */
  maxRepairs?: number
  /** How many times one stage may be re-asked when its JSON does not fit the shape. */
  maxStageAttempts?: number
  onProgress?: (p: Progress) => void
  /** Called with each stage's parsed output, so a long run leaves something to inspect if it fails later. */
  onStageOutput?: (stage: string, output: unknown) => void
}

/** The model could not produce a playable case within the allowed attempts. */
export class CaseGenError extends Error {
  constructor(
    message: string,
    public problems: string[],
    public draft?: unknown,
  ) {
    super(message)
  }
}

// mulberry32: a tiny seeded random generator, so `--seed 7` always picks the same killer
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/** Join the three stages into the case file shape. Does no checking: validation is separate. */
export function assemble(parts: { cast: Cast; night: Night; evidence: EvidenceStage; culpritId: string; number: string }): unknown {
  const { cast, night, evidence, culpritId, number } = parts
  return {
    slug: `case-${number.replace(/\D/g, '')}-${slugify(cast.title) || 'untitled'}`,
    title: cast.title,
    number,
    briefing: cast.briefing,
    culpritId,
    verdictCorrect: night.verdictCorrect,
    verdictWrong: night.verdictWrong,
    suspects: cast.suspects.map(({ persona: _persona, ...profile }) => profile),
    evidence: evidence.evidence.map((e, i) => ({ ...e, tag: `EXH.${String.fromCharCode(65 + i)}` })),
    truth: {
      story: night.story,
      timeline: night.timeline,
      motive: night.motive,
      method: night.method,
      suspects: Object.fromEntries(
        night.suspects.map(({ id, claims, ...truth }) => [
          id,
          {
            persona: cast.suspects.find((s) => s.id === id)?.persona,
            ...truth,
            // the model must write these keys even for a true claim; a stored case simply leaves them out
            claims: claims.map((c) => ({ ...c, truth: c.truth || undefined, exposedNote: c.exposedNote || undefined })),
          },
        ]),
      ),
      edges: evidence.edges,
    },
  }
}

/** Which stage must be rewritten to fix this complaint? Earlier stages win, because later ones are built on them. */
export function stageOf(issue: Issue): 1 | 2 | 3 {
  if (issue.code === 'DUPLICATE_ID') return issue.message.startsWith('Duplicate evidence') ? 3 : issue.message.startsWith('Duplicate suspect') ? 1 : 2
  if (['CULPRIT_UNKNOWN'].includes(issue.code)) return 1
  if (['MISSING_TRUTH', 'UNKNOWN_TRUTH', 'NO_LIE', 'NO_LEAK_MARKERS', 'MARKER_NOT_IN_TRUTH', 'MURDER_COUNT', 'MURDER_NOT_CULPRIT'].includes(issue.code)) return 2
  return 3 // edges, exposability, the chain against the culprit, and the play-through
}

const zodProblems = (error: { issues: { path: PropertyKey[]; message: string }[] }) =>
  error.issues.slice(0, 12).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)

/** Hold an assembled draft to the case-file shape and every case-writing rule. `caseFile` is set only if it passes. */
function draftProblems(draft: unknown): { caseFile?: CaseFile; problems: string[]; issues: Issue[] } {
  const shaped = caseFileSchema.safeParse(draft)
  if (!shaped.success) return { problems: zodProblems(shaped.error), issues: [] }
  // A threshold that is a few points off is arithmetic, not creativity: fix it here (see balanceCase)
  const balanced = balanceCase(shaped.data)
  const issues = validateCaseFile(balanced)
  if (!issues.length) return { caseFile: balanced, problems: [], issues }
  return { problems: issues.map((i) => `[${i.code}] ${i.message}`), issues }
}

export async function generateCase(provider: LlmProvider, opts: GenerateOptions = {}): Promise<{ caseFile: CaseFile; repairs: number }> {
  const progress = opts.onProgress ?? (() => {})
  const maxRepairs = opts.maxRepairs ?? 3
  const maxStageAttempts = opts.maxStageAttempts ?? 3
  const random = rng(opts.seed ?? Date.now())
  // The caller numbers cases in sequence (see catalog.ts); without one, a random number keeps tests and one-offs apart
  const number = opts.number ?? `Case ${String(1000 + Math.floor(random() * 9000))}`

  /**
   * Ask for one stage's JSON and keep asking, with the complaints attached, until it fits the shape and passes
   * `check` (the rules this stage can already be held to). Fixing a stage by itself costs a couple of minutes;
   * finding the same fault only after the NEXT stage was written costs twice that.
   * If the attempts run out, the last answer that fit the shape is returned anyway: the whole-draft check
   * decides what to do with it, and may send the fault back to an earlier stage.
   */
  async function runStage<T>(
    index: 0 | 1 | 2,
    prompt: (feedback: string[], previous?: T) => string,
    schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
    feedback: string[],
    check: (value: T) => string[] = () => [],
    previousAnswer?: T,
  ): Promise<T> {
    const stage = STAGES[index]
    let complaints = feedback
    let lastShaped: { value: T; attempt: number } | undefined
    for (let attempt = 1; attempt <= maxStageAttempts; attempt++) {
      progress({ stage: stage.name, status: 'start', attempt })
      const started = Date.now()
      const raw = await provider.generate({
        system: prompt(complaints, complaints.length ? (lastShaped?.value ?? previousAnswer) : undefined),
        messages: [{ role: 'user', content: 'Write the JSON now.' }],
        task: 'casegen',
        json: jsonSchemaFor(stage.schema),
        maxTokens: stage.maxTokens,
        temperature: complaints.length ? 0.5 : 0.7,
      })

      let problems: string[]
      try {
        const parsed = schema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          problems = check(parsed.data)
          if (!problems.length) {
            progress({ stage: stage.name, status: 'done', attempt, ms: Date.now() - started })
            opts.onStageOutput?.(stage.name, parsed.data)
            return parsed.data
          }
          lastShaped = { value: parsed.data, attempt }
        } else {
          problems = zodProblems(parsed.error)
        }
      } catch {
        problems = ['The answer was not valid JSON (it may have been cut off). Keep it shorter.']
      }
      progress({ stage: stage.name, status: 'retry', attempt, detail: problems.join(' | '), ms: Date.now() - started })
      complaints = problems
    }
    if (lastShaped) {
      progress({ stage: stage.name, status: 'done', attempt: lastShaped.attempt, detail: `still has problems after ${maxStageAttempts} attempts; passing it on` })
      opts.onStageOutput?.(stage.name, lastShaped.value)
      return lastShaped.value
    }
    throw new CaseGenError(`The model could not write a well-formed "${stage.name}" stage after ${maxStageAttempts} attempts`, complaints)
  }

  let cast: Cast | undefined
  let night: Night | undefined
  let evidence: EvidenceStage | undefined
  let culprit: Culprit | undefined
  let feedback: string[] = []
  let restartAt: 1 | 2 | 3 = 1
  let lastDraft: unknown
  let lastProblems: string[] = []

  for (let repairs = 0; repairs <= maxRepairs; repairs++) {
    if (restartAt <= 1 || !cast) {
      cast = await runStage(0, (f, prev) => castPrompt({ theme: opts.theme, avoidNames: opts.avoidNames, feedback: f, previous: prev }), castSchema, restartAt === 1 ? feedback : [], (c) => castProblems(c, opts.avoidNames), restartAt === 1 ? cast : undefined)
      night = evidence = undefined
    }
    if (!culprit || restartAt <= 1) {
      const pick = opts.culpritId ? cast.suspects.find((s) => s.id === opts.culpritId) : cast.suspects[Math.floor(random() * cast.suspects.length)]
      if (!pick) throw new CaseGenError(`culpritId "${opts.culpritId}" is not one of the suspects the model wrote: ${cast.suspects.map((s) => s.id).join(', ')}`, [])
      culprit = { id: pick.id, fullName: pick.fullName, role: pick.role }
    }
    const castNow = cast
    const culpritNow = culprit
    if (restartAt <= 2 || !night) {
      night = await runStage(
        1,
        (f, prev) => nightPrompt({ cast: castNow, culprit: culpritNow, feedback: f, previous: prev }),
        nightSchema,
        restartAt === 2 ? feedback : [],
        (n) => nightProblems(n, { culpritId: culpritNow.id, suspectIds: castNow.suspects.map((s) => s.id) }),
        restartAt === 2 ? night : undefined, // on a repair, show the model the night it is fixing
      )
      evidence = undefined
    }
    const nightNow = night
    if (restartAt <= 3 || !evidence) {
      evidence = await runStage(
        2,
        (f, prev) => evidencePrompt({ cast: castNow, night: nightNow, culprit: culpritNow, feedback: f, previous: prev }),
        evidenceStageSchema,
        restartAt === 3 ? feedback : [],
        // hold the evidence to every case-writing rule now, while only this stage needs rewriting
        (e) => draftProblems(assemble({ cast: castNow, night: nightNow, evidence: e, culpritId: culpritNow.id, number })).problems,
        restartAt === 3 ? evidence : undefined,
      )
    }

    // ---- check the draft: shape first, then the case-writing rules and a play-through ----
    progress({ stage: 'check', status: 'start', attempt: repairs + 1 })
    lastDraft = assemble({ cast, night, evidence, culpritId: culprit.id, number })
    const verdict = draftProblems(lastDraft)
    if (verdict.caseFile) {
      progress({ stage: 'check', status: 'done', attempt: repairs + 1 })
      return { caseFile: verdict.caseFile, repairs }
    }
    lastProblems = verdict.problems
    if (verdict.issues.length) {
      // a recurring complaint after fixing only the evidence means the cause is upstream: go back a stage
      restartAt = Math.min(...verdict.issues.map(stageOf), repairs >= 1 ? 2 : 3) as 1 | 2 | 3
    } else {
      restartAt = 2 // the stage schemas already passed, so what is wrong is how the stages fit together
    }
    progress({ stage: 'check', status: 'retry', attempt: repairs + 1, detail: lastProblems.join(' | ') })
    feedback = lastProblems
  }

  throw new CaseGenError(`The case still breaks the rules after ${maxRepairs} repair rounds`, lastProblems, lastDraft)
}
