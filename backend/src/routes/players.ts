import { Router } from 'express'
import { authOf, requireAuth, requireOwner } from '../http/auth.js'
import { parseId } from '../http/errors.js'
import { createPlayerBody, listPlayersQuery, updatePlayerBody } from '../services/playerSchemas.js'
import { createPlayer, deletePlayer, getPlayer, listPlayers, updatePlayer } from '../services/playerService.js'

export const playersRouter = Router()

// Reading is public (public fields only); changing needs a login, and only for your own account.

// GET /api/players?limit=50&offset=0
playersRouter.get('/', async (req, res) => {
  res.json(await listPlayers(listPlayersQuery.parse(req.query)))
})

// POST /api/players  { username, email, password }
playersRouter.post('/', async (req, res) => {
  res.status(201).json(await createPlayer(createPlayerBody.parse(req.body)))
})

// GET /api/players/:id  (your own account with email: GET /api/auth/me)
playersRouter.get('/:id', async (req, res) => {
  res.json(await getPlayer(parseId(req.params.id, 'Player')))
})

// PATCH /api/players/:id  { username?, email?, password?, currentPassword? }  (owner only)
playersRouter.patch('/:id', requireAuth, requireOwner, async (req, res) => {
  const { playerId, tokenId } = authOf(res)
  res.json(await updatePlayer(playerId, updatePlayerBody.parse(req.body), tokenId))
})

// DELETE /api/players/:id  (owner only)
playersRouter.delete('/:id', requireAuth, requireOwner, async (_req, res) => {
  await deletePlayer(authOf(res).playerId)
  res.status(204).end()
})
