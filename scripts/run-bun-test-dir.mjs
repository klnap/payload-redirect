import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dashDash = process.argv.indexOf('--')
const argv = dashDash >= 0 ? process.argv.slice(2, dashDash) : process.argv.slice(2)
const bunArgs = dashDash >= 0 ? process.argv.slice(dashDash + 1) : []

const dir = argv[0]
if (!dir) {
  process.stderr.write('usage: run-bun-test-dir.mjs <directory> [-- bun-test-args...]\n')
  process.exit(1)
}

function hasTests(root) {
  try {
    for (const name of readdirSync(root)) {
      const full = join(root, name)
      if (statSync(full).isDirectory()) {
        if (hasTests(full)) return true
        continue
      }
      if (/\.(test|spec)\.(t|j)sx?$/.test(name) || /\.int\.test\.(t|j)sx?$/.test(name)) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}

if (!hasTests(dir)) {
  process.stdout.write(`[test] No tests under ${dir}; skipping.\n`)
  process.exit(0)
}

const result = spawnSync('bun', ['test', dir, ...bunArgs], { stdio: 'inherit' })
process.exit(result.status ?? 1)
