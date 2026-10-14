import { Router } from 'express'
import { z } from 'zod'
import { parseId } from '../http/errors.js'
import { accuse, createSession, getSession, interrogate } from '../services/sessionService.js'

export const sessionsRouter = Router()

const sessionId = (id: string) => parseId(id, 'Session')

const createBody = z.object({ caseId: z.uuid() })
const interrogateBody = z.object({
  suspectId: z.string().min(1),
  message: z.string().trim().min(1).max(200),
  evidenceId: z.string().min(1).optional(),
})
const accuseBody = z.object({ suspectId: z.string().min(1) })

// POST /api/sessions  { caseId }
sessionsRouter.post('/', async (req, res) => {
  const { caseId } = createBody.parse(req.body)
  res.status(201).json(await createSession(caseId))
})

// GET /api/sessions/:id
sessionsRouter.get('/:id', async (req, res) => {
  res.json(await getSession(sessionId(req.params.id)))
})

// POST /api/sessions/:id/interrogate  { suspectId, message, evidenceId? }
sessionsRouter.post('/:id/interrogate', async (req, res) => {
  res.json(await interrogate(sessionId(req.params.id), interrogateBody.parse(req.body)))
})

// POST /api/sessions/:id/accuse  { suspectId }
sessionsRouter.post('/:id/accuse', async (req, res) => {
  const { suspectId } = accuseBody.parse(req.body)
  res.json(await accuse(sessionId(req.params.id), suspectId))
})
