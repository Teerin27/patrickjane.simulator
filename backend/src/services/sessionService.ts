import type { Session, SuspectState as SuspectStateRow } from '../generated/prisma/client.js'
import { parseTruth } from '../caseFile/store.js'
import { caseFile, sessionOnly, sessionWithCase } from '../db/includes.js'
import { prisma } from '../db/prisma.js'
import { createSuspectState, isLawyeredUp, MAX_QUESTIONS, spendQuestion } from '../engine/questions.js'
import { decideTurn, suspectTruth } from '../engine/turn.js'
import { judgeAccusation } from '../engine/verdict.js'
import type { SuspectState } from '../engine/types.js'
import { HttpError, notFound } from '../http/errors.js'
import { fallbackReply, generateAdmission, generateSuspectReply } from '../llm/chat.js'
import { forbiddenMarkers, hasConfessed, retiredLies } from '../llm/guard.js'
import { llm } from '../llm/index.js'
import { buildChatPrompt, buildReactionPrompt, isDictated, playerLine, speakableText, type HistoryTurn } from '../llm/promptBuilder.js'
import { toPublicSession } from './publicView.js'

// How many earlier exchanges with a suspect the model sees. Small on purpose: the context window is
// tight, and everything that matters (commitments, what has been proved) lives in the suspect's state.
const HISTORY_TURNS = 6

async function loadSession(id: string) {
  const session = await prisma.session.findUnique({ where: { id }, include: sessionWithCase })
  if (!session) throw notFound('Session')
  return session
}

// The engine works on plain suspect state; drop the row's sessionId/position so they never leak into it
// (or into the transcript snapshot).
const toEngineState = (row: SuspectStateRow): SuspectState => ({
  suspectId: row.suspectId,
  composure: row.composure,
  questionsRemaining: row.questionsRemaining,
  mood: row.mood,
  commitments: row.commitments,
  brokenClaims: row.brokenClaims,
  confrontedEvidence: row.confrontedEvidence,
  revealedSecrets: row.revealedSecrets,
})

/**
 * Write changes only if nobody else changed the session since we read it.
 * The version check and the suspect update share one transaction, so a conflict rolls both back.
 */
async function saveSession(
  session: Session,
  { suspect, ...extra }: { suspect?: SuspectState } & Partial<Pick<Session, 'status' | 'accusedId'>> = {},
) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.session.updateMany({
      where: { id: session.id, version: session.version },
      data: { version: { increment: 1 }, ...extra },
    })
    if (count === 0) throw new HttpError(409, 'CONFLICT', 'Session changed, please retry')
    if (suspect) {
      const { suspectId, ...fields } = suspect
      await tx.suspectState.update({ where: { sessionId_suspectId: { sessionId: session.id, suspectId } }, data: fields })
    }
  })
}

