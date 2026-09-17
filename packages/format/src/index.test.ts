import { describe, expect, it } from 'vitest'
import {
  CONTROL_KINDS,
  DEFAULT_SIZES,
  IMAGE_PROVIDERS,
  alignRects,
  applyRectToObject,
  backgroundFor,
  centerBlockRects,
  contentExtent,
  createBook,
  createBackground,
  createGroup,
  createObject,
  createPage,
  distributeRects,
  effectiveMargin,
  flattenObjects,
  marginOf,
  matchSizeRects,
  parseBook,
  randomImageUrl,
  rebaseRect,
  rectForObject,
  resolvePageBox,
  resolveStartPageIndex,
  resolveX,
  resolveY,
  safeParseBook,
  scaleEdges,
  scaleRect,
  scaleSubtreeEdges,
  treeRows,
  unionRects,
  unrebaseRect,
  writeRectPart,
  xEdgeFromRect,
  yEdgeFromRect,
  type XEdge,
  type YEdge,
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

  it('supports markdown and html viewer kinds with defaults and JSON round-trip', () => {
    for (const kind of ['markdown', 'html'] as const) {
      expect(DEFAULT_SIZES[kind]).toEqual({ w: 420, h: 260 })
      const book = createBook('viewers')
      const obj = createObject(kind, kind, { x: 0, y: 0, ...DEFAULT_SIZES[kind] })
      book.pages[0]!.objects.push(obj)
      const parsed = parseBook(JSON.parse(JSON.stringify(book)))
      expect(parsed.pages[0]!.objects[0]!.control).toBe(kind)
    }
  })

  it('design-time store: defaults empty, parses ordered [key, value] pairs, allows JSON values', () => {
    const book = parseBook({ id: 'b1', title: 'x', pages: [{ id: 'p1', name: 'P', objects: [] }] })
    expect(book.store).toEqual([])

    const withStore = parseBook({
      id: 'b1',
      title: 'x',
      store: [
        ['score', 3],
        ['name', 'andy'],
        ['win', true],
        ['opts', { a: 1 }],
      ],
      pages: [{ id: 'p1', name: 'P', objects: [] }],
    })
    expect(withStore.store).toEqual([
      ['score', 3],
      ['name', 'andy'],
      ['win', true],
      ['opts', { a: 1 }],
    ])
    // round-trips through JSON (what crosses the iframe)
    expect(parseBook(JSON.parse(JSON.stringify(withStore))).store).toEqual(withStore.store)
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
            { id: 'o1', name: 'a', control: 'wombat', rect: { x: 0, y: 0, w: 10, h: 10 } },
          ],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('factories produce valid books', () => {
    const book = createBook('Fresh')
    book.pages[0]!.objects.push(
      createObject('button', 'ok', { x: 10, y: 10, w: 100, h: 40 }),
    )
    expect(() => parseBook(book)).not.toThrow()
  })

  describe('backgrounds', () => {
    it('createBook ships with one background and links the first page', () => {
      const book = createBook('Fresh')
      expect(book.backgrounds).toHaveLength(1)
      expect(book.backgrounds[0]!.name).toBe('Background 1')
      expect(book.pages[0]!.backgroundId).toBe(book.backgrounds[0]!.id)
      expect(() => parseBook(book)).not.toThrow()
    })

    it('migrates legacy books: one background per distinct page colour', () => {
      const legacy = {
        id: 'b1',
        title: 'old',
        pages: [
          { id: 'p1', name: 'A', background: '#ffffff', objects: [] },
          { id: 'p2', name: 'B', background: '#ffffff', objects: [] },
          { id: 'p3', name: 'C', background: '#0000ff', objects: [] },
        ],
      }
      const book = parseBook(legacy)
      expect(book.backgrounds.map((b) => b.color)).toEqual(['#ffffff', '#0000ff'])
      expect(book.backgrounds[0]!.name).toBe('Background 1')
      expect(book.backgrounds[1]!.name).toBe('Background 2')
      expect(book.pages[0]!.backgroundId).toBe(book.backgrounds[0]!.id)
      expect(book.pages[1]!.backgroundId).toBe(book.backgrounds[0]!.id)
      expect(book.pages[2]!.backgroundId).toBe(book.backgrounds[1]!.id)
      // the legacy field is stripped
      expect('background' in book.pages[0]!).toBe(false)
    })

    it('normalises dangling backgroundIds to the first background', () => {
      const raw = {
        id: 'b1',
        title: 'x',
        backgrounds: [{ id: 'bg1', name: 'B', color: '#fff', objects: [] }],
        pages: [
          { id: 'p1', name: 'A', backgroundId: 'nope', objects: [] },
          { id: 'p2', name: 'B', backgroundId: 'bg1', objects: [] },
        ],
      }
      const book = parseBook(raw)
      expect(book.pages[0]!.backgroundId).toBe('bg1')
    })

    it('backgroundFor resolves and falls back to the first background', () => {
      const book = createBook('F')
      const page = book.pages[0]!
      expect(backgroundFor(book, page)).toBe(book.backgrounds[0])
      page.backgroundId = 'ghost'
      expect(backgroundFor(book, page)).toBe(book.backgrounds[0])
    })

    it('resolvePageBox: a fixed page keeps its size; a fluid page fills the container and grows with content', () => {
      const book = createBook('F')
      const page = book.pages[0]!
      const container = { width: 1024, height: 700 }
      // fluid: box fills the container
      expect(resolvePageBox(page, container, [])).toEqual(container)
      // a near-edge object below the fold grows the box by exactly its extent
      const tall = createObject('card', 'tall', { x: 0, y: 1000, w: 200, h: 100 })
      expect(resolvePageBox(page, container, [tall])).toEqual({ width: 1024, height: 1100 })
      // past the right edge grows the width too, on the same rule
      const wide = createObject('card', 'wide', { x: 0, y: 10, w: 1200, h: 100 })
      expect(resolvePageBox(page, container, [wide])).toEqual({ width: 1200, height: 700 })
      // short content never shrinks below the container
      const short = createObject('card', 'short', { x: 0, y: 10, w: 200, h: 100 })
      expect(resolvePageBox(page, container, [short])).toEqual(container)
      // far-edge / follows-both / centred objects sit inside the box
      const pinned = createObject('card', 'pin', { x: 0, y: 0, w: 200, h: 100 })
      pinned.x = { mode: 'right', right: 10, width: 200 }
      pinned.y = { mode: 'bottom', bottom: 10, height: 100 }
      expect(resolvePageBox(page, container, [pinned])).toEqual(container)
      const fill = createObject('card', 'fill', { x: 0, y: 0, w: 200, h: 100 })
      fill.x = { mode: 'both', left: 10, right: 10 }
      fill.y = { mode: 'both', top: 10, bottom: 10 }
      expect(resolvePageBox(page, container, [fill])).toEqual(container)
      // only near edges contribute to the extent
      expect(contentExtent([tall, pinned, fill])).toEqual({ right: 200, bottom: 1100 })
      // a group's box is its own constraint; members are ignored
      const child = createObject('label', 'inner', { x: 0, y: 0, w: 50, h: 50 })
      const group = createGroup('g', { x: 0, y: 1200, w: 200, h: 200 }, [child])
      expect(resolvePageBox(page, container, [group])).toEqual({ width: 1024, height: 1400 })
      // fixed page: its own size
      page.size = { width: 360, height: 420 }
      expect(resolvePageBox(page, container, [tall])).toEqual({ width: 360, height: 420 })
    })

    it('a near-edge object margin grows the page past the control', () => {
      const book = createBook('M')
      const page = book.pages[0]!
      const container = { width: 1024, height: 700 }
      const btn = createObject('button', 'go', { x: 40, y: 900, w: 100, h: 40 })
      btn.margin = { right: 10, bottom: 24 }
      expect(contentExtent([btn])).toEqual({ right: 150, bottom: 964 })
      expect(resolvePageBox(page, container, [btn])).toEqual({ width: 1024, height: 964 })
    })

    it('round-trips an object margin through parse', () => {
      const book = createBook('M')
      const o = createObject('button', 'b', { x: 10, y: 20, w: 100, h: 40 })
      o.margin = { right: 2, bottom: 3 }
      book.pages[0]!.objects.push(o)
      const parsed = parseBook(JSON.parse(JSON.stringify(book)))
      expect(parsed.pages[0]!.objects[0]!.margin).toEqual({ right: 2, bottom: 3 })
    })

    it('drops legacy left/top margins on parse', () => {
      const book = createBook('M')
      const o = createObject('button', 'b', { x: 10, y: 20, w: 100, h: 40 })
      book.pages[0]!.objects.push(o)
      const raw = JSON.parse(JSON.stringify(book))
      raw.pages[0].objects[0].margin = { top: 1, right: 2, bottom: 3, left: 4 }
      const parsed = parseBook(raw)
      expect(parsed.pages[0]!.objects[0]!.margin).toEqual({ right: 2, bottom: 3 })
    })

    it('a disabled margin stops growing the page but keeps its values', () => {
      const btn = createObject('button', 'go', { x: 40, y: 900, w: 100, h: 40 })
      btn.margin = { right: 10, bottom: 24 }
      btn.marginEnabled = false
      expect(marginOf(btn)).toEqual({ right: 0, bottom: 0 })
      expect(effectiveMargin(btn)).toBeUndefined()
      expect(contentExtent([btn])).toEqual({ right: 140, bottom: 940 })
      // the stored values survive for re-enabling
      expect(btn.margin).toEqual({ right: 10, bottom: 24 })
    })

    it('marginEnabled defaults to on and round-trips off', () => {
      const book = createBook('M')
      const on = createObject('button', 'a', { x: 10, y: 20, w: 100, h: 40 })
      on.margin = { right: 8 }
      const off = createObject('button', 'b', { x: 10, y: 20, w: 100, h: 40 })
      off.margin = { right: 8 }
      off.marginEnabled = false
      book.pages[0]!.objects.push(on, off)
      const parsed = parseBook(JSON.parse(JSON.stringify(book)))
      expect(parsed.pages[0]!.objects[0]!.marginEnabled).toBeUndefined()
      expect(parsed.pages[0]!.objects[1]!.marginEnabled).toBe(false)
    })

    it('createPage links a backgroundId', () => {
      const bg = createBackground('Popup', '#f0f0f0')
      const page = createPage('Dialog', bg.id)
      expect(page.backgroundId).toBe(bg.id)
      expect(page.name).toBe('Dialog')
      expect(page.objects).toEqual([])
    })

    it('round-trips a fixed page size through parse', () => {
      const book = createBook('P')
      book.pages[0]!.size = { width: 320, height: 240 }
      const parsed = parseBook(JSON.parse(JSON.stringify(book)))
      expect(parsed.pages[0]!.size).toEqual({ width: 320, height: 240 })
    })

    it('migrates a background size to fixed pages and drops the old sizing fields', () => {
      const raw = {
        id: 'b1',
        title: 'old',
        canvas: {
          desktop: { width: 1024, height: 768 },
          tablet: { width: 800, height: 600 },
        },
        backgrounds: [
          {
            id: 'bg1',
            name: 'Popup',
            color: '#ffffff',
            size: { desktop: { width: 320, height: 240 } },
            objects: [],
          },
          { id: 'bg2', name: 'Main', color: '#ffffff', objects: [] },
        ],
        pages: [
          { id: 'p1', name: 'Dialog', backgroundId: 'bg1', objects: [] },
          { id: 'p2', name: 'Other', backgroundId: 'bg2', objects: [] },
        ],
      }
      const book = parseBook(raw)
      expect(book.pages[0]!.size).toEqual({ width: 320, height: 240 })
      expect(book.pages[1]!.size).toBeUndefined()
      expect('canvas' in book).toBe(false)
      expect('design' in book).toBe(false)
      expect('size' in book.backgrounds[0]!).toBe(false)
    })
  })

  describe('groups', () => {
    it('accepts nested groups and round-trips through JSON', () => {
      const child = createObject('label', 'inner', { x: 8, y: 8, w: 100, h: 40 })
      const inner = createGroup('inner1', { x: 16, y: 16, w: 120, h: 60 }, [child])
      const outer = createGroup('group1', { x: 40, y: 40, w: 200, h: 120 }, [inner])
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
              { id: 'o1', name: 'a', control: 'label', rect: { x: 0, y: 0, w: 10, h: 10 } },
            ],
          },
        ],
      }
      expect(() => parseBook(legacy)).not.toThrow()
    })

    it('flattenObjects walks groups pre-order; treeRows annotates depth', () => {
      const a = createObject('label', 'a', { x: 0, y: 0, w: 10, h: 10 })
      const child = createObject('button', 'b', { x: 0, y: 0, w: 10, h: 10 })
      const nested = createObject('label', 'c', { x: 0, y: 0, w: 10, h: 10 })
      const inner = createGroup('g2', { x: 0, y: 0, w: 10, h: 10 }, [nested])
      const g = createGroup('g1', { x: 0, y: 0, w: 10, h: 10 }, [child, inner])
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

describe('edge constraints', () => {
  const ref = { width: 1280, height: 800 }
  const box = { width: 1000, height: 600 }
  const base = { x: 1080, y: 200, w: 176, h: 48 }

  function obj(x?: XEdge, y?: YEdge) {
    const o = createObject('button', 'b1', { ...base })
    if (x) o.x = x
    if (y) o.y = y
    return o
  }

  function rect(edge: { x?: XEdge; y?: YEdge }) {
    return rectForObject(obj(edge.x, edge.y), box)
  }

  it('resolveX / resolveY resolve each mode against the box', () => {
    expect(resolveX({ mode: 'left', left: 40, width: 100 }, 1000)).toEqual({ left: 40, width: 100 })
    expect(resolveX({ mode: 'right', right: 30, width: 100 }, 1000)).toEqual({ left: 870, width: 100 })
    expect(resolveX({ mode: 'both', left: 20, right: 30 }, 1000)).toEqual({ left: 20, width: 950 })
    expect(resolveX({ mode: 'center', width: 100 }, 1000)).toEqual({ left: 450, width: 100 })
    expect(resolveY({ mode: 'bottom', bottom: 20, height: 40 }, 600)).toEqual({ top: 540, height: 40 })
    expect(resolveY({ mode: 'both', top: 10, bottom: 20 }, 600)).toEqual({ top: 10, height: 570 })
  })

  it('margin offsets the followed edges and shifts a centred margin box', () => {
    const m = { right: 10, bottom: 7 }
    // left/top have no margin side — the distance is the whole offset
    expect(resolveX({ mode: 'left', left: 40, width: 100 }, 1000, m)).toEqual({ left: 40, width: 100 })
    expect(resolveX({ mode: 'right', right: 30, width: 100 }, 1000, m)).toEqual({ left: 860, width: 100 })
    expect(resolveX({ mode: 'both', left: 20, right: 30 }, 1000, m)).toEqual({ left: 20, width: 940 })
    // a right margin shifts the centred margin box left by half
    expect(resolveX({ mode: 'center', width: 100 }, 1000, { right: 8 })).toEqual({ left: 446, width: 100 })
    expect(resolveY({ mode: 'top', top: 12, height: 40 }, 600, m)).toEqual({ top: 12, height: 40 })
    expect(resolveY({ mode: 'bottom', bottom: 12, height: 40 }, 600, m)).toEqual({ top: 541, height: 40 })
    expect(resolveY({ mode: 'both', top: 10, bottom: 20 }, 600, m)).toEqual({ top: 10, height: 563 })
    expect(resolveY({ mode: 'center', height: 40 }, 600, { bottom: 8 })).toEqual({ top: 276, height: 40 })
  })

  it('left keeps its distance from the left and its width', () => {
    const r = rect({ x: { mode: 'left', left: 40, width: 100 } })
    expect(r).toMatchObject({ x: 40, w: 100 })
    expect(rectForObject(obj({ mode: 'left', left: 40, width: 100 }), { width: 2000, height: 600 }).x).toBe(40)
  })

  it('right keeps its distance from the right and its width', () => {
    expect(rect({ x: { mode: 'right', right: 30, width: 100 } }).x).toBe(1000 - 30 - 100)
    expect(rectForObject(obj({ mode: 'right', right: 30, width: 100 }), { width: 400, height: 600 }).x).toBe(400 - 30 - 100)
  })

  it('both keeps both margins and stretches the width', () => {
    const r = rect({ x: { mode: 'both', left: 20, right: 30 } })
    expect(r.x).toBe(20)
    expect(r.w).toBe(1000 - 50)
    expect(rectForObject(obj({ mode: 'both', left: 20, right: 30 }), { width: 2000, height: 600 }).w).toBe(2000 - 50)
  })

  it('center keeps its width and centres on the box', () => {
    const r = rect({ x: { mode: 'center', width: 100 } })
    expect(r.x).toBe((1000 - 100) / 2)
    expect(r.w).toBe(100)
  })

  it('vertical choices mirror the horizontal ones', () => {
    expect(rect({ y: { mode: 'top', top: 12, height: 40 } })).toMatchObject({ y: 12, h: 40 })
    expect(rect({ y: { mode: 'bottom', bottom: 12, height: 40 } }).y).toBe(600 - 12 - 40)
    expect(rect({ y: { mode: 'both', top: 10, bottom: 20 } }).h).toBe(600 - 30)
    expect(rect({ y: { mode: 'center', height: 40 } }).y).toBe((600 - 40) / 2)
  })

  it('writeRectPart keeps which edges a control follows', () => {
    const o = obj()
    o.x = { mode: 'right', right: 30, width: 100 }
    writeRectPart(o, 'x', 500, box)
    expect(o.x).toEqual({ mode: 'right', right: box.width - (500 + 100), width: 100 })
    // a width write on a far-edge control keeps the far edge
    writeRectPart(o, 'w', 200, box)
    expect(o.x).toMatchObject({ mode: 'right', width: 200 })

    const both = obj()
    both.x = { mode: 'both', left: 20, right: 30 }
    writeRectPart(both, 'x', 120, box)
    expect(both.x).toEqual({ mode: 'both', left: 120, right: -70 })
    // a width write on a follows-both control switches it to a fixed left size
    writeRectPart(both, 'w', 200, box)
    expect(both.x).toEqual({ mode: 'left', left: 120, width: 200 })

    const centred = obj()
    centred.x = { mode: 'center', width: 100 }
    writeRectPart(centred, 'x', 300, box)
    expect(centred.x).toEqual({ mode: 'left', left: 300, width: 100 })
  })

  it('xEdgeFromRect / yEdgeFromRect rebuild a rect into any mode', () => {
    expect(xEdgeFromRect({ x: 20, y: 0, w: 100, h: 40 }, 1000, 'left')).toEqual({ mode: 'left', left: 20, width: 100 })
    expect(xEdgeFromRect({ x: 20, y: 0, w: 100, h: 40 }, 1000, 'right')).toEqual({ mode: 'right', right: 880, width: 100 })
    expect(xEdgeFromRect({ x: 20, y: 0, w: 100, h: 40 }, 1000, 'both')).toEqual({ mode: 'both', left: 20, right: 880 })
    expect(yEdgeFromRect({ x: 0, y: 30, w: 10, h: 40 }, 600, 'bottom')).toEqual({ mode: 'bottom', bottom: 530, height: 40 })
  })

  it('xEdgeFromRect / yEdgeFromRect subtract the margin so a write round-trips', () => {
    const m = { right: 10, bottom: 7 }
    const r = { x: 40, y: 12, w: 100, h: 40 }
    expect(xEdgeFromRect(r, 1000, 'left', m)).toEqual({ mode: 'left', left: 40, width: 100 })
    expect(xEdgeFromRect(r, 1000, 'right', m)).toEqual({ mode: 'right', right: 850, width: 100 })
    expect(xEdgeFromRect(r, 1000, 'both', m)).toEqual({ mode: 'both', left: 40, right: 850 })
    expect(yEdgeFromRect(r, 600, 'top', m)).toEqual({ mode: 'top', top: 12, height: 40 })
    expect(yEdgeFromRect(r, 600, 'bottom', m)).toEqual({ mode: 'bottom', bottom: 541, height: 40 })
  })

  it('a rect read back through applyRectToObject keeps the margin (no double count)', () => {
    const o = obj({ mode: 'right', right: 30, width: 100 }, { mode: 'bottom', bottom: 12, height: 40 })
    o.margin = { right: 10, bottom: 7 }
    const r = rectForObject(o, box)
    expect(r).toMatchObject({ x: 860, y: 541 })
    applyRectToObject(o, { x: r.x - 50, y: r.y - 20, w: r.w, h: r.h }, box)
    expect(o.x).toEqual({ mode: 'right', right: 80, width: 100 })
    expect(o.y).toEqual({ mode: 'bottom', bottom: 32, height: 40 })
    expect(o.margin).toEqual({ right: 10, bottom: 7 })
    expect(rectForObject(o, box)).toMatchObject({ x: 810, y: 521 })
  })

  it('a disabled margin is ignored by rectForObject and applyRectToObject', () => {
    const o = obj({ mode: 'right', right: 30, width: 100 }, { mode: 'bottom', bottom: 12, height: 40 })
    o.margin = { right: 10, bottom: 7 }
    expect(rectForObject(o, box)).toMatchObject({ x: 860, y: 541 })
    o.marginEnabled = false
    expect(rectForObject(o, box)).toMatchObject({ x: 870, y: 548 })
    applyRectToObject(o, { x: 500, y: 200, w: 100, h: 40 }, box)
    expect(o.x).toEqual({ mode: 'right', right: 400, width: 100 })
    expect(o.y).toEqual({ mode: 'bottom', bottom: 360, height: 40 })
    expect(rectForObject(o, box)).toMatchObject({ x: 500, y: 200 })
  })

  it('scaleEdges scales the margin too', () => {
    const o = obj({ mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 12, height: 40 })
    o.margin = { right: 10, bottom: 7 }
    scaleEdges(o, 2, 3)
    expect(o.margin).toEqual({ right: 20, bottom: 21 })
  })

  it('scaleEdges scales distances and sizes for every mode', () => {
    const left = obj({ mode: 'left', left: 40, width: 100 })
    scaleEdges(left, 2, 3)
    expect(left.x).toEqual({ mode: 'left', left: 80, width: 200 })
    expect(left.y).toMatchObject({ mode: 'top', top: base.y * 3, height: base.h * 3 })

    const right = obj({ mode: 'right', right: 30, width: 100 })
    scaleEdges(right, 0.5, 1)
    expect(right.x).toEqual({ mode: 'right', right: 15, width: 50 })

    const both = obj({ mode: 'both', left: 20, right: 30 })
    scaleEdges(both, 2, 1)
    expect(both.x).toEqual({ mode: 'both', left: 40, right: 60 })

    const centred = obj({ mode: 'center', width: 100 })
    scaleEdges(centred, 2, 1)
    expect(centred.x).toEqual({ mode: 'center', width: 200 })
  })

  it('scaleEdges clamps a scaled size to at least 1px', () => {
    const o = obj({ mode: 'left', left: 0, width: 1 })
    scaleEdges(o, 0.1, 1)
    expect(o.x).toEqual({ mode: 'left', left: 0, width: 1 })
  })

  it('scaleSubtreeEdges recurses into nested groups', () => {
    const child = createObject('label', 'inner', { x: 10, y: 10, w: 100, h: 40 })
    const inner = createGroup('g2', { x: 20, y: 20, w: 120, h: 60 }, [child])
    const outer = createGroup('g1', { x: 40, y: 40, w: 200, h: 120 }, [inner])
    scaleSubtreeEdges(outer, 2, 2)
    expect(outer.x).toMatchObject({ mode: 'left', left: 80, width: 400 })
    expect(outer.children![0]!.x).toMatchObject({ mode: 'left', left: 40, width: 240 })
    expect(outer.children![0]!.children![0]!.x).toMatchObject({ mode: 'left', left: 20, width: 200 })
  })

  it('applyRectToObject preserves the current mode by default', () => {
    const o = obj({ mode: 'right', right: 30, width: 100 })
    applyRectToObject(o, { x: 100, y: 0, w: 100, h: 40 }, box)
    expect(o.x).toEqual({ mode: 'right', right: box.width - 200, width: 100 })
  })

  it('migrates rect + fit to frozen edge distances at the reference size', () => {
    const legacy = (fit: Record<string, string>) => ({
      id: 'b',
      title: 't',
      canvas: { desktop: ref },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [{ id: 'o', name: 'o', control: 'label', rect: { ...base }, props: {}, on: {}, fit }],
        },
      ],
    })
    const left = parseBook(legacy({ x: 'left', y: 'top' })).pages[0]!.objects[0]!
    expect(left.x).toEqual({ mode: 'left', left: 1080, width: 176 })
    expect(left.y).toEqual({ mode: 'top', top: 200, height: 48 })
    const right = parseBook(legacy({ x: 'right', y: 'pin-bottom' })).pages[0]!.objects[0]!
    expect(right.x).toEqual({ mode: 'right', right: 24, width: 176 })
    expect(right.y).toEqual({ mode: 'bottom', bottom: 552, height: 48 })
    const fill = parseBook(legacy({ x: 'fill', y: 'fill' })).pages[0]!.objects[0]!
    expect(fill.x).toEqual({ mode: 'both', left: 1080, right: 24 })
    expect(fill.y).toEqual({ mode: 'both', top: 200, bottom: 552 })
    // proportional stretch collapses to the near edge (nearest fixed equivalent)
    const stretch = parseBook(legacy({ x: 'stretch', y: 'stretch' })).pages[0]!.objects[0]!
    expect(stretch.x).toEqual({ mode: 'left', left: 1080, width: 176 })
    expect(stretch.y).toEqual({ mode: 'top', top: 200, height: 48 })
    const center = parseBook(legacy({ x: 'center', y: 'center' })).pages[0]!.objects[0]!
    expect(center.x).toEqual({ mode: 'center', width: 176 })
    expect(center.y).toEqual({ mode: 'center', height: 48 })
    // legacy tokens prop/middle upgrade first
    const tokens = parseBook(legacy({ x: 'prop', y: 'middle' })).pages[0]!.objects[0]!
    expect(tokens.x).toEqual({ mode: 'left', left: 1080, width: 176 })
    expect(tokens.y).toEqual({ mode: 'center', height: 48 })
    // no fit at all -> fixed left/top
    const plain = parseBook({
      id: 'b',
      title: 't',
      canvas: { desktop: ref },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [{ id: 'o', name: 'o', control: 'label', rect: { ...base }, props: {}, on: {} }],
        },
      ],
    }).pages[0]!.objects[0]!
    expect(plain.x).toEqual({ mode: 'left', left: 1080, width: 176 })
  })

  it('migrates legacy rects.desktop and drops rects', () => {
    const book = parseBook({
      id: 'b',
      title: 't',
      canvas: { desktop: ref },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [
            {
              id: 'o',
              name: 'o',
              control: 'label',
              rects: { desktop: { ...base }, tablet: { x: 1, y: 1, w: 10, h: 10 } },
              props: {},
              on: {},
            },
          ],
        },
      ],
    })
    const o = book.pages[0]!.objects[0]!
    expect('rects' in o).toBe(false)
    expect(o.x).toEqual({ mode: 'left', left: 1080, width: 176 })
  })

  it('round-trips constraints through parse', () => {
    const parsed = safeParseBook({
      id: 'b',
      title: 't',
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [
            {
              id: 'o',
              name: 'o',
              control: 'label',
              x: { mode: 'right', right: 24, width: 176 },
              y: { mode: 'both', top: 10, bottom: 20 },
              props: {},
              on: {},
            },
          ],
        },
      ],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data!.pages[0]!.objects[0]!.x).toEqual({ mode: 'right', right: 24, width: 176 })
    expect(parsed.data!.pages[0]!.objects[0]!.y).toEqual({ mode: 'both', top: 10, bottom: 20 })
  })

  it('rejects an invalid edge mode on parse', () => {
    const parsed = safeParseBook({
      id: 'b',
      title: 't',
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [
            { id: 'o', name: 'o', control: 'label', x: { mode: 'sideways', left: 0, width: 10 }, y: { mode: 'top', top: 0, height: 10 }, props: {}, on: {} },
          ],
        },
      ],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('selection align / distribute / match', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }
  const b = { x: 120, y: 40, w: 80, h: 60 }
  const c = { x: 60, y: 200, w: 40, h: 20 }
  const rects = [a, b, c]

  it('aligns to the selection bounding box per edge/center', () => {
    expect(alignRects(rects, 'left').map((r) => r.x)).toEqual([0, 0, 0])
    expect(alignRects(rects, 'right').map((r) => r.x)).toEqual([100, 120, 160])
    expect(alignRects(rects, 'centerX').map((r) => r.x)).toEqual([50, 60, 80])
    expect(alignRects(rects, 'top').map((r) => r.y)).toEqual([0, 0, 0])
    expect(alignRects(rects, 'bottom').map((r) => r.y)).toEqual([170, 160, 200])
    expect(alignRects(rects, 'centerY').map((r) => r.y)).toEqual([85, 80, 100])
  })

  it('centerBlockRects translates the whole block onto the page center', () => {
    const out = centerBlockRects(rects, { width: 400, height: 400 })
    expect(out).toEqual([
      { x: 100, y: 90, w: 100, h: 50 },
      { x: 220, y: 130, w: 80, h: 60 },
      { x: 160, y: 290, w: 40, h: 20 },
    ])
    // the block's own center lands on the page center
    const box = unionRects(out)
    expect(box.x + box.w / 2).toBe(200)
    expect(box.y + box.h / 2).toBe(200)
  })

  it('distributeRects spaces centers evenly, keeping the outer two fixed', () => {
    const out = distributeRects(rects, 'x')
    expect(out.map((r) => r.x)).toEqual([0, 120, 85])
    expect(out[0]).toEqual(a)
    expect(out[1]).toEqual(b)
    const centers = out.map((r) => r.x + r.w / 2).sort((p, q) => p - q)
    expect(centers[1]! - centers[0]!).toBeCloseTo(centers[2]! - centers[1]!, 5)
    const vy = distributeRects(rects, 'y')
    expect(vy[0]!.y).toBe(0)
    expect(vy[2]!.y).toBe(200)
    expect(vy[1]!.y).toBe(88)
  })

  it('distribute is a no-op below three rects', () => {
    expect(distributeRects([a, b], 'x')).toEqual([a, b])
  })

  it('matchSizeRects targets the largest dimension', () => {
    expect(matchSizeRects(rects, 'w').map((r) => r.w)).toEqual([100, 100, 100])
    expect(matchSizeRects(rects, 'h').map((r) => r.h)).toEqual([60, 60, 60])
    const both = matchSizeRects(rects, 'both')
    expect(both.map((r) => [r.w, r.h])).toEqual([[100, 60], [100, 60], [100, 60]])
  })
})

