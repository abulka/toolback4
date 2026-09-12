import type { Book } from '@toolback/format'
import { flattenObjects } from '@toolback/format'

/**
 * npm library access for user scripts. Authors write plain
 * `await import('name')`; the player compiles script bodies with bare
 * dynamic imports rewritten to the injected `__tbImport` resolver, which
 * looks the specifier up in `window.__TOOLBACK_LIBS__` (URL or data: URL —
 * exports embed shelf libraries offline), falls back to esm.sh for anything
 * else, and normalizes CommonJS interop so named destructuring works:
 * `const { Midi } = await import('@tonejs/midi')`.
 */

type LibMap = Record<string, string>

/** specifiers that resolve through the library resolver, not on their own */
export function isBareSpecifier(spec: string): boolean {
  return (
    !spec.startsWith('.') &&
    !spec.startsWith('/') &&
    !spec.startsWith('#') &&
    !/^[a-z]+:/.test(spec)
  )
}

/** package name of an import specifier: '@tonejs/midi@2/track' → '@tonejs/midi' */
export function basePackageName(specifier: string): string {
  const parts = specifier.split('/')
  const base = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
  return base.replace(/@[^@/]+$/, '')
}

const LIB_IMPORT_RE = /\bimport\s*\(\s*(['"])([^'"\n]+?)\1/g

/**
 * Collect every `import('...')` specifier used by book scripts (background,
 * pages, and object event scripts, including group members). Only bare
 * specifiers count — relative paths, URLs and `data:` are left alone.
 */
export function scanLibImports(book: Book): string[] {
  const found = new Set<string>()
  const scan = (script: string): void => {
    for (const m of script.matchAll(LIB_IMPORT_RE)) found.add(m[2]!)
  }
  for (const bg of book.backgrounds) scan(bg.script)
  for (const page of book.pages) {
    scan(page.script)
    for (const obj of flattenObjects(page.objects)) {
      for (const script of Object.values(obj.on)) scan(script)
    }
  }
  return [...found].filter(isBareSpecifier)
}

/**
 * Rewrite bare dynamic imports in a script body to `__tbImport(...)`.
 * Non-bare specifiers (URLs, data:) keep their native `import()`.
 */
export function rewriteLibImports(script: string): string {
  return script.replace(LIB_IMPORT_RE, (_m, q: string, spec: string) =>
    isBareSpecifier(spec) ? `__tbImport(${q}${spec}${q}` : _m,
  )
}

const CDN_BASE = 'https://esm.sh/'

export function libUrlFor(spec: string): string {
  const map =
    typeof window !== 'undefined'
      ? (window as unknown as { __TOOLBACK_LIBS__?: LibMap }).__TOOLBACK_LIBS__
      : undefined
  return map?.[spec] ?? (isBareSpecifier(spec) ? `${CDN_BASE}${spec}` : spec)
}

/**
 * CommonJS interop: a bundled CJS lib surfaces as `{ default: exports }`;
 * unwrap that so `const { Midi } = await import('@tonejs/midi')` works.
 * Real ESM namespaces (named + default) pass through untouched, and a
 * default-only ESM module comes back as the default itself.
 */
export function normalizeModule(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && !Array.isArray(mod)) {
    const keys = Object.keys(mod as Record<string, unknown>)
    if (keys.length === 1 && keys[0] === 'default') {
      const d = (mod as Record<string, unknown>).default
      if (d !== undefined && d !== null) return d
    }
  }
  return mod
}

const libCache = new Map<string, Promise<unknown>>()

// Dynamic imports must not be rewritten by bundlers: Vite dev injects an
// `?import` query into the URL (breaking public-dir module URLs) and esbuild
// would try to resolve the expression. The Function indirection keeps the
// import call opaque to both, so preview and export share one behavior.
const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>

/** the resolver injected into every compiled script body as `__tbImport` */
export function toolbackImport(spec: string): Promise<unknown> {
  const cached = libCache.get(spec)
  if (cached) return cached
  const loaded = Promise.resolve()
    .then(() => dynamicImport(libUrlFor(spec)))
    .then(normalizeModule)
    .catch((err: unknown) => {
      libCache.delete(spec)
      throw err
    })
  libCache.set(spec, loaded)
  return loaded
}

/** inject the export/preview URL map (lazily consulted by toolbackImport) */
export function setLibMap(map: LibMap): void {
  ;(window as unknown as { __TOOLBACK_LIBS__?: LibMap }).__TOOLBACK_LIBS__ = map
}

/** boot-time shelf lookup: the build step's importmap.json (URL per lib) */
export async function loadShelfManifest(url = '/libs/importmap.json'): Promise<LibMap> {
  const res = await fetch(url)
  if (!res.ok) return {}
  const json = (await res.json()) as { imports?: LibMap }
  return json.imports ?? {}
}