import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../db/prisma.js'
import { truthSchema, type CaseFile, type Truth } from './schema.js'

/**
 * Save a case file to the database, replacing the previous version with the same slug.
 * Upserting by slug keeps the case's id, so sessions already in progress still point at it.
 * The caller is expected to have validated the file (see validateCaseFile).
 */
export async function saveCase(c: CaseFile) {
  const { slug, suspects, evidence, truth, ...fields } = c
  const data = { ...fields, truth: truth as unknown as Prisma.InputJsonValue }
  // Child rows have no natural order in SQL, so remember the display order explicitly
  const suspectRows = suspects.map((s, position) => ({
    ...s,
    whereabouts: s.whereabouts as unknown as Prisma.InputJsonValue,
    look: s.look as unknown as Prisma.InputJsonValue,
    position,
  }))
  const evidenceRows = evidence.map((e, position) => ({ ...e, position }))

  return prisma.case.upsert({
    where: { slug },
    create: { slug, ...data, suspects: { create: suspectRows }, evidence: { create: evidenceRows } },
    update: { ...data, suspects: { deleteMany: {}, create: suspectRows }, evidence: { deleteMany: {}, create: evidenceRows } },
  })
}

/**
 * The ground truth of a stored case. Re-checked on every read: a row written before the case-truth
 * migration holds `{}` until it is re-seeded, and that should fail loudly rather than play wrongly.
 */
export function parseTruth(stored: unknown, slug: string): Truth {
  const result = truthSchema.safeParse(stored)
  if (!result.success) {
    throw new Error(`Case "${slug}" has no valid ground truth in the database. Run \`pnpm db:seed\` to load it from /cases.`)
  }
  return result.data
}
