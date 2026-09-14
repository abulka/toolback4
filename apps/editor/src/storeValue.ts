/**
 * Turn text from the Store tab's value field into a stored value. The whole
 * trimmed string is parsed as JSON, so numbers, `true`/`false`, `null`,
 * quoted strings and `[…]`/`{…}` keep their type; anything else is stored as a
 * plain string.
 */
export function parseDesignValue(s: string): unknown {
  const t = s.trim()
  if (!t) return s
  try {
    return JSON.parse(t)
  } catch {
    return s
  }
}
