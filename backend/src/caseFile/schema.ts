import { z } from 'zod'

// The case file: everything about one case, in one validated shape. Hand-written cases and
// LLM-generated cases both end up here, and the database stores exactly this.
//
// Two halves:
//  - public: what the player may see (police files, exhibits, the briefing)
//  - truth:  what really happened. SERVER ONLY, never sent to the client.
//
// TODO(later): move to packages/shared so the web app can reuse the public half (see CLAUDE.md).

const id = z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, 'lowercase letters, digits and underscores')
const text = (max: number) => z.string().trim().min(1).max(max)
const keyword = z.string().trim().toLowerCase().min(2).max(30)

// ---------- public half ----------

export const whereaboutSchema = z.object({ time: text(12), place: text(80) })

/**
 * What a suspect looks like. A fixed vocabulary, so the case writer (a person or a model) picks from choices
 * the game can actually draw, and so every generated suspect gets a portrait (frontend/src/lib/pixel.ts).
 * Adding a value here means teaching the portrait renderer to draw it.
 */
export const LOOK = {
  skin: ['fair', 'light', 'tan', 'brown', 'dark'],
  hairStyle: ['short', 'slick', 'long', 'bun', 'curly', 'bob', 'bald'],
  hairColor: ['black', 'brown', 'auburn', 'blond', 'gray', 'white'],
  facialHair: ['none', 'mustache', 'beard', 'stubble'],
  outfit: ['suit', 'vest', 'dress', 'uniform', 'apron', 'coat'],
  outfitColor: ['navy', 'charcoal', 'brown', 'green', 'crimson', 'teal', 'plum', 'cream'],
} as const

export const lookSchema = z.object({
  skin: z.enum(LOOK.skin),
  hairStyle: z.enum(LOOK.hairStyle),
  hairColor: z.enum(LOOK.hairColor),
  facialHair: z.enum(LOOK.facialHair),
  glasses: z.boolean(),
  hat: z.boolean(),
  outfit: z.enum(LOOK.outfit),
  outfitColor: z.enum(LOOK.outfitColor),
})

/** Police-file data only. A suspect's lies, secrets and role in the crime live in `truth`. */
export const suspectProfileSchema = z.object({
  id,
  look: lookSchema,
  short: text(16),
  surname: text(30),
  role: text(30),
  /** What they told the police, in one line. */
  alibi: text(160),
  /** First line when the interview starts. */
  opener: text(200),
  /** Last line once they have lawyered up. */
  closer: text(160),
  fullName: text(60),
  age: z.number().int().min(16).max(99),
  address: text(80),
  tie: text(120),
  /** Where they CLAIM to have been. Whether that is true stays in `truth`. */
  whereabouts: z.array(whereaboutSchema).min(2).max(6),
})

// The exhibit sprites the frontend can draw (frontend/src/lib/pixel.ts). A new exhibit needs one of these, so it
// is worth keeping the list broad: pick the one that looks most like the object.
export const SPRITES = [
  'key', 'letter', 'ticket', 'glass',
  'gun', 'knife', 'photo', 'bottle', 'ledger', 'ring', 'cloth', 'hat', 'watch', 'matchbook',
] as const

export const evidenceSchema = z.object({
  id,
  tag: text(10),
  name: text(40),
  sprite: z.enum(SPRITES),
  note: text(200),
})

// ---------- truth half ----------

/** A statement a suspect makes once asked, and is then bound to. */
export const claimShape = z.object({
    id,
    /** The stance in the suspect's own words (first person). The LLM voices it; it does not invent it. */
    statement: text(200),
    /** If the player's message contains any of these, the suspect commits to this claim. Lowercase. */
    triggers: z.array(keyword).min(1).max(10),
    isLie: z.boolean(),
    /**
     * What really happened, in the suspect's own voice (first person: "I left the bar at 11:45.").
     * Required for a lie. Only shown to the LLM once the lie is broken, and used word for word as the
     * fallback admission if the model fails.
     */
    truth: text(240).optional(),
    /** One line for the player's notes when the lie is exposed ("Voss lied: she was in the office."). */
    exposedNote: text(120).optional(),
    /** Distinctive words that would only appear if `truth` leaked. The guard rejects replies containing them early. */
    leakMarkers: z.array(keyword).max(8).default([]),
})

