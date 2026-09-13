import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, createBook, createObject, type Book } from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import { getObjectRects, isGroupKey, listenForEditor, renderBook, renderBookPage, renderObjectInto, shouldToggleRun } from './index'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

function key(key: string, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, code, ...init })
}

describe('runtime', () => {
  it('renders the sample book into positioned objects', () => {
    const root = document.createElement('div')
    const pageRoot = renderBook(sampleBook(), root)

    expect(pageRoot.className).toBe('tb-page')
    const objects = pageRoot.querySelectorAll<HTMLElement>('.tb-object')
    expect(objects).toHaveLength(2)

    const button = root.querySelector('button.tb-button')
    expect(button?.textContent).toBe('Click me')

    const first = objects[0] as HTMLElement
    expect(first.style.left).toBe('96px')
    expect(first.style.top).toBe('96px')
    expect(first.style.width).toBe('480px')
    expect(first.style.height).toBe('56px')
  })

  it('renders a placeholder for controls without renderers', () => {
    const root = document.createElement('div')
    const unregistered = {
      ...createObject('image', 'pic', { x: 0, y: 0, w: 100, h: 100 }),
      control: 'wombat',
    } as never
    const pageRoot = renderObjectInto(root, unregistered, 'desktop')
    expect(pageRoot.querySelector('.tb-missing')?.textContent).toContain('wombat')
  })

  it('collects object rects relative to the page root', () => {
    const root = document.createElement('div')
    const pageRoot = renderBook(sampleBook(), root)
    const rects = getObjectRects(pageRoot)
    const ids = Object.keys(rects)
    expect(ids).toHaveLength(2)
    for (const id of ids) {
      expect(rects[id]).toHaveProperty('w')
      expect(rects[id]).toHaveProperty('h')
    }
  })

  it('handshakes with the editor over postMessage', () => {
    const sent: Array<{ type: string }> = []
    const send = (msg: { type: string }) => sent.push(msg)
    const root = document.createElement('div')
    document.body.appendChild(root)

    const cleanup = listenForEditor(root, send)
    try {
      expect(sent[0]).toEqual({ type: 'toolback:ready' })

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book: sampleBook() } }),
      )
      expect(root.querySelector('button.tb-button')).not.toBeNull()
      expect(sent.some((m) => m.type === 'toolback:rects')).toBe(true)
    } finally {
      cleanup()
      root.remove()
    }
  })

  describe('run-toggle shortcut', () => {
    it('classifies F3 and ⌥3, rejects plain 3, other modifiers and repeats', () => {
      expect(shouldToggleRun(key('F3', 'F3'))).toBe(true)
      expect(shouldToggleRun(key('£', 'Digit3', { altKey: true }))).toBe(true)
      expect(shouldToggleRun(key('3', 'Digit3'))).toBe(false)
      expect(shouldToggleRun(key('³', 'Digit3', { shiftKey: true, altKey: true }))).toBe(false)
      expect(shouldToggleRun(key('Digit3', 'Digit3', { ctrlKey: true, altKey: true }))).toBe(false)
      expect(shouldToggleRun(key('Ω', 'KeyE', { altKey: true }))).toBe(false)
      expect(shouldToggleRun(key('F3', 'F3', { repeat: true }))).toBe(false)
    })

    it('toggles on ⌥3 even in editable targets, like F3', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      const onInput = new KeyboardEvent('keydown', {
        key: '£',
        code: 'Digit3',
        altKey: true,
        bubbles: true,
      })
      Object.defineProperty(onInput, 'target', { value: input })
      expect(shouldToggleRun(onInput)).toBe(true)

      const f3InInput = new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true })
      Object.defineProperty(f3InInput, 'target', { value: input })
      expect(shouldToggleRun(f3InInput)).toBe(true)

      input.remove()
    })

    it('the canvas forwards run-toggle keys to the editor, including editable ⌥3', () => {
      const sent: Array<{ type: string }> = []
      const send = (msg: { type: string }) => sent.push(msg)
      const root = document.createElement('div')
      document.body.appendChild(root)
      const input = document.createElement('input')
      document.body.appendChild(input)

      const cleanup = listenForEditor(root, send)
      try {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: '£', code: 'Digit3', altKey: true, bubbles: true }),
        )
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(1)

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3' }))
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(2)

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true }))
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(3)
      } finally {
        cleanup()
        root.remove()
        input.remove()
      }
    })
  })

  describe('store streaming', () => {
    function tinyBook(): Book {
      const obj = createObject('button', 'btn', { x: 0, y: 0, w: 100, h: 40 }, { text: 'x' })
      obj.on = { click: `store.set('n', 5)` }
      return {
        id: 'b',
        title: 'T',
        canvas: { desktop: { width: 400, height: 300 } },
        backgrounds: [BG],
        pages: [
          {
            id: 'p',
            name: 'P',
            script: `function pageEnter() { store.set('seed', 1) }`,
            backgroundId: 'bg1',
            objects: [obj],
          },
        ],
      }
    }

    it('streams store entries while running and clears them on design load', () => {
      const sent: Array<{ type: string; entries?: Array<[string, unknown]> }> = []
      const send = (msg: { type: string; entries?: Array<[string, unknown]> }) => sent.push(msg)
      const root = document.createElement('div')
      document.body.appendChild(root)

      const cleanup = listenForEditor(root, send)
      try {
        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'toolback:load', book: tinyBook(), design: false } }),
        )
        expect(sent.filter((m) => m.type === 'toolback:store').at(-1)?.entries).toContainEqual(['seed', 1])

        root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
        expect(sent.filter((m) => m.type === 'toolback:store').at(-1)?.entries).toEqual(
          expect.arrayContaining([
            ['seed', 1],
            ['n', 5],
          ]),
        )

        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'toolback:load', book: tinyBook(), design: true } }),
        )
        expect(sent.filter((m) => m.type === 'toolback:store').at(-1)?.entries).toEqual([])
      } finally {
        cleanup()
        root.remove()
      }
    })

    it('design loads resolve {{key}} labels against the book store (design-time preview)', () => {
      const sent: Array<{ type: string; entries?: Array<[string, unknown]> }> = []
      const send = (msg: { type: string; entries?: Array<[string, unknown]> }) => sent.push(msg)
      const root = document.createElement('div')
      document.body.appendChild(root)
      const obj = createObject('label', 'lbl', { x: 0, y: 0, w: 100, h: 40 })
      obj.props = { text: 'Score: {{score}} / {{missing}}' }
      const book: Book = {
        id: 'b',
        title: 'T',
        canvas: { desktop: { width: 400, height: 300 } },
        backgrounds: [BG],
        store: [['score', 3]],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [obj] }],
      }

      const cleanup = listenForEditor(root, send)
      try {
        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
        )
        const labels = [...root.querySelectorAll('.tb-label')].map((el) => el.textContent)
        expect(labels[0]).toBe('Score: 3 / ')
      } finally {
        cleanup()
        root.remove()
      }
    })

    it('store values stream to the editor: usable values raw, functions as labels', () => {
      const sent: Array<{ type: string; entries?: Array<[string, unknown]> }> = []
      const send = (msg: { type: string; entries?: Array<[string, unknown]> }) => sent.push(msg)
      const root = document.createElement('div')
      document.body.appendChild(root)
      const obj = createObject('label', 'lbl', { x: 0, y: 0, w: 100, h: 40 })
      const book: Book = {
        id: 'b2',
        title: 'T',
        canvas: { desktop: { width: 400, height: 300 } },
        backgrounds: [BG],
        pages: [
          {
            id: 'p',
            name: 'P',
            script: [
              `function pageEnter() {`,
              `  store.set('num', 42)`,
              `  store.set('text', 'hi')`,
              `  store.set('list', [1, 2])`,
              `  store.set('missing', undefined)`,
              `  store.set('fn', function greet() {})`,
              `}`,
            ].join('\n'),
            backgroundId: 'bg1',
            objects: [obj],
          },
        ],
      }
      const cleanup = listenForEditor(root, send)
      try {
        window.dispatchEvent(
          new MessageEvent('message', { data: { type: 'toolback:load', book, design: false } }),
        )
        const entries = sent.filter((m) => m.type === 'toolback:store').at(-1)?.entries ?? []
        // cloneable values arrive verbatim (the editor can copy them to design)
        expect(entries).toContainEqual(['num', 42])
        expect(entries).toContainEqual(['text', 'hi'])
        expect(entries).toContainEqual(['list', [1, 2]])
        expect(entries).toContainEqual(['missing', undefined])
        // functions can't cross postMessage — they arrive as a label sentinel
        expect(entries).toContainEqual(['fn', { ['__tbLabel']: 'ƒ greet' }])
      } finally {
        cleanup()
        root.remove()
      }
    })
  })

  describe('group shortcut', () => {
    it('classifies ⌥G as group, ⌥U as ungroup, rejects other alt keys and modifiers', () => {
      expect(isGroupKey(key('g', 'KeyG', { altKey: true }))).toBe('group')
      expect(isGroupKey(key('u', 'KeyU', { altKey: true }))).toBe('ungroup')
      expect(isGroupKey(key('d', 'KeyD', { altKey: true }))).toBeNull()
      expect(isGroupKey(key('g', 'KeyG', { altKey: true, ctrlKey: true }))).toBeNull()
      expect(isGroupKey(key('g', 'KeyG', { altKey: true, metaKey: true }))).toBeNull()
      expect(isGroupKey(key('g', 'KeyG', { altKey: true, shiftKey: true }))).toBeNull()
      expect(isGroupKey(key('g', 'KeyG'))).toBeNull()
    })

    it('ignores ⌥G/⌥U while typing in editable targets', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      const g = new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', altKey: true, bubbles: true })
      Object.defineProperty(g, 'target', { value: input })
      expect(isGroupKey(g)).toBeNull()
      const u = new KeyboardEvent('keydown', { key: 'u', code: 'KeyU', altKey: true, bubbles: true })
      Object.defineProperty(u, 'target', { value: input })
      expect(isGroupKey(u)).toBeNull()

      const notInput = new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', altKey: true, bubbles: true })
      Object.defineProperty(notInput, 'target', { value: document.body })
      expect(isGroupKey(notInput)).toBe('group')
      input.remove()
    })
  })

  describe('responsive glue at render time', () => {
    /** a mini book: one page on a default book → 1280x800 desktop */
    type FMX = 'free' | 'left' | 'center' | 'right' | 'stretch'
    type FMY = 'free' | 'top' | 'center' | 'bottom' | 'stretch'
    function fitBook(fit?: { x?: FMX; y?: FMY }) {
      const book = createBook('fit')
      const menu = createObject(
        'button',
        'menu',
        { x: 1080, y: 24, w: 176, h: 48 },
        { text: 'Menu' },
      )
      if (fit) menu.fit = fit
      book.pages[0]!.objects.push(menu)
      return book
    }

    function firstObjectStyle(book: Book, bp: 'desktop' | 'tablet' | 'mobile') {
      const root = document.createElement('div')
      renderBookPage(book, 0, root, bp)
      const el = root.querySelector<HTMLElement>('.tb-object')!
      return {
        left: parseInt(el.style.left),
        top: parseInt(el.style.top),
        width: parseInt(el.style.width),
        height: parseInt(el.style.height),
      }
    }

    it('default (free/free) keeps desktop px on mobile', () => {
      const style = firstObjectStyle(fitBook(), 'mobile')
      expect(style.left).toBe(1080)
      expect(style.top).toBe(24)
      expect(firstObjectStyle(fitBook({ x: 'free', y: 'free' }), 'mobile').left).toBe(1080)
    })

    it('left keeps the left proportion on mobile', () => {
      const style = firstObjectStyle(fitBook({ x: 'left' }), 'mobile')
      expect(style.left).toBe(Math.round(1080 * (390 / 1280)))
    })

    it('right keeps the right proportion on mobile (the gap scales)', () => {
      const style = firstObjectStyle(fitBook({ x: 'right' }), 'mobile')
      // desktop gap to the right edge was 24; it scales with the page
      expect(style.left).toBe(Math.round((1080 + 176) * (390 / 1280)) - 176)
      expect(Math.abs(390 - (style.left + style.width) - 24 * (390 / 1280))).toBeLessThanOrEqual(1)
    })

    it('center centers horizontally on mobile', () => {
      const style = firstObjectStyle(fitBook({ x: 'center' }), 'mobile')
      expect(style.left).toBe((390 - 176) / 2)
    })

    it('stretch grows width with the page on a wider canvas', () => {
      const book = createBook('fit')
      const bar = createObject(
        'container',
        'bar',
        { x: 0, y: 0, w: 1280, h: 40 },
      )
      bar.fit = { x: 'stretch' }
      book.pages[0]!.objects.push(bar)
      book.canvas.desktop = { width: 1280, height: 800 }
      book.canvas.tablet = { width: 1920, height: 1024 }
      const root = document.createElement('div')
      renderBookPage(book, 0, root, 'tablet')
      const el = root.querySelector<HTMLElement>('.tb-object')!
      expect(parseInt(el.style.width)).toBe(Math.round(1280 * (1920 / 1280)))
    })

    it('at the base size the authored position is used', () => {
      const style = firstObjectStyle(fitBook({ x: 'right' }), 'desktop')
      expect(style.left).toBe(1080)
    })

    it('stretching a group scales its members', () => {
      const book = createBook('fit')
      const button = createObject('button', 'member', { x: 10, y: 10, w: 100, h: 40 })
      const group = createObject('group', 'g1', { x: 0, y: 0, w: 200, h: 60 })
      group.fit = { x: 'stretch' }
      group.children = [button]
      book.pages[0]!.objects.push(group)
      book.canvas.desktop = { width: 1280, height: 800 }
      book.canvas.tablet = { width: 640, height: 1024 }
      const root = document.createElement('div')
      renderBookPage(book, 0, root, 'tablet')
      const member = root.querySelector<HTMLElement>('.tb-group [data-tb-id]')!
      // group scales 200 → 200·(640/1280) = 100; fx = 100/200 = 0.5
      const fx = (200 * (640 / 1280)) / 200
      expect(parseInt(member.style.left)).toBe(Math.round(10 * fx))
      expect(parseInt(member.style.width)).toBe(Math.max(1, Math.round(100 * fx)))
    })

    it('a glued group lenses its box and its members ride without scaling', () => {
      const book = createBook('fit')
      const ok = createObject('button', 'ok', { x: 10, y: 10, w: 80, h: 40 })
      const cancel = createObject('button', 'cancel', { x: 110, y: 10, w: 80, h: 40 })
      const group = createObject('group', 'g1', { x: 600, y: 100, w: 200, h: 100 })
      group.fit = { x: 'right' }
      group.children = [ok, cancel]
      book.pages[0]!.objects.push(group)
      const root = document.createElement('div')
      renderBookPage(book, 0, root, 'mobile')
      const groupEl = root.querySelector<HTMLElement>('.tb-object')!
      // right, proportional: (600+200)·390/1280 − 200 = 44
      expect(parseInt(groupEl.style.left)).toBe(Math.round((600 + 200) * (390 / 1280)) - 200)
      const members = root.querySelectorAll<HTMLElement>('.tb-group [data-tb-id]')
      // non-stretch glue: members keep their authored relative positions
      expect(parseInt(members[0]!.style.left)).toBe(10)
      expect(parseInt(members[1]!.style.left)).toBe(110)
    })

    it('a non-stretch glued group lenses its box; members ride at their authore size', () => {
      const book = createBook('fit')
      const member = createObject('button', 'm', { x: 10, y: 10, w: 100, h: 40 })
      const group = createObject('group', 'g1', { x: 0, y: 0, w: 200, h: 60 })
      group.fit = { x: 'center' }
      group.children = [member]
      book.pages[0]!.objects.push(group)
      const root = document.createElement('div')
      renderBookPage(book, 0, root, 'tablet')
      const memberEl = root.querySelector<HTMLElement>('.tb-group [data-tb-id]')!
      // non-stretch: the member keeps its authored relative box
      expect(parseInt(memberEl.style.left)).toBe(10)
      expect(parseInt(memberEl.style.width)).toBe(100)
    })

    it('background objects glue to the edge too', () => {
      const book = createBook('fit')
      const nav = createObject('button', 'nav', { x: 1200, y: 0, w: 80, h: 40 })
      nav.fit = { x: 'right' }
      book.backgrounds[0]!.objects.push(nav)
      const root = document.createElement('div')
      renderBookPage(book, 0, root, 'mobile')
      const all = root.querySelectorAll<HTMLElement>('.tb-object')
      // both page (none here) and background objects render — find the nav
      const navEl = Array.from(all).find((el) => el.dataset.tbName === 'nav')!
      // desktop right edge was 1280 → scales to the mobile right edge (390)
      expect(parseInt(navEl.style.left)).toBe(390 - 80)
    })
  })
})
