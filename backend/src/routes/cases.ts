import { Router } from 'express'
import { parseId } from '../http/errors.js'
import { getCase, listCases } from '../services/caseService.js'

export const casesRouter = Router()

// GET /api/cases
casesRouter.get('/', async (_req, res) => {
  res.json(await listCases())
})

// GET /api/cases/:id
casesRouter.get('/:id', async (req, res) => {
  res.json(await getCase(parseId(req.params.id, 'Case')))
})
