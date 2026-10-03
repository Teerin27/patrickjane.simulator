import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler, notFound } from './http/errors.js'
import { casesRouter } from './routes/cases.js'
import { sessionsRouter } from './routes/sessions.js'

export function createApp() {
  const app = express()
  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api/cases', casesRouter)
  app.use('/api/sessions', sessionsRouter)

  app.use((_req, _res, next) => next(notFound('Route')))
  // Express 5 forwards errors from async handlers here automatically
  app.use(errorHandler)
  return app
}
