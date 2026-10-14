import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password hashing', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
    expect(await verifyPassword('correct horse batterz', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('never stores the password, and salts every hash differently', async () => {
    const a = await hashPassword('same password')
    const b = await hashPassword('same password')
    expect(a).not.toContain('same password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same password', a)).toBe(true)
    expect(await verifyPassword('same password', b)).toBe(true)
  })

  it('records its scheme and cost parameters in the hash, so they can be raised later', async () => {
    const [scheme, n, r, p, salt, hash] = (await hashPassword('x')).split('$')
    expect([scheme, n, r, p]).toEqual(['scrypt', '32768', '8', '1'])
    expect(Buffer.from(salt ?? '', 'base64')).toHaveLength(16)
    expect(Buffer.from(hash ?? '', 'base64')).toHaveLength(32)
  })

  it('treats unicode-equivalent passwords as the same', async () => {
    const stored = await hashPassword('café au lait') // é as one character
    expect(await verifyPassword('café au lait', stored)).toBe(true) // e + combining accent
  })

  it.each(['', 'plaintext', 'scrypt$1$2$3', 'bcrypt$32768$8$1$c2FsdA==$aGFzaA==', 'scrypt$$$$$'])(
    'returns false, not an error, for a stored value that is not a valid hash: %j',
    async (stored) => {
      expect(await verifyPassword('anything', stored)).toBe(false)
    },
  )
})
