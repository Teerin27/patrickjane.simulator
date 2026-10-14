import type { PlayerStats } from '../types'

// (DUMMY) Rank and solved-case count are not stored by the backend yet, so every player shows the
// same values. Screens that display them mark them as placeholders.
// TODO(later): replace with real numbers once sessions are linked to players and the API reports them.
export const placeholderStats: PlayerStats = {
  rank: 'ROOKIE',
  casesSolved: 0,
}
