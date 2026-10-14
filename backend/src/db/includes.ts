import type { Prisma } from '../generated/prisma/client.js'

// SQL gives child rows no natural order, so always read them back in display order.
const byPosition = { orderBy: { position: 'asc' } } as const

export const caseFile = { suspects: byPosition, evidence: byPosition } satisfies Prisma.CaseInclude

export const sessionWithCase = {
  suspects: byPosition,
  case: { include: { suspects: byPosition, evidence: byPosition } },
} satisfies Prisma.SessionInclude

export const sessionOnly = { suspects: byPosition } satisfies Prisma.SessionInclude
