import type { CaseFile } from '../caseFile/schema.js'

// Helpers for writing a whole series of cases: which number comes next, which setting to use, and which
// names are already taken, so case 7 does not open with the same barman as case 2. Pure.

/** Where the cases take place. The generator uses them in turn, so neighbouring cases feel different. */
export const THEMES = [
  'a riverboat casino on the Mississippi',
  'a grand opera house on opening night',
  'a transcontinental sleeper train snowed in the mountains',
  'a department store after closing on Christmas Eve',
  'a boxing gym and the fight club behind it',
  'a radio station during a live broadcast',
  'a seaside hotel at the end of the season',
  'a newspaper office on deadline night',
  'a jazz club with a speakeasy in the basement',
  'a lighthouse and the fishing village around it',
  'a film studio backlot while a picture is shooting',
  'a private hospital during a hurricane',
  'a ocean liner on its last night at sea',
  'a racetrack and its stables on derby day',
  'a university observatory and the faculty club',
  'a Chinatown restaurant that fronts for a gambling ring',
  'a country mansion during the reading of a will',
  'a travelling circus wintering in a small town',
  'a museum the night before a new exhibit opens',
  'a mining town saloon the week the payroll arrives',
  'a hotel switchboard office and the rooms above it',
  'a cannery on the waterfront during a strike',
  'a fashion house the night of its big show',
  'a small-town bank and the diner across the street',
] as const

const CASE_NUMBER = /^Case (\d+)$/i

/** "Case 0001", "Case 0002", ... The next number after the highest one already used. */
export function nextCaseNumber(existing: string[]): string {
  const used = existing.map((n) => Number(CASE_NUMBER.exec(n)?.[1])).filter((n) => Number.isFinite(n))
  return `Case ${String(Math.max(0, ...used) + 1).padStart(4, '0')}`
}

/** The number as an integer, e.g. "Case 0007" -> 7. */
export const caseIndex = (number: string) => Number(CASE_NUMBER.exec(number)?.[1] ?? 0)

/** The setting for case number `n`: consecutive cases get consecutive, different settings. */
export const themeFor = (n: number) => THEMES[(Math.max(1, n) - 1) % THEMES.length]!

/** Every name already used by a suspect in these cases (full name, surname, id), without repeats. */
export function namesInCases(cases: Pick<CaseFile, 'suspects'>[]): string[] {
  const names = cases.flatMap((c) => c.suspects.flatMap((s) => [s.fullName, s.surname, s.id]))
  return [...new Set(names)]
}
