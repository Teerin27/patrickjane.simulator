import { Router } from 'express'
import { authOf, requireAuth } from '../http/auth.js'
import { login, logout } from '../services/authService.js'
import { loginBody } from '../services/playerSchemas.js'
import { getAccount } from '../services/playerService.js'

export const authRouter = Router()

// POST /api/auth/login  { username, password }  ->  { token, expiresAt, player }
authRouter.post('/login', async (req, res) => {
  res.json(await login(loginBody.parse(req.body)))
})

// POST /api/auth/logout  (revokes the token that made the request)
authRouter.post('/logout', requireAuth, async (_req, res) => {
  await logout(authOf(res).tokenId)
  res.status(204).end()
})

// GET /api/auth/me  ->  your own account, including email
authRouter.get('/me', requireAuth, async (_req, res) => {
  res.json(await getAccount(authOf(res).playerId))
})
