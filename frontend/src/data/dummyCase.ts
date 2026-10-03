// (DUMMY) Hardcoded sample case data.
// In the future all of this will be fetched from the backend API.
// Ground truth (CULPRIT, reactions, verdict text) must then stay server-only:
// the client should only receive what the engine decides a suspect reveals.

import type { Evidence, Preset, Reaction, Suspect, Who } from '../types'

export const MAX_Q = 10

// (DUMMY) will come from the server's /accuse response, never sent to the client up front
export const CULPRIT: Who = 'doyle'

// (DUMMY) GET /cases/:id -> suspects
export const suspects: Suspect[] = [
  { id: 'lorraine', short: 'L. VOSS', surname: 'Voss', role: 'Singer', alibi: 'Alone in her dressing room after the 11:40 set.' },
  { id: 'pike', short: 'DR. PIKE', surname: 'Pike', role: 'Doctor', alibi: 'Cards upstairs with the club accountant.' },
  { id: 'doyle', short: 'M. DOYLE', surname: 'Doyle', role: 'Barman', alibi: 'Behind the bar all night. Never left it.' },
]

// (DUMMY) GET /sessions/:id -> discovered evidence
export const evidence: Evidence[] = [
  { id: 'key', tag: 'EXH.A', name: 'Brass key', sprite: 'key', note: 'Found under the desk. Stamped "BL-2", the office door.' },
  { id: 'letter', tag: 'EXH.B', name: 'Burned letter', sprite: 'letter', note: 'Charred scrap: "...pay by Friday or I tell Pike."' },
  { id: 'ticket', tag: 'EXH.C', name: 'Rail ticket', sprite: 'ticket', note: 'Union Station stub, stamped 11:52 PM, the night of the murder.' },
  { id: 'glass', tag: 'EXH.D', name: 'Lipstick glass', sprite: 'glass', note: 'Rye glass on the desk. Dark red on the rim.' },
]

// (DUMMY) first line of dialogue per suspect
export const openers: Record<Who, string> = {
  lorraine: 'Make it quick, detective. I have a second set to think about.',
  pike: 'I told the officers everything. A doctor does not forget a card game.',
  doyle: 'I pour drinks. I see everybody and I say nothing. That is the job.',
}

// (DUMMY) preset questions; answers will come from POST /interrogate
export const presets: Record<Who, Preset[]> = {
  lorraine: [
    { label: 'ALIBI', q: 'Where were you at midnight?', a: 'Dressing room. Door shut, shoes off. Ask the stagehand, if he is sober.' },
    { label: 'VICTOR', q: 'How well did you know Victor?', a: 'He signed my checks and never let me forget it.' },
    { label: 'ENEMIES', q: 'Who wanted him dead?', a: 'In this town? Darling, he had subscribers.' },
    { label: 'THE OFFICE', q: 'Were you in his office tonight?', a: 'No. Why would I climb those stairs for that man?' },
  ],
  pike: [
    { label: 'ALIBI', q: 'Who can vouch for you?', a: 'Harold Finch, the accountant. A dull man, but reliable.' },
    { label: 'VICTOR', q: 'What was Victor to you?', a: 'A patient, a landlord and lately a nuisance. Nothing more.' },
    { label: 'TROUBLE', q: 'Any trouble between you two?', a: 'A disagreement over rent. Gentlemen settle such things quietly.' },
    { label: 'MONEY', q: 'Did you owe him money?', a: 'Everyone owes someone, detective.' },
  ],
  doyle: [
    { label: 'ALIBI', q: 'Did you leave the bar?', a: 'Not once. Ask any regular. I do not even take smoke breaks.' },
    { label: 'THE OFFICE', q: 'Who went into the office?', a: 'Nobody I saw. And I see plenty.' },
    { label: 'VICTOR', q: 'Was Victor in a mood?', a: 'He was counting money and humming. Happy. That is what scared me.' },
    { label: 'KEYS', q: 'Who holds office keys?', a: 'Victor. Nobody else. He was funny about it.' },
  ],
}

// (DUMMY) evidence reactions; the engine + LLM will produce these via POST /interrogate
export const reactions: Record<Who, Record<string, Reaction>> = {
  lorraine: {
    glass: { text: 'That is my shade. Fine. I had a drink with him at ten. I left him alive and sulking.', kind: 'contradiction', mood: 'nervous', note: 'Voss lied: she was in the office.' },
    ticket: { text: 'I have never ridden a train. Somebody is planting trash on me.', kind: 'deflect', mood: 'angry' },
    letter: { text: 'It names Pike. Why show it to me?', kind: 'deflect', mood: 'nervous' },
    key: { text: 'Every stagehand has one of those. Ask someone with more to hide.', kind: 'deflect', mood: 'calm' },
  },
  pike: {
    letter: { text: 'Where did you find that? Victor was bleeding me dry. I did not kill him. I wanted to, God help me.', kind: 'truth', mood: 'broken', note: 'Pike was being blackmailed by Hale.' },
    ticket: { text: 'A train? Coincidence. I was upstairs. Finch will swear to it.', kind: 'deflect', mood: 'nervous' },
    key: { text: 'I never held that key. My business with Victor was done in the open.', kind: 'deflect', mood: 'calm' },
    glass: { text: 'Lipstick? Do I look like I wear lipstick, detective?', kind: 'deflect', mood: 'angry' },
  },
  doyle: {
    ticket: { text: 'Fine. I stepped out for the late train. I was back before anyone noticed, I swear.', kind: 'contradiction', mood: 'broken', note: 'Doyle left the bar at 11:52. Alibi broken.' },
    key: { text: 'The spare set hangs behind my bar. Anybody could have grabbed it. Not me.', kind: 'contradiction', mood: 'nervous', note: "Spare office keys hang behind Doyle's bar." },
    letter: { text: 'Never seen it. Victor kept his dirt to himself.', kind: 'deflect', mood: 'calm' },
    glass: { text: "A customer's glass. We lose three a night upstairs.", kind: 'deflect', mood: 'calm' },
  },
}

// (DUMMY) line spoken when a suspect lawyers up
export const closers: Record<Who, string> = {
  lorraine: 'That is enough. Talk to my lawyer.',
  pike: 'I have nothing more to say to you.',
  doyle: 'Bar is closed, detective. Get out.',
}

// (DUMMY) fallback replies until the LLM is wired up
export const freeTextReply = 'I have said my piece. Ask something with a little more teeth.'
export const repeatEvidenceReply = 'You showed me that already. My answer has not changed.'

// (DUMMY) verdict text; will come from POST /accuse
export const verdictText = {
  correct: 'Doyle slipped out on the 11:52 and used the spare key from behind his bar. The cuffs go on.',
  wrong: 'Your suspect walks. The real killer pours the next round. Check the ticket stub and the spare keys.',
}

// (DUMMY) case header info
export const caseInfo = { title: 'patricjane.sim', number: 'Case 0417' }
