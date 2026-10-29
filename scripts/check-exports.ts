import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const snapshotPath = join(root, 'scripts/exports-snapshot.json')
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, string[]>

const toSpecifier = (subpath: string): string =>
  subpath === '.' ? '@klnap/payload-redirect' : `@klnap/payload-redirect${subpath.slice(1)}`

let failed = false

for (const [subpath, expected] of Object.entries(snapshot)) {
  const specifier = toSpecifier(subpath)
  let mod: Record<string, unknown>
  try {
    mod = await import(specifier)
  } catch (error) {
    process.stderr.write(`[check:exports] Failed to import ${specifier}: ${String(error)}\n`)
    failed = true
    continue
  }

  const actual = Object.keys(mod).sort()
  const expectedSorted = [...expected].sort()
  const missing = expectedSorted.filter((name) => !actual.includes(name))
  const extra = actual.filter((name) => !expectedSorted.includes(name))

  if (missing.length || extra.length) {
    failed = true
    process.stderr.write(`[check:exports] Mismatch for ${subpath} (${specifier})\n`)
    if (missing.length) process.stderr.write(`  missing: ${missing.join(', ')}\n`)
    if (extra.length) process.stderr.write(`  extra: ${extra.join(', ')}\n`)
  }
}

if (failed) {
  process.exit(1)
}

process.stdout.write('[check:exports] All public subpaths match exports snapshot.\n')
