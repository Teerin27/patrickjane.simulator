import type { Case, CaseEvidence, CaseSuspect, Player, Session, SuspectState } from '../generated/prisma/client.js'

// Every API response goes through one of these. They whitelist fields so
// ground truth (culprit, reactions, verdict text) can never leak to the client.

export const toPublicCaseSummary = (c: Pick<Case, 'id' | 'slug' | 'title' | 'number'>) => ({
  id: c.id,
  slug: c.slug,
  title: c.title,
  number: c.number,
})

/** One entry of the case list: enough to choose by (the briefing, and who is in it), nothing about what happened. */
export const toPublicCaseCard = (c: Pick<Case, 'id' | 'slug' | 'title' | 'number' | 'briefing'> & { suspects: Pick<CaseSuspect, 'id' | 'short' | 'role' | 'look'>[] }) => ({
  ...toPublicCaseSummary(c),
  briefing: c.briefing,
  suspects: c.suspects.map(({ id, short, role, look }) => ({ id, short, role, look })),
})

export const toPublicCase =(c: Case & { suspects: CaseSuspect[]; evidence: CaseEvidence[] }) => ({
  ...toPublicCaseSummary(c),
  briefing: c.briefing,
  suspects: c.suspects.map(({ id, short, surname, role, alibi, opener, fullName, age, address, tie, whereabouts, look }) => ({
    id,
    look,
    short,
    surname,
    role,
    alibi,
    opener,
    fullName,
    age,
    address,
    tie,
    whereabouts,
  })),
  evidence: c.evidence.map(({ id, tag, name, sprite, note }) => ({ id, tag, name, sprite, note })),
})

// Listings show a player's public face only; the email is part of the account view.
export const toPublicPlayer = (p: Pick<Player, 'id' | 'username' | 'createdAt'>) => ({
  id: p.id,
  username: p.username,
  createdAt: p.createdAt,
})

export const toPlayerAccount = (p: Player) => ({
  ...toPublicPlayer(p),
  email: p.email,
  updatedAt: p.updatedAt,
})

export const toPublicSession =(s: Session & { suspects: SuspectState[] }) => ({
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
