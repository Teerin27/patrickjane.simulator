import type { Preset } from '../types'

// Shortcut buttons under the chat box. Each one just types its question for the player and sends it to
// POST /interrogate like any other message (it costs a question). The suspects' answers come from the
// engine and the model, never from here.
//
// They are written to fit any murder case, not the sample one: no names, and the words that make a
// suspect commit to a statement (alibi, office, trouble, keys) are the ones case files list as triggers.
export const quickQuestions: Preset[] = [
  { label: 'ALIBI', q: 'Where were you at midnight?' },
  { label: 'OFFICE', q: 'Did you go into the office tonight?' },
  { label: 'TROUBLE', q: 'Was there any trouble between you and the victim?' },
  { label: 'KEYS', q: 'Who has keys to the office?' },
]
