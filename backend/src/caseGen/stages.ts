import { z } from 'zod'
import { claimShape, evidenceSchema, edgeSchema, lieNeedsTruth, LOOK, personaSchema, secretSchema, suspectProfileSchema, suspectTruthSchema, SPRITES } from '../caseFile/schema.js'

// A case is written in three small stages instead of one huge request. A local model writes ~4 tokens a
// second here, so each stage stays short enough to finish, and a stage that goes wrong can be redone
// without throwing away the others.
//
//   1. CAST      the suspects: who they are, how they talk, what they tell the police    (category 1)
//   2. NIGHT     what really happened: the true timeline, every lie and secret            (category 2)
//   3. EVIDENCE  the exhibits found, and how each one bears on each suspect's story       (category 2)
//
// The shapes below are sent to the model as a JSON Schema (it cannot answer in any other shape) and checked
// again with zod afterwards, because a schema cannot express lengths and patterns reliably.

// ---------- stage 1: cast ----------

export const castSchema = z.object({
  title: z.string().trim().min(1).max(60),
  /** Where, when, who died, when the body was found. Written for the player. */
  briefing: z.string().trim().min(1).max(500),
  suspects: z.array(suspectProfileSchema.extend({ persona: personaSchema })).length(3),
})

// ---------- stage 2: night ----------

// In a stored case `leakMarkers` defaults to empty, which makes the key optional in the JSON Schema, and a small
// model then simply leaves it out, so the guard would protect nothing. In the model's answer the key is REQUIRED
// (it may be empty for a truthful claim); a lie or a secret must fill it.
const markers = z.array(z.string().trim().toLowerCase().min(2).max(30)).max(8)
// The same reasoning applies to `truth` and `exposedNote`: optional keys are skipped by the model even for a lie.
// Here they are required, empty for a true claim; assemble() drops the empties again.
const nightClaimSchema = lieNeedsTruth(
  claimShape.extend({ truth: z.string().trim().max(240), exposedNote: z.string().trim().max(120), leakMarkers: markers }),
).refine((c) => !c.isLie || c.leakMarkers.length > 0, {
  message: 'a lie needs at least one leakMarker',
  path: ['leakMarkers'],
})
const nightSecretSchema = secretSchema.extend({ leakMarkers: markers.min(1) })

const nightSuspectSchema = suspectTruthSchema
  .omit({ persona: true })
  .extend({ id: suspectProfileSchema.shape.id, claims: z.array(nightClaimSchema).min(1).max(6), secrets: z.array(nightSecretSchema).max(3) })

export const nightSchema = z.object({
  story: z.string().trim().min(1).max(700),
  timeline: z.array(z.object({ time: z.string().trim().min(1).max(12), event: z.string().trim().min(1).max(200) })).min(3).max(12),
  motive: z.string().trim().min(1).max(240),
  method: z.string().trim().min(1).max(240),
  verdictCorrect: z.string().trim().min(1).max(400),
  verdictWrong: z.string().trim().min(1).max(400),
  suspects: z.array(nightSuspectSchema).length(3),
})

// ---------- stage 3: evidence ----------

export const evidenceStageSchema = z.object({
  // `tag` (EXH.A, EXH.B, ...) is assigned by the generator, not the model
  evidence: z.array(evidenceSchema.omit({ tag: true })).min(4).max(8),
  edges: z.array(edgeSchema).min(8).max(40),
})

/**
 * What can be checked about the cast right away: ids are unique, and no suspect reuses a name the game already
 * has. (A model told "do not reuse these names" reuses them anyway, so it is checked, not trusted.)
 */
export function castProblems(cast: Cast, avoidNames: string[] = []): string[] {
  const problems: string[] = []
  const ids = cast.suspects.map((s) => s.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dup.length) problems.push(`suspects have the same id (${[...new Set(dup)].join(', ')}). Every suspect needs a different id`)

  // Compare whole words, so avoiding "Voss" catches "Elara Voss" and "voss" but not "Vossberg"
  const words = (s: string) => s.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 1)
  const taken = new Set(avoidNames.flatMap(words))
  for (const s of cast.suspects) {
    const reused = [...new Set(words(`${s.fullName} ${s.surname} ${s.id}`))].filter((w) => taken.has(w))
    if (reused.length) problems.push(`"${s.fullName}" (id "${s.id}") reuses ${reused.map((w) => `"${w}"`).join(', ')}, which another case already has. Pick a different first name, surname and id`)
  }
  return problems
}

/**
 * The case-writing rules a night can already be held to before any evidence exists. Checking here, in the
 * stage that caused the fault, means a night that breaks them is rewritten alone instead of after the (slow)
 * evidence stage has been written on top of it.
 */
export function nightProblems(night: Night, ctx: { culpritId: string; suspectIds: string[] }): string[] {
  const problems: string[] = []
  const ids = night.suspects.map((s) => s.id)
  for (const id of ctx.suspectIds) if (!ids.includes(id)) problems.push(`suspects: there is no entry for "${id}". Write one entry for each of: ${ctx.suspectIds.join(', ')}`)
  for (const id of ids) if (!ctx.suspectIds.includes(id)) problems.push(`suspects: "${id}" is not one of the suspects. Use only: ${ctx.suspectIds.join(', ')}`)

  for (const s of night.suspects) {
    if (!s.claims.some((c) => c.isLie)) problems.push(`"${s.id}" never lies. Give "${s.id}" at least one claim with isLie true, and the truth it hides`)
    const dupClaims = s.claims.map((c) => c.id).filter((id, i, all) => all.indexOf(id) !== i)
    if (dupClaims.length) problems.push(`"${s.id}" has two claims with the same id (${[...new Set(dupClaims)].join(', ')}). Every claim id must be unique`)
    const murders = s.secrets.filter((x) => x.kind === 'murder').length
    if (s.id === ctx.culpritId && murders !== 1) problems.push(`"${s.id}" is the killer and needs exactly one secret with kind "murder" (found ${murders})`)
    if (s.id !== ctx.culpritId && murders > 0) problems.push(`"${s.id}" is innocent of the murder and must not have a secret with kind "murder". Make it kind "personal"`)
  }
  return problems
}

export type Cast = z.infer<typeof castSchema>
export type Night = z.infer<typeof nightSchema>
export type EvidenceStage = z.infer<typeof evidenceStageSchema>

export const STAGES = [
  { n: 1, name: 'cast', schema: castSchema, maxTokens: 3000 },
  { n: 2, name: 'night', schema: nightSchema, maxTokens: 4500 },
  { n: 3, name: 'evidence', schema: evidenceStageSchema, maxTokens: 3000 },
] as const

/** The JSON Schema handed to the model for a stage. */
export const jsonSchemaFor = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as object

// ---------- prompts ----------

const WRITER = `You are a mystery writer designing one short 1940s noir murder case for a detective interrogation game. The player questions three suspects and wins by exposing lies with evidence until the killer breaks. Everything is fiction. Write in English. Be concrete and specific: names, times, places, objects.`

const RULES = `Case-writing rules:
1. Every suspect lies about something.
2. The killer can be proved guilty by a chain of exhibits that point to them and ONLY them.
3. No dead ends: every lie can be exposed by an exhibit, and every secret can come out.
Innocent suspects have their own secrets too (an affair, a debt, a crime), so everyone looks suspicious.`

const JSON_ONLY = 'Answer with one JSON object that follows the schema exactly, and nothing else.'

export type Culprit = { id: string; fullName: string; role: string }

/**
 * What goes at the end of a stage prompt when it is being rewritten. Showing the model its own previous answer
 * matters: told only "suspect X never lies", it rewrites everything and over-corrects (every claim becomes a lie,
 * none with a truth). Given the answer, it can change just the part that was wrong.
 */
export function repairBlock(feedback?: string[], previous?: unknown): string {
  if (!feedback?.length) return ''
  const problems = `\nYour previous attempt had these problems. Fix them:\n${feedback.map((f) => `- ${f}`).join('\n')}\n`
  if (previous === undefined) return problems
  return `${problems}\nYour previous attempt was this. Change ONLY what the problems require, and keep everything else exactly as it is:\n${JSON.stringify(previous)}\n`
}

export function castPrompt(opts: { theme?: string; avoidNames?: string[]; feedback?: string[]; previous?: unknown }) {
  return `${WRITER}

# STAGE 1 OF 3: THE CAST
Invent the setting and exactly three suspects.${opts.theme ? ` Setting: ${opts.theme}.` : ''}${
    opts.avoidNames?.length ? `\nThe game already has suspects with these names, so do NOT reuse any first name, surname or id from them: ${opts.avoidNames.join(', ')}.` : ''
  }

Write:
- title: a short case title.
- briefing: 2 to 3 sentences for the player: where and when, who died and how, when the body was found. Do not say who did it.
- suspects: three people who were all close enough to have done it. For each:
  - id: lowercase first name or nickname, letters only (for example "marta").
  - short: surname in capitals for a label, at most 10 characters, like "L. VOSS".
  - surname, role (their job), fullName, age (16 to 99), address, tie (one line: their link to the victim).
  - alibi: one line, what they tell the police.
  - look: how they are drawn. Choose from these values only: skin (${LOOK.skin.join(', ')}); hairStyle (${LOOK.hairStyle.join(', ')}); hairColor (${LOOK.hairColor.join(', ')}); facialHair (${LOOK.facialHair.join(', ')}); glasses (true or false); hat (true or false); outfit (${LOOK.outfit.join(', ')}); outfitColor (${LOOK.outfitColor.join(', ')}). Make it fit their age, job and personality, and make the three look clearly different from each other.
  - whereabouts: 3 entries { time, place } of where they CLAIM to have been.
  - opener: the first thing they say when the interview starts. closer: what they say when they refuse to talk any more.
  - persona: voice (how they talk), temperament, background (2 sentences, no secrets), fallbackLines (3 short in-character lines that reveal nothing).
Make the three clearly different people with different voices.
${repairBlock(opts.feedback, opts.previous)}
${JSON_ONLY}`
}

