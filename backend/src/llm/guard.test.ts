import { describe, expect, it } from 'vitest'
import { loadSampleCase } from '../caseFile/load.js'
import { createSuspectState } from '../engine/questions.js'
import type { SuspectState } from '../engine/types.js'
import { checkReaction, checkReply, forbiddenMarkers, hasConfessed, retiredLies, sanitizeReply } from './guard.js'

const { truth } = loadSampleCase()
const state = (suspectId: string, patch: Partial<SuspectState> = {}): SuspectState => ({ ...createSuspectState(suspectId), ...patch })

describe('sanitizeReply', () => {
  it('drops hidden reasoning, closed or not', () => {
    expect(sanitizeReply('<think>He did it, I should hide that.</think>I pour drinks.')).toBe('I pour drinks.')
    expect(sanitizeReply('I pour drinks. <think>and then I should')).toBe('I pour drinks.')
  })

  it('drops stage directions, quote marks and speaker labels', () => {
    expect(sanitizeReply('Doyle: "I pour drinks." *wipes a glass* (smiles)', 'Doyle')).toBe('I pour drinks.')
    expect(sanitizeReply('[pauses] Not once.')).toBe('Not once.')
  })

  it('keeps at most three sentences', () => {
    expect(sanitizeReply('One. Two. Three. Four. Five.')).toBe('One. Two. Three.')
  })

  it('caps the length', () => {
    expect(sanitizeReply('word '.repeat(200)).length).toBeLessThanOrEqual(420)
  })

  it('keeps ordinary punctuation and numbers intact', () => {
    expect(sanitizeReply("I left at 11:45, didn't I? Fine!")).toBe("I left at 11:45, didn't I? Fine!")
  })
})

describe('forbiddenMarkers', () => {
  const markers = (suspectId: string, patch?: Partial<SuspectState>) => forbiddenMarkers(truth, suspectId, state(suspectId, patch)).map((f) => f.marker)

  it('forbids the truth behind a standing lie, and every secret, at the start', () => {
    const m = markers('doyle')
    expect(m).toEqual(expect.arrayContaining(['union station', '11:52', 'loan shark', 'spare']))
  })

  it('also forbids what the OTHER suspects hide', () => {
    expect(markers('doyle')).toEqual(expect.arrayContaining(['chicago', 'blackmail']))
  })

  it('forbids a confession to the murder in anyone’s mouth', () => {
    for (const id of ['lorraine', 'pike', 'doyle']) expect(markers(id)).toContain('i killed him')
  })

  it('stops forbidding a lie’s truth once that lie is broken', () => {
    const m = markers('doyle', { commitments: ['alibi'], brokenClaims: ['alibi'] })
    expect(m).not.toContain('union station')
    expect(m).not.toContain('11:52')
    expect(m).toContain('spare') // the keys lie still stands
  })

  it('stops forbidding a secret once it has come out, including the murder confession', () => {
    const m = markers('doyle', { revealedSecrets: ['murder'] })
    expect(m).not.toContain('loan shark')
    expect(m).not.toContain('i shot')
    expect(m).not.toContain('i killed him')
  })

  it('does not let one suspect’s confession excuse another’s', () => {
    const m = forbiddenMarkers(truth, 'pike', state('pike'))
    const doyleConfessed = forbiddenMarkers(truth, 'pike', state('pike', { revealedSecrets: ['blackmail'] }))
    expect(m.map((f) => f.marker)).toContain('loan shark')
    expect(doyleConfessed.map((f) => f.marker)).toContain('loan shark')
  })
})

