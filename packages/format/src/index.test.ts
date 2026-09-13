import { describe, expect, it } from 'vitest'
import {
  CONTROL_KINDS,
  DEFAULT_SIZES,
  IMAGE_PROVIDERS,
  backgroundFor,
  createBook,
  createBackground,
  createGroup,
  createObject,
  createPage,
  flattenObjects,
  parseBook,
  randomImageUrl,
  rebaseRect,
  resolveObjectRect,
  resolvePageSize,
  safeParseBook,
  scaleRect,
  treeRows,
  unlensObjectRect,
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

    it('resolvePageSize: background override wins per breakpoint, else book canvas', () => {
      const book = createBook('F')
      const bg = backgroundFor(book, book.pages[0]!)
      expect(resolvePageSize(book, bg, 'desktop')).toEqual({ width: 1280, height: 800 })
      expect(resolvePageSize(book, bg, 'tablet')).toEqual({ width: 768, height: 1024 })
      bg.size = { desktop: { width: 320, height: 240 } }
      expect(resolvePageSize(book, bg, 'desktop')).toEqual({ width: 320, height: 240 })
      // tablet has no override → book canvas
      expect(resolvePageSize(book, bg, 'tablet')).toEqual({ width: 768, height: 1024 })
      // undefined background → book canvas
      expect(resolvePageSize(book, undefined, 'desktop')).toEqual({ width: 1280, height: 800 })
    })

    it('createPage links a backgroundId', () => {
      const bg = createBackground('Popup', '#f0f0f0')
      const page = createPage('Dialog', bg.id)
      expect(page.backgroundId).toBe(bg.id)
      expect(page.name).toBe('Dialog')
      expect(page.objects).toEqual([])
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

describe('resolveObjectRect (responsive glue — lens)', () => {
  // base page 1280x800, mobile page 390x844
  const ref = { width: 1280, height: 800 }
  const page = { width: 390, height: 844 }
  const base = { x: 1080, y: 200, w: 176, h: 48 }

  function obj(fit?: Record<string, string>) {
    const o = createObject('button', 'b1', { ...base })
    if (fit) o.fit = fit
    return o
  }

  function rect(fit?: Record<string, string>) {
    return resolveObjectRect(obj(fit), page, ref)
  }

  it('defaults to Free = keeps the authored px at every size', () => {
    expect(rect()).toEqual({ ...base })
    expect(rect({})).toEqual({ ...base })
    expect(rect({ x: 'free', y: 'free' })).toEqual({ ...base })
  })

  it('left keeps the left proportion (x scales with the page width)', () => {
    const r = rect({ x: 'left' })
    expect(r.x).toBe(Math.round(1080 * (390 / 1280)))
    expect(r.w).toBe(176)
  })

  it('right keeps the right proportion (the gap scales with the page width)', () => {
    const r = rect({ x: 'right' })
    expect(r.x).toBe(Math.round((1080 + 176) * (390 / 1280)) - 176)
    // authored right gap was 24 → scales to ~24 · 390/1280
    expect(Math.abs(390 - (r.x + r.w) - 24 * (390 / 1280))).toBeLessThanOrEqual(1)
  })

  it('center centers the object middle on the page axis', () => {
    const r = rect({ x: 'center' })
    expect(r.x).toBe((390 - 176) / 2)
    expect(r.x + r.w / 2).toBe(195) // page middle
  })

  it('stretch scales the size and both margins proportionally', () => {
    const wide = { width: 1920, height: 800 }
    const r = resolveObjectRect(obj({ x: 'stretch' }), wide, ref)
    expect(r.w).toBe(Math.round(176 * (1920 / 1280)))
    expect(r.x).toBe(Math.round(1080 * (1920 / 1280)))
    // on the narrower mobile page it shrinks by the same ratio
    expect(rect({ x: 'stretch' }).w).toBe(Math.max(1, Math.round(176 * (390 / 1280))))
  })

  it('vertical modes mirror horizontal math', () => {
    expect(rect({ y: 'top' }).y).toBe(Math.round(200 * (844 / 800)))
    expect(rect({ y: 'center' }).y).toBe((844 - 48) / 2)
    expect(rect({ y: 'bottom' }).y).toBe(Math.round((200 + 48) * (844 / 800)) - 48)
  })

  it('combines horizontal and vertical modes independently', () => {
    const r = rect({ x: 'right', y: 'bottom' })
    expect(r.x).toBe(Math.round((1080 + 176) * (390 / 1280)) - 176)
    expect(r.y).toBe(Math.round((200 + 48) * (844 / 800)) - 48)
  })

  it('at the base size the constrained axes are identity; only Center moves', () => {
    expect(resolveObjectRect(obj(), ref, ref)).toEqual({ ...base })
    expect(resolveObjectRect(obj({ x: 'right', y: 'bottom' }), ref, ref)).toEqual({ ...base })
    expect(resolveObjectRect(obj({ x: 'left', y: 'top' }), ref, ref)).toEqual({ ...base })
    expect(resolveObjectRect(obj({ x: 'stretch', y: 'stretch' }), ref, ref)).toEqual({ ...base })
    const centered = resolveObjectRect(obj({ x: 'center', y: 'center' }), ref, ref)
    expect(centered.x).toBe((1280 - 176) / 2)
    expect(centered.y).toBe((800 - 48) / 2)
    expect(centered.w).toBe(176) // size untouched by center
  })

  it('the authored rect is the reference data for other sizes', () => {
    const o = obj({ x: 'center' })
    o.rect = { x: 100, y: 100, w: 176, h: 48 }
    expect(resolveObjectRect(o, ref, ref).x).toBe((1280 - 176) / 2)
    expect(resolveObjectRect(o, page, ref).x).toBe((390 - 176) / 2)
  })

  it('unlensObjectRect inverts the lens back onto the base rect', () => {
    const fit = { x: 'right', y: 'bottom' } as const
    const refRect = { ...base }
    // drag to a new position at mobile; deriving the base rect then lensing it
    // forward must reproduce exactly what was dragged
    const dragged = { x: 40, y: 60, w: 176, h: 48 }
    const nextRef = unlensObjectRect(refRect, dragged, fit, page, ref)
    const round = resolveObjectRect({ ...obj(fit), rect: nextRef }, page, ref)
    expect(round).toEqual(dragged)
  })

  it('unlensObjectRect is the identity at the base size', () => {
    const refRect = { ...base }
    const dragged = { x: 40, y: 60, w: 200, h: 60 }
    expect(unlensObjectRect(refRect, dragged, { x: 'right', y: 'bottom' }, ref, ref)).toEqual(dragged)
    expect(unlensObjectRect(refRect, dragged, { x: 'stretch', y: 'stretch' }, ref, ref)).toEqual(dragged)
  })

  it('unlensObjectRect leaves a Center axis rigid on its base', () => {
    const refRect = { ...base }
    const next = unlensObjectRect(refRect, { x: 999, y: 60, w: 176, h: 48 }, { x: 'center' }, page, ref)
    expect(next.x).toBe(refRect.x) // centered has no free parameter
    expect(next.y).toBe(60)
  })

  it('round-trips fit through schema parse', () => {
    const o = obj({ x: 'right', y: 'bottom' })
    const parsed = safeParseBook({
      id: 'b',
      title: 't',
      canvas: { desktop: ref },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          backgroundId: '',
          objects: [{ ...o, props: {}, on: {} }],
        },
      ],
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data!.pages[0]!.objects[0]!.fit).toEqual({ x: 'right', y: 'bottom' })
  })

  it('migrates legacy objects: rect = rects.desktop, bp rects + fit tokens upgraded', () => {
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
          objects: [
            {
              id: 'o',
              name: 'o',
              control: 'label',
              rects: { desktop: { ...base }, tablet: { x: 1, y: 1, w: 10, h: 10 }, mobile: { x: 2, y: 2, w: 20, h: 20 } },
              props: {},
              on: {},
              fit,
            },
          ],
        },
      ],
    })
    // tablet/mobile rects are dropped, the authored layout becomes `rect`
    const a = parseBook(legacy({ x: 'left', y: 'top' }))
    expect(a.pages[0]!.objects[0]!.rect).toEqual({ ...base })
    expect('rects' in a.pages[0]!.objects[0]!).toBe(false)
    // left/top are current proportional modes and must survive a parse
    expect(a.pages[0]!.objects[0]!.fit).toEqual({ x: 'left', y: 'top' })
    const b = parseBook(legacy({ x: 'prop', y: 'prop' }))
    expect(b.pages[0]!.objects[0]!.fit).toEqual({ x: 'left', y: 'top' })
    const c = parseBook(legacy({ x: 'right', y: 'middle' }))
    expect(c.pages[0]!.objects[0]!.fit).toEqual({ x: 'right', y: 'center' })
  })

  it('rejects invalid fit modes on parse', () => {
    const parsed = safeParseBook({
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
            { id: 'o', name: 'o', control: 'label', rect: { ...base }, props: {}, on: {}, fit: { x: 'sideways' } },
          ],
        },
      ],
    })
    expect(parsed.success).toBe(false)
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

