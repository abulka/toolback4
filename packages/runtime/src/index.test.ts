import { describe, expect, it } from 'vitest'
import { createObject, type Book } from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import { getObjectRects, isGroupKey, listenForEditor, renderBook, renderObjectInto, shouldToggleRun } from './index'

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
      ...createObject('image', 'pic', { desktop: { x: 0, y: 0, w: 100, h: 100 } }),
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

    it('ignores ⌥3 while typing in editable targets, still allows F3 there', () => {
      const input = document.createElement('input')
      document.body.appendChild(input)
      const onInput = new KeyboardEvent('keydown', {
        key: '£',
        code: 'Digit3',
        altKey: true,
        bubbles: true,
      })
      Object.defineProperty(onInput, 'target', { value: input })
      expect(shouldToggleRun(onInput)).toBe(false)

      const f3InInput = new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true })
      Object.defineProperty(f3InInput, 'target', { value: input })
      expect(shouldToggleRun(f3InInput)).toBe(true)

      input.remove()
    })

    it('the canvas forwards run-toggle keys to the editor, editable ⌥3 stays typed', () => {
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
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(0)

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3' }))
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(1)

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F3', code: 'F3', bubbles: true }))
        expect(sent.filter((m) => m.type === 'toolback:runToggle')).toHaveLength(2)
      } finally {
        cleanup()
        root.remove()
        input.remove()
      }
    })
  })

  describe('store streaming', () => {
    function tinyBook(): Book {
      const obj = createObject('button', 'btn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'x' })
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
      const obj = createObject('label', 'lbl', { desktop: { x: 0, y: 0, w: 100, h: 40 } })
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
      const obj = createObject('label', 'lbl', { desktop: { x: 0, y: 0, w: 100, h: 40 } })
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
})
