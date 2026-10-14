import { useCallback, useEffect, useRef, useState } from 'react'
import { quickQuestions } from '../data/quickQuestions'
import { ApiError, NETWORK, TIMEOUT, api } from '../lib/api'
import { MAX_Q } from '../lib/rules'
import { clearSaved, writeSaved } from '../lib/savedGame'
import type { Kind, Mood, Msg, Pin, PublicCase, SessionStatus, SessionView, SuspectView, Verdict, Who } from '../types'
import type { Loaded } from './useGameBoot'

export type Interrogation = ReturnType<typeof useInterrogation>

/** Something the player should know that is not a suspect's line: a failed request, a locked door. */
export type Notice = { text: string; kind: 'error' | 'info' }

const MOODS: readonly string[] = ['calm', 'nervous', 'angry', 'broken']
// The server's mood is a free string; anything the portraits cannot draw reads as calm.
const toMood = (m: string): Mood => (MOODS.includes(m) ? (m as Mood) : 'calm')

const byId = (views: SuspectView[]) => Object.fromEntries(views.map((v) => [v.suspectId, v])) as Record<Who, SuspectView>

/** Turn a failed request into a line for the player, and say what it means for the question counter. */
function explain(err: unknown): { text: string; sync: boolean } {
  if (!(err instanceof ApiError)) return { text: 'Something went wrong. Your question may not have been counted.', sync: true }
  switch (err.code) {
    case NETWORK:
      return { text: "Can't reach the server. Your question was not counted. Check that the backend is running, then ask again.", sync: false }
    case TIMEOUT:
      return { text: 'The suspect took too long to answer. Your question may have been counted; the counter has been refreshed.', sync: true }
    case 'LAWYERED_UP':
      return { text: `${err.message}. Nothing more to get out of them.`, sync: true }
    case 'CASE_OVER':
      return { text: 'This case is already closed. Start a new one from the menu.', sync: true }
    case 'UNKNOWN_EVIDENCE':
      return { text: 'The server does not know that exhibit. Your question was not counted.', sync: true }
    case 'CONFLICT':
      return { text: 'The file changed while you were asking. Your question was not counted. Ask again.', sync: true }
    case 'NOT_FOUND':
      return { text: 'This investigation file is gone from the server. Go back to the menu and start a new case.', sync: false }
    default:
      return { text: `${err.message}. Your question may not have been counted.`, sync: true }
  }
}
export const explainError = (err: unknown) => explain(err).text

/**
 * Client-side state for the interrogation room. The server is the authority on everything that
 * matters: the question counter, composure, mood and which exhibits were shown all come from API
 * responses and are never worked out here. What lives only here is presentation: the chat log,
 * which suspect is open, the typewriter, the case notes.
 */
