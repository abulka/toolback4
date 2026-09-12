import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildLibs } from './build-libs.mjs'

const root = mkdtempSync(join(tmpdir(), 'toolback-libs-'))

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

function makeShelf(): string {
  const libsDir = join(root, 'shelf')
  mkdirSync(join(libsDir, 'node_modules', 'hello-lib'), { recursive: true })
  writeFileSync(
    join(libsDir, 'node_modules', 'hello-lib', 'package.json'),
    JSON.stringify({ name: 'hello-lib', version: '1.0.0', type: 'module', main: 'index.js' }),
  )
  writeFileSync(
    join(libsDir, 'node_modules', 'hello-lib', 'index.js'),
    'export const answer = 42\nexport default { answer }\n',
  )
  writeFileSync(
    join(libsDir, 'package.json'),
    JSON.stringify({ name: '@toolback/libs-test', private: true, dependencies: { 'hello-lib': '^1.0.0' } }),
  )
  return libsDir
}

describe('buildLibs', () => {
  it('bundles shelf dependencies to ESM + importmap + manifest', async () => {
    const libsDir = makeShelf()
    const outDir = join(root, 'out')
    const { imports, manifest } = await buildLibs({ libsPackageDir: libsDir, outDir })
    expect(imports).toEqual({ 'hello-lib': '/libs/hello-lib.js' })
    expect(manifest).toEqual([
      { name: 'hello-lib', url: '/libs/hello-lib.js', bytes: expect.any(Number), builtAt: expect.any(String) },
    ])
    expect(manifest[0]!.bytes).toBeGreaterThan(0)

    const esm = readFileSync(join(outDir, 'hello-lib.js'), 'utf8')
    expect(esm).toContain('answer')
    expect(esm).toMatch(/export/) // still an ES module, importable via import()

    const map = JSON.parse(readFileSync(join(outDir, 'importmap.json'), 'utf8'))
    expect(map).toEqual({ imports: { 'hello-lib': '/libs/hello-lib.js' } })
    expect(JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'))).toEqual(manifest)
  })

  it('leaves an empty importmap when the shelf has no dependencies', async () => {
    const libsDir = join(root, 'empty-shelf')
    mkdirSync(libsDir, { recursive: true })
    writeFileSync(libsDir + '/package.json', JSON.stringify({ name: '@toolback/libs-empty', private: true }))
    const outDir = join(root, 'out-empty')
    const { imports, manifest } = await buildLibs({ libsPackageDir: libsDir, outDir })
    expect(imports).toEqual({})
    expect(manifest).toEqual([])
    expect(JSON.parse(readFileSync(join(outDir, 'importmap.json'), 'utf8'))).toEqual({ imports: {} })
  })
})