/** A lie must carry the truth it hides. A function so schemas built from `claimShape` (the generator's) can reuse it. */
export const lieNeedsTruth = <T extends z.ZodType<{ isLie: boolean; truth?: string | undefined }>>(schema: T) =>
  schema.refine((c) => !c.isLie || !!c.truth, { message: 'a lie needs the truth it hides', path: ['truth'] })

export const claimSchema = lieNeedsTruth(claimShape)

/** Something a suspect hides. The murder, for the culprit; a personal matter, for anyone. */
export const secretSchema = z.object({
  id,
  kind: z.enum(['murder', 'personal']),
  /** What they admit when it comes out, in their own voice (first person). */
  description: text(240),
  leakMarkers: z.array(keyword).max(8).default([]),
  /**
   * They crack once composure is at or below this AND every exhibit with a `reveals` edge to this
   * secret has been put in front of them.
   */
  maxComposure: z.number().int().min(0).max(100),
})

export const personaSchema = z.object({
  /** How they talk: vocabulary, rhythm, habits. */
  voice: text(240),
  temperament: text(160),
  /** Who they are, in a couple of sentences. Safe to show the LLM: it holds no secrets. */
  background: text(240),
  /** Spoken if the model fails or says something the guard rejects. In character, reveals nothing. */
  fallbackLines: z.array(text(160)).min(2).max(5),
})

export const suspectTruthSchema = z.object({
  persona: personaSchema,
  /** Where they REALLY were. */
  trueWhereabouts: z.array(whereaboutSchema).min(2).max(8),
  claims: z.array(claimSchema).min(1).max(6),
  secrets: z.array(secretSchema).max(3),
})

/**
 * The evidence graph. Each edge links one exhibit to one suspect:
 *  - contradicts: the exhibit disproves a claim. Hurts only if the suspect already committed to it.
 *  - supports:    the exhibit backs a claim up. No effect on composure.
 *  - implicates:  the exhibit points at the suspect. Adds pressure.
 *  - reveals:     the exhibit is part of what it takes to expose a secret.
 */
export const edgeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contradicts'), evidenceId: id, suspectId: id, claimId: id, weight: z.number().int().min(5).max(60) }),
  z.object({ kind: z.literal('supports'), evidenceId: id, suspectId: id, claimId: id }),
  z.object({ kind: z.literal('implicates'), evidenceId: id, suspectId: id, weight: z.number().int().min(1).max(40) }),
  z.object({ kind: z.literal('reveals'), evidenceId: id, suspectId: id, secretId: id }),
])

export const truthSchema = z.object({
  /** What really happened, as prose. For authors and the generator; never sent to the chat model. */
  story: text(700),
  timeline: z.array(z.object({ time: text(12), event: text(200) })).min(3).max(12),
  motive: text(240),
  method: text(240),
  suspects: z.record(id, suspectTruthSchema),
  edges: z.array(edgeSchema).max(60),
})

export const caseFileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/, 'lowercase letters, digits and hyphens'),
  title: text(60),
  number: text(20),
  /** What the player is told up front: where, who died, when it was found. */
  briefing: text(500),
  culpritId: id,
  verdictCorrect: text(400),
  verdictWrong: text(400),
  suspects: z.array(suspectProfileSchema).min(3).max(5),
  evidence: z.array(evidenceSchema).min(4).max(10),
  truth: truthSchema,
})

export type Look = z.infer<typeof lookSchema>
export type Whereabout = z.infer<typeof whereaboutSchema>
export type SuspectProfile = z.infer<typeof suspectProfileSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type Claim = z.infer<typeof claimSchema>
export type Secret = z.infer<typeof secretSchema>
export type Persona = z.infer<typeof personaSchema>
export type SuspectTruth = z.infer<typeof suspectTruthSchema>
export type Edge = z.infer<typeof edgeSchema>
export type Truth = z.infer<typeof truthSchema>
export type CaseFile = z.infer<typeof caseFileSchema>
