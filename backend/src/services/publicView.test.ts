import { describe, expect, it } from 'vitest'
import { toPlayerAccount, toPublicCaseCard, toPublicPlayer } from './publicView.js'

const row = {
  id: '3bceee9a-8331-4ab2-b113-c646f79cb70f',
  username: 'det_guest',
  email: 'guest@example.com',
  passwordHash: 'scrypt$32768$8$1$c2FsdA==$aGFzaA==',
  createdAt: new Date('2026-10-15T00:00:00Z'),
  updatedAt: new Date('2026-10-15T01:00:00Z'),
}

describe('player views', () => {
  it('shows the public view only id, username and createdAt', () => {
    expect(toPublicPlayer(row)).toEqual({ id: row.id, username: 'det_guest', createdAt: row.createdAt })
  })

  it("adds the email and updatedAt to the owner's account view", () => {
    expect(toPlayerAccount(row)).toEqual({
      id: row.id,
      username: 'det_guest',
      createdAt: row.createdAt,
      email: 'guest@example.com',
      updatedAt: row.updatedAt,
    })
  })

  it('never lets the password hash out, in either view', () => {
    expect(JSON.stringify(toPublicPlayer(row))).not.toContain('scrypt')
    expect(JSON.stringify(toPlayerAccount(row))).not.toContain('scrypt')
    expect(toPlayerAccount(row)).not.toHaveProperty('passwordHash')
  })

  it('keeps the email out of the public view', () => {
    expect(toPublicPlayer(row)).not.toHaveProperty('email')
  })
})

describe('case card', () => {
  const look = { skin: 'tan', hairStyle: 'short', hairColor: 'black', facialHair: 'none', glasses: false, hat: false, outfit: 'suit', outfitColor: 'navy' }
  // a row as the database returns it, carrying everything including what must never leave the server
  const row = {
    id: 'c1',
    slug: 'case-0002-test',
    title: 'The Test',
    number: 'Case 0002',
    briefing: 'Somebody died.',
    culpritId: 'doyle',
    verdictCorrect: 'secret verdict',
    truth: { story: 'secret story' },
    suspects: [{ id: 'doyle', short: 'M. DOYLE', role: 'Barman', look, alibi: 'x', opener: 'y', closer: 'z', fullName: 'Michael Doyle', age: 42, address: 'a', tie: 't', whereabouts: [] }],
  }

  it('shows what is needed to choose a case: number, title, briefing, and who is in it', () => {
    expect(toPublicCaseCard(row)).toEqual({
      id: 'c1',
      slug: 'case-0002-test',
      title: 'The Test',
      number: 'Case 0002',
      briefing: 'Somebody died.',
      suspects: [{ id: 'doyle', short: 'M. DOYLE', role: 'Barman', look }],
    })
  })

  it('never lets the culprit, the verdict texts or the ground truth out', () => {
    const text = JSON.stringify(toPublicCaseCard(row))
    for (const secret of ['culpritId', 'verdictCorrect', 'secret verdict', 'secret story', 'truth']) expect(text, secret).not.toContain(secret)
  })
})