export async function createSession(caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: caseFile })
  if (!c) throw notFound('Case')
  const session = await prisma.session.create({
    data: {
      caseId: c.id,
      suspects: { create: c.suspects.map((s) => ({ ...createSuspectState(s.id), position: s.position })) },
      // (DUMMY) all evidence starts discovered until the Investigation scene exists
      discoveredEvidence: c.evidence.map((e) => e.id),
    },
    include: sessionOnly,
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
  const row = session.suspects[idx]
  const profile = session.case.suspects.find((s) => s.id === input.suspectId)
  if (!row || !profile) throw notFound('Suspect')
  const current = toEngineState(row)

  if (input.evidenceId && !session.discoveredEvidence.includes(input.evidenceId)) {
    throw new HttpError(400, 'UNKNOWN_EVIDENCE', 'Evidence not discovered')
  }

  // 2. Question limit is enforced here, never trusted from the client
  const spent = spendQuestion(current)
  if (!spent.ok) throw new HttpError(403, spent.reason, `${profile.surname} has lawyered up`)

  // 3-4. The engine decides everything that matters about this turn. The model only voices it.
  const truth = parseTruth(session.case.truth, session.case.slug)
  const decision = decideTurn(truth, input.suspectId, spent.state, { message: input.message, evidenceId: input.evidenceId })
  const next = decision.state

  // 5-7. Prompt (only what this suspect may say now) -> model -> guard
  const evidence = session.case.evidence
  const exhibitName = (id?: string) => evidence.find((e) => e.id === id)?.name
  const earlier = await prisma.transcript.findMany({
    where: { sessionId, suspectId: input.suspectId },
    orderBy: { turn: 'desc' },
    take: HISTORY_TURNS,
  })
  const history: HistoryTurn[] = earlier
    .reverse()
    .flatMap((t) => [
      { role: 'user' as const, content: playerLine(t.playerMessage, exhibitName(t.evidenceId ?? undefined)) },
      { role: 'assistant' as const, content: t.reply },
    ])

  const suspect = suspectTruth(truth, input.suspectId)
  const promptInput = { briefing: session.case.briefing, profile, truth: suspect, evidence, decision, action: input, history }
  const forbidden = forbiddenMarkers(truth, input.suspectId, next)
  // A lie broke or a secret cracked: the engine dictates what is admitted, the model only adds a reaction.
  // Anything else is an open turn, answered by the model from the suspect's story.
  const chat = isDictated(decision)
    ? await generateAdmission(llm, { prompt: buildReactionPrompt(promptInput), forbidden, speaker: profile.fullName, decision })
    : await generateSuspectReply(llm, {
        prompt: buildChatPrompt(promptInput),
        forbidden,
        allowedText: speakableText(promptInput),
        retired: retiredLies(suspect, next),
        confessed: hasConfessed(suspect, next),
        speaker: profile.fullName,
        fallback: fallbackReply(suspect, MAX_QUESTIONS - next.questionsRemaining),
      })
  if (chat.rejections.length) {
    console.warn(`[llm] ${session.case.slug}/${input.suspectId} used ${chat.source} after ${chat.attempts} attempt(s):`)
    chat.rejections.forEach((reason, i) => console.warn(`  - ${reason}${chat.rejectedReplies[i] ? ` | said: ${JSON.stringify(chat.rejectedReplies[i])}` : ''}`))
  }

  await saveSession(session, { suspect: next })
  const suspects = session.suspects.map((s, i) => (i === idx ? { ...s, ...next } : s))

  // 8. Save the turn plus a state snapshot
  const turn = await prisma.transcript.count({ where: { sessionId, suspectId: input.suspectId } })
  await prisma.transcript.create({
    data: {
      sessionId,
      suspectId: input.suspectId,
      turn: turn + 1,
      intent: decision.intent,
      playerMessage: input.message,
      evidenceId: input.evidenceId,
      reply: chat.reply,
      replyKind: decision.kind,
      stateSnapshot: next,
    },
  })

  const lawyeredUp = isLawyeredUp(next)
  return {
    reply: chat.reply,
    kind: decision.kind,
    // One line for the player's notes when a lie was just exposed
    note: decision.brokenNow.find((c) => c.exposedNote)?.exposedNote,
    lawyeredUp,
    closer: lawyeredUp ? profile.closer : undefined,
    suspect: toPublicSession({ ...session, suspects }).suspects[idx],
  }
}

export async function accuse(sessionId: string, accusedId: string) {
  const session = await loadSession(sessionId)
  if (session.status !== 'ACTIVE') throw new HttpError(409, 'CASE_OVER', 'This case is already closed')
  if (!session.case.suspects.some((s) => s.id === accusedId)) throw notFound('Suspect')

  const verdict = judgeAccusation(session.case.culpritId, accusedId, session.suspects.map(toEngineState))
  await saveSession(session, { status: verdict.status, accusedId })

  // Only after the case is over may the explanation be revealed
  const { verdictCorrect, verdictWrong } = session.case
  return { ...verdict, explanation: verdict.status === 'SOLVED' ? verdictCorrect : verdictWrong }
}
