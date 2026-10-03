import { prisma } from '../db/prisma.js'
import { notFound } from '../http/errors.js'
import { toPublicCase, toPublicCaseSummary } from './publicView.js'

export async function listCases() {
  const cases = await prisma.case.findMany({ select: { id: true, slug: true, title: true, number: true } })
  return cases.map(toPublicCaseSummary)
}

export async function getCase(id: string) {
  const c = await prisma.case.findUnique({ where: { id } })
  if (!c) throw notFound('Case')
  return toPublicCase(c)
}
