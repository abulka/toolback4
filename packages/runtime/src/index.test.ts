import { describe, expect, it } from 'vitest'
import { createObject } from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import { getObjectRects, listenForEditor, renderBook, renderObjectInto } from './index'

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
})
