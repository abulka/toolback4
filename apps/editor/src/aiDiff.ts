import { flattenObjects, type Book, type Page } from '@toolback/format'
import { mergeGeneratedBook } from './mergeBook'

export type LoadMode = 'append' | 'modify' | 'replace'

function pageNames(book: Book): string[] {
  return book.pages.map((p) => p.name)
}

function objectNames(page: Page): string[] {
  return flattenObjects(page.objects).map((o) => o.name)
}

/**
 * A short, human-readable summary of what applying `generated` would do to
 * `current`, for the preview card. Pure — it never mutates the current book
 * (the append check runs the merge on a clone).
 */
export function diffBooks(
  current: Book,
  generated: Book,
  mode: LoadMode,
  pageIndex: number,
): string[] {
  const lines: string[] = []

  if (mode === 'replace') {
    if (current.title !== generated.title) lines.push(`Title: “${current.title}” → “${generated.title}”`)
    lines.push(
      `Replace ${current.pages.length} page(s) and ${current.backgrounds.length} background(s) with ` +
        `${generated.pages.length} page(s) and ${generated.backgrounds.length} background(s)`,
    )
    lines.push(`Pages: ${pageNames(generated).join(', ') || '(none)'}`)
    return lines
  }

  if (mode === 'append') {
    const { report } = mergeGeneratedBook(current, generated)
    const existingNames = new Set(pageNames(current))
    const incoming = pageNames(generated).filter((n) => !existingNames.has(n))
    lines.push(`Add ${report.pagesAdded} page(s)${incoming.length ? `: ${incoming.join(', ')}` : ''}`)
    if (report.backgroundsAdded) lines.push(`Add ${report.backgroundsAdded} background(s)`)
    if (report.reusedBackgrounds.length) {
      lines.push(`Join existing background(s): ${report.reusedBackgrounds.join(', ')}`)
    }
    if (report.droppedBackgroundObjects) {
      lines.push(
        `Note: ${report.droppedBackgroundObjects} generated object(s) on reused backgrounds were dropped`,
      )
    }
    for (const rename of report.renamedPages) lines.push(`Rename page ${rename}`)
    for (const rename of report.renamedObjects) lines.push(`Rename object ${rename}`)
    return lines
  }

  const currentPage = current.pages[pageIndex]
  if (!currentPage) return ['No current page']
  const generatedPage =
    generated.pages.find((p) => p.name === currentPage.name) ?? generated.pages[0]
  if (!generatedPage) return ['The generated book has no pages']

  const before = new Set(objectNames(currentPage))
  const after = new Set(objectNames(generatedPage))
  const added = [...after].filter((n) => !before.has(n))
  const removed = [...before].filter((n) => !after.has(n))
  if (added.length) lines.push(`Add object(s): ${added.join(', ')}`)
  if (removed.length) lines.push(`Remove object(s): ${removed.join(', ')}`)
  if (currentPage.script !== generatedPage.script) lines.push('Change the page script')
  if (!lines.length) lines.push('No object or script changes detected')
  return lines
}
