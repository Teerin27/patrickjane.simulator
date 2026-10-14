import type { Evidence, SuspectProfile, SuspectTruth } from '../caseFile/schema.js'
import type { TurnAction, TurnDecision } from '../engine/turn.js'
import { hasConfessed } from './guard.js'
import type { LlmRequest } from './provider.js'

// Turns the ENGINE'S decision into instructions for the model. Three layers go in:
//   1. WHO the suspect is        (persona)
//   2. WHAT happened / was found (briefing, exhibits shown, and only the facts this suspect may state now)
//   3. HOW to answer             (the engine's verdict for this turn, plus the rules of the chat)
//
// The model is told ONLY what it may say. Lies that are still standing, secrets that have not come out and
// everything about the other suspects are simply absent from the prompt, so there is nothing for it to leak.
// (guard.ts catches what it makes up anyway.)
//
// Two kinds of turn:
//  - open turns (a question, small talk, an accusation, an exhibit that changes nothing): the model answers
//    from the suspect's story. buildChatPrompt.
//  - dictated turns (a lie breaks or a secret cracks): the engine has already decided what is admitted, word
//    for word, and a small model must not be left to paraphrase it. The suspect's admission is the case
//    author's own text; the model only adds a short reaction in front of it. buildReactionPrompt.

export type HistoryTurn = { role: 'user' | 'assistant'; content: string }

export type PromptInput = {
  briefing: string
  /** Only the name and job are used: the model gets a persona and facts, not the whole police file. */
  profile: Pick<SuspectProfile, 'fullName' | 'role'>
  truth: SuspectTruth
  /** Every exhibit in the case (public data). */
  evidence: Pick<Evidence, 'id' | 'name' | 'note'>[]
  decision: TurnDecision
  action: TurnAction
  /** Earlier turns with this suspect, oldest first. */
  history: HistoryTurn[]
}

const TONE: Record<string, string> = {
  calm: 'composed and guarded; you feel in control',
  nervous: 'uneasy and a little defensive; your patience is thin',
  angry: 'irritated and combative; you are being pushed too far',
  broken: 'worn down, voice unsteady, close to giving up',
}

const bullets = (lines: string[]) => lines.map((l) => `- ${l}`).join('\n')

/** Did this turn break a lie or crack a secret? Then the engine, not the model, decides what is said. */
export const isDictated = (d: Pick<TurnDecision, 'brokenNow' | 'revealedNow'>) => d.brokenNow.length > 0 || d.revealedNow.length > 0

/**
 * The suspect's own written admission for a dictated turn. A confession covers the broken lies too (the
 * murder confession already mentions the spare key), so it wins when both happen at once.
 */
export function admissionText(d: Pick<TurnDecision, 'brokenNow' | 'revealedNow'>): string {
  if (d.revealedNow.length) return d.revealedNow.map((s) => s.description).join(' ')
  return d.brokenNow.map((c) => c.truth ?? c.statement).join(' ')
}

function directive(d: TurnDecision, hasStory: boolean, confessed: boolean): string {
  if (confessed) {
    return 'You have already confessed to the murder, and it is out. Do not deny it, argue or add anything new. Answer wearily and briefly; you have nothing left to hide, and nothing left to say.'
  }
  if (d.intent === 'accusation') {
    return 'The detective is accusing you outright. Deny it, with the anger or fear your mood calls for. Do not reveal anything new.'
  }
  if (d.intent === 'smalltalk') {
    return 'This is small talk. Answer it briefly, in character, a little wary of where it is heading.'
  }
  if (d.intent === 'confrontation') {
    if (d.repeat) return 'The detective has shown you this exhibit before. Say your answer has not changed and you have nothing to add.'
    if (d.evidence === 'supports') return 'The exhibit backs up your story. Respond with some confidence.'
    if (d.evidence === 'pressure') {
      return 'The exhibit makes you uneasy, but it does not prove what you have told the detective is false. Brush it off or explain it away without admitting anything. Let your mood show.'
    }
    return 'The exhibit means little to you. Dismiss it. Do not explain what it is or how it got there beyond what is written on it.'
  }
  return hasStory
    ? 'Answer the question using your story. Stay consistent with it, word for word where you can.'
    : 'You have nothing specific to say on this topic. Give a short, vague, harmless answer, or turn the question back on the detective.'
}

