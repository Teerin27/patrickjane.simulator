import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { caseFileSchema, type CaseFile } from './schema.js'

/** Where case files live: <repo>/cases */
export const CASES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../cases')

/** Read one case file and check its shape. Throws with the offending field path if it is malformed. */
export function loadCaseFile(file: string): CaseFile {
  const result = caseFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
  if (!result.success) {
    const where = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
    throw new Error(`${path.basename(file)} is not a valid case file:\n${where}`)
  }
  return result.data
}

export const listCaseFiles = (dir = CASES_DIR) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f))

export const loadSampleCase = () => loadCaseFile(path.join(CASES_DIR, 'case-0417-blue-lantern.json'))
