import { flattenObjects, type Book } from '@toolback/format'

const SET_RE = /\bstore\.set\(\s*['"]([\w$]+)['"]/g
const TEMPLATE_RE = /\{\{\s*([\w$]+)\s*\}\}/g

/**
 * All store keys referenced anywhere in the book: keys written via
 * `store.set('key', …)` in page/object scripts, plus keys already used
 * in `{{key}}` label templates. Store is shared across pages during a
 * run, so keys from every page are relevant. Group members included.
 */
export function collectStoreKeys(book: Book): string[] {
  const keys = new Set<string>()
  for (const page of book.pages) {
    for (const m of page.script.matchAll(SET_RE)) keys.add(m[1]!)
    for (const obj of flattenObjects(page.objects)) {
      for (const script of Object.values(obj.on)) {
        for (const m of (script ?? '').matchAll(SET_RE)) keys.add(m[1]!)
      }
      for (const v of Object.values(obj.props)) {
        if (typeof v === 'string') {
          for (const m of v.matchAll(TEMPLATE_RE)) keys.add(m[1]!)
        }
      }
    }
  }
  return [...keys].sort()
}
