import type { Msg, Pin } from '../types'

// A reload must not cost the player their investigation. The server keeps the authoritative state
// (questions, composure, moods) and hands it back through GET /api/sessions/:id, but it has no endpoint
// that returns the chat history, so the conversation and the case notes are kept in localStorage.
// localStorage can throw or come back empty (private windows, blocked site data): then a reload simply
// starts a new case.
const KEY = 'whodunit.game'

export type SavedGame = {
  caseId: string
  sessionId: string
  log: Record<string, Msg[]>
  pins: Pin[]
  /** Quick-question buttons already used, per suspect (a UI convenience; the server never sees it). */
  presets: Record<string, string[]>
}

export function readSaved(): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<SavedGame> | null
    if (!v || typeof v.caseId !== 'string' || typeof v.sessionId !== 'string') return null
    return { caseId: v.caseId, sessionId: v.sessionId, log: v.log ?? {}, pins: v.pins ?? [], presets: v.presets ?? {} }
  } catch {
    return null
  }
}

export function writeSaved(game: SavedGame) {
  try {
    localStorage.setItem(KEY, JSON.stringify(game))
  } catch {
    /* progress will not survive a reload; nothing else to do */
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing stored, nothing to clear */
  }
}
