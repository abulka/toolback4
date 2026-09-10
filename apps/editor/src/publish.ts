import type { Book } from '@toolback/format'

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
 * Build the single-file published book: runtime player + book JSON in one
 * self-contained HTML file. Book JSON is embedded with `<` escaped so a
 * `</script>` inside any string cannot break out of the script tag.
 */
export function buildStandaloneHtml(book: Book, playerJs: string): string {
  const json = JSON.stringify(book).replace(/</g, '\\u003c')
  const safePlayer = playerJs.replaceAll('</script', '<\\/script')
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
    `<script>${safePlayer}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}
