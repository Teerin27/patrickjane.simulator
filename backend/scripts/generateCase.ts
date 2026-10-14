// Writes brand-new cases with the local casegen model, proves each one is playable, and saves it to /cases.
//
//   pnpm case:generate                              the next case: next number, next setting, fresh names
//   pnpm case:generate -- --count 5 --save-db       five in a row, each also saved to the database
//   pnpm case:generate -- --theme "a riverboat casino, 1948" --culprit marta --seed 7
//
// Cases are numbered in sequence (Case 0002, 0003, ...), take their settings from a rotating list, and are told
// which names are already taken. This is slow on a laptop: a case takes roughly 15-30 minutes. Each stage prints
// as it finishes, and its raw output is kept in backend/.casegen/ so a failed run is never a total loss. In a
// batch, a case that fails is reported and the next one is attempted.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { CASES_DIR, listCaseFiles, loadCaseFile } from '../src/caseFile/load.js'
import { caseIndex, namesInCases, nextCaseNumber, themeFor } from '../src/caseGen/catalog.js'
import { CaseGenError, generateCase, type Progress } from '../src/caseGen/generate.js'
import { env } from '../src/config/env.js'
import { llm } from '../src/llm/index.js'

const { values } = parseArgs({
  // `pnpm case:generate -- --theme x` forwards the lone `--` to the script as well
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    count: { type: 'string', default: '1' },
    theme: { type: 'string' },
    culprit: { type: 'string' },
    seed: { type: 'string' },
    repairs: { type: 'string' },
    out: { type: 'string' },
    'save-db': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})

if (values.help) {
  console.log('Usage: pnpm case:generate -- [--count <n>] [--theme "text"] [--culprit <suspect id>] [--seed <n>] [--repairs <n>] [--out <dir>] [--save-db]')
  process.exit(0)
}
if (env.LLM_PROVIDER !== 'ollama') {
  console.error('Case generation needs a real model: set LLM_PROVIDER=ollama in backend/.env')
  process.exit(1)
}
const count = Number(values.count)
if (!Number.isInteger(count) || count < 1 || count > 50) {
  console.error('--count must be a whole number from 1 to 50')
  process.exit(1)
}

const outDir = values.out ? path.resolve(values.out) : CASES_DIR
const workDir = path.resolve(import.meta.dirname, '../.casegen')
mkdirSync(workDir, { recursive: true })

const t0 = Date.now()
const clock = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`
const onProgress = (p: Progress) => {
  const what = p.stage === 'check' ? 'rules check' : `stage ${p.stage}`
  if (p.status === 'start') console.log(`${clock()} ${what}: ${p.stage === 'check' ? 'checking' : 'writing'} (attempt ${p.attempt})`)
  else if (p.status === 'done') console.log(`${clock()} ${what}: ok${p.ms ? ` in ${Math.round(p.ms / 1000)}s` : ''}`)
  else console.log(`${clock()} ${what}: needs another go${p.detail ? `\n    ${p.detail.split(' | ').join('\n    ')}` : ''}`)
}

/** Everything already written, both in /cases and in the output folder, so numbers and names never collide. */
function existingCases() {
  const dirs = [...new Set([CASES_DIR, outDir])]
  return dirs.flatMap((d) => {
    try {
      return listCaseFiles(d).map((f) => loadCaseFile(f))
    } catch {
      return [] // a folder that does not exist yet has no cases
    }
  })
}

let made = 0
const failed: string[] = []

for (let i = 0; i < count; i++) {
  const existing = existingCases()
  const number = nextCaseNumber(existing.map((c) => c.number))
  const theme = values.theme ?? themeFor(caseIndex(number))
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${number.replace(/\D/g, '')}`
  console.log(`\n=== ${number} (${i + 1} of ${count}) with ${env.OLLAMA_CASEGEN_MODEL}\n    Setting: ${theme}`)

  try {
    const { caseFile, repairs } = await generateCase(llm, {
      theme,
      number,
      avoidNames: namesInCases(existing),
      culpritId: values.culprit,
      seed: values.seed ? Number(values.seed) + i : undefined,
      maxRepairs: values.repairs ? Number(values.repairs) : undefined,
      onProgress,
      onStageOutput: (stage, output) => writeFileSync(path.join(workDir, `${stamp}-${stage}.json`), JSON.stringify(output, null, 2)),
    })

    mkdirSync(outDir, { recursive: true })
    const file = path.join(outDir, `${caseFile.slug}.json`)
    writeFileSync(file, `${JSON.stringify(caseFile, null, 2)}\n`)
    console.log(`\n${clock()} Wrote ${path.relative(process.cwd(), file)} (${repairs} repair round${repairs === 1 ? '' : 's'})`)
    console.log(`    "${caseFile.title}": ${caseFile.suspects.map((s) => s.fullName).join(', ')}. Killer: ${caseFile.culpritId}.`)
    made++

    if (values['save-db']) {
      const { saveCase } = await import('../src/caseFile/store.js')
      const saved = await saveCase(caseFile)
      console.log(`    Saved to the database as ${saved.id}`)
    }
  } catch (err) {
    failed.push(number)
    if (err instanceof CaseGenError) {
      console.error(`\n${clock()} ${number}: gave up: ${err.message}`)
      for (const p of err.problems) console.error(`    - ${p}`)
      if (err.draft) {
        const file = path.join(workDir, `${stamp}-failed-draft.json`)
        writeFileSync(file, JSON.stringify(err.draft, null, 2))
        console.error(`    Last draft kept at ${path.relative(process.cwd(), file)}`)
      }
    } else {
      console.error(`\n${clock()} ${number}: failed`, err)
    }
  }
}

if (values['save-db']) {
  const { prisma } = await import('../src/db/prisma.js')
  await prisma.$disconnect()
} else if (made) {
  console.log('\nLoad the new cases into the database with: pnpm db:seed')
}
console.log(`\nDone: ${made} of ${count} case${count === 1 ? '' : 's'} written${failed.length ? `. Failed: ${failed.join(', ')}` : ''}.`)
process.exit(failed.length === count ? 1 : 0)
