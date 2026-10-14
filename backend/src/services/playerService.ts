import { isRecordNotFound } from '../db/errors.js'
import { prisma } from '../db/prisma.js'
import { HttpError, notFound } from '../http/errors.js'
import { hashPassword, verifyPassword } from './password.js'
import { rethrowPlayerError } from './playerErrors.js'
import type { CreatePlayerInput, ListPlayersQuery, UpdatePlayerInput } from './playerSchemas.js'
import { toPlayerAccount, toPublicPlayer } from './publicView.js'

export async function listPlayers({ limit, offset }: ListPlayersQuery) {
  // id breaks ties so pages never overlap or skip rows
  const players = await prisma.player.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: limit, skip: offset })
  return players.map(toPublicPlayer)
}

/** What anyone may see about a player. The email is only in the owner's account view. */
export async function getPlayer(id: string) {
  const player = await prisma.player.findUnique({ where: { id } })
  if (!player) throw notFound('Player')
  return toPublicPlayer(player)
}

/** The owner's own view, including the email. Callers must have checked that `id` is the caller. */
export async function getAccount(id: string) {
  const player = await prisma.player.findUnique({ where: { id } })
  if (!player) throw notFound('Player')
  return toPlayerAccount(player)
}

export async function createPlayer({ password, ...profile }: CreatePlayerInput) {
  const passwordHash = await hashPassword(password)
  try {
    return toPlayerAccount(await prisma.player.create({ data: { ...profile, passwordHash } }))
  } catch (err) {
    rethrowPlayerError(err)
  }
}

/**
 * Callers must have checked that `id` is the caller. `keepTokenId` is the token making this request:
 * after a password change every other login of this player is signed out, but this one stays valid.
 */
export async function updatePlayer(id: string, { password, currentPassword, ...profile }: UpdatePlayerInput, keepTokenId: string) {
  let passwordHash: string | undefined
  if (password !== undefined) {
    const player = await prisma.player.findUnique({ where: { id } })
    if (!player) throw notFound('Player')
    // the schema guarantees currentPassword is present whenever password is
    if (!(await verifyPassword(currentPassword ?? '', player.passwordHash))) {
      throw new HttpError(403, 'WRONG_PASSWORD', 'Current password is incorrect')
    }
    passwordHash = await hashPassword(password)
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const player = await tx.player.update({ where: { id }, data: { ...profile, passwordHash } })
      if (passwordHash) await tx.authToken.deleteMany({ where: { playerId: id, id: { not: keepTokenId } } })
      return player
    })
    return toPlayerAccount(updated)
  } catch (err) {
    if (isRecordNotFound(err)) throw notFound('Player')
    rethrowPlayerError(err)
  }
}

/** Callers must have checked that `id` is the caller. Their login tokens go with them (cascade). */
export async function deletePlayer(id: string) {
  try {
    await prisma.player.delete({ where: { id } })
  } catch (err) {
    if (isRecordNotFound(err)) throw notFound('Player')
    throw err
  }
}