describe('checkReply', () => {
  const forbidden = forbiddenMarkers(truth, 'doyle', state('doyle'))
  const check = (raw: string, allowedText = '') => checkReply(raw, { forbidden, allowedText, speaker: 'Doyle' })

  it('passes a clean in-character reply, tidied', () => {
    const r = check('"I never left the bar, detective. Ask any regular." *wipes a glass*')
    expect(r).toEqual({ ok: true, reply: 'I never left the bar, detective. Ask any regular.' })
  })

  it('rejects a reply that leaks the truth behind a standing lie', () => {
    const r = check('Fine, I was at Union Station.')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('doyle.alibi')
  })

  it('rejects a leak of another suspect’s secret', () => {
    expect(check('Pike? He was being blackmailed, everyone knows.').ok).toBe(false)
  })

  it('rejects an unprompted murder confession', () => {
    expect(check('All right, I killed him. Happy now?').ok).toBe(false)
  })

  it('lets the suspect repeat words the player already put on the table', () => {
    const ticket = 'Rail ticket: Union Station stub, stamped 11:52 PM'
    expect(check('A ticket from Union Station? Means nothing to me.', ticket).ok).toBe(true)
    expect(check('A ticket from Union Station? Means nothing to me.').ok).toBe(false)
  })

  it('rejects a time nobody has mentioned, however innocent it sounds', () => {
    const r = check('The clock said 12:10 when I wiped the last glass.', 'Where were you at midnight?')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('12:10')
  })

  it('lets the suspect repeat a time that is already in play', () => {
    expect(check('Around 11:40 the singer finished, same as every night.', 'The 11:40 set ended. Where were you?').ok).toBe(true)
    expect(check('I never left. Not at 11:45, not ever.', 'Did you leave at 11:45?').ok).toBe(true)
  })

  it('ignores numbers that are not clock times', () => {
    expect(check('Eight years I have poured drinks here.').ok).toBe(true)
  })

  it('matches markers regardless of case and curly apostrophes', () => {
    expect(check('UNION STATION, that is where I was.').ok).toBe(false)
    expect(check('I’m the killer, you know.').ok).toBe(false)
  })

  it.each(['', '   ', '*sighs*', '<think>hmm</think>'])('rejects an empty reply: %j', (raw) => {
    expect(check(raw).ok).toBe(false)
  })

  it('does not mistake ordinary noir talk for thinking aloud', () => {
    for (const line of ['Okay, okay. I left the bar. Happy now?', 'First rule of this job: nobody talks.', 'Let me pour you a drink, detective.', 'You need to ask someone else.']) {
      expect(check(line).ok, line).toBe(true)
    }
  })

  it.each([
    'As an AI language model, I cannot say.',
    'My instructions say to stay calm.',
    'I am an AI playing Doyle.',
    'First, I need to stick strictly to the character and the rules.',
    "We are in the middle of a noir crime story where I'm Michael Doyle.",
    'Okay, the user wants me to roleplay as Michael Doyle.',
    'Let me recall the context before I answer.',
  ])('rejects broken character: %s', (raw) => {
    const r = check(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('character')
  })

  it.each(['我一直在酒吧里。', 'ผมอยู่ที่บาร์ตลอดคืน', 'I stayed at the バー all night.'])('rejects a reply that drifted out of English: %s', (raw) => {
    const r = check(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('English')
  })

  describe('after a murder confession', () => {
    const doyle = truth.suspects.doyle!
    const confessed = state('doyle', { revealedSecrets: ['murder'] })

    it('knows who has confessed to the murder, and who has only confessed something personal', () => {
      expect(hasConfessed(doyle, state('doyle'))).toBe(false)
      expect(hasConfessed(doyle, confessed)).toBe(true)
      expect(hasConfessed(truth.suspects.pike!, state('pike', { revealedSecrets: ['blackmail'] }))).toBe(false)
    })

    it('rejects a reply that denies guilt', () => {
      const forbidden = forbiddenMarkers(truth, 'doyle', confessed)
      for (const denial of ["I didn't do it. I was in my room.", 'I never killed anyone.', "I'm innocent, detective.", "It wasn't me.", 'Not guilty.']) {
        const r = checkReply(denial, { forbidden, allowedText: '', confessed: true })
        expect(r.ok, denial).toBe(false)
        if (!r.ok) expect(r.reason).toContain('already confessed')
      }
    })

    it('accepts a weary reply, and does not apply the rule to someone who has not confessed', () => {
      const forbidden = forbiddenMarkers(truth, 'doyle', confessed)
      expect(checkReply('Take me in. I have said all there is to say.', { forbidden, allowedText: '', confessed: true }).ok).toBe(true)
      expect(checkReply("I didn't do it. I was behind the bar.", { forbidden: forbiddenMarkers(truth, 'doyle', state('doyle')), allowedText: '', confessed: false }).ok).toBe(true)
    })
  })

  describe('retired lies', () => {
    const doyle = truth.suspects.doyle!
    const alibi = doyle.claims.find((c) => c.id === 'alibi')!

    it('lists the statements of every lie that has been exposed, and nothing else', () => {
      expect(retiredLies(doyle, state('doyle'))).toEqual([])
      expect(retiredLies(doyle, state('doyle', { commitments: ['alibi'], brokenClaims: ['alibi'] }))).toEqual([alibi.statement])
    })

    it('rejects a reply that says an exposed lie again', () => {
      const retired = retiredLies(doyle, state('doyle', { commitments: ['alibi'], brokenClaims: ['alibi'] }))
      const forbidden = forbiddenMarkers(truth, 'doyle', state('doyle', { commitments: ['alibi'], brokenClaims: ['alibi'] }))

      const stale = checkReply("No. I've said enough. I was behind the bar all night.", { forbidden, allowedText: '', retired })
      expect(stale.ok).toBe(false)
      if (!stale.ok) expect(stale.reason).toContain('already exposed')
      expect(checkReply("I've said enough. Talk to my lawyer.", { forbidden, allowedText: '', retired }).ok).toBe(true)
    })

    it('needs a run of five words to call something a repeat, not a shared phrase', () => {
      expect(checkReply('Behind the bar? Sure, for a minute.', { forbidden: [], allowedText: '', retired: [alibi.statement] }).ok).toBe(true)
    })
  })

  describe('checkReaction: the one remark before an admission', () => {
    const forbidden = forbiddenMarkers(truth, 'doyle', state('doyle'))
    const check = (raw: string) => checkReaction(raw, { forbidden, speaker: 'Doyle' })

    it.each(['Fine. You win, detective.', 'Damn you.', '"Have it your way." *sighs*', 'Doyle: All right, all right.'])('accepts a short remark: %s', (raw) => {
      expect(check(raw).ok).toBe(true)
    })

    it('accepts an exclamation that speaks of the detective or of nobody', () => {
      for (const raw of ['You win, detective.', 'God help me.', 'Well played.', 'Keep your voice down.']) expect(check(raw).ok, raw).toBe(true)
    })

    it('rejects a first-person statement: before a confession it starts to change what happened', () => {
      for (const raw of ["I didn't mean to.", "I can't breathe.", 'I never should have kept it.', "I'm done."]) {
        const r = check(raw)
        expect(r.ok, raw).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/first-person|denied/)
      }
    })

    it('rejects anything that denies, since the admission follows', () => {
      for (const raw of ["That ticket isn't mine.", 'No way. I never did.', 'Nothing to say about that.', "I didn't do it.", 'I never saw that ticket.', "I don't know what that is."]) {
        const r = check(raw)
        expect(r.ok, raw).toBe(false)
        if (!r.ok) expect(r.reason).toMatch(/denied|first-person/)
      }
    })

    it('rejects facts: numbers, times and known secrets', () => {
      expect(check('I left at 11:45, all right.').ok).toBe(false)
      expect(check('Fine, Union Station.').ok).toBe(false)
      expect(check('Okay, I killed him.').ok).toBe(false)
    })

    it('rejects a speech: it is a remark, not an answer', () => {
      const r = check('Well now, detective, you have certainly done your homework on me tonight, I will say that much.')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toContain('words')
    })

    it('still applies the usual character and language checks', () => {
      expect(check('As an AI, I give in.').ok).toBe(false)
      expect(check('我认输了').ok).toBe(false)
    })
  })

  it('accepts the confession once the engine has released it', () => {
    const released = forbiddenMarkers(truth, 'doyle', state('doyle', { commitments: ['alibi', 'keys'], brokenClaims: ['alibi', 'keys'], revealedSecrets: ['murder'] }))
    const r = checkReply('I shot him. The markers, the loan shark, all of it. Union Station was where the gun went.', { forbidden: released, allowedText: '' })
    expect(r.ok).toBe(true)
  })
})
