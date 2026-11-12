#!/usr/bin/env node
// Cuts every plate in atlas/plates/ out of its paper (tools/cut-plate.py) and writes the three images
// the atlas shows of it: botanical-terpenes/plates/<id>.webp, the whole plate; plates/small/<id>.webp,
// its main figure alone for the compound's tile; and plates/icon/<id>.webp, the same figure 96 px high,
// to stand beside the compound's name in a table.
// Needs python3 with numpy, scipy and Pillow, and cwebp.
// usage: node tools/plates.mjs [id …]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { terpenes } from '../atlas/data.mjs'

const root = new URL('..', import.meta.url).pathname, only = process.argv.slice(2)
mkdirSync(join(root, 'botanical-terpenes/plates/icon'), { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), 'plates-')), whole = join(tmp, 'whole.png'), figure = join(tmp, 'figure.png')
const run = (cmd, ...args) => execFileSync(cmd, args.map(String), { cwd: root, stdio: 'inherit' })

for (const t of terpenes.filter(t => !only.length || only.includes(t.id))) {
  run('python3', 'tools/cut-plate.py', `atlas/plates/${t.id}.webp`, whole, figure, t.plate.parts || 1)
  run('cwebp', '-quiet', '-q', 84, '-alpha_q', 92, whole, '-o', `botanical-terpenes/plates/${t.id}.webp`)
  run('cwebp', '-quiet', '-q', 74, '-alpha_q', 90, '-resize', 0, 380, figure, '-o', `botanical-terpenes/plates/small/${t.id}.webp`)
  run('cwebp', '-quiet', '-q', 80, '-alpha_q', 90, '-resize', 0, 96, figure, '-o', `botanical-terpenes/plates/icon/${t.id}.webp`)
}
rmSync(tmp, { recursive: true })
