import type { LoadMode } from './aiDiff'

export interface Intent {
  mode: LoadMode
  /** for modify: keep existing objects verbatim and only add new ones */
  keepExisting: boolean
}

const TO_PAGE_RE = /\b(to|on|onto|into)\s+(the|this|my|current)?\s*page\b/i
const PAGE_CREATE_RE = /\b(add|create|new|make|insert)\b[^.]*\b(page|screen|view|dialog|popup)\b/i
const ADDITIVE_RE = /\b(add|insert|append|one more|another|also|put|duplicate)\b/i
const MODIFY_RE = /\b(modify|update|change|edit|adjust|rewrite|tweak|rename|restyle|recolour|recolor)\b/i

/**
 * Guess the best load mode from the request text. `null` means "leave the mode
 * as the user set it". Additive-to-page requests get the strict add-only
 * treatment so existing objects (and their colours) survive.
 */
export function detectIntent(text: string): Intent | null {
  if (!text.trim()) return null
  if (TO_PAGE_RE.test(text)) return { mode: 'modify', keepExisting: true }
  if (PAGE_CREATE_RE.test(text)) return { mode: 'append', keepExisting: false }
  if (ADDITIVE_RE.test(text)) return { mode: 'modify', keepExisting: true }
  if (MODIFY_RE.test(text)) return { mode: 'modify', keepExisting: false }
  return null
}
