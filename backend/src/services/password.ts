import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// scrypt is a deliberately slow, memory-hungry hash: each guess an attacker makes against a stolen
// database costs ~100 ms and 32 MiB, which a fast hash like SHA-256 would not. The cost parameters
// are stored inside every hash, so they can be raised later without breaking existing passwords.
const N = 2 ** 15
const R = 8
const P = 1
const KEY_LENGTH = 32

const derive = (password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) =>
  new Promise<Buffer>((resolve, reject) =>
    // scrypt needs 128 * N * r bytes; give it double so the default 32 MiB cap is never the limit
    scrypt(password.normalize('NFKC'), salt, keyLength, { N: n, r, p, maxmem: 256 * n * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )

/** Format: `scrypt$N$r$p$salt$hash` (salt and hash in base64). A fresh random salt per password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, N, R, P, KEY_LENGTH)
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

/** False for a wrong password and for a stored value that is not a valid hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p), expected.length)
  // constant-time compare, so response time does not reveal how many leading bytes matched
  return timingSafeEqual(actual, expected)
}