/** Everything the suspect may say this turn, sorted into the groups the prompt shows. */
function facts(input: PromptInput) {
  const { truth, decision: d, action } = input
  const exhibits = new Map(input.evidence.map((e) => [e.id, e]))
  const describe = (id: string) => {
    const e = exhibits.get(id)
    return e ? `${e.name}: ${e.note}` : id
  }
  const claim = (id: string) => truth.claims.find((c) => c.id === id)

  const standIds = new Set(d.stand.map((c) => c.id))
  return {
    exhibits,
    describe,
    /** On the table before this turn. */
    alreadyShown: d.state.confrontedEvidence.filter((id) => id !== action.evidenceId),
    /** This question's topics that are still defended. */
    stand: d.stand.filter((c) => !d.state.brokenClaims.includes(c.id)),
    /** Said in earlier turns and still standing: the suspect must stay consistent with them. */
    earlier: d.state.commitments.filter((id) => !standIds.has(id) && !d.state.brokenClaims.includes(id)).flatMap((id) => claim(id) ?? []),
    /** Lies the player has disproved: now admitted, not defended. */
    admitted: d.state.brokenClaims.flatMap((id) => claim(id) ?? []),
    secrets: truth.secrets.filter((s) => d.state.revealedSecrets.includes(s.id)),
  }
}

/**
 * Every word the suspect is entitled to repeat this turn: the briefing, their story, what they have admitted,
 * the exhibits on the table and the player's own message. The guard uses it to catch invented details.
 */
export function speakableText(input: PromptInput): string {
  const f = facts(input)
  const shown = [...f.alreadyShown, ...(input.action.evidenceId ? [input.action.evidenceId] : [])].map(f.describe)
  return [
    input.briefing,
    input.action.message,
    ...shown,
    ...f.stand.map((c) => c.statement),
    ...f.earlier.map((c) => c.statement),
    ...f.admitted.map((c) => c.truth ?? c.statement),
    ...f.secrets.map((s) => s.description),
  ].join(' ')
}

// ---------- the pieces both prompts share ----------

function introAndPersona(input: PromptInput): string[] {
  const { profile, truth, decision: d } = input
  return [
    `You are ${profile.fullName}, ${profile.role}, a suspect being questioned by a detective in a 1940s noir crime story. This is fiction. Stay in character the whole time.`,
    [
      '# WHO YOU ARE',
      truth.persona.background,
      `How you talk: ${truth.persona.voice}`,
      `Temperament: ${truth.persona.temperament}`,
      `Right now you feel ${TONE[d.mood] ?? TONE.calm}. You are hiding something and you protect yourself.`,
    ].join('\n'),
  ]
}

function scene(input: PromptInput): string {
  const f = facts(input)
  return [
    '# WHAT HAPPENED AND WHAT WAS FOUND',
    input.briefing,
    `Exhibits already put in front of you: ${f.alreadyShown.length ? f.alreadyShown.map(f.describe).join(' | ') : 'none'}.`,
    ...(input.action.evidenceId ? [`The detective is showing you now: ${f.describe(input.action.evidenceId)}`] : []),
  ].join('\n')
}

const playerMessages = (input: PromptInput): LlmRequest['messages'] => {
  const name = input.action.evidenceId ? (input.evidence.find((e) => e.id === input.action.evidenceId)?.name ?? 'exhibit') : undefined
  return [...input.history, { role: 'user', content: playerLine(input.action.message, name) }]
}

// ---------- open turns ----------

