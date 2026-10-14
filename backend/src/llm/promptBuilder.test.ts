import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { createSuspectState } from '../engine/questions.js'
import { decideTurn, type TurnAction } from '../engine/turn.js'
import type { SuspectState } from '../engine/types.js'
import { admissionText, buildChatPrompt, buildReactionPrompt, isDictated, speakableText } from './promptBuilder.js'

const c = loadSampleCase()

/** Play a conversation with one suspect and build the prompt for its LAST turn. */
function promptAfter(suspectId: string, turns: TurnAction[], history: { role: 'user' | 'assistant'; content: string }[] = [], reaction = false) {
  let state: SuspectState = createSuspectState(suspectId)
  let decision = decideTurn(c.truth, suspectId, state, turns[0]!)
  state = decision.state
  for (const t of turns.slice(1)) {
    decision = decideTurn(c.truth, suspectId, state, t)
    state = decision.state
  }
  const action = turns[turns.length - 1]!
  const profile = c.suspects.find((s) => s.id === suspectId)!
  const input = { briefing: c.briefing, profile, truth: c.truth.suspects[suspectId]!, evidence: c.evidence, decision, action, history }
  const req = reaction ? buildReactionPrompt(input) : buildChatPrompt(input)
  return { req, decision }
}

const ask = (message: string): TurnAction => ({ message })
const show = (evidenceId: string): TurnAction => ({ message: 'Explain this.', evidenceId })

