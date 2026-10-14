import type { CaseFile } from './schema.js'
import { perfectPlay } from './validate.js'

// Composure is arithmetic: each exhibit takes off a set number of points, and a secret cracks at or below its
// `maxComposure`. A case writer (a person or a model) picks both sets of numbers by feel and is often a few
// points off ("composure ends at 28, the confession needs 25"). That is a balance slip, not a design fault, so it
// is fixed here by arithmetic instead of costing a model another multi-minute attempt.
//
// Only SMALL slips are fixed, and only up to a ceiling, so a case cannot be "balanced" into a pushover:
// a culprit who cracks at 60 composure would confess after one exhibit. Anything bigger is a real fault
// (too little evidence pressure) and is left for validateCaseFile to report.

/** The highest composure at which a secret may be made to crack by this pass. */
export const MAX_TUNED = { murder: 40, personal: 80 } as const
/** The most points this pass will move a threshold. */
export const MAX_SLIP = 15

/**
 * Raise a secret's `maxComposure` to the composure that perfect play actually reaches, when the two are close.
 * Returns a new case; the input is left alone. A case that needs no tuning is returned as it came.
 * Expects a case whose references are intact (validateCaseFile checks those first); otherwise returns it as it came.
 */
export function balanceCase(c: CaseFile): CaseFile {
  let tuned: CaseFile | undefined

  try {
    for (const [suspectId, truth] of Object.entries(c.truth.suspects)) {
      // How the best possible interrogation of this suspect ends. Cracking a secret never changes composure,
      // so what one secret needs does not depend on what another has been tuned to.
      const { state } = perfectPlay(c, suspectId)
      truth.secrets.forEach((secret, i) => {
        const slip = state.composure - secret.maxComposure
        const alreadyCracks = state.revealedSecrets.includes(secret.id)
        if (alreadyCracks || slip <= 0 || slip > MAX_SLIP || state.composure > MAX_TUNED[secret.kind]) return
        tuned ??= structuredClone(c)
        tuned.truth.suspects[suspectId]!.secrets[i]!.maxComposure = state.composure
      })
    }
  } catch {
    return c
  }
  return tuned ?? c
}