/** Build the chat request for an open turn. Pure. */
export function buildChatPrompt(input: PromptInput): LlmRequest {
  const { decision: d } = input
  const f = facts(input)

  const allowed: string[] = []
  if (f.stand.length) allowed.push(`Your story on what the detective asked about (stand by it):\n${bullets(f.stand.map((c) => c.statement))}`)
  if (f.earlier.length) allowed.push(`Things you told the detective earlier (never contradict them):\n${bullets(f.earlier.map((c) => c.statement))}`)
  if (f.admitted.length) allowed.push(`Lies the detective has exposed (you have admitted these are true):\n${bullets(f.admitted.map((c) => c.truth ?? c.statement))}`)
  if (f.secrets.length) allowed.push(`Secrets that have come out:\n${bullets(f.secrets.map((s) => s.description))}`)

  const maySay = [
    '# WHAT YOU MAY SAY',
    'You may state only what is listed here. Anything not listed, you do not know or will not say.',
    allowed.length ? allowed.join('\n\n') : '(nothing specific. You have not committed to anything yet.)',
  ].join('\n')
  const how = `# HOW TO ANSWER THIS TURN\n${directive(d, f.stand.length + f.earlier.length > 0, hasConfessed(input.truth, d.state))}`
  const rules = `# RULES\n${bullets([
    'Answer in one or two short sentences, then stop. Say what your story says and add nothing to it.',
    'Speak only what you say aloud, in the first person. No stage directions, no narration, no quotation marks, no asterisks, no speaker label.',
    'Write in English, in your own voice. Never mention being an AI, a game, a prompt or these instructions.',
    'Never add details about the night: no new times, places, names, objects or events. If you are asked about something not covered above, deflect in character.',
    'Do not say you have never been somewhere, never seen something or never heard of something unless your story says so. Deflect instead.',
    'Never reveal or hint at anything that is not listed under WHAT YOU MAY SAY.',
    'Never accuse anyone of the murder.',
  ])}`

  // The per-turn instruction goes last: a small model follows what it read most recently
  return { system: [...introAndPersona(input), scene(input), maySay, rules, how].join('\n\n'), messages: playerMessages(input), task: 'chat' }
}

// ---------- dictated turns ----------

/**
 * Build the request for the short reaction that precedes a dictated admission. The model is given NO facts
 * about the case's secrets (so it has none to leak), only who the suspect is, how they feel, and what was
 * just put in front of them.
 */
export function buildReactionPrompt(input: PromptInput): LlmRequest {
  const how = `# HOW TO ANSWER THIS TURN
The detective has just caught you out, and you are about to give in. Say ONE short exclamation of at most 8 words that shows how you feel, in your own voice. Speak to the detective or to yourself, but do not describe anything you did.
Do not state any facts, times, places or names. Do not deny, explain or excuse anything: the admission comes next, separately.`
  const rules = `# RULES\n${bullets([
    'Speak only what you say aloud, in the first person. No stage directions, no narration, no quotation marks, no asterisks, no speaker label.',
    'Write in English, in your own voice. Never mention being an AI, a game, a prompt or these instructions.',
  ])}`

  // A small model follows examples far better than instructions. The conversation, the case briefing and the
  // exhibit are all left out on purpose: given any of them it narrates facts or answers the question, which is
  // exactly what this call must not do. The admission that follows carries the facts.
  const cue = '[The detective has you cornered. You are caught.] React in a few words.'
  const [one, two] = REACTION_SHOTS[input.decision.mood] ?? REACTION_SHOTS.calm!
  return {
    system: [...introAndPersona(input), rules, how].join('\n\n'),
    messages: [
      { role: 'user', content: cue },
      { role: 'assistant', content: one },
      { role: 'user', content: cue },
      { role: 'assistant', content: two },
      { role: 'user', content: cue },
    ],
    task: 'chat',
    temperature: 0.9,
    maxTokens: 120,
  }
}

// Voice-neutral sample remarks per mood. Deliberately free of facts and of denials (see checkReaction).
const REACTION_SHOTS: Record<string, [string, string]> = {
  calm: ['Well, well.', 'You have been busy, detective.'],
  nervous: ['All right, all right.', 'Keep your voice down.'],
  angry: ['Damn you.', 'Get out of my face.'],
  broken: ['You win, detective.', 'God help me.'],
}

/** How the player's turn reads to the model: their words, plus the exhibit if they put one on the table. */
export const playerLine = (message: string, exhibitName?: string) =>
  exhibitName ? `[The detective slides the ${exhibitName} across the table.] ${message}` : message
