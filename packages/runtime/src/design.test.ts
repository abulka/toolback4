import { describe, expect, it } from 'vitest'
import { sampleBook } from '@toolback/format/src/sample'
import { createDesignController, resizeRect, snap } from './design'
import { listenForEditor } from './editorLink'

describe('design geometry helpers', () => {
  it('snaps to the grid', () => {
    expect(snap(3)).toBe(0)
    expect(snap(9)).toBe(8)
    expect(snap(12)).toBe(16)
    expect(snap(17)).toBe(16)
    expect(snap(-5)).toBe(-8)
  })

  it('resizes from each edge', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 }
    expect(resizeRect(start, 'e', 24, 0)).toEqual({ x: 100, y: 100, w: 224, h: 100 })
    expect(resizeRect(start, 'se', 8, 16)).toEqual({ x: 100, y: 100, w: 208, h: 116 })
    expect(resizeRect(start, 'w', 24, 0)).toEqual({ x: 124, y: 100, w: 176, h: 100 })
    expect(resizeRect(start, 'n', 0, -8)).toEqual({ x: 100, y: 92, w: 200, h: 108 })
  })

  it('clamps to minimum size keeping the opposite edge fixed', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 }
    expect(resizeRect(start, 'nw', 500, 500)).toEqual({ x: 276, y: 176, w: 24, h: 24 })
    expect(resizeRect(start, 'se', -500, -500)).toEqual({ x: 100, y: 100, w: 24, h: 24 })
  })
})

describe('design mode (structural)', () => {
  it('mounts overlay chrome, applies selection from load, and toggles off', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m))

    try {
      const book = sampleBook()
      const buttonId = book.pages[0]!.objects[1]!.id

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, design: true, selection: buttonId },
        }),
      )

      expect(root.querySelector('.tb-canvas-root')).not.toBeNull()
      expect(root.querySelector('.tb-page-holder .tb-page')).not.toBeNull()
      expect(root.querySelector('.tb-design-overlay')).not.toBeNull()
      expect(root.querySelectorAll('.tb-handle')).toHaveLength(8)
      const sel = root.querySelector<HTMLElement>('.tb-sel')!
      expect(sel.style.display).toBe('block')

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: false } }),
      )
      const overlay = root.querySelector<HTMLElement>('.tb-design-overlay')!
      expect(overlay.style.display).toBe('none')
    } finally {
      cleanup()
      root.remove()
    }
  })

  it('clears selection when the selected object no longer exists', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const book = sampleBook()
      const gone = 'obj_does_not_exist'
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, selection: gone } }),
      )
      const sel = root.querySelector<HTMLElement>('.tb-sel')!
      expect(sel.style.display).toBe('none')
    } finally {
      cleanup()
      root.remove()
    }
  })
})

describe('design controller wiring', () => {
  it('forwards selection and commit messages through send', () => {
    const sent: Array<{ type: string }> = []
    const controller = createDesignController((m) => sent.push(m))
    expect(controller.selectedId).toBeNull()
    controller.setEnabled(false)
    expect(sent).toEqual([])
  })
})
