import { describe, expect, it } from 'vitest'
import { Prisma } from '../generated/prisma/client.js'
import { HttpError } from '../http/errors.js'
import { rethrowPlayerError } from './playerErrors.js'

// Same shape the pg driver adapter produces for a Postgres 23505 error
const uniqueError = (constraint?: { index?: string; fields?: string[] }) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint } } },
  })

const caught = (err: unknown) => {
  try {
    rethrowPlayerError(err)
  } catch (e) {
    return e
  }
}

describe('rethrowPlayerError', () => {
  it('names the username when its index was violated', () => {
    expect(caught(uniqueError({ index: 'players_username_key' }))).toMatchObject({ status: 409, code: 'USERNAME_TAKEN' })
  })

  it('names the email when its index was violated', () => {
    expect(caught(uniqueError({ index: 'players_email_key' }))).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' })
  })

  it('reads column names when the driver gives fields instead of an index', () => {
    expect(caught(uniqueError({ fields: ['email'] }))).toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('still answers 409 when the driver does not say which field', () => {
    const err = caught(uniqueError())
    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 409, code: 'CONFLICT' })
  })

  it('rethrows anything that is not a unique violation unchanged', () => {
    const other = new Error('connection lost')
    expect(caught(other)).toBe(other)
    const otherPrisma = new Prisma.PrismaClientKnownRequestError('x', { code: 'P2003', clientVersion: 'test' })
    expect(caught(otherPrisma)).toBe(otherPrisma)
  })
})