export function nightPrompt(opts: { cast: Cast; culprit: Culprit; feedback?: string[]; previous?: unknown }) {
  const { cast, culprit } = opts
  const people = cast.suspects.map((s) => `- id "${s.id}": ${s.fullName}, ${s.role}. ${s.tie} Tells police: ${s.alibi}`).join('\n')
  return `${WRITER}

${RULES}

# STAGE 2 OF 3: WHAT REALLY HAPPENED
Case: ${cast.title}. ${cast.briefing}
Suspects:
${people}

THE KILLER IS "${culprit.id}" (${culprit.fullName}, ${culprit.role}). The other two are innocent of the murder.

Write the ground truth:
- story: what really happened, 3 to 5 sentences. timeline: 5 to 8 entries { time, event } in order. motive. method.
- verdictCorrect: one or two sentences shown when the player accuses the killer. verdictWrong: shown when they accuse an innocent.
- suspects: one entry per suspect id (all three), each with:
  - trueWhereabouts: where they REALLY were, 3 to 4 entries { time, place }.
  - claims: 2 to 3 statements the suspect will make when asked. Each has:
      id (lowercase letters, unique for that suspect, for example "alibi"),
      statement (first person, what they claim),
      triggers (3 to 6 lowercase words a player would use when asking about it, for example ["alibi","midnight","where were you"]),
      isLie (true or false),
      truth (FIRST PERSON, what really happened. REQUIRED and non-empty when isLie is true; "" when the claim is true),
      exposedNote (one short line for the player's notes when the lie is exposed; "" when the claim is true),
      leakMarkers (2 to 5 short, distinctive lowercase words or phrases that appear WORD FOR WORD in your truth text, such as place names, objects, times. They are how the game checks the admission was really made).
    EVERY suspect has at least one claim with isLie true. Keep at least one claim per suspect that is true.
  - secrets: what they are hiding, in first person.
      The killer has exactly one secret with kind "murder": the full confession, in first person. maxComposure between 20 and 35.
      Each innocent has one secret with kind "personal" (not the murder). maxComposure between 55 and 75.
      Each secret has id, kind, description, leakMarkers (2 to 5, as above: words that appear word for word in the description), maxComposure.
Use ids exactly as given. Do not invent a fourth suspect.
${repairBlock(opts.feedback, opts.previous)}
${JSON_ONLY}`
}

export function evidencePrompt(opts: { cast: Cast; night: Night; culprit: Culprit; feedback?: string[]; previous?: unknown }) {
  const { cast, night, culprit } = opts
  const table = night.suspects
    .map((s) => {
      const claims = s.claims.map((c) => `${c.id}${c.isLie ? ' (LIE)' : ' (true)'}`).join(', ')
      const secrets = s.secrets.map((x) => `${x.id} [${x.kind}, cracks at composure ${x.maxComposure}]`).join(', ')
      return `- "${s.id}": claims: ${claims || 'none'}; secrets: ${secrets || 'none'}`
    })
    .join('\n')
  return `${WRITER}

${RULES}

# STAGE 3 OF 3: THE EVIDENCE
Case: ${cast.title}. ${cast.briefing}
What really happened: ${night.story}
Method: ${night.method}. Motive: ${night.motive}
The killer is "${culprit.id}".

ID TABLE (use these ids exactly):
${table}

Write 5 to 6 exhibits and the edges that link them to the suspects.
- evidence: each { id (lowercase letters), name (2 to 3 words), sprite (the picture drawn for it. One of: ${SPRITES.join(', ')}. Pick the one that looks most like the object: gun = revolver or pistol, knife = blade or letter opener, photo = photograph, bottle = bottle or flask, ledger = account book, diary or notebook, ring = ring or jewellery, cloth = handkerchief, scarf or stained rag, hat = hat or cap, watch = pocket or wrist watch, matchbook = matches or cigarette case, key, letter = note or document, ticket = ticket or receipt, glass = drinking glass), note (what the player reads: 1 to 2 factual sentences about what was found and where; describe it, never explain what it proves) }.
- edges: each links ONE exhibit to ONE suspect, and is one of:
    { "kind": "contradicts", "evidenceId", "suspectId", "claimId", "weight" }   the exhibit disproves one of that suspect's LIE claims. weight 20 to 40.
    { "kind": "implicates", "evidenceId", "suspectId", "weight" }               the exhibit points at that suspect. weight 5 to 15.
    { "kind": "reveals", "evidenceId", "suspectId", "secretId" }                the exhibit is part of what it takes to expose that secret.
    { "kind": "supports", "evidenceId", "suspectId", "claimId" }                the exhibit backs up one of that suspect's TRUE claims. Optional.
Requirements:
- Every LIE claim in the ID TABLE has at least one "contradicts" edge. Never "contradicts" a true claim.
- Every secret has at least one "reveals" edge.
- The killer's murder secret has "reveals" edges from at least TWO exhibits. Each of those exhibits "implicates" the killer ("${culprit.id}"), and NONE of them implicates anyone else.
- Every exhibit appears in at least one edge.
- Each innocent's lie is exposed by an exhibit that is not needed against the killer.
${repairBlock(opts.feedback, opts.previous)}
${JSON_ONLY}`
}
