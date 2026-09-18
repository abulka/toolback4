import { describe, expect, it } from 'vitest'
import { createBook, createObject, createPage } from '@toolback/format'
import { diffBooks } from './aiDiff'

describe('diffBooks', () => {
  it('summarises a replace', () => {
    const current = createBook('Current')
    const generated = createBook('Generated')
    const lines = diffBooks(current, generated, 'replace', 0)
    expect(lines[0]).toContain('Current')
    expect(lines[0]).toContain('Generated')
    expect(lines.some((l) => l.startsWith('Replace'))).toBe(true)
  })

  it('summarises an append with renames', () => {
    const current = createBook('Current')
    const generated = createBook('Generated')
    const lines = diffBooks(current, generated, 'append', 0)
    expect(lines.some((l) => l.includes('Add 1 page'))).toBe(true)
    expect(lines.some((l) => l.includes('Rename page'))).toBe(true)
  })

  it('summarises a modify by added/removed objects and script', () => {
    const current = createBook('Current')
    const page = current.pages[0]!
    page.name = 'Home'
    page.objects.push(createObject('label', 'keep', { x: 0, y: 0, w: 10, h: 10 }))
    page.objects.push(createObject('label', 'drop', { x: 0, y: 0, w: 10, h: 10 }))
    page.script = 'function pageEnter() {}'

    const generated = createBook('Generated')
    const gen = generated.pages[0]!
    gen.name = 'Home'
    gen.objects.push(createObject('label', 'keep', { x: 0, y: 0, w: 10, h: 10 }))
    gen.objects.push(createObject('label', 'fresh', { x: 0, y: 0, w: 10, h: 10 }))
    gen.script = 'function pageEnter() { store.set("n", 1) }'

    const lines = diffBooks(current, generated, 'modify', 0)
    expect(lines.some((l) => l.includes('Add object(s): fresh'))).toBe(true)
    expect(lines.some((l) => l.includes('Remove object(s): drop'))).toBe(true)
    expect(lines.some((l) => l.includes('Change the page script'))).toBe(true)
  })
})
