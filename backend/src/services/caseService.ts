import { prisma } from '../db/prisma.js'
import { caseFile } from '../db/includes.js'
import { notFound } from '../http/errors.js'
import { toPublicCase, toPublicCaseCard } from './publicView.js'

export async function listCases() {
  // "Case 0001", "Case 0002", ...: zero-padded, so sorting the text sorts the cases in order
  const cases = await prisma.case.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      number: true,
      briefing: true,
      suspects: { select: { id: true, short: true, role: true, look: true }, orderBy: { position: 'asc' } },
    },
    orderBy: [{ number: 'asc' }, { slug: 'asc' }],
  })
  return cases.map(toPublicCaseCard)
}

export async function getCase(id: string) {
  const c = await prisma.case.findUnique({ where: { id }, include: caseFile })
  if (!c) throw notFound('Case')
  return toPublicCase(c)
}
