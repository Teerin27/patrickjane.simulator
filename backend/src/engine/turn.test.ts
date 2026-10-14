import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { createSuspectState, spendQuestion } from './questions.js'
import { decideTurn, moodFor, requiredEvidence, type TurnAction } from './turn.js'
import type { SuspectState } from './types.js'

const { truth } = loadSampleCase()

/** Charge the question the way the server does, then let the engine decide. */
function play(suspectId: string, state: SuspectState, action: TurnAction) {
  const spent = spendQuestion(state)
  if (!spent.ok) throw new Error('lawyered up')
  return decideTurn(truth, suspectId, spent.state, action)
}

/** A whole conversation: each turn starts from the state the last one left. */
function conversation(suspectId: string, turns: TurnAction[]) {
  let state = createSuspectState(suspectId)
  const decisions = turns.map((t) => {
    const d = play(suspectId, state, t)
    state = d.state
    return d
  })
  return { state, decisions, last: decisions[decisions.length - 1]! }
}

const ask = (message: string): TurnAction => ({ message })
const show = (evidenceId: string, message = 'Explain this.'): TurnAction => ({ message, evidenceId })

describe('commitments', () => {
  it('binds the suspect to a stance when the player asks about the topic', () => {
    const { last } = conversation('doyle', [ask('Did you leave the bar tonight?')])
    expect(last.stand.map((c) => c.id)).toEqual(['alibi'])
    expect(last.state.commitments).toEqual(['alibi'])
    expect(last.kind).toBe('ask')
  })

  it('commits to several stances when a message touches several topics', () => {
    const { last } = conversation('doyle', [ask('Where were you, and who held the keys?')])
    expect(last.state.commitments.sort()).toEqual(['alibi', 'keys'])
  })

  it('commits to nothing for a question about an unrelated topic', () => {
    const { last } = conversation('doyle', [ask('Do you like jazz?')])
    expect(last.stand).toEqual([])
    expect(last.state.commitments).toEqual([])
  })

  it('commits to nothing on small talk, even if it brushes a keyword', () => {
    const { last } = conversation('doyle', [ask('Hello, nice place. Is the door always this heavy?')])
    expect(last.intent).toBe('smalltalk')
    expect(last.state.commitments).toEqual([])
  })

  it('keeps standing by a stance when asked about it again, without recording it twice', () => {
    const { last } = conversation('doyle', [ask('Did you leave the bar?'), ask('Are you sure you never left the bar?')])
    expect(last.stand.map((c) => c.id)).toEqual(['alibi'])
    expect(last.state.commitments).toEqual(['alibi'])
  })

  it('matches triggers case-insensitively', () => {
    const { last } = conversation('doyle', [ask('WHO HAD THE KEYS?')])
    expect(last.state.commitments).toEqual(['keys'])
  })
})

describe('contradictions', () => {
  it('breaks a lie the suspect committed to, and lowers composure by the edge weight plus pressure', () => {
    const { last } = conversation('doyle', [ask('Did you leave the bar?'), show('ticket')])
    expect(last.brokenNow.map((c) => c.id)).toEqual(['alibi'])
    expect(last.kind).toBe('contradiction')
    expect(last.evidence).toBe('broke')
    expect(last.state.brokenClaims).toEqual(['alibi'])
    expect(last.state.composure).toBe(100 - 30 - 10) // contradiction 30, implicates 10
    expect(last.brokenNow[0]?.exposedNote).toBe('Doyle left the bar at 11:52. Alibi broken.')
  })

  it('does nothing to a lie the suspect has not stated yet', () => {
    const { last } = conversation('doyle', [show('ticket')])
    expect(last.brokenNow).toEqual([])
    expect(last.kind).toBe('deflect')
    expect(last.state.brokenClaims).toEqual([])
    expect(last.state.composure).toBe(90) // pressure only: the ticket still points at him
    expect(last.evidence).toBe('pressure')
  })

  it('lets a re-shown exhibit land once the suspect has committed since', () => {
    const { decisions, last } = conversation('doyle', [show('ticket'), ask('Did you leave the bar?'), show('ticket')])
    expect(decisions[0]!.state.composure).toBe(90)
    expect(last.brokenNow.map((c) => c.id)).toEqual(['alibi'])
    expect(last.state.composure).toBe(60) // only the contradiction: the pressure was already paid
    expect(last.repeat).toBe(false)
  })

  it('treats showing the same exhibit twice as a repeat that changes nothing', () => {
    const { decisions, last } = conversation('doyle', [ask('Did you leave the bar?'), show('ticket'), show('ticket')])
    expect(last.repeat).toBe(true)
    expect(last.kind).toBe('deflect')
    expect(last.state.composure).toBe(decisions[1]!.state.composure)
    expect(last.brokenNow).toEqual([])
  })

  it('does not break the same lie twice', () => {
    const { last } = conversation('doyle', [ask('Did you leave the bar?'), show('ticket'), ask('Where were you?'), show('ticket')])
    expect(last.brokenNow).toEqual([])
    expect(last.state.brokenClaims).toEqual(['alibi'])
  })

  it("ignores edges that belong to another suspect's story", () => {
    const { last } = conversation('doyle', [ask('Did you go upstairs to the office?'), show('glass')])
    expect(last.brokenNow).toEqual([])
    expect(last.state.composure).toBe(100)
    expect(last.evidence).toBe('nothing')
    expect(last.kind).toBe('deflect')
  })

  it('never lets composure leave 0..100', () => {
    let state = createSuspectState('doyle')
    state = { ...state, composure: 5 }
    const d = play('doyle', state, ask('Did you leave the bar?'))
    const d2 = play('doyle', d.state, show('ticket'))
    expect(d2.state.composure).toBe(0)
  })
})

