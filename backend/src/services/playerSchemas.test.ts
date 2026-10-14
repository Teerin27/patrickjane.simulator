import { describe, expect, it } from 'vitest'
import { createPlayerBody, listPlayersQuery, loginBody, updatePlayerBody } from './playerSchemas.js'

const valid = { username: 'valid_name', email: 'a@b.co', password: 'correct horse' }

describe('createPlayerBody', () => {
  it('trims and lowercases username and email, and leaves the password alone', () => {
    expect(createPlayerBody.parse({ username: '  Det_Guest ', email: ' Guest@Example.COM ', password: '  Mixed Case  ' })).toEqual({
      username: 'det_guest',
      email: 'guest@example.com',
      password: '  Mixed Case  ',
    })
  })

  it.each(['ab', 'a'.repeat(21), 'has space', 'dash-ed', 'ünïcode', ''])('rejects username %j', (username) => {
    expect(createPlayerBody.safeParse({ ...valid, username }).success).toBe(false)
  })

  it.each(['nope', 'a@', '@b.co', '', `${'a'.repeat(250)}@b.co`])('rejects email %j', (email) => {
    expect(createPlayerBody.safeParse({ ...valid, email }).success).toBe(false)
  })

  it.each(['short', '1234567', '', 'x'.repeat(129)])('rejects password %j', (password) => {
    expect(createPlayerBody.safeParse({ ...valid, password }).success).toBe(false)
  })

  it('accepts a password of exactly 8 and exactly 128 characters', () => {
    expect(createPlayerBody.safeParse({ ...valid, password: '12345678' }).success).toBe(true)
    expect(createPlayerBody.safeParse({ ...valid, password: 'x'.repeat(128) }).success).toBe(true)
  })

  it('requires all three fields', () => {
    for (const missing of ['username', 'email', 'password'] as const) {
      const { [missing]: _omitted, ...rest } = valid
      expect(createPlayerBody.safeParse(rest).success).toBe(false)
    }
  })

  it('drops fields the client has no business setting', () => {
    const parsed = createPlayerBody.parse({ ...valid, id: 'x', passwordHash: 'x', createdAt: 'x' })
    expect(Object.keys(parsed).sort()).toEqual(['email', 'password', 'username'])
  })
})

describe('updatePlayerBody', () => {
  it('accepts a single profile field and normalizes it', () => {
    expect(updatePlayerBody.parse({ username: 'New_Name' })).toEqual({ username: 'new_name' })
    expect(updatePlayerBody.parse({ email: 'New@Example.com' })).toEqual({ email: 'new@example.com' })
  })

  it('rejects an empty update, including one made only of unknown fields', () => {
    expect(updatePlayerBody.safeParse({}).success).toBe(false)
    expect(updatePlayerBody.safeParse({ id: 'x' }).success).toBe(false)
  })

  it('does not count currentPassword alone as something to update', () => {
    expect(updatePlayerBody.safeParse({ currentPassword: 'whatever' }).success).toBe(false)
  })

  it('still validates the fields it is given', () => {
    expect(updatePlayerBody.safeParse({ username: 'x' }).success).toBe(false)
    expect(updatePlayerBody.safeParse({ password: 'short', currentPassword: 'old' }).success).toBe(false)
  })

  it('needs currentPassword to change the password', () => {
    const result = updatePlayerBody.safeParse({ password: 'a brand new one' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['currentPassword'])
    expect(updatePlayerBody.safeParse({ password: 'a brand new one', currentPassword: 'old one' }).success).toBe(true)
  })

  it('does not need currentPassword for username or email', () => {
    expect(updatePlayerBody.safeParse({ username: 'new_name', email: 'n@e.co' }).success).toBe(true)
  })
})

describe('loginBody', () => {
  it('normalizes the username like registration does, but not the password', () => {
    expect(loginBody.parse({ username: ' Det_Guest ', password: ' Pw ' })).toEqual({ username: 'det_guest', password: ' Pw ' })
  })

  it('does not enforce registration rules, so an old or odd credential just fails to match later', () => {
    expect(loginBody.safeParse({ username: 'x', password: 'y' }).success).toBe(true)
  })

  it.each([{ username: '', password: 'pw' }, { username: 'u', password: '' }, { username: 'u' }, { password: 'pw' }, { username: 'u', password: 'x'.repeat(129) }])(
    'rejects %j',
    (body) => {
      expect(loginBody.safeParse(body).success).toBe(false)
    },
  )
})

describe('listPlayersQuery', () => {
  it('defaults to the first page of 50', () => {
    expect(listPlayersQuery.parse({})).toEqual({ limit: 50, offset: 0 })
  })

  it('coerces query-string numbers', () => {
    expect(listPlayersQuery.parse({ limit: '10', offset: '20' })).toEqual({ limit: 10, offset: 20 })
  })

  it.each([{ limit: '0' }, { limit: '101' }, { limit: 'abc' }, { offset: '-1' }, { limit: '1.5' }])('rejects %j', (query) => {
    expect(listPlayersQuery.safeParse(query).success).toBe(false)
  })
})
