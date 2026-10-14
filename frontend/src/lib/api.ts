import type { Account, CaseSummary, LoginResult, PublicCase, SessionView, TurnResult, Verdict } from '../types'

// Thin client for the Express API. The server is the authority on every rule (username format,
// password length, who may edit whom); this file only moves JSON and turns failures into ApiError.
//
// In dev, Vite proxies /api to the backend (vite.config.ts), so BASE stays empty and there is no CORS.
// Set VITE_API_URL (e.g. https://api.example.com) to talk to a backend on another origin.
const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

/** A failed API call. `code` is the server's error code (INVALID_CREDENTIALS, USERNAME_TAKEN, ...). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues: ApiIssue[] = [],
  ) {
    super(message)
  }
}
/** One zod validation issue as the server reports it in a 400 BAD_REQUEST. */
export type ApiIssue = { path: (string | number)[]; message: string }

/** The server could not be reached at all (down, wrong port, offline). Not the same as a rejected request. */
export const NETWORK = 'NETWORK'
export const isNetworkError = (err: unknown) => err instanceof ApiError && err.code === NETWORK
/** The server took longer than we were willing to wait. The turn may still have gone through on its side. */
export const TIMEOUT = 'TIMEOUT'

// ---- token storage -------------------------------------------------------------------------
// localStorage can throw (private windows, blocked site data); a missing store just means "signed out".
const TOKEN_KEY = 'whodunit.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* session will not survive a reload; nothing else to do */
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nothing stored, nothing to clear */
  }
}

// ---- 401 handling --------------------------------------------------------------------------
// Any protected call answered 401 means the stored token is dead (expired, revoked, account gone).
// The auth provider registers one handler that clears it. It gets the token that was *sent*, so a
// late 401 for an old token cannot sign out a login that happened since.
type UnauthorizedHandler = (sentToken: string) => void
let onUnauthorized: UnauthorizedHandler | null = null
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

// ---- transport -----------------------------------------------------------------------------
type Options = { body?: unknown; auth?: boolean; timeoutMs?: number }

async function request<T>(method: string, path: string, { body, auth = true, timeoutMs }: Options = {}): Promise<T> {
  const token = auth ? getToken() : null
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new ApiError(0, TIMEOUT, 'The server is taking too long to answer.')
    throw new ApiError(0, NETWORK, "Can't reach the server. Is the backend running?")
  }

  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)
  if (res.ok) return data as T

  const err = (data as { error?: { code?: string; message?: string; issues?: ApiIssue[] } } | null)?.error
  if (!err?.code) {
    // Not our `{ error: {...} }` shape: with the dev proxy, this is what a dead backend looks like
    if (res.status >= 500) throw new ApiError(res.status, NETWORK, "Can't reach the server. Is the backend running?")
    throw new ApiError(res.status, 'UNKNOWN', `Unexpected response (${res.status})`)
  }
  if (res.status === 401 && token) onUnauthorized?.(token)
  throw new ApiError(res.status, err.code, err.message ?? 'Request failed', err.issues)
}

// ---- endpoints -----------------------------------------------------------------------------
export type AccountPatch = { username?: string; email?: string; password?: string; currentPassword?: string }

const INTERROGATE_TIMEOUT_MS = 120_000

export const api = {
  /** Register. The server answers with the new account but no token: log in next. */
  register: (body: { username: string; email: string; password: string }) => request<Account>('POST', '/api/players', { body, auth: false }),
  login: (body: { username: string; password: string }) => request<LoginResult>('POST', '/api/auth/login', { body, auth: false }),
  logout: () => request<void>('POST', '/api/auth/logout'),
  me: () => request<Account>('GET', '/api/auth/me'),
  updatePlayer: (id: string, patch: AccountPatch) => request<Account>('PATCH', `/api/players/${id}`, { body: patch }),
  deletePlayer: (id: string) => request<void>('DELETE', `/api/players/${id}`),

  // Game routes are not behind login yet, so they never send the token (auth: false).
  cases: () => request<CaseSummary[]>('GET', '/api/cases', { auth: false }),
  getCase: (id: string) => request<PublicCase>('GET', `/api/cases/${id}`, { auth: false }),
  createSession: (caseId: string) => request<SessionView>('POST', '/api/sessions', { body: { caseId }, auth: false }),
  getSession: (id: string) => request<SessionView>('GET', `/api/sessions/${id}`, { auth: false }),
  /** Costs the suspect one question. A local model answers in 1-10 s, retries included maybe 30 s, hence the long timeout. */
  interrogate: (sessionId: string, body: { suspectId: string; message: string; evidenceId?: string }) =>
    request<TurnResult>('POST', `/api/sessions/${sessionId}/interrogate`, { body, auth: false, timeoutMs: INTERROGATE_TIMEOUT_MS }),
  accuse: (sessionId: string, suspectId: string) => request<Verdict>('POST', `/api/sessions/${sessionId}/accuse`, { body: { suspectId }, auth: false }),
}

// ---- turning errors into form messages ------------------------------------------------------
export type FormErrors = { fields: Record<string, string>; form?: string }

/**
 * Split an error into per-field messages (shown under the input) and one form-level message.
 * `codeFields` routes specific error codes to a field, e.g. `{ USERNAME_TAKEN: 'username' }`.
 * Validation issues land on the field named by their path.
 */
export function toFormErrors(err: unknown, codeFields: Record<string, string> = {}): FormErrors {
  if (!(err instanceof ApiError)) return { fields: {}, form: 'Something went wrong' }
  const field = codeFields[err.code]
  if (field) return { fields: { [field]: err.message } }

  const fields: Record<string, string> = {}
  let loose: string | undefined
  for (const issue of err.issues) {
    const name = issue.path[0]
    if (typeof name === 'string') fields[name] ??= issue.message
    else loose ??= issue.message
  }
  if (Object.keys(fields).length > 0) return { fields, form: loose }
  return { fields, form: err.message }
}