export function useInterrogation({ caseData, session, saved }: { caseData: PublicCase; session: SessionView; saved: Loaded['saved'] }) {
  const { suspects, evidence } = caseData

  const [who, setWho] = useState<Who>(suspects[0].id)
  const [sel, setSel] = useState<string | null>(null)
  const [server, setServer] = useState(() => byId(session.suspects))
  const [status, setStatus] = useState<SessionStatus>(session.status)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [log, setLog] = useState<Record<Who, Msg[]>>(() =>
    Object.fromEntries(suspects.map((s, i) => [s.id, saved?.log[s.id]?.length ? saved.log[s.id] : [{ id: i + 1, from: 'them', text: s.opener }]])),
  )
  const [pins, setPins] = useState<Pin[]>(saved?.pins ?? [])
  const [usedPresets, setUsedPresets] = useState<Record<Who, string[]>>(saved?.presets ?? {})
  const [pending, setPending] = useState<Who | null>(null) // whose answer we are waiting for
  const [typingId, setTypingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const uid = useRef(Math.max(suspects.length, ...Object.values(log).flatMap((l) => l.map((m) => m.id))) + 1)
  const whoRef = useRef(who)
  whoRef.current = who
  // Lines that follow a reply (a suspect's parting line) wait here until the reply has finished typing
  const queue = useRef<{ target: Who; msg: Msg }[]>([])

  const suspect = suspects.find((s) => s.id === who)!
  const selected = evidence.find((e) => e.id === sel)
  const over = status !== 'ACTIVE'
  const busy = pending !== null || typingId !== null
  const left = Object.fromEntries(suspects.map((s) => [s.id, server[s.id]?.questionsRemaining ?? MAX_Q])) as Record<Who, number>
  const moods = Object.fromEntries(suspects.map((s) => [s.id, toMood(server[s.id]?.mood ?? 'calm')])) as Record<Who, Mood>
  const asked = suspects.reduce((n, s) => n + MAX_Q - left[s.id], 0)

  const push = useCallback((target: Who, m: Msg) => setLog((l) => ({ ...l, [target]: [...(l[target] ?? []), m] })), [])

  // Keep the investigation across reloads (see lib/savedGame.ts). Not while a question is in flight,
  // or a reload would bring back a question the player never got an answer to.
  useEffect(() => {
    if (over) clearSaved()
    else if (pending === null) writeSaved({ caseId: caseData.id, sessionId: session.id, log, pins, presets: usedPresets })
  }, [over, pending, log, pins, usedPresets, caseData.id, session.id])

  /** Put the suspect's lines in their chat. The first types out; the rest follow once it has. */
  const deliver = (target: Who, lines: { text: string; kind: Kind }[]) => {
    const msgs = lines.map((l): Msg => ({ id: uid.current++, from: 'them', text: l.text, kind: l.kind }))
    if (whoRef.current !== target) {
      msgs.forEach((m) => push(target, m)) // not looking at them: nothing to type for
      return
    }
    const [first, ...rest] = msgs
    push(target, first)
    setTypingId(first.id)
    queue.current.push(...rest.map((msg) => ({ target, msg })))
  }

  const finishTyping = useCallback(() => {
    const next = queue.current.shift()
    if (!next) {
      setTypingId(null)
      return
    }
    push(next.target, next.msg)
    setTypingId(next.msg.id)
  }, [push])

  /** Re-read the authoritative state after a failure, so the counters are right whatever the server did. */
  const resync = async () => {
    try {
      const fresh = await api.getSession(session.id)
      setServer(byId(fresh.suspects))
      setStatus(fresh.status)
    } catch {
      /* still unreachable; the next successful turn brings everything up to date */
    }
  }

  /** One player turn. Resolves true when the suspect answered. */
  const send = async (text: string, evidenceId?: string): Promise<boolean> => {
    if (busy || over || left[who] <= 0) return false
    const target = who
    const mine: Msg = { id: uid.current++, from: 'you', text, kind: 'ask' }
    setNotice(null)
    push(target, mine)
    setPending(target)
    try {
      const r = await api.interrogate(session.id, { suspectId: target, message: text, evidenceId })
      setServer((s) => ({ ...s, [target]: r.suspect }))
      deliver(target, [{ text: r.reply, kind: r.kind }, ...(r.lawyeredUp && r.closer ? [{ text: r.closer, kind: 'deflect' as const }] : [])])
      if (r.note) {
        const note = r.note
        // a note means a lie was just exposed, even when the same turn also cracked a secret and the reply reads as 'truth'
        setPins((p) => (p.some((x) => x.text === note) ? p : [...p, { who: target, text: note, kind: 'contradiction' }]))
      }
      return true
    } catch (err) {
      // The server only charges for a turn it answered, so take the unanswered question back out of the chat
      setLog((l) => ({ ...l, [target]: l[target].filter((m) => m.id !== mine.id) }))
      const { text: message, sync } = explain(err)
      setNotice({ text: message, kind: 'error' })
      if (sync) void resync()
      return false
    } finally {
      setPending(null)
    }
  }

  const askPreset = async (i: number) => {
    const p = quickQuestions[i]
    if (usedPresets[who]?.includes(p.label)) return
    const target = who
    if (await send(p.q)) setUsedPresets((u) => ({ ...u, [target]: [...(u[target] ?? []), p.label] }))
  }

  const askText = (text: string) => send(text)

  const confront = async () => {
    if (!selected) return
    const shown = selected.id
    if (await send(`Explain this: ${selected.name}.`, shown)) setSel((s) => (s === shown ? null : s))
  }

  const toggleEvidence = (id: string) => setSel((s) => (s === id ? null : id))

  const switchTo = (id: Who) => {
    queue.current.forEach(({ target, msg }) => push(target, msg))
    queue.current = []
    setTypingId(null)
    setNotice(null)
    setWho(id)
    setSel(null)
  }

  /** Name the killer. Throws the ApiError so the accusation screen can show what went wrong. */
  const accuse = async (suspectId: Who): Promise<Verdict> => {
    try {
      const v = await api.accuse(session.id, suspectId)
      setVerdict(v)
      setStatus(v.status)
      return v
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CASE_OVER') void resync()
      throw err
    }
  }

  return {
    sessionId: session.id,
    caseInfo: { title: caseData.title, number: caseData.number, briefing: caseData.briefing },
    suspects,
    evidence,
    who,
    suspect,
    messages: log[who] ?? [],
    left,
    qLeft: left[who],
    mood: moods[who],
    moods,
    used: usedPresets[who] ?? [],
    shown: server[who]?.confrontedEvidence ?? [],
    pins,
    selected,
    thinking: pending === who,
    typingId,
    busy,
    asked,
    over,
    status,
    verdict,
    notice,
    switchTo,
    askPreset,
    askText,
    confront,
    toggleEvidence,
    accuse,
    finishTyping,
  }
}
