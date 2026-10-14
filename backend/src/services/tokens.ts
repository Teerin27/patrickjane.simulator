import { createHash, randomBytes } from 'node:crypto'

/** 256 random bits, URL-safe. This is what the client keeps and sends as `Authorization: Bearer <token>`. */
export const newToken = () => randomBytes(32).toString('base64url')

/**
 * Only this hash is stored. The token is random, not a human password, so a fast hash is enough:
 * there is nothing to brute-force, and the lookup stays a plain indexed equality.
 */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** The token from an `Authorization: Bearer <token>` header, or undefined if absent or malformed. */
export function bearerToken(header: string | undefined): string | undefined {
  return /^Bearer ([A-Za-z0-9_-]{16,128})$/i.exec(header ?? '')?.[1]
}
