import type { PageObject } from '@toolback/format'

/** pretty-printed JSON of the selection: a single object (including any
 *  sub-objects) or an array for multi-selections */
export function objectsToJson(objs: PageObject[]): string {
  return JSON.stringify(objs.length === 1 ? objs[0] : objs, null, 2)
}

/** the special key that marks a clipboard payload as toolback copy data */
export const CLIPBOARD_KEY = '__toolback'

/**
 * Serialize a copy of one or more objects to the clipboard format: pretty
 * JSON with a `__toolback` marker. Paste will only accept payloads that
 * carry the marker, so copying unrelated text can never be pasted as
 * objects. A single object copies bare (not as a one-element array).
 */
export function clipboardToJson(objs: PageObject[]): string {
  return JSON.stringify(
    {
      [CLIPBOARD_KEY]: 1,
      objects: objs.length === 1 ? objs[0] : objs,
    },
    null,
    2,
  )
}

/** whether a clipboard string looks like a toolback copy payload */
export function isClipboardJson(text: string): boolean {
  return parseClipboardJson(text) !== null
}

/**
 * Parse a toolback copy payload back into objects. Returns null for
 * anything that isn't a `{ __toolback, objects }` payload — plain JSON,
 * garbage, or empty. Normalizes a single object into a one-element array.
 */
export function parseClipboardJson(text: string): PageObject[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (obj[CLIPBOARD_KEY] !== 1) return null
  const objs = Array.isArray(obj['objects']) ? obj['objects'] : [obj['objects']]
  if (!objs.length || !objs.every(isPageObjectLike)) return null
  return objs as PageObject[]
}

function isPageObjectLike(v: unknown): boolean {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o['id'] === 'string' &&
    typeof o['name'] === 'string' &&
    typeof o['control'] === 'string' &&
    typeof o['rect'] === 'object' &&
    o['rect'] !== null
  )
}

/** clipboard write with a textarea fallback for non-secure contexts */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}
