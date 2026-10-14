import { Prisma } from '../generated/prisma/client.js'

const isKnown = (err: unknown, code: string) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === code

/** P2025: an update/delete targeted a row that does not exist. */
export const isRecordNotFound = (err: unknown) => isKnown(err, 'P2025')

/**
 * P2002: a unique index rejected the write. `target` names the violated index or columns
 * (e.g. `players_email_key`), or is '' when the driver did not say.
 *
 * With the pg driver adapter the details live in `meta.driverAdapterError.cause.constraint`,
 * not in the `meta.target` that the Rust query engine used to fill in.
 */
export function uniqueViolation(err: unknown): { target: string } | undefined {
  if (!isKnown(err, 'P2002')) return undefined
  const adapterError = (err as Prisma.PrismaClientKnownRequestError).meta?.driverAdapterError as
    | { cause?: { constraint?: { index?: string; fields?: string[] } } }
    | undefined
  const constraint = adapterError?.cause?.constraint
  return { target: constraint?.index ?? constraint?.fields?.join(',') ?? '' }
}
