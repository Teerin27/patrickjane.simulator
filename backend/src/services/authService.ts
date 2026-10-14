import { prisma } from '../db/prisma.js'
import { HttpError, unauthenticated } from '../http/errors.js'
import { hashPassword, verifyPassword } from './password.js'
import { toPlayerAccount } from './publicView.js'
import { hashToken, newToken } from './tokens.js'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Checked when the username does not exist, so "no such user" costs the same ~100 ms as "wrong
// password" and response time cannot be used to find out which usernames are registered.
let decoyHash: Promise<string> | undefined
const decoy = () => (decoyHash ??= hashPassword('decoy-password'))

export async function login({ username, password }: { username: string; password: string }) {
  const player = await prisma.player.findUnique({ where: { username } })
  const passwordOk = await verifyPassword(password, player?.passwordHash ?? (await decoy()))
  // One message for both failures: never say which half was wrong
  if (!player || !passwordOk) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Wrong username or password')

  const token = newToken()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  await prisma.$transaction([
    // tidy this player's expired tokens while we are here, so the table does not grow forever
    prisma.authToken.deleteMany({ where: { playerId: player.id, expiresAt: { lte: new Date() } } }),
    prisma.authToken.create({ data: { tokenHash: hashToken(token), playerId: player.id, expiresAt } }),
  ])
  return { token, expiresAt, player: toPlayerAccount(player) }
}

/** Who is behind this token? Throws 401 for unknown, revoked and expired tokens alike. */
export async function authenticate(token: string) {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!row || row.expiresAt <= new Date()) throw unauthenticated()
  return { playerId: row.playerId, tokenId: row.id }
}

/** Revoke one token. Safe to repeat. */
export async function logout(tokenId: string) {
  await prisma.authToken.deleteMany({ where: { id: tokenId } })
}
