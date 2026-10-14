import type { Claim, Secret, SuspectTruth, Truth } from '../caseFile/schema.js'
import { classifyIntent } from './intent.js'
import type { Intent, Mood, ReplyKind, SuspectState } from './types.js'

// The game's brain. Given the case's ground truth and one player turn, it decides EVERYTHING that matters:
// what the suspect commits to, whether a lie is exposed, how composure moves, whether anything is confessed.
// The LLM only voices the result. Pure: no database, no LLM, no clock, no randomness.

export type TurnAction = { message: string; evidenceId?: string }

/** What the presented exhibit did to this suspect. */
export type EvidenceOutcome = 'none' | 'broke' | 'pressure' | 'supports' | 'nothing'

export type TurnDecision = {
  intent: Intent
  kind: ReplyKind
  mood: Mood
  /** The suspect's state after this turn. (The caller has already charged the question.) */
  state: SuspectState
  /** Claims the suspect states or repeats in this reply, because the player asked about them. */
  stand: Claim[]
  /** Claims disproved by this very turn. */
  brokenNow: Claim[]
  /** Secrets that come out in this reply. */
  revealedNow: Secret[]
  evidence: EvidenceOutcome
  /** The exhibit had already been shown and changed nothing this time. */
  repeat: boolean
}

export const moodFor = (composure: number): Mood =>
  composure > 70 ? 'calm' : composure > 40 ? 'nervous' : composure > 20 ? 'angry' : 'broken'

const addUnique = (list: string[], item: string) => (list.includes(item) ? list : [...list, item])

export const suspectTruth = (truth: Truth, suspectId: string): SuspectTruth => {
  const found = truth.suspects[suspectId]
  if (!found) throw new Error(`No ground truth for suspect "${suspectId}"`)
  return found
}

/** Every exhibit that has to be shown before this secret can come out. */
export const requiredEvidence = (truth: Truth, suspectId: string, secretId: string): string[] =>
  truth.edges.flatMap((e) => (e.kind === 'reveals' && e.suspectId === suspectId && e.secretId === secretId ? [e.evidenceId] : []))

export function decideTurn(truth: Truth, suspectId: string, before: SuspectState, action: TurnAction): TurnDecision {
  const suspect = suspectTruth(truth, suspectId)
  const intent = classifyIntent(action.message, action.evidenceId)
  const message = action.message.toLowerCase()

  let { composure, commitments, brokenClaims, confrontedEvidence, revealedSecrets } = before

  // 1. What is the player asking about? Asking about a topic binds the suspect to their stance on it.
  const stand = intent === 'smalltalk' ? [] : suspect.claims.filter((c) => c.triggers.some((t) => message.includes(t)))
  for (const claim of stand) commitments = addUnique(commitments, claim.id)

  // 2. Evidence. Only edges between this exhibit and THIS suspect matter.
  const brokenNow: Claim[] = []
  let evidence: EvidenceOutcome = 'none'
  const alreadyShown = !!action.evidenceId && confrontedEvidence.includes(action.evidenceId)
  if (action.evidenceId) {
    evidence = 'nothing'
    confrontedEvidence = addUnique(confrontedEvidence, action.evidenceId)
    for (const edge of truth.edges) {
      if (edge.evidenceId !== action.evidenceId || edge.suspectId !== suspectId) continue
      if (edge.kind === 'contradicts') {
        // Only a statement the suspect has already made can be contradicted
        const claim = suspect.claims.find((c) => c.id === edge.claimId)
        if (claim && commitments.includes(claim.id) && !brokenClaims.includes(claim.id)) {
          brokenClaims = addUnique(brokenClaims, claim.id)
          brokenNow.push(claim)
          composure -= edge.weight
          evidence = 'broke'
        }
      } else if (edge.kind === 'implicates') {
        // Pressure lands once per exhibit; showing it again adds nothing
        if (!alreadyShown) {
          composure -= edge.weight
          if (evidence !== 'broke') evidence = 'pressure'
        }
      } else if (edge.kind === 'supports') {
        if (commitments.includes(edge.claimId) && evidence === 'nothing') evidence = 'supports'
      }
    }
  }
  composure = Math.max(0, Math.min(100, composure))

  // 3. Does anything come out? A secret cracks when composure is low enough AND every exhibit tied to it has been shown.
  const revealedNow = suspect.secrets.filter((s) => {
    if (revealedSecrets.includes(s.id)) return false
    const needed = requiredEvidence(truth, suspectId, s.id)
    return needed.length > 0 && composure <= s.maxComposure && needed.every((id) => confrontedEvidence.includes(id))
  })
  for (const secret of revealedNow) revealedSecrets = addUnique(revealedSecrets, secret.id)

  const repeat = !!action.evidenceId && alreadyShown && brokenNow.length === 0 && revealedNow.length === 0
  const kind: ReplyKind = revealedNow.length
    ? 'truth'
    : brokenNow.length
      ? 'contradiction'
      : action.evidenceId || intent === 'accusation'
        ? 'deflect'
        : 'ask'
  const mood: Mood = revealedNow.length ? 'broken' : moodFor(composure)

  return {
    intent,
    kind,
    mood,
    state: { ...before, composure, mood, commitments, brokenClaims, confrontedEvidence, revealedSecrets },
    stand,
    brokenNow,
    revealedNow,
    evidence,
    repeat,
  }
}
