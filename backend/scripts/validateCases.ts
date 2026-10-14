// Checks case files against the schema and the case-writing rules, without touching the database.
//
//   pnpm case:validate                 every file in /cases
//   pnpm case:validate path/to/a.json  just those files
import path from 'node:path'
import { listCaseFiles, loadCaseFile } from '../src/caseFile/load.js'
import { validateCaseFile } from '../src/caseFile/validate.js'

const given = process.argv.slice(2).filter((a) => a !== '--')
const files = given.length ? given.map((f) => path.resolve(f)) : listCaseFiles()
let failed = 0

for (const file of files) {
  const name = path.basename(file)
  try {
    const issues = validateCaseFile(loadCaseFile(file))
    if (!issues.length) {
      console.log(`ok    ${name}`)
      continue
    }
    failed++
    console.log(`FAIL  ${name}`)
    for (const i of issues) console.log(`        [${i.code}] ${i.message}`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${name}\n        ${err instanceof Error ? err.message.replaceAll('\n', '\n        ') : err}`)
  }
}

console.log(`\n${files.length - failed}/${files.length} case file(s) pass`)
process.exit(failed ? 1 : 0)
