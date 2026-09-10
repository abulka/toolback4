import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')

mkdirSync(join(here, '..', 'public'), { recursive: true })

await build({
  entryPoints: [join(here, '..', '..', '..', 'packages', 'runtime', 'src', 'player-entry.ts')],
  bundle: true,
  format: 'iife',
  minify: true,
  outfile: join(here, '..', 'public', 'toolback-player.js'),
  logLevel: 'silent',
})

console.log('toolback player bundle written to public/toolback-player.js')
