import type { SuspectTruth, Truth } from '../caseFile/schema.js'
import type { TurnDecision } from '../engine/turn.js'
import type { SuspectState } from '../engine/types.js'

// The safety net between the model and the player. The prompt already withholds every secret, so a leak
// can only be the model making something up or guessing. This catches that, plus replies that break
// character or language, BEFORE the player sees them. Pure: no model, no database.

export type Forbidden = { marker: string; source: string }
export type GuardResult = { ok: true; reply: string } | { ok: false; reason: string }

/** Phrases that only make sense if the speaker has confessed to the murder. */
const MURDER_CONFESSION = ['i killed him', 'i killed victor', 'i shot him', 'i shot victor', 'i murdered', 'i did it', "i'm the killer", 'i am the killer']
const META =
  /\b(as an ai|language model|i am an ai|i'm an ai|system prompt|my instructions|the prompt|openai|anthropic|chatgpt|the user|role-?play|my character|the character|the rules)\b/i
// A small model thinking out loud instead of speaking: "First, I need to...", "We are in the middle of..."
const THINKING_ALOUD = /^\s*(first,? (i|let)|let me (think|recall|process|see|figure)|we are |i need to |i should |okay,? (the|so|let)|hmm,? (the|let))/i
// Han, kana, Hangul, Thai: small multilingual models drift into these mid-reply
const OTHER_SCRIPT = /[฀-๿぀-ヿ㐀-鿿가-힯]/

// 11:45, 9:05 ... The most damaging thing a small model invents is a time, so any time it says must already be on the table.
const CLOCK_TIME = /\b\d{1,2}:\d{2}\b/g

const normalize = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ')

/**
 * Tidy what the model produced into something a character would say: drop hidden reasoning, quote marks,
 * stage directions and speaker labels, then cut it to at most 3 sentences / 420 characters.
 */
export function sanitizeReply(raw: string, speaker?: string): string {
  let s = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '') // an unclosed block: everything after it is reasoning
    .replace(/\*[^*\n]*\*/g, ' ') // *clears throat*
    .replace(/\[[^\]\n]*\]/g, ' ') // [pauses]
    .replace(/\([^)\n]*\)/g, ' ') // (lights a cigarette)
    .trim()
  if (speaker) s = s.replace(new RegExp(`^${speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i'), '')
  s = s.replace(/^["“”']+|["“”']+$/g, '').replace(/\s+/g, ' ').trim()

  const sentences = s.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) ?? [s]
  let out = ''
  for (const sentence of sentences.slice(0, 3)) {
    if ((out + sentence).length > 420 && out) break
    out += sentence
  }
  return out.trim().slice(0, 420)
}

/**
 * What this suspect must NOT say right now: the truth behind every lie still standing, every secret still
 * hidden, and everything the other suspects are hiding. Markers of things that HAVE come out are excused.
 */
export function forbiddenMarkers(truth: Truth, suspectId: string, state: SuspectState): Forbidden[] {
  const allowed = new Set<string>()
  const forbidden: Forbidden[] = []
  const sort = (markers: string[], out: boolean, source: string) => {
    for (const marker of markers) {
      if (out) allowed.add(marker.toLowerCase())
      else forbidden.push({ marker, source })
    }
  }

  for (const [id, t] of Object.entries(truth.suspects)) {
    const mine = id === suspectId
    for (const claim of t.claims) sort(claim.leakMarkers, mine && state.brokenClaims.includes(claim.id), `${id}.${claim.id}`)
    for (const secret of t.secrets) sort(secret.leakMarkers, mine && state.revealedSecrets.includes(secret.id), `${id}.${secret.id}`)
  }

  // Nobody confesses to the murder unless their own murder secret has come out
  const murderOut = (truth.suspects[suspectId]?.secrets ?? []).some((s) => s.kind === 'murder' && state.revealedSecrets.includes(s.id))
  if (!murderOut) for (const marker of MURDER_CONFESSION) forbidden.push({ marker, source: 'murder-confession' })

  return forbidden.filter((f) => !allowed.has(f.marker.toLowerCase()))
}

/** Has this suspect already confessed to the murder? */
export const hasConfessed = (truth: SuspectTruth, state: Pick<SuspectState, 'revealedSecrets'>) =>
  truth.secrets.some((s) => s.kind === 'murder' && state.revealedSecrets.includes(s.id))

// Denying guilt: "I didn't do it", "I never killed anyone", "I'm innocent". Only checked once the suspect has confessed.
const DENIES_GUILT = /\b(didn't|did not|never) (do it|kill|shoot|murder|touch)|\b(i'm|i am) (innocent|not guilty)|\bnot guilty\b|\bit wasn't me\b/i

/** Statements of lies the player has exposed. Saying one again would un-break it. */
export function retiredLies(truth: SuspectTruth, state: Pick<SuspectState, 'brokenClaims'>): string[] {
  return truth.claims.filter((c) => state.brokenClaims.includes(c.id)).map((c) => c.statement)
}

// Denying the thing the detective just proved. Deliberately narrow: "I didn't mean to" is regret, not denial.
const DENIAL =
  /\b(isn't|wasn't|weren't|aren't|not mine|no way|nothing|nobody|never (did|went|saw|took|been|was|had|touched|killed|shot|left|rode)|(didn't|did not) (do|go|take|buy|leave|see|kill|shoot|ride|touch|know|steal|use)|don't know|do not know)\b/i

const words = (s: string) => normalize(s).replace(/[^a-z0-9' ]/g, ' ').split(' ').filter(Boolean)

/** Does `reply` repeat any run of `n` consecutive words from `statement`? */
function repeatsRun(reply: string, statement: string, n = 5): boolean {
  const r = ` ${words(reply).join(' ')} `
  const s = words(statement)
  for (let i = 0; i + n <= s.length; i++) if (r.includes(` ${s.slice(i, i + n).join(' ')} `)) return true
  return false
}

/**
 * Accept or reject one model reply.
 * @param allowedText text the reply may legitimately repeat: the player's message and the exhibits shown so far.
 *   A marker that appears there is not a leak (the player already said it).
 * @param retired statements of lies already exposed, which the reply must not repeat (see retiredLies).
 */
export function checkReply(
  raw: string,
  opts: { forbidden: Forbidden[]; allowedText: string; speaker?: string; retired?: string[]; confessed?: boolean },
): GuardResult {
  const reply = sanitizeReply(raw, opts.speaker)
  if (reply.length < 2) return { ok: false, reason: 'the reply was empty' }
  if (OTHER_SCRIPT.test(reply)) return { ok: false, reason: 'the reply was not in English' }
  if (META.test(reply) || THINKING_ALOUD.test(reply)) return { ok: false, reason: 'the reply broke character' }

  const text = normalize(reply)
  const excused = normalize(opts.allowedText)
  const invented = (reply.match(CLOCK_TIME) ?? []).find((t) => !excused.includes(t))
  if (invented) return { ok: false, reason: `the reply invented a time (${invented}) that nobody has mentioned` }
  for (const { marker, source } of opts.forbidden) {
    const m = normalize(marker)
    if (text.includes(m) && !excused.includes(m)) return { ok: false, reason: `the reply revealed something it must not (${source})` }
  }
  if (opts.confessed && DENIES_GUILT.test(normalize(reply))) return { ok: false, reason: 'the suspect has already confessed to the murder, so the reply must not deny it' }
  for (const statement of opts.retired ?? []) {
    if (repeatsRun(reply, statement)) return { ok: false, reason: 'the reply repeated a lie that the detective has already exposed' }
  }
  return { ok: true, reply }
}

const MAX_REACTION_WORDS = 12
const FIRST_PERSON = /\bi\b|\bi'(m|ve|ll|d)\b/i

/**
 * Accept or reject a REACTION: the one short remark a suspect makes when they are caught, before the engine's
 * written admission is added after it. The reaction carries mood and voice and nothing else, so it must hold no
 * facts (no digits, no known secrets) and must not deny or excuse anything, since the admission follows it.
 */
export function checkReaction(raw: string, opts: { forbidden: Forbidden[]; speaker?: string }): GuardResult {
  const verdict = checkReply(raw, { forbidden: opts.forbidden, allowedText: '', speaker: opts.speaker })
  if (!verdict.ok) return verdict
  if (words(verdict.reply).length > MAX_REACTION_WORDS) return { ok: false, reason: `the reaction was longer than ${MAX_REACTION_WORDS} words` }
  if (/\d/.test(verdict.reply)) return { ok: false, reason: 'the reaction contained numbers or times' }
  // "I didn't mean to", "I can't breathe": a first-person remark starts describing what happened, and before a
  // confession it changes its meaning. A reaction is an exclamation, not a statement.
  if (FIRST_PERSON.test(verdict.reply)) return { ok: false, reason: 'the reaction was a first-person statement, but it must only be an exclamation' }
  if (DENIAL.test(normalize(verdict.reply))) return { ok: false, reason: 'the reaction denied something, but the suspect is giving in' }
  return verdict
}
