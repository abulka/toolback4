import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { basePackageName, isBareSpecifier, normalizeModule, rewriteLibImports, scanLibImports } from './libs'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

const book = {
  id: 'b',
  title: 't',
 
  backgrounds: [BG],
  pages: [],
} as unknown as Book

describe('isBareSpecifier', () => {
  it('accepts bare package specifiers only', () => {
    expect(isBareSpecifier('@tonejs/midi')).toBe(true)
    expect(isBareSpecifier('lodash')).toBe(true)
    expect(isBareSpecifier('./x.js')).toBe(false)
    expect(isBareSpecifier('/abs')).toBe(false)
    expect(isBareSpecifier('https://x.com/y')).toBe(false)
    expect(isBareSpecifier('data:text/javascript,1')).toBe(false)
    expect(isBareSpecifier('node:fs')).toBe(false)
    expect(isBareSpecifier('#private')).toBe(false)
  })
})

describe('basePackageName', () => {
  it('reduces specifiers to their base package, ignoring versions', () => {
    expect(basePackageName('@tonejs/midi/track')).toBe('@tonejs/midi')
    expect(basePackageName('lodash/fp')).toBe('lodash')
    expect(basePackageName('lodash')).toBe('lodash')
    expect(basePackageName('lodash@4.17.21')).toBe('lodash')
    expect(basePackageName('@tonejs/midi@2.0.28')).toBe('@tonejs/midi')
    expect(basePackageName('@scope/pkg@beta/sub')).toBe('@scope/pkg')
  })
})

describe('scanLibImports', () => {
  it('scans background, page and object scripts, dedupes bare specifiers', () => {
    const b = {
      ...book,
      backgrounds: [{ ...BG, script: "await import('@tonejs/midi')" }],
      pages: [
        {
          id: 'p1',
          name: 'one',
          script: 'await import("chart.js")\nawait import("@tonejs/midi")',
          backgroundId: 'bg1',
          objects: [
            {
              id: 'o1',
              name: 'btn',
              control: 'button',
              rect: { x: 0, y: 0, w: 1, h: 1 },
              props: {},
              on: { click: "await import('./rel.js'); await import('https://x/y.js')" },
              children: [],
            },
          ],
        },
      ],
    } as unknown as Book
    expect(scanLibImports(b)).toEqual(['@tonejs/midi', 'chart.js'])
  })
})

describe('rewriteLibImports', () => {
  it('rewrites bare dynamic imports to the resolver', () => {
    expect(rewriteLibImports("const { a } = await import('x')")).toBe("const { a } = await __tbImport('x')")
  })
  it('leaves non-bare imports native', () => {
    const src = "await import('./rel.js'); await import('https://x/y.js'); await import('data:,1')"
    expect(rewriteLibImports(src)).toBe(src)
  })
  it('leaves lookalikes untouched', () => {
    const src = "const s = 'important(x)'; store.set('await import', s)"
    expect(rewriteLibImports(src)).toBe(src)
  })
})

describe('normalizeModule', () => {
  it('unwraps a bundled CJS default-only namespace', () => {
    const exportsObj = { Midi: class {} }
    expect(normalizeModule({ default: exportsObj })).toBe(exportsObj)
  })
  it('passes real ESM namespaces through', () => {
    const mod = { named: 1, default: 2 }
    expect(normalizeModule(mod)).toBe(mod)
  })
  it('unwraps a default-only ESM module', () => {
    const d = { run: () => 1 }
    expect(normalizeModule({ default: d })).toBe(d)
  })
  it('keeps null/undefined defaults visible', () => {
    expect(normalizeModule({ default: null })).toEqual({ default: null })
  })
})