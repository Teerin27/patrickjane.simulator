import type { ErrorRequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

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

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid request', issues: err.issues } })
    return
  }
  // P2023: malformed ObjectId in the URL
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2023') {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
}
