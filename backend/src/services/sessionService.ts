import { z } from 'zod'
import type { Session, SuspectState } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { createSuspectState, isLawyeredUp, spendQuestion } from '../engine/questions.js'
import { judgeAccusation } from '../engine/verdict.js'
import type { Intent, ReplyKind } from '../engine/types.js'
import { HttpError, notFound } from '../http/errors.js'
import { llm } from '../llm/provider.js'
import { toPublicSession } from './publicView.js'

// (DUMMY) Shape of Case.truth.reactions until the evidence graph exists
const reactionSchema = z.object({
  text: z.string(),
  kind: z.enum(['ask', 'contradiction', 'truth', 'deflect']),
  mood: z.string(),
  note: z.string().optional(),
})
const reactionsSchema = z.record(z.string(), z.record(z.string(), reactionSchema))

async function loadSession(id: string) {
  const session = await prisma.session.findUnique({ where: { id }, include: { case: true } })
  if (!session) throw notFound('Session')
  return session
}

/** Write suspects back only if nobody else changed the session since we read it. */
async function saveSuspects(session: Session, suspects: SuspectState[], extra: Partial<Pick<Session, 'status' | 'accusedId'>> = {}) {
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, version: session.version },
    data: { suspects: { set: suspects }, version: { increment: 1 }, ...extra },
  })
  if (count === 0) throw new HttpError(409, 'CONFLICT', 'Session changed, please retry')
}

export async function createSession(caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId } })
  if (!c) throw notFound('Case')
  const session = await prisma.session.create({
    data: {
      caseId: c.id,
      suspects: c.suspects.map((s) => createSuspectState(s.id)),
      // (DUMMY) all evidence starts discovered until the Investigation scene exists
      discoveredEvidence: c.evidence.map((e) => e.id),
    },
  })
  return toPublicSession(session)
}

export async function getSession(id: string) {
  return toPublicSession(await loadSession(id))
}

export async function interrogate(sessionId: string, input: { suspectId: string; message: string; evidenceId?: string }) {
  const session = await loadSession(sessionId)
  if (session.status !== 'ACTIVE') throw new HttpError(409, 'CASE_OVER', 'This case is already closed')

  const idx = session.suspects.findIndex((s) => s.suspectId === input.suspectId)
  const current = session.suspects[idx]
  const profile = session.case.suspects.find((s) => s.id === input.suspectId)
  if (!current || !profile) throw notFound('Suspect')

  if (input.evidenceId && !session.discoveredEvidence.includes(input.evidenceId)) {
    throw new HttpError(400, 'UNKNOWN_EVIDENCE', 'Evidence not discovered')
  }

  // Question limit is enforced here, never trusted from the client
  const spent = spendQuestion(current)
  if (!spent.ok) throw new HttpError(403, spent.reason, `${profile.surname} has lawyered up`)
  let next = spent.state

  // (DUMMY) Intent classifier: will become an ML model (see CLAUDE.md roadmap)
  const intent: Intent = input.evidenceId ? 'confrontation' : 'question'

  // (DUMMY) Engine + LLM stand-in: look up a canned reaction for first-time evidence,
  // otherwise ask the provider. The real engine will decide state changes from the evidence graph.
  let reply: string
  let kind: ReplyKind = 'ask'
  let note: string | undefined
  const reaction = input.evidenceId ? reactionsSchema.parse(session.case.truth.reactions)[input.suspectId]?.[input.evidenceId] : undefined

  if (input.evidenceId && current.confrontedEvidence.includes(input.evidenceId)) {
    reply = 'You showed me that already. My answer has not changed.'
    kind = 'deflect'
  } else if (reaction) {
    reply = reaction.text
    kind = reaction.kind
    note = reaction.note
    next = { ...next, mood: reaction.mood }
  } else {
    reply = await llm.generate({ system: '', messages: [{ role: 'user', content: input.message }] })
  }

  if (input.evidenceId && !next.confrontedEvidence.includes(input.evidenceId)) {
    next = { ...next, confrontedEvidence: [...next.confrontedEvidence, input.evidenceId] }
  }

  const suspects = session.suspects.map((s, i) => (i === idx ? next : s))
  await saveSuspects(session, suspects)

  const turn = await prisma.transcript.count({ where: { sessionId, suspectId: input.suspectId } })
  await prisma.transcript.create({
    data: {
      sessionId,
      suspectId: input.suspectId,
      turn: turn + 1,
      intent,
      playerMessage: input.message,
      evidenceId: input.evidenceId,
      reply,
      replyKind: kind,
      stateSnapshot: next,
    },
  })

  const lawyeredUp = isLawyeredUp(next)
  return {
    reply,
    kind,
    note,
    lawyeredUp,
    closer: lawyeredUp ? profile.closer : undefined,
    suspect: toPublicSession({ ...session, suspects }).suspects[idx],
  }
}

export async function accuse(sessionId: string, accusedId: string) {
  const session = await loadSession(sessionId)
  if (session.status !== 'ACTIVE') throw new HttpError(409, 'CASE_OVER', 'This case is already closed')
  if (!session.case.suspects.some((s) => s.id === accusedId)) throw notFound('Suspect')

  const verdict = judgeAccusation(session.case.truth.culpritId, accusedId, session.suspects)
  await saveSuspects(session, session.suspects, { status: verdict.status, accusedId })

  // Only after the case is over may the explanation be revealed
  const { truth } = session.case
  return { ...verdict, explanation: verdict.status === 'SOLVED' ? truth.verdictCorrect : truth.verdictWrong }
}
