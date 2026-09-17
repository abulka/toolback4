import { describe, expect, it } from 'vitest'
import { createBook, createObject, type Book, type XEdge, type YEdge } from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import { getObjectRects, isCopyKey, isCutKey, isGroupKey, isPasteKey, listenForEditor, renderBook, renderBookPage, renderObjectInto, shouldToggleRun } from './index'

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
    const pageRoot = renderObjectInto(root, unregistered)
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

  it('applies the fluid wrapper class before measuring rects (fixed → fluid navigation)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const fluidAtRects: boolean[] = []
    const send = (msg: { type: string }) => {
      if (msg.type !== 'toolback:rects') return
      const wrapper = root.querySelector('.tb-canvas-root')
      fluidAtRects.push(!!wrapper?.classList.contains('tb-canvas-root--fluid'))
    }
    const cleanup = listenForEditor(root, send)
    const book = (id: string, fixed: boolean): Book =>
      ({
        id,
        title: 't',
        backgrounds: [BG],
        pages: [
          {
            id: `${id}_p`,
            name: 'P',
            script: '',
            backgroundId: 'bg1',
            ...(fixed ? { size: { width: 400, height: 300 } } : {}),
            objects: [],
          },
        ],
      }) as Book
    try {
      // a fixed page first, then a fluid one: the rects sent on the fluid load
      // must already have been measured against the full-width fluid wrapper
      // (otherwise right/bottom-anchored objects measure against a collapsed
      // root and render offset until the next navigation)
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'toolback:load', book: book('fx', true), design: true } }))
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'toolback:load', book: book('fl', false), design: true } }))
      expect(fluidAtRects).toEqual([false, true])
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

  describe('edge constraints at render time', () => {
    const L: XEdge = { mode: 'left', left: 1080, width: 176 }
    const R: XEdge = { mode: 'right', right: 24, width: 176 }
    const BOTH: XEdge = { mode: 'both', left: 1080, right: 24 }
    const CX: XEdge = { mode: 'center', width: 176 }
    const T: YEdge = { mode: 'top', top: 24, height: 48 }
    const BOT: YEdge = { mode: 'bottom', bottom: 24, height: 48 }
    const BY: YEdge = { mode: 'both', top: 24, bottom: 24 }
    const CY: YEdge = { mode: 'center', height: 48 }

    function edgeBook(x: XEdge, y: YEdge, control = 'button') {
      const book = createBook('fit')
      const menu = createObject(control as never, 'menu', { x: 1080, y: 24, w: 176, h: 48 })
      menu.x = x
      menu.y = y
      book.pages[0]!.objects.push(menu)
      return book
    }

    function firstStyle(book: Book, container?: { width: number; height: number }) {
      const root = document.createElement('div')
      renderBookPage(book, 0, root, container)
      const el = root.querySelector<HTMLElement>('.tb-object')!
      return {
        left: el.style.left,
        right: el.style.right,
        top: el.style.top,
        bottom: el.style.bottom,
        width: el.style.width,
        height: el.style.height,
      }
    }

    it('renders left + top as fixed near-edge distances', () => {
      expect(firstStyle(edgeBook(L, T))).toMatchObject({
        left: '1080px',
        top: '24px',
        width: '176px',
        height: '48px',
      })
    })

    it('renders right + bottom as fixed far-edge distances', () => {
      expect(firstStyle(edgeBook(R, BOT))).toMatchObject({
        right: '24px',
        bottom: '24px',
        width: '176px',
        height: '48px',
      })
    })

    it('renders follows-both as both margins (stretches, no size)', () => {
      const s = firstStyle(edgeBook(BOTH, BY))
      expect(s.left).toBe('1080px')
      expect(s.right).toBe('24px')
      expect(s.top).toBe('24px')
      expect(s.bottom).toBe('24px')
      expect(s.width).toBe('')
      expect(s.height).toBe('')
    })

    it('renders centred with calc offsets', () => {
      expect(firstStyle(edgeBook(CX, CY))).toMatchObject({
        left: 'calc(50% - 88px)',
        width: '176px',
        top: 'calc(50% - 24px)',
        height: '48px',
      })
    })

    it('a right/bottom margin grows the page past a near-edge control', () => {
      const book = edgeBook(L, T)
      book.pages[0]!.objects[0]!.margin = { right: 10, bottom: 24 }
      expect(firstStyle(book)).toMatchObject({ left: '1080px', top: '24px', width: '176px' })
      const root = document.createElement('div')
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      // extent.right = 1080 + 176 + 10; extent.bottom = 24 + 48 + 24
      expect(page.style.minWidth).toBe('1266px')
      expect(page.style.minHeight).toBe('96px')
    })

    it('a disabled margin neither offsets nor grows the page', () => {
      const book = edgeBook(L, T)
      const o = book.pages[0]!.objects[0]!
      o.margin = { right: 10, bottom: 24 }
      o.marginEnabled = false
      // values kept, but the control sits flush to the constraint
      expect(o.margin).toEqual({ right: 10, bottom: 24 })
      expect(firstStyle(book)).toMatchObject({ left: '1080px', top: '24px', width: '176px' })
      const root = document.createElement('div')
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      expect(page.style.minWidth).toBe('1256px')
      expect(page.style.minHeight).toBe('72px')
      // no margin advertised for the design overlay, so no shaded bands
      expect(root.querySelector<HTMLElement>('.tb-object')?.dataset.tbMargin).toBeUndefined()
    })

    it('a centred control’s margin shifts its margin box by half', () => {
      const book = edgeBook(CX, CY)
      book.pages[0]!.objects[0]!.margin = { right: 8, bottom: 8 }
      expect(firstStyle(book)).toMatchObject({
        left: 'calc(50% - 92px)',
        top: 'calc(50% - 28px)',
      })
    })

    it('a far-edge margin offsets the control but does not grow the page', () => {
      const book = edgeBook(R, BOT)
      book.pages[0]!.objects[0]!.margin = { right: 10, bottom: 24 }
      expect(firstStyle(book)).toMatchObject({ right: '34px', bottom: '48px' })
      const root = document.createElement('div')
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      expect(page.style.minWidth).toBe('0px')
      expect(page.style.minHeight).toBe('0px')
    })

    it('a fluid page fills the container and grows to the near-edge content extent', () => {
      const root = document.createElement('div')
      renderBookPage(edgeBook(L, T), 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      expect(page.style.width).toBe('100%')
      expect(page.style.height).toBe('100%')
      expect(page.style.minWidth).toBe('1256px')
      expect(page.style.minHeight).toBe('72px')
    })

    it('a fixed page keeps its declared size', () => {
      const root = document.createElement('div')
      const book = edgeBook(L, T)
      book.pages[0]!.size = { width: 360, height: 420 }
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      expect(page.style.width).toBe('360px')
      expect(page.style.height).toBe('420px')
    })

    it('a bottom/right control sits inside the page and does not grow it', () => {
      const root = document.createElement('div')
      renderBookPage(edgeBook(R, BOT), 0, root, { width: 800, height: 600 })
      const page = root.querySelector<HTMLElement>('.tb-page')!
      expect(page.style.minWidth).toBe('0px')
      expect(page.style.minHeight).toBe('0px')
    })

    it('renders group members relative to the group box without scaling', () => {
      const book = createBook('fit')
      const member = createObject('button', 'm', { x: 10, y: 10, w: 100, h: 40 })
      member.x = { mode: 'both', left: 10, right: 10 }
      const group = createObject('group', 'g1', { x: 100, y: 0, w: 200, h: 60 })
      group.x = { mode: 'both', left: 100, right: 100 }
      group.children = [member]
      book.pages[0]!.objects.push(group)
      const root = document.createElement('div')
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const groupEl = root.querySelector<HTMLElement>('.tb-object')!
      expect(groupEl.style.left).toBe('100px')
      expect(groupEl.style.right).toBe('100px')
      const memberEl = root.querySelector<HTMLElement>('.tb-group [data-tb-id]')!
      // follows-both stretches with the group box; no JS scaling
      expect(memberEl.style.left).toBe('10px')
      expect(memberEl.style.right).toBe('10px')
      expect(memberEl.style.width).toBe('')
    })

    it('background objects carry their own edges too', () => {
      const book = createBook('fit')
      const nav = createObject('button', 'nav', { x: 1200, y: 0, w: 80, h: 40 })
      nav.x = R
      book.backgrounds[0]!.objects.push(nav)
      const root = document.createElement('div')
      renderBookPage(book, 0, root, { width: 800, height: 600 })
      const navEl = Array.from(root.querySelectorAll<HTMLElement>('.tb-object')).find(
        (el) => el.dataset.tbName === 'nav',
      )!
      expect(navEl.style.right).toBe('24px')
    })
  })

  describe('clipboard shortcut', () => {
    it('classifies ⌘C/⌘X/⌘V (and Ctrl) as copy/cut/paste, rejects other keys', () => {
      expect(isCopyKey(key('c', 'KeyC', { metaKey: true }))).toBe(true)
      expect(isCopyKey(key('c', 'KeyC', { ctrlKey: true }))).toBe(true)
      expect(isCutKey(key('x', 'KeyX', { metaKey: true }))).toBe(true)
      expect(isCutKey(key('x', 'KeyX', { ctrlKey: true }))).toBe(true)
      expect(isPasteKey(key('v', 'KeyV', { metaKey: true }))).toBe(true)
      expect(isCopyKey(key('v', 'KeyV', { metaKey: true }))).toBe(false)
      expect(isPasteKey(key('c', 'KeyC', { metaKey: true }))).toBe(false)
      expect(isCutKey(key('c', 'KeyC', { metaKey: true }))).toBe(false)
      expect(isCopyKey(key('c', 'KeyC'))).toBe(false)
      expect(isCopyKey(key('c', 'KeyC', { altKey: true, metaKey: true }))).toBe(false)
      // shift doesn't disqualify (⌘⇧C etc. still copy)
      expect(isCopyKey(key('c', 'KeyC', { metaKey: true, shiftKey: true }))).toBe(true)
    })

    it('ignores ⌘C/⌘X/⌘V while typing in editable targets', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      const c = new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', metaKey: true, bubbles: true })
      Object.defineProperty(c, 'target', { value: input })
      expect(isCopyKey(c)).toBe(false)
      const v = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', metaKey: true, bubbles: true })
      Object.defineProperty(v, 'target', { value: input })
      expect(isPasteKey(v)).toBe(false)

      const notInput = new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', metaKey: true, bubbles: true })
      Object.defineProperty(notInput, 'target', { value: document.body })
      expect(isCopyKey(notInput)).toBe(true)
      input.remove()
    })
  })
})
