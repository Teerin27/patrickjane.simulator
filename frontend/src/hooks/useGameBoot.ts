import { useCallback, useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api'
import { clearSaved, readSaved, type SavedGame } from '../lib/savedGame'
import type { CaseSummary, PublicCase, SessionView } from '../types'

/** Everything the table needs before play can start. */
export type Loaded = { caseData: PublicCase; session: SessionView; saved: SavedGame | null }

export type Boot =
  | { phase: 'loading' }
  | { phase: 'error'; error: unknown }
  | { phase: 'pick'; cases: CaseSummary[] }
  | { phase: 'ready'; loaded: Loaded }

/** Pick up the investigation the browser remembers, if the server still has it and it is still open. */
async function resume(): Promise<Loaded | null> {
  const saved = readSaved()
  if (!saved) return null
  try {
    const [session, caseData] = await Promise.all([api.getSession(saved.sessionId), api.getCase(saved.caseId)])
    if (session.status === 'ACTIVE') return { caseData, session, saved }
  } catch (err) {
    // Gone from the server (database reset, case removed): forget it. Anything else (server down) is reported.
    if (!(err instanceof ApiError && err.status === 404)) throw err
  }
  clearSaved()
  return null
}

async function begin(caseId: string): Promise<Boot> {
  const caseData = await api.getCase(caseId)
  const session = await api.createSession(caseId)
  clearSaved()
  return { phase: 'ready', loaded: { caseData, session, saved: null } }
}

async function load(): Promise<Boot> {
  const resumed = await resume()
  if (resumed) return { phase: 'ready', loaded: resumed }
  const cases = await api.cases()
  if (cases.length === 0) throw new Error('The server has no cases yet. Seed one with `pnpm db:seed` in backend/.')
  // One case: no need to ask. Several: let the player choose.
  return cases.length === 1 ? begin(cases[0].id) : { phase: 'pick', cases }
}

// React StrictMode runs effects twice in development. Sharing one in-flight load keeps that from opening
// two sessions (and leaving an orphan row in the database) every time the page mounts.
let inflight: Promise<Boot> | null = null
function once(task: () => Promise<Boot>): Promise<Boot> {
  if (!inflight) {
    inflight = task()
      .catch((error): Boot => ({ phase: 'error', error }))
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Loads the case list, resumes or starts a session, and exposes the ways to start over. */
export function useGameBoot() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' })

  const run = useCallback((task: () => Promise<Boot>) => {
    let live = true
    setBoot({ phase: 'loading' })
    void once(task).then((next) => live && setBoot(next))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => run(load), [run])

  return {
    boot,
    /** Try again after an error. */
    retry: () => void run(load),
    /** Start a fresh session of this case. */
    choose: (caseId: string) => void run(() => begin(caseId)),
    /** Forget the current investigation and begin another (after a verdict). */
    newCase: () => {
      clearSaved()
      void run(load)
    },
  }
}
