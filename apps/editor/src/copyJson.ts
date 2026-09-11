import type { PageObject } from '@toolback/format'

/** pretty-printed JSON of the selection: a single object (including any
 *  sub-objects) or an array for multi-selections */
export function objectsToJson(objs: PageObject[]): string {
  return JSON.stringify(objs.length === 1 ? objs[0] : objs, null, 2)
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
