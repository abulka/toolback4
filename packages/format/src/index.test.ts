import { describe, expect, it } from 'vitest'
import {
  CONTROL_KINDS,
  DEFAULT_SIZES,
  createBook,
  createGroup,
  createObject,
  flattenObjects,
  parseBook,
  rebaseRect,
  safeParseBook,
  scaleRect,
  treeRows,
  unionRects,
  unrebaseRect,
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

  describe('groups', () => {
    it('accepts nested groups and round-trips through JSON', () => {
      const child = createObject('label', 'inner', { desktop: { x: 8, y: 8, w: 100, h: 40 } })
      const inner = createGroup('inner1', { desktop: { x: 16, y: 16, w: 120, h: 60 } }, [child])
      const outer = createGroup('group1', { desktop: { x: 40, y: 40, w: 200, h: 120 } }, [inner])
      const book = createBook('G')
      book.pages[0]!.objects.push(outer)
      const parsed = parseBook(JSON.parse(JSON.stringify(book)))
      const g = parsed.pages[0]!.objects[0]!
      expect(g.control).toBe('group')
      expect(g.children![0]!.control).toBe('group')
      expect(g.children![0]!.children![0]!.name).toBe('inner')
    })

    it('parses legacy books without children', () => {
      const legacy = {
        id: 'b1',
        title: 'old',
        pages: [
          {
            id: 'p1',
            name: 'P',
            objects: [
              { id: 'o1', name: 'a', control: 'label', rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } } },
            ],
          },
        ],
      }
      expect(() => parseBook(legacy)).not.toThrow()
    })

    it('flattenObjects walks groups pre-order; treeRows annotates depth', () => {
      const a = createObject('label', 'a', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
      const child = createObject('button', 'b', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
      const nested = createObject('label', 'c', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
      const inner = createGroup('g2', { desktop: { x: 0, y: 0, w: 10, h: 10 } }, [nested])
      const g = createGroup('g1', { desktop: { x: 0, y: 0, w: 10, h: 10 } }, [child, inner])
      const rows = treeRows([a, g])
      expect(rows.map((r) => `${r.obj.name}@${r.depth}`)).toEqual(['a@0', 'g1@0', 'b@1', 'g2@1', 'c@2'])
      expect(flattenObjects([a, g]).map((o) => o.name)).toEqual(['a', 'g1', 'b', 'g2', 'c'])
    })

    it('geometry helpers: union, rebase, unrebase, scale', () => {
      expect(
        unionRects([
          { x: 10, y: 20, w: 40, h: 50 },
          { x: 100, y: 0, w: 10, h: 10 },
        ]),
      ).toEqual({ x: 10, y: 0, w: 100, h: 70 })
      expect(rebaseRect({ x: 60, y: 70, w: 10, h: 10 }, { x: 40, y: 20 })).toEqual({
        x: 20,
        y: 50,
        w: 10,
        h: 10,
      })
      expect(unrebaseRect({ x: 40, y: 0, w: 10, h: 10 }, { x: 60, y: 20 })).toEqual({
        x: 100,
        y: 20,
        w: 10,
        h: 10,
      })
      // scaling around origin (0,0) by 2x doubles position and size
      expect(scaleRect({ x: 10, y: 10, w: 20, h: 30 }, { x: 0, y: 0 }, 2, 2)).toEqual({
        x: 20,
        y: 20,
        w: 40,
        h: 60,
      })
      // scaling keeps the opposite corner fixed
      expect(scaleRect({ x: 10, y: 10, w: 20, h: 20 }, { x: 0, y: 0 }, 0.5, 0.5)).toEqual({
        x: 5,
        y: 5,
        w: 10,
        h: 10,
      })
      // origin at 100: x=20 stays at origin when scaling from there
      expect(scaleRect({ x: 100, y: 50, w: 20, h: 20 }, { x: 100, y: 0 }, 2, 1)).toEqual({
        x: 100,
        y: 50,
        w: 40,
        h: 20,
      })
    })
  })
})
