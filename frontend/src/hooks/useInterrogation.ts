import { useEffect, useRef, useState } from 'react'
import {
  MAX_Q,
  closers,
  evidence,
  freeTextReply,
  openers,
  presets,
  reactions,
  repeatEvidenceReply,
  suspects,
} from '../data/dummyCase'
import type { Kind, Mood, Msg, Pin, Reaction, Who } from '../types'

const perSuspect = <T,>(f: (id: Who) => T) => Object.fromEntries(suspects.map((s) => [s.id, f(s.id)])) as Record<Who, T>

// Client-side game state for the interrogation room.
// (DUMMY) Replies are looked up locally for now; later `ask` will call POST /interrogate
// and the server will own the question counter, mood and notes.
export function useInterrogation() {
  const [who, setWho] = useState<Who>(suspects[0].id)
  const [sel, setSel] = useState<string | null>(null)
  const [log, setLog] = useState<Record<Who, Msg[]>>(() => perSuspect((id) => [{ id: suspects.findIndex((s) => s.id === id) + 1, from: 'them', text: openers[id] }]))
  const [left, setLeft] = useState(() => perSuspect(() => MAX_Q))
  const [moods, setMoods] = useState(() => perSuspect<Mood>(() => 'calm'))
  const [used, setUsed] = useState(() => perSuspect<string[]>(() => []))
  const [closed, setClosed] = useState(() => perSuspect(() => false))
  const [pins, setPins] = useState<Pin[]>([])
  const [thinking, setThinking] = useState(false)
  const [typingId, setTypingId] = useState<number | null>(null)

  const uid = useRef(10)
  const whoRef = useRef(who)
  whoRef.current = who

  const suspect = suspects.find((x) => x.id === who)!
  const selected = evidence.find((e) => e.id === sel)
  const busy = thinking || typingId !== null
  const qLeft = left[who]
  const asked = suspects.reduce((n, s) => n + MAX_Q - left[s.id], 0)

  const push = (target: Who, m: Msg) => setLog((l) => ({ ...l, [target]: [...l[target], m] }))

  const say = (target: Who, text: string, kind: Kind) => {
    const id = ++uid.current
    push(target, { id, from: 'them', text, kind })
    if (whoRef.current === target) setTypingId(id)
  }

  // Lawyer up once the last question has been answered
  useEffect(() => {
    if (qLeft === 0 && !closed[who] && !busy) {
      setClosed((c) => ({ ...c, [who]: true }))
      say(who, closers[who], 'deflect')
    }
  }, [qLeft, closed, who, busy]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (text: string, r: Reaction) => {
    if (busy || qLeft <= 0) return
    const target = who
    setLeft((l) => ({ ...l, [target]: l[target] - 1 }))
    push(target, { id: ++uid.current, from: 'you', text, kind: 'ask' })
    setThinking(true)
    setTimeout(() => {
      say(target, r.text, r.kind)
      setMoods((m) => ({ ...m, [target]: r.mood }))
      const note = r.note
      if (note) setPins((p) => (p.some((x) => x.text === note) ? p : [...p, { who: target, text: note, kind: r.kind }]))
      setThinking(false)
    }, 700)
  }

  const askPreset = (i: number) => {
    const p = presets[who][i]
    if (used[who].includes(p.label) || busy || qLeft <= 0) return
    setUsed((u) => ({ ...u, [who]: [...u[who], p.label] }))
    ask(p.q, { text: p.a, kind: 'ask', mood: 'calm' })
  }

  const askText = (text: string) => ask(text, { text: freeTextReply, kind: 'ask', mood: moods[who] })

  const confront = () => {
    if (!selected) return
    const done = used[who].includes(selected.id)
    setUsed((u) => ({ ...u, [who]: done ? u[who] : [...u[who], selected.id] }))
    ask(`Explain this: ${selected.name}.`, done ? { text: repeatEvidenceReply, kind: 'deflect', mood: moods[who] } : reactions[who][selected.id])
    setSel(null)
  }

  const toggleEvidence = (id: string) => setSel((s) => (s === id ? null : id))

  const switchTo = (id: Who) => {
    setTypingId(null)
    setWho(id)
    setSel(null)
  }

  return {
    who,
    suspect,
    messages: log[who],
    left,
    qLeft,
    mood: moods[who],
    used: used[who],
    pins,
    selected,
    thinking,
    typingId,
    busy,
    asked,
    switchTo,
    askPreset,
    askText,
    confront,
    toggleEvidence,
    finishTyping: () => setTypingId(null),
  }
}
