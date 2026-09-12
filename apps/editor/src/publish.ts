import type { Book } from '@toolback/format'
import { basePackageName, scanLibImports } from '@toolback/runtime'

export { basePackageName, scanLibImports } from '@toolback/runtime'

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function standaloneFileName(book: Book): string {
  const base =
    book.title
      .trim()
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'book'
  return `${base}.html`
}

/**
 * Resolve scanned import specifiers to URLs for the export: shelf packages
 * get their (base64 data:) module URL so the book stays offline and
 * self-contained; anything else falls back to esm.sh at runtime and is
 * reported as a warning.
 */
export function libUrlMapFor(
  specifiers: string[],
  shelf: Map<string, string>,
): { libs: Record<string, string>; warnings: string[] } {
  const libs: Record<string, string> = {}
  const warnings: string[] = []
  for (const spec of specifiers) {
    const bundled = shelf.get(basePackageName(spec))
    if (bundled !== undefined) {
      libs[spec] = bundled
    } else {
      libs[spec] = `https://esm.sh/${spec}`
      warnings.push(
        `${spec} is not installed in packages/libs — the exported book fetches it from esm.sh at runtime (needs network). For an offline export run: pnpm --filter @toolback/libs add ${basePackageName(spec)}`,
      )
    }
  }
  return { libs, warnings }
}

/**
 * Build the single-file published book: runtime player + book JSON in one
 * self-contained HTML file. Book JSON is embedded with `<` escaped so a
 * `</script>` inside any string cannot break out of the script tag. Library
 * imports are wired through `window.__TOOLBACK_LIBS__` (URL or data: URL per
 * specifier) consulted by the player's `__tbImport` resolver — no importmap.
 */
export function buildStandaloneHtml(
  book: Book,
  playerJs: string,
  libs: Record<string, string> = {},
): string {
  const json = JSON.stringify(book).replace(/</g, '\\u003c')
  const safePlayer = playerJs.replaceAll('</script', '<\\/script')
  const safeLibs = JSON.stringify(libs).replace(/</g, '\\u003c')
  const libsTag = Object.keys(libs).length
    ? [`<script>window.__TOOLBACK_LIBS__=${safeLibs};</script>`]
    : []
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${escapeHtml(book.title)}</title>`,
    '<style>html,body{margin:0;padding:0}</style>',
    '</head>',
    '<body>',
    `<script>window.__TOOLBACK_BOOK__=${json};</script>`,
    ...libsTag,
    `<script>${safePlayer}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}