describe('start page', () => {
  it('round-trips startPageId through parseBook', () => {
    const book = createBook('Start')
    book.pages.push(createPage('Second', book.backgrounds[0]!.id))
    book.startPageId = book.pages[1]!.id
    expect(parseBook(JSON.parse(JSON.stringify(book))).startPageId).toBe(book.pages[1]!.id)
  })

  it('resolves the start page index, falling back to the first page', () => {
    const book = createBook('Start')
    book.pages.push(createPage('Second', book.backgrounds[0]!.id))
    expect(resolveStartPageIndex(book)).toBe(0)
    book.startPageId = book.pages[1]!.id
    expect(resolveStartPageIndex(book)).toBe(1)
    book.startPageId = 'page_missing'
    expect(resolveStartPageIndex(book)).toBe(0)
  })
})

describe('randomImageUrl', () => {
  it('defaults to a seeded picsum photo at 600x400', () => {
    const url = randomImageUrl()
    expect(url).toMatch(/^https:\/\/picsum\.photos\/seed\/[\w-]+\/600\/400$/)
  })

  it('sizes the image to the given dimensions', () => {
    expect(randomImageUrl(320, 240, 'picsum')).toMatch(/\/320\/240$/)
    const di = randomImageUrl(320, 240, 'dummyimage')
    expect(di).toMatch(/^https:\/\/dummyimage\.com\/320x240\//)
    expect(di).toContain('&text=')
  })

  it('falls back to sane sizes for junk dimensions', () => {
    expect(randomImageUrl(0, -5)).toMatch(/\/600\/400$/)
  })

  it('produces a readable dummyimage placeholder (colour + encoded label)', () => {
    const url = randomImageUrl(600, 400, 'dummyimage')
    expect(url).toMatch(/^https:\/\/dummyimage\.com\/600x400\/[0-9a-f]{6}\/[0-9a-f]{6}&text=\w+$/)
  })

  it('varies the URL on every call (cache-busting nonce)', () => {
    // picsum is seeded, so two calls almost never collide
    const a = new Set()
    for (let i = 0; i < 20; i++) a.add(randomImageUrl(600, 400, 'picsum'))
    expect(a.size).toBeGreaterThan(1)
  })

  it('exposes the providers the UI offers', () => {
    expect(IMAGE_PROVIDERS).toEqual(['picsum', 'dummyimage'])
  })
})