describe('secrets and confession', () => {
  it('reveals an innocent suspect’s own secret once its exhibit lands and composure is low enough', () => {
    const { last } = conversation('pike', [ask('Any trouble between you and Victor?'), show('letter')])
    expect(last.revealedNow.map((s) => s.id)).toEqual(['blackmail'])
    expect(last.kind).toBe('truth')
    expect(last.brokenNow.map((c) => c.id)).toEqual(['trouble']) // the lie breaks in the same turn
    expect(last.state.revealedSecrets).toEqual(['blackmail'])
    expect(last.mood).toBe('broken')
  })

  it('keeps the culprit’s murder confession locked until BOTH exhibits are shown', () => {
    const afterTicket = conversation('doyle', [ask('Did you leave the bar?'), show('ticket')])
    expect(afterTicket.state.revealedSecrets).toEqual([])
    expect(afterTicket.last.revealedNow).toEqual([])
    expect(afterTicket.state.composure).toBe(60)
  })

  it('makes the culprit confess when composure is low and both exhibits have been shown', () => {
    const { last } = conversation('doyle', [ask('Did you leave the bar?'), show('ticket'), ask('Who had the keys?'), show('key')])
    expect(last.state.composure).toBe(25) // 100 - (30+10) - (25+10)
    expect(last.revealedNow.map((s) => s.id)).toEqual(['murder'])
    expect(last.kind).toBe('truth')
    expect(last.state.revealedSecrets).toEqual(['murder'])
  })

  it('does not confess when the exhibits are shown but the suspect never committed (composure stays high)', () => {
    const { last } = conversation('doyle', [show('ticket'), show('key')])
    expect(last.state.composure).toBe(80) // pressure only
    expect(last.revealedNow).toEqual([])
  })

  it('can confess on a plain question once the conditions have been met by earlier turns', () => {
    const { decisions } = conversation('doyle', [
      ask('Did you leave the bar?'),
      show('ticket'),
      ask('Who had the keys?'),
      show('key'),
      ask('Anything to add?'),
    ])
    // the confession happened on turn 4; later turns must not repeat it
    expect(decisions[3]!.revealedNow).toHaveLength(1)
    expect(decisions[4]!.revealedNow).toEqual([])
  })

  it('never reveals a secret that no exhibit is tied to', () => {
    const detached = { ...truth, edges: truth.edges.filter((e) => e.kind !== 'reveals') }
    let state = { ...createSuspectState('doyle'), composure: 0 }
    state = decideTurn(detached, 'doyle', state, ask('Anything?')).state
    expect(state.revealedSecrets).toEqual([])
  })

  it('only the culprit has a murder secret', () => {
    const murderers = Object.entries(truth.suspects).filter(([, s]) => s.secrets.some((x) => x.kind === 'murder'))
    expect(murderers.map(([id]) => id)).toEqual(['doyle'])
  })
})

describe('accusation and mood', () => {
  it('answers an accusation with a deflection and no state change beyond the question', () => {
    const { last } = conversation('doyle', [ask('You did it, Doyle.')])
    expect(last.intent).toBe('accusation')
    expect(last.kind).toBe('deflect')
    expect(last.state.composure).toBe(100)
  })

  it.each([
    [100, 'calm'],
    [71, 'calm'],
    [70, 'nervous'],
    [41, 'nervous'],
    [40, 'angry'],
    [21, 'angry'],
    [20, 'broken'],
    [0, 'broken'],
  ])('composure %i is %s', (composure, mood) => {
    expect(moodFor(composure)).toBe(mood)
  })
})

describe('purity', () => {
  it('does not change the state or the case it was given', () => {
    const before = createSuspectState('doyle')
    const snapshot = JSON.stringify(before)
    const truthSnapshot = JSON.stringify(truth)
    decideTurn(truth, 'doyle', before, show('ticket'))
    expect(JSON.stringify(before)).toBe(snapshot)
    expect(JSON.stringify(truth)).toBe(truthSnapshot)
  })

  it('gives the same decision for the same input', () => {
    const state = createSuspectState('pike')
    expect(decideTurn(truth, 'pike', state, ask('Any trouble?'))).toEqual(decideTurn(truth, 'pike', state, ask('Any trouble?')))
  })

  it('refuses a suspect the case does not have', () => {
    expect(() => decideTurn(truth, 'nobody', createSuspectState('nobody'), ask('hi'))).toThrow(/No ground truth/)
  })
})

describe('requiredEvidence', () => {
  it('lists every exhibit tied to a secret', () => {
    expect(requiredEvidence(truth, 'doyle', 'murder').sort()).toEqual(['key', 'ticket'])
    expect(requiredEvidence(truth, 'pike', 'blackmail')).toEqual(['letter'])
    expect(requiredEvidence(truth, 'pike', 'nope')).toEqual([])
  })
})
