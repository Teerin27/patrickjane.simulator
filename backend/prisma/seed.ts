// Loads every case file in /cases into the database.
// Each file is checked against the case schema AND the case-writing rules first; a case that breaks
// either is refused, so the database never holds a case that cannot be played through.
import { listCaseFiles, loadCaseFile } from '../src/caseFile/load.js'
import { saveCase } from '../src/caseFile/store.js'
import { validateCaseFile } from '../src/caseFile/validate.js'
import { prisma } from '../src/db/prisma.js'

async function main() {
  for (const file of listCaseFiles()) {
    const c = loadCaseFile(file)
    const issues = validateCaseFile(c)
    if (issues.length) {
      throw new Error(`${c.slug} breaks the case-writing rules:\n${issues.map((i) => `  [${i.code}] ${i.message}`).join('\n')}`)
    }
    const saved = await saveCase(c)
    console.log(`Seeded case ${saved.slug} (${saved.id})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
