import { describe, expect, it } from 'vitest'
import { normalizeBook, safeParseBook, validateBook } from './index'

describe('normalizeBook', () => {
  it('fills missing root fields, a background and object geometry', () => {
    const { book, notes } = normalizeBook({
      pages: [{ name: 'Home', objects: [{ control: 'button', props: { text: 'Hi' } }] }],
    })
    const parsed = safeParseBook(book)
    expect(parsed.success).toBe(true)
    const page = parsed.success ? parsed.data.pages[0]! : undefined
    expect(page?.objects[0]?.x).toEqual({ mode: 'left', left: 0, width: 176 })
    expect(page?.objects[0]?.y).toEqual({ mode: 'top', top: 0, height: 48 })
    expect(notes.length).toBeGreaterThan(0)
  })

  it('merges control defaults into props', () => {
    const { book } = normalizeBook({
      pages: [{ name: 'P', objects: [{ control: 'label', props: {} }] }],
    })
    const parsed = safeParseBook(book)
    const props = parsed.success ? parsed.data.pages[0]!.objects[0]!.props : {}
    expect(props['fontSize']).toBe(15)
    expect(props['text']).toBe('Label')
  })

  it('fixes invalid and duplicated object names and rewrites references', () => {
    const { book } = normalizeBook({
      backgrounds: [
        {
          id: 'bg1',
          name: 'B',
          color: '#fff',
          script: '',
          objects: [],
        },
      ],
      pages: [
        {
          id: 'p1',
          name: 'P',
          script: '',
          backgroundId: 'bg1',
          objects: [
            { id: 'a', name: 'my button', control: 'button', props: { text: 'A' } },
            { id: 'b', name: 'my button', control: 'button', on: { click: "controls['my button'].text = 'x'" } },
          ],
        },
      ],
    })
    const parsed = safeParseBook(book)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    const names = parsed.data.pages[0]!.objects.map((o) => o.name)
    expect(names).toEqual(['mybutton', 'mybutton2'])
    expect(validateBook(book).ok).toBe(true)
  })

  it('keeps page names as free text (only object names are identifiers)', () => {
    const { book } = normalizeBook({
      pages: [
        { name: 'Main Menu', objects: [] },
        { name: 'Main Menu', objects: [] },
      ],
    })
    const parsed = safeParseBook(book)
    expect(parsed.success && parsed.data.pages.map((p) => p.name)).toEqual([
      'Main Menu',
      'Main Menu 2',
    ])
  })

  it('points a page with a dangling background at a valid one', () => {
    const { book } = normalizeBook({
      backgrounds: [{ id: 'bg1', name: 'B', color: '#fff', script: '', objects: [] }],
      pages: [{ id: 'p1', name: 'P', backgroundId: 'nope', objects: [] }],
    })
    const parsed = safeParseBook(book)
    expect(parsed.success && parsed.data.pages[0]!.backgroundId).toBe('bg1')
  })
})
