import type { RequestHandler, Response } from 'express'
import { authenticate } from '../services/authService.js'
import { bearerToken } from '../services/tokens.js'
import { HttpError, unauthenticated } from './errors.js'

export type Auth = { playerId: string; tokenId: string }

/** Reject the request with 401 unless it carries a valid `Authorization: Bearer <token>`. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = bearerToken(req.headers.authorization)
  if (!token) throw unauthenticated()
  res.locals.auth = await authenticate(token)
  next()
}

/** Who requireAuth let in. Only call from handlers that sit behind it. */
export const authOf = (res: Response): Auth => res.locals.auth as Auth

/** Put after requireAuth on `/:id` routes: you may only act on your own account. */
export const requireOwner: RequestHandler<{ id: string }> = (req, res, next) => {
  // ids are stored lowercase; a client may send the same uuid in capitals
  if (req.params.id.toLowerCase() !== authOf(res).playerId) {
    throw new HttpError(403, 'FORBIDDEN', 'You can only change your own account')
  }
  next()
}
