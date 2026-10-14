import { createSuspectState, MAX_QUESTIONS } from '../engine/questions.js'
import { decideTurn, requiredEvidence } from '../engine/turn.js'
import type { SuspectState } from '../engine/types.js'
import type { CaseFile } from './schema.js'

// Deterministic checks on a case file, beyond what the zod shape can say. They enforce the case-writing
// rules from CLAUDE.md, so a hand-written case and an LLM-generated one are held to the same standard:
//   1. every suspect lies about something
//   2. the culprit is provable through a chain of evidence that points to them and only them
//   3. no dead ends: every lie can be exposed, and every secret can come out
// and they prove it by actually playing each suspect through the engine.

export type Issue = {
  /** Stable machine-readable code, e.g. LIE_NOT_EXPOSABLE. */
  code: string
  message: string
}

export function validateCaseFile(c: CaseFile): Issue[] {
  const issues: Issue[] = []
  const add = (code: string, message: string) => issues.push({ code, message })

  const suspectIds = c.suspects.map((s) => s.id)
  const evidenceIds = c.evidence.map((e) => e.id)

  // ---- identity and references ----
  for (const [list, what] of [[suspectIds, 'suspect'], [evidenceIds, 'evidence']] as const) {
    const dupes = list.filter((id, i) => list.indexOf(id) !== i)
    if (dupes.length) add('DUPLICATE_ID', `Duplicate ${what} id: ${[...new Set(dupes)].join(', ')}`)
  }
  if (!suspectIds.includes(c.culpritId)) add('CULPRIT_UNKNOWN', `culpritId "${c.culpritId}" is not one of the suspects`)

  const truthIds = Object.keys(c.truth.suspects)
  for (const id of suspectIds) if (!truthIds.includes(id)) add('MISSING_TRUTH', `Suspect "${id}" has no entry in truth.suspects`)
  for (const id of truthIds) if (!suspectIds.includes(id)) add('UNKNOWN_TRUTH', `truth.suspects has "${id}", who is not a suspect`)

  for (const [suspectId, t] of Object.entries(c.truth.suspects)) {
    for (const [list, what] of [[t.claims.map((x) => x.id), 'claim'], [t.secrets.map((x) => x.id), 'secret']] as const) {
      const dupes = list.filter((id, i) => list.indexOf(id) !== i)
      if (dupes.length) add('DUPLICATE_ID', `Suspect "${suspectId}" has duplicate ${what} id: ${[...new Set(dupes)].join(', ')}`)
    }
  }

  let edgesOk = true
  const badEdge = (code: string, message: string) => {
    edgesOk = false
    add(code, message)
  }
  c.truth.edges.forEach((e, i) => {
    const where = `edge ${i} (${e.kind} ${e.evidenceId} -> ${e.suspectId})`
    if (!evidenceIds.includes(e.evidenceId)) badEdge('EDGE_UNKNOWN_EVIDENCE', `${where}: no such exhibit`)
    const t = c.truth.suspects[e.suspectId]
    if (!t) return badEdge('EDGE_UNKNOWN_SUSPECT', `${where}: no such suspect`)
    if ('claimId' in e && !t.claims.some((x) => x.id === e.claimId)) badEdge('EDGE_UNKNOWN_CLAIM', `${where}: ${e.suspectId} has no claim "${e.claimId}"`)
    if ('secretId' in e && !t.secrets.some((x) => x.id === e.secretId)) badEdge('EDGE_UNKNOWN_SECRET', `${where}: ${e.suspectId} has no secret "${e.secretId}"`)
    // An exhibit cannot disprove something that is true
    if (e.kind === 'contradicts' && t.claims.some((x) => x.id === e.claimId && !x.isLie)) add('CONTRADICTS_TRUTH', `${where}: claim "${e.claimId}" is true, so nothing can contradict it`)
  })

  // ---- rule 1: every suspect lies about something ----
  for (const [id, t] of Object.entries(c.truth.suspects)) {
    if (!t.claims.some((x) => x.isLie)) add('NO_LIE', `Suspect "${id}" never lies. Every suspect must lie about something`)
  }

  // ---- rule 3: no dead ends ----
  for (const [id, t] of Object.entries(c.truth.suspects)) {
    for (const claim of t.claims.filter((x) => x.isLie)) {
      if (!c.truth.edges.some((e) => e.kind === 'contradicts' && e.suspectId === id && e.claimId === claim.id)) {
        add('LIE_NOT_EXPOSABLE', `${id}'s lie "${claim.id}" has no exhibit that contradicts it`)
      }
      if (!claim.leakMarkers.length) add('NO_LEAK_MARKERS', `${id}'s lie "${claim.id}" needs leakMarkers so the guard can protect its truth`)
      else if (!claim.leakMarkers.some((m) => (claim.truth ?? '').toLowerCase().includes(m))) {
        add('MARKER_NOT_IN_TRUTH', `${id}'s lie "${claim.id}": at least one leakMarker must appear word for word in its truth text, or the admission can never be checked`)
      }
    }
    for (const secret of t.secrets) {
      if (!requiredEvidence(c.truth, id, secret.id).length) add('SECRET_UNREACHABLE', `${id}'s secret "${secret.id}" has no exhibit with a "reveals" edge`)
      if (!secret.leakMarkers.length) add('NO_LEAK_MARKERS', `${id}'s secret "${secret.id}" needs leakMarkers so the guard can protect it`)
      else if (!secret.leakMarkers.some((m) => secret.description.toLowerCase().includes(m))) {
        add('MARKER_NOT_IN_TRUTH', `${id}'s secret "${secret.id}": at least one leakMarker must appear word for word in its description, or the confession can never be checked`)
      }
    }
  }
  for (const e of c.evidence) {
    if (!c.truth.edges.some((x) => x.evidenceId === e.id)) add('EVIDENCE_UNUSED', `Exhibit "${e.id}" is linked to nobody`)
  }

  // ---- rule 2: the culprit, and only the culprit, is provable ----
  const murders = Object.entries(c.truth.suspects).flatMap(([id, t]) => t.secrets.filter((s) => s.kind === 'murder').map((s) => ({ id, secret: s })))
  if (murders.length !== 1) {
    add('MURDER_COUNT', `Exactly one murder secret is required, found ${murders.length}`)
  } else {
    const murder = murders[0]!
    if (murder.id !== c.culpritId) add('MURDER_NOT_CULPRIT', `The murder secret belongs to "${murder.id}", not the culprit "${c.culpritId}"`)
    const chain = requiredEvidence(c.truth, murder.id, murder.secret.id)
    if (chain.length < 2) add('CHAIN_TOO_SHORT', 'The case against the culprit must rest on at least two exhibits')
    for (const evidenceId of chain) {
      const pointsTo = new Set(c.truth.edges.flatMap((e) => (e.kind === 'implicates' && e.evidenceId === evidenceId ? [e.suspectId] : [])))
      if (!pointsTo.has(c.culpritId)) add('CHAIN_NOT_POINTING', `Exhibit "${evidenceId}" is needed against the culprit but does not implicate them`)
      for (const other of pointsTo) {
        if (other !== c.culpritId) add('CHAIN_AMBIGUOUS', `Exhibit "${evidenceId}" is needed against the culprit but also implicates "${other}"`)
      }
    }
  }

  // ---- prove it by playing: only meaningful once the references above hold ----
  if (!issues.length && edgesOk) {
    for (const id of suspectIds) {
      const result = perfectPlay(c, id)
      const t = c.truth.suspects[id]!
      const unbroken = t.claims.filter((x) => x.isLie && !result.state.brokenClaims.includes(x.id)).map((x) => x.id)
      const locked = t.secrets.filter((s) => !result.state.revealedSecrets.includes(s.id))
      if (unbroken.length) add('PLAY_LIE_SURVIVES', `Playing ${id} perfectly still leaves these lies standing: ${unbroken.join(', ')}`)
      for (const secret of locked) {
        // Say what the numbers are, so whoever fixes it (a person, or the generator's model) knows how far off they are
        const reached = result.state.composure
        add(
          'PLAY_SECRET_LOCKED',
          `Playing ${id} perfectly ends at composure ${reached}, but "${secret.id}" only cracks at ${secret.maxComposure} or lower. Raise the weights of the contradicts/implicates edges against ${id} so composure falls to ${secret.maxComposure} or below, or raise that secret's maxComposure to at least ${reached}`,
        )
      }
      if (result.questions > MAX_QUESTIONS) add('PLAY_TOO_LONG', `${id} needs ${result.questions} questions to crack; the limit is ${MAX_QUESTIONS}`)
    }
  }

  return issues
}

