import { describe, expect, it } from 'vitest'
import { internalize } from './scriptLink'

describe('scriptLink internalize', () => {
  it('strips the generated header, keeping only the script body', () => {
    const out =
      '// toolback-linked script — edit me in VS Code (or in toolback) and save.\n' +
      '// Changes sync both ways.\n' +
      'declare const store: TBStore\n' +
      '// ============= toolback script =============\n' +
      "function pageEnter() { store.set('x', 1) }"
    expect(internalize(out)).toBe("function pageEnter() { store.set('x', 1) }")
  })

  it('passes through text without the marker untouched', () => {
    expect(internalize('function click() {}')).toBe('function click() {}')
  })

  it('handles an empty script body', () => {
    const out = 'declare const store: TBStore\n// ============= toolback script =============\n'
    expect(internalize(out)).toBe('')
  })
})