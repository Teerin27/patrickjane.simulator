import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, clearToken, getToken, isNetworkError, setToken, setUnauthorizedHandler, type AccountPatch } from '../lib/api'
import type { Account } from '../types'

// 'loading'  asking the server who the stored token belongs to
// 'out'      nobody signed in (no token, or the server said it is dead)
// 'in'       signed in; `player` is set
// 'offline'  a token is stored but the server could not be reached, so we cannot tell yet (kept for retry)
// One variant per status (not `'loading' | 'out'` in one) so checking `status` narrows `player`.
type Auth = { status: 'loading'; player: null } | { status: 'out'; player: null } | { status: 'offline'; player: null } | { status: 'in'; player: Account }

type AuthApi = {
  auth: Auth
  login: (username: string, password: string) => Promise<void>
  /** Create the account, then sign straight in. */
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Send only the fields that changed. Resolves with the account as the server normalised it. */
  updateAccount: (patch: AccountPatch) => Promise<Account>
  deleteAccount: () => Promise<void>
  /** Ask the server again after 'offline'. */
  retry: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<Auth>({ status: 'loading', player: null })

  // Load the player behind the stored token. A network failure keeps the token (the login may
  // well be fine); only a 401 throws it away, and that happens inside the api client's handler.
  const restore = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!getToken()) return setAuth({ status: 'out', player: null })
    setAuth({ status: 'loading', player: null })
    try {
      const player = await api.me()
      if (isCurrent()) setAuth({ status: 'in', player })
    } catch (err) {
      if (isCurrent()) setAuth({ status: isNetworkError(err) ? 'offline' : 'out', player: null })
    }
  }, [])

  useEffect(() => {
    let current = true
    setUnauthorizedHandler((sentToken) => {
      if (getToken() !== sentToken) return // a newer login replaced it while that request was in flight
      clearToken()
      setAuth({ status: 'out', player: null })
    })
    void restore(() => current)
    return () => {
      current = false
      setUnauthorizedHandler(null)
    }
  }, [restore])

  const login = useCallback(async (username: string, password: string) => {
    const { token, player } = await api.login({ username, password })
    setToken(token)
    setAuth({ status: 'in', player })
  }, [])

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await api.register({ username, email, password })
      await login(username, password)
    },
    [login],
  )

  const logout = useCallback(async () => {
    // Best effort: revoke the token on the server, but sign out locally even if that call fails
    try {
      await api.logout()
    } catch {
      /* token is dropped below either way */
    }
    clearToken()
    setAuth({ status: 'out', player: null })
  }, [])

  const updateAccount = useCallback(
    async (patch: AccountPatch) => {
      if (auth.status !== 'in') throw new Error('Not signed in')
      const player = await api.updatePlayer(auth.player.id, patch)
      setAuth({ status: 'in', player })
      return player
    },
    [auth],
  )

  const deleteAccount = useCallback(async () => {
    if (auth.status !== 'in') throw new Error('Not signed in')
    await api.deletePlayer(auth.player.id)
    clearToken()
    setAuth({ status: 'out', player: null })
  }, [auth])

  const retry = useCallback(() => void restore(), [restore])

  const value = useMemo(() => ({ auth, login, register, logout, updateAccount, deleteAccount, retry }), [auth, login, register, logout, updateAccount, deleteAccount, retry])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
