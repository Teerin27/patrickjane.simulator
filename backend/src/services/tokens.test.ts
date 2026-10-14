import { describe, expect, it } from 'vitest'
import { bearerToken, hashToken, newToken } from './tokens.js'

describe('newToken', () => {
  it('is 256 bits of URL-safe randomness and never repeats', () => {
    const tokens = new Set(Array.from({ length: 50 }, newToken))
    expect(tokens.size).toBe(50)
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

describe('hashToken', () => {
  it('is stable, and is not the token itself', () => {
    const token = newToken()
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(token)).not.toContain(token)
    expect(hashToken(token)).not.toBe(hashToken(newToken()))
  })
})

describe('bearerToken', () => {
  const token = newToken()

  it('extracts the token from a Bearer header, whatever the scheme capitalization', () => {
    expect(bearerToken(`Bearer ${token}`)).toBe(token)
    expect(bearerToken(`bearer ${token}`)).toBe(token)
  })

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Basic dXNlcjpwYXNz',
    'Bearer too short',
    'Bearer has spaces inside it xxxxxxxxxxxx',
    `Token ${'a'.repeat(43)}`,
    `Bearer ${'a'.repeat(200)}`,
    `Bearer ${'a'.repeat(43)} extra`,
  ])('returns undefined for %j', (header) => {
    expect(bearerToken(header)).toBeUndefined()
  })
})
