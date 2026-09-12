import { build } from 'esbuild'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const editorDir = join(here, '..')
const repoRoot = join(editorDir, '..', '..')
const libsDir = join(repoRoot, 'packages', 'libs')
const outDir = join(editorDir, 'public', 'libs')

/**
 * The library shelf: every dependency declared in packages/libs is
 * pre-bundled to a browser-ready ESM file under apps/editor/public/libs/
 * and registered in libs/importmap.json, so user scripts can
 * `await import('name')` in previews and exports alike.
 */
export async function buildLibs({
  libsPackageDir = libsDir,
  outDir: out = outDir,
} = {}) {
  const pkgPath = join(libsPackageDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const names = Object.keys(pkg.dependencies ?? {}).filter(
    (n) => !n.startsWith('@toolback/'),
  )
  const imports = {}
  const manifest = []
  if (names.length === 0) {
    console.log('library shelf is empty (add deps to packages/libs/package.json)')
  }

  // generated entry files must live inside packages/libs so bare imports
  // resolve against its node_modules
  const tmp = join(libsPackageDir, '.toolback-libs')
  mkdirSync(tmp, { recursive: true })
  mkdirSync(out, { recursive: true })

  for (const name of names) {
    const entry = join(tmp, `entry-${name.replaceAll('/', '__')}.mjs`)
    writeFileSync(entry, `import * as m from ${JSON.stringify(name)}\nexport default m\nexport * from ${JSON.stringify(name)}\n`)
    try {
      const result = await build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        minify: true,
        platform: 'browser',
        metafile: true,
        logLevel: 'silent',
        outfile: join(out, `${name}.js`),
      })
      const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0)
      imports[name] = `/libs/${name}.js`
      manifest.push({ name, url: `/libs/${name}.js`, bytes, builtAt: new Date().toISOString() })
      console.log(`bundled ${name} (${(bytes / 1024).toFixed(0)} KB)`)
    } catch (err) {
      console.error(`\n✗ could not bundle ${name} — is it browser-compatible?\n`)
      console.error(err.message ?? err)
    }
  }
  rmSync(tmp, { recursive: true, force: true })

  writeFileSync(join(out, 'importmap.json'), JSON.stringify({ imports }, null, 2))
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return { names, imports, manifest }
}

const isMain = process.argv[1] && process.argv[1].endsWith('build-libs.mjs')
if (isMain) {
  await buildLibs()
  console.log('library shelf written to apps/editor/public/libs/')
}