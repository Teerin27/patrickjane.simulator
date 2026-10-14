import type { ErrorRequestHandler } from 'express'
import { z, ZodError } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`)

export const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'Log in first')

/** Ids in URLs are UUIDs. Anything else cannot exist, so answer 404 without asking the database. */
export const parseId = (id: string, what: string) => {
  if (!z.uuid().safeParse(id).success) throw notFound(what)
  return id
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid request', issues: err.issues } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
}
