import { uniqueViolation } from '../db/errors.js'
import { HttpError } from '../http/errors.js'

/** Turn a unique-index violation into a 409 that says which field clashed; rethrow anything else. */
export function rethrowPlayerError(err: unknown): never {
  const violation = uniqueViolation(err)
  if (!violation) throw err
  if (violation.target.includes('username')) throw new HttpError(409, 'USERNAME_TAKEN', 'That username is already taken')
  if (violation.target.includes('email')) throw new HttpError(409, 'EMAIL_TAKEN', 'That email is already registered')
  throw new HttpError(409, 'CONFLICT', 'That username or email is already taken')
}
