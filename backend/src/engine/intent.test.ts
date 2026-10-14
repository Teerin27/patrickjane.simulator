import { describe, expect, it } from 'vitest'
import { classifyIntent } from './intent.js'

describe('classifyIntent', () => {
  it('treats any message that carries an exhibit as a confrontation', () => {
    expect(classifyIntent('Explain this.', 'ticket')).toBe('confrontation')
    expect(classifyIntent('hello', 'ticket')).toBe('confrontation')
  })

  it.each(['You did it, Doyle.', 'I accuse you of murder', 'You killed Victor!', "You're the killer", 'Just confess'])('spots an accusation: %s', (msg) => {
    expect(classifyIntent(msg)).toBe('accusation')
  })

  it.each(['Hello there', 'hi', 'Good evening, Mr Doyle', 'Thanks for your time', 'Nice place you have'])('spots small talk: %s', (msg) => {
    expect(classifyIntent(msg)).toBe('smalltalk')
  })

  it.each(['Where were you at midnight?', 'Who holds the office keys?', 'Did you hear a shot?', 'High-priced rye, is it not?'])(
    'defaults to a question: %s',
    (msg) => {
      expect(classifyIntent(msg)).toBe('question')
    },
  )

  it('does not call a question that merely contains a greeting word small talk', () => {
    expect(classifyIntent('Tell me, who said hello to Victor last?')).toBe('question')
  })
})
