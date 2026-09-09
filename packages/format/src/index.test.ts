import { describe, expect, it } from 'vitest'
import {
  CONTROL_KINDS,
  DEFAULT_SIZES,
  createBook,
  createObject,
  parseBook,
  safeParseBook,
} from './index'
import { sampleBook } from './sample'

describe('format', () => {
  it('has a default size for every control kind', () => {
    for (const kind of CONTROL_KINDS) {
      expect(DEFAULT_SIZES[kind]).toBeDefined()
    }
  })
  it('parses the sample book and applies defaults', () => {
    const book = parseBook(structuredClone(sampleBook()))
    expect(book.title).toBe('Hello Toolbook')
    expect(book.pages[0]!.objects).toHaveLength(2)
    expect(book.pages[0]!.objects[0]!.on).toEqual({})
  })

  it('round-trips through JSON', () => {
    const book = sampleBook()
    const parsed = parseBook(JSON.parse(JSON.stringify(book)))
    expect(parsed).toEqual(book)
  })

  it('rejects an empty pages array', () => {
    const result = safeParseBook({ id: 'b1', title: 'x', pages: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown control kind', () => {
    const result = safeParseBook({
      id: 'b1',
      title: 'x',
      pages: [
        {
          id: 'p1',
          name: 'Page 1',
          objects: [
            { id: 'o1', name: 'a', control: 'wombat', rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } } },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('factories produce valid books', () => {
    const book = createBook('Fresh')
    book.pages[0]!.objects.push(
      createObject('button', 'ok', { desktop: { x: 10, y: 10, w: 100, h: 40 } }),
    )
    expect(() => parseBook(book)).not.toThrow()
  })
})
