import type { Case, Session } from '@prisma/client'

// Every API response goes through one of these. They whitelist fields so
// ground truth (culprit, reactions, verdict text) can never leak to the client.

export const toPublicCaseSummary = (c: Pick<Case, 'id' | 'slug' | 'title' | 'number'>) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  number: c.number,
})

export const toPublicCase = (c: Case) => ({
  ...toPublicCaseSummary(c),
  suspects: c.suspects.map(({ id, short, surname, role, alibi, opener }) => ({ id, short, surname, role, alibi, opener })),
  evidence: c.evidence.map(({ id, tag, name, sprite, note }) => ({ id, tag, name, sprite, note })),
})

export const toPublicSession = (s: Session) => ({
  id: s.id,
  caseId: s.caseId,
  status: s.status,
  discoveredEvidence: s.discoveredEvidence,
  accusedId: s.accusedId,
  suspects: s.suspects.map(({ suspectId, composure, questionsRemaining, mood, confrontedEvidence, revealedSecrets }) => ({
    suspectId,
    composure,
    questionsRemaining,
    mood,
    confrontedEvidence,
    revealedSecrets,
  })),
})