describe('buildChatPrompt: the three layers', () => {
  const { req } = promptAfter('doyle', [ask('Where were you at midnight?')])

  it('introduces who the suspect is', () => {
    expect(req.system).toContain('Michael Doyle, Barman')
    expect(req.system).toContain('Always seems to be wiping a glass')
    expect(req.system).toContain('Owes more than he earns')
  })

  it('tells what happened and which exhibits are on the table', () => {
    expect(req.system).toContain('Victor Hale was found shot')
    expect(req.system).toContain('Exhibits already put in front of you: none')
  })

  it('sets the chat rules', () => {
    expect(req.system).toContain('one or two short sentences')
    expect(req.system).toContain('Never add details about the night')
    expect(req.system).toContain('Never accuse anyone')
  })

  it('asks the chat model, with the player’s message last', () => {
    expect(req.task).toBe('chat')
    expect(req.messages[req.messages.length - 1]).toEqual({ role: 'user', content: 'Where were you at midnight?' })
  })

  it('puts earlier turns before the new message', () => {
    const history = [
      { role: 'user' as const, content: 'Evening.' },
      { role: 'assistant' as const, content: 'Evening.' },
    ]
    const { req: r } = promptAfter('doyle', [ask('Where were you?')], history)
    expect(r.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  })
})

describe('buildChatPrompt: what the model is allowed to know', () => {
  it('gives the stance to state, but never the truth behind a standing lie', () => {
    const { req } = promptAfter('doyle', [ask('Did you leave the bar?')])
    expect(req.system).toContain('I was behind the bar all night')
    for (const secret of ['Union Station', '11:52', 'spare set', 'gambling markers', 'loan shark', 'ditched it', 'I shot Victor']) {
      expect(req.system, secret).not.toContain(secret)
    }
  })

  it('never mentions another suspect’s lies or secrets', () => {
    const { req } = promptAfter('doyle', [ask('Did you leave the bar?')])
    for (const other of ['Chicago', 'blackmail', 'rival club', 'died under my care', 'Harold Finch']) {
      expect(req.system, other).not.toContain(other)
    }
  })

  it('does not mention the other suspects’ names as culprits or hint at who did it', () => {
    const { req } = promptAfter('pike', [ask('Any trouble with Victor?')])
    expect(req.system).not.toMatch(/culprit|killer is|murderer is/i)
  })

  it('tells nothing specific when the question touches no topic', () => {
    const { req } = promptAfter('doyle', [ask('Do you like jazz?')])
    expect(req.system).toContain('You have not committed to anything yet')
    expect(req.system).toContain('nothing specific to say on this topic')
  })

  it('shows the exhibit’s public description, which the player can already read', () => {
    const { req } = promptAfter('doyle', [show('ticket')])
    expect(req.system).toContain('Rail ticket: Union Station stub, stamped 11:52 PM')
    expect(req.messages[req.messages.length - 1]!.content).toContain('slides the Rail ticket across the table')
  })

  it('does not turn a standing lie into an admission just because an exhibit was shown', () => {
    const { req } = promptAfter('doyle', [show('ticket')]) // never committed, so nothing to break
    expect(req.system).not.toContain('JUST EXPOSED')
    expect(req.system).not.toContain('ditched')
  })
})

describe('once the engine breaks something', () => {
  const crack = [ask('Did you leave the bar?'), show('ticket'), ask('Who had the keys?'), show('key')]

  it('treats a turn that breaks a lie or cracks a secret as dictated by the engine', () => {
    expect(isDictated(promptAfter('doyle', [ask('Did you leave the bar?')]).decision)).toBe(false)
    expect(isDictated(promptAfter('doyle', [show('ticket')]).decision)).toBe(false) // nothing committed yet: nothing to break
    expect(isDictated(promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket')]).decision)).toBe(true)
    expect(isDictated(promptAfter('doyle', crack).decision)).toBe(true)
  })

  it('takes the admission from the case file: the lie’s own truth text', () => {
    const { decision } = promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket')])
    expect(admissionText(decision)).toBe(c.truth.suspects.doyle!.claims.find((x) => x.id === 'alibi')!.truth)
  })

  it('takes the confession from the case file, and lets it stand in for the lies it covers', () => {
    const { decision } = promptAfter('doyle', crack)
    expect(decision.brokenNow).toHaveLength(1) // the keys lie breaks in the same turn
    expect(admissionText(decision)).toBe(c.truth.suspects.doyle!.secrets[0]!.description)
  })

  it('confesses an innocent’s own secret, not the murder', () => {
    const { decision } = promptAfter('pike', [ask('Any trouble with Victor?'), show('letter')])
    expect(admissionText(decision)).toContain('I paid Victor for months')
    expect(admissionText(decision)).not.toContain('I shot')
  })

  describe('the reaction prompt', () => {
    const { req } = promptAfter('doyle', crack, [], true)

    it('asks the chat model for one short remark that states no facts', () => {
      expect(req.task).toBe('chat')
      expect(req.system).toContain('ONE short exclamation of at most 8 words')
      expect(req.system).toContain('Do not state any facts')
      expect(req.system).toContain('Do not deny, explain or excuse')
      expect(req.maxTokens).toBeLessThan(200)
    })

    it('still tells the model who the suspect is and how they feel', () => {
      expect(req.system).toContain('Michael Doyle, Barman')
      expect(req.system).toContain('bartender patter')
      expect(req.system).toMatch(/Right now you feel/)
    })

    it('holds none of the case’s secrets, so there is nothing for the model to leak', () => {
      for (const secret of ['loan shark', 'gambling markers', 'ditched', 'I shot', 'spare set of office keys', 'WHAT YOU MAY SAY']) {
        expect(req.system, secret).not.toContain(secret)
      }
    })

    it('leaves the briefing and the exhibit out too, since the model narrates whatever facts it is handed', () => {
      expect(req.system).not.toContain('Victor Hale was found shot')
      expect(req.system).not.toContain('Brass key')
      expect(JSON.stringify(req.messages)).not.toContain('Brass key')
    })

    it('teaches the shape with two sample remarks fitting the suspect’s mood, then asks for a third', () => {
      expect(req.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
      // a confession leaves the suspect broken, whatever the composure number says
      expect(req.messages[1]!.content).toBe('You win, detective.')
      expect(req.messages[3]!.content).toBe('God help me.')

      const angry = promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket')], [], true).req // composure 60, nervous
      expect(angry.messages[1]!.content).toBe('All right, all right.')
    })

    it('leaves the real question and the history out, so the model does not try to answer them', () => {
      const withHistory = promptAfter('doyle', crack, [{ role: 'user', content: 'Earlier question' }, { role: 'assistant', content: 'Earlier answer' }], true).req
      expect(JSON.stringify(withHistory.messages)).not.toContain('Earlier')
      expect(JSON.stringify(withHistory.messages)).not.toContain('Explain this.')
    })

    it('asks for variety', () => {
      expect(req.temperature).toBeGreaterThanOrEqual(0.8)
    })
  })

  describe('open turns that follow', () => {
    it('list an exposed lie as admitted, not as a story to defend', () => {
      const { req } = promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket'), ask('So where were you, really?')])
      expect(req.system).toContain('Lies the detective has exposed (you have admitted these are true)')
      expect(req.system).toContain('I left the bar around 11:45')
      expect(req.system).not.toContain('(stand by it)')
    })

    it('still carry stances from earlier turns so the suspect stays consistent', () => {
      const { req } = promptAfter('doyle', [ask('Did you leave the bar?'), ask('Who had the keys?')])
      expect(req.system).toContain('Victor was the only one with a key')
      expect(req.system).toContain('Things you told the detective earlier')
      expect(req.system).toContain('I was behind the bar all night')
    })

    it('list a confession as a secret that has come out', () => {
      const { req } = promptAfter('doyle', [...crack, ask('Anything to add?')])
      expect(req.system).toContain('Secrets that have come out:')
      expect(req.system).toContain('I shot Victor in his office')
    })

    it('tell a suspect who has confessed not to deny it, whatever is asked', () => {
      for (const next of [ask('You did it, Doyle.'), ask('Where were you at midnight?'), ask('Anything to add?')]) {
        const { req } = promptAfter('doyle', [...crack, next])
        expect(req.system, next.message).toContain('You have already confessed to the murder')
        expect(req.system).toContain('Do not deny it')
      }
    })

    it('do not say that to a suspect who has not confessed to the murder', () => {
      expect(promptAfter('doyle', [ask('You did it, Doyle.')]).req.system).not.toContain('already confessed')
      // an innocent's personal confession is not a murder confession
      const pike = promptAfter('pike', [ask('Any trouble with Victor?'), show('letter'), ask('You killed Victor, did you not?')])
      expect(pike.req.system).not.toContain('already confessed to the murder')
    })

    it('keep the murder out of the prompt until the engine releases it', () => {
      const { req } = promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket'), ask('Who had the keys?')])
      expect(req.system).not.toContain('I shot Victor')
    })
  })
})

describe('speakableText', () => {
  const textAfter = (suspectId: string, turns: TurnAction[]) => {
    let state: SuspectState = createSuspectState(suspectId)
    let decision = decideTurn(c.truth, suspectId, state, turns[0]!)
    for (const t of turns.slice(1)) {
      state = decision.state
      decision = decideTurn(c.truth, suspectId, state, t)
    }
    const profile = c.suspects.find((s) => s.id === suspectId)!
    return speakableText({ briefing: c.briefing, profile, truth: c.truth.suspects[suspectId]!, evidence: c.evidence, decision, action: turns[turns.length - 1]!, history: [] })
  }

  it('covers the briefing, the player’s own words and the story the suspect is defending', () => {
    const text = textAfter('doyle', [ask('Where were you at 11:40?')])
    expect(text).toContain('12:10 AM') // from the briefing
    expect(text).toContain('11:40') // the player said it
    expect(text).toContain('I was behind the bar all night')
  })

  it('does not cover the truth behind a lie that is still standing', () => {
    const text = textAfter('doyle', [ask('Did you leave the bar?')])
    expect(text).not.toContain('11:52')
    expect(text).not.toContain('Union Station')
  })

  it('covers the exhibit on the table, and the admission once a lie is broken', () => {
    const text = textAfter('doyle', [ask('Did you leave the bar?'), show('ticket')])
    expect(text).toContain('Union Station stub, stamped 11:52 PM')
    expect(text).toContain('I left the bar around 11:45')
  })
})

describe('buildChatPrompt: how to answer', () => {
  it('describes the mood in the suspect’s tone', () => {
    const { req } = promptAfter('doyle', [ask('Did you leave the bar?'), show('ticket')])
    expect(req.system).toMatch(/Right now you feel (uneasy|composed|irritated|worn down)/)
  })

  it('answers an accusation with a denial', () => {
    const { req } = promptAfter('doyle', [ask('You did it, Doyle.')])
    expect(req.system).toContain('accusing you outright. Deny it')
  })

  it('treats a repeated exhibit as nothing new', () => {
    const { req } = promptAfter('doyle', [show('glass'), show('glass')])
    expect(req.system).toContain('shown you this exhibit before')
  })
})