/**
 * The best a player can do against one suspect: ask about every lie so they commit, then put every
 * exhibit tied to them on the table. Returns the final state and how many questions it took.
 */
export function perfectPlay(c: CaseFile, suspectId: string): { state: SuspectState; questions: number } {
  let state = createSuspectState(suspectId)
  let questions = 0
  // The engine does not care about the question counter, so count here and play on past the limit:
  // the validator reports "too long" instead of silently stopping.
  const turn = (message: string, evidenceId?: string) => {
    questions++
    state = decideTurn(c.truth, suspectId, state, { message, evidenceId }).state
  }

  const t = c.truth.suspects[suspectId]!
  for (const claim of t.claims.filter((x) => x.isLie)) turn(claim.triggers[0]!)
  const mine = [...new Set(c.truth.edges.filter((e) => e.suspectId === suspectId).map((e) => e.evidenceId))]
  // exhibits that break lies first, then the rest
  const breakers = new Set(c.truth.edges.flatMap((e) => (e.kind === 'contradicts' && e.suspectId === suspectId ? [e.evidenceId] : [])))
  for (const evidenceId of [...mine.filter((x) => breakers.has(x)), ...mine.filter((x) => !breakers.has(x))]) turn('Explain this.', evidenceId)
  return { state, questions }
}
