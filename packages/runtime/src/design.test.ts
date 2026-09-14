import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGroup, createObject, type Book, type Rect } from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import { createDesignController, resizeRect, snap } from './design'
import { listenForEditor } from './editorLink'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

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
          data: { type: 'toolback:load', book, design: true, selection: [buttonId] },
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
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, selection: [gone] } }),
      )
      const sel = root.querySelector<HTMLElement>('.tb-sel')
      expect(sel === null || sel.style.display === 'none').toBe(true)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})

describe('palette drag ghost', () => {
  it('renders a real control ghost that follows dragOver and is removed on dragEnd', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const book = sampleBook()
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'toolback:dragOver',
            control: 'button',
            rect: { x: 64, y: 64, w: 176, h: 48 },
          },
        }),
      )
      let ghost = root.querySelector<HTMLElement>('.tb-ghost')
      expect(ghost).not.toBeNull()
      expect(ghost!.querySelector('button.tb-button')).not.toBeNull()
      expect(ghost!.style.left).toBe('64px')
      expect(ghost!.style.width).toBe('176px')

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'toolback:dragOver',
            control: 'button',
            rect: { x: 128, y: 96, w: 176, h: 48 },
          },
        }),
      )
      expect(root.querySelectorAll('.tb-ghost')).toHaveLength(1)
      ghost = root.querySelector<HTMLElement>('.tb-ghost')
      expect(ghost!.style.left).toBe('128px')
      expect(ghost!.style.top).toBe('96px')

      window.dispatchEvent(new MessageEvent('message', { data: { type: 'toolback:dragEnd' } }))
      expect(root.querySelector('.tb-ghost')).toBeNull()

      // ghost is wiped by any re-render too
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:dragOver', control: 'card', rect: { x: 0, y: 0, w: 100, h: 100 } },
        }),
      )
      expect(root.querySelector('.tb-ghost .tb-card')).not.toBeNull()
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )
      expect(root.querySelector('.tb-ghost')).toBeNull()
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})

describe('multi-select, marquee and groups', () => {
  it('shift-click builds a multi-selection; dragging moves all with one batched commit', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[]; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = sampleBook()
      const [a, b] = book.pages[0]!.objects.map((o) => o.id)
      load(root, book)
      // sampleBook: helloLabel at 96,96 (480×56), myButton at 96,184 (176×48)

      pointer(root, 'pointerdown', 200, 120) // press on the label
      pointer(root, 'pointerup', 200, 120)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([a])

      pointer(root, 'pointerdown', 150, 200, { shiftKey: true }) // shift-press on the button
      pointer(root, 'pointerup', 150, 200)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([a, b])

      // drag both from the button: +48,+48
      pointer(root, 'pointerdown', 150, 200)
      pointer(root, 'pointermove', 198, 248)
      pointer(root, 'pointerup', 198, 248)

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      expect(commit.objects).toHaveLength(2)
      const byId = Object.fromEntries(commit.objects.map((o) => [o.id, o.rect]))
      expect(byId[a]).toEqual({ x: 144, y: 144, w: 480, h: 56 })
      expect(byId[b]).toEqual({ x: 144, y: 232, w: 176, h: 48 })
    } finally {
      cleanup()
      root.remove()
    }
  })

  it('marquee on empty canvas selects intersecting top-level objects; shift adds', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = sampleBook()
      const [a, b] = book.pages[0]!.objects.map((o) => o.id)
      load(root, book)

      pointer(root, 'pointerdown', 700, 500) // empty corner
      pointer(root, 'pointermove', 0, 0) // sweep over both objects
      pointer(root, 'pointerup', 0, 0)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([a, b])

      // shift-marquee keeps the previous selection and adds nothing new
      pointer(root, 'pointerdown', 700, 500, { shiftKey: true })
      pointer(root, 'pointermove', 700, 520)
      pointer(root, 'pointerup', 700, 520)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([a, b])

      // tiny marquee (no movement) changes nothing — but the plain marquee-down
      // already cleared the selection
      pointer(root, 'pointerdown', 700, 500)
      pointer(root, 'pointerup', 700, 500)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([])
    } finally {
      cleanup()
      root.remove()
    }
  })

it('clicking a member selects the group; alt-click and double-click enter it', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const child = createObject('button', 'kid', { x: 10, y: 10, w: 100, h: 40 })
      const child2 = createObject('label', 'kid2', { x: 10, y: 60, w: 100, h: 20 })
      const group = createGroup('grp', { x: 40, y: 40, w: 200, h: 100 }, [child, child2])
      const book: Book = {
        id: 'bg',
        title: 'G',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
      }
      load(root, book)

      // child sits at 50,50 (40,40 group + 10,10 rel); click inside it
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([group.id])

      // alt-click descends to the member
      pointer(root, 'pointerdown', 60, 60, { altKey: true })
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([child.id])

      // double-click enters too
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      overlayOf(root).dispatchEvent(new MouseEvent('dblclick', { clientX: 60, clientY: 60, bubbles: true }))
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([child.id])

      // while entered, clicking the OTHER member selects it (stay in member mode)
      pointer(root, 'pointerdown', 60, 110)
      pointer(root, 'pointerup', 60, 110)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([child2.id])

      // clicking empty space exits: next gentle click on a member selects the GROUP
      pointer(root, 'pointerdown', 700, 500)
      pointer(root, 'pointerup', 700, 500)
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([group.id])

      // two gentle clicks (no concerted dblclick) never drill in
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([group.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

it('resizing a group scales member rects around the fixed corner (batched commit)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const child = createObject('button', 'kid', { x: 10, y: 10, w: 100, h: 40 })
      const group = createGroup('grp', { x: 0, y: 0, w: 200, h: 100 }, [child])
      const book: Book = {
        id: 'bg',
        title: 'G',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
      }
      load(root, book)
      const groupId = group.id
      const childId = child.id

      // select the group, then grab the se handle at (200,100) and drag +40/+40
      pointer(root, 'pointerdown', 100, 50)
      pointer(root, 'pointerup', 100, 50)
      const handle = overlayOf(root).querySelector<HTMLElement>('.tb-handle[data-dir="se"]')!
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 100, button: 0, bubbles: true }))
      overlayOf(root).dispatchEvent(
        new MouseEvent('pointermove', { clientX: 240, clientY: 140, bubbles: true }),
      )
      handle.dispatchEvent(new MouseEvent('pointerup', { clientX: 240, clientY: 140, bubbles: true }))

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      const byId = Object.fromEntries(commit.objects.map((o) => [o.id, o.rect]))
      expect(byId[groupId]).toEqual({ x: 0, y: 0, w: 240, h: 140 })
      // fx = 240/200 = 1.2, fy = 140/100 = 1.4
      expect(byId[childId]).toEqual({ x: 12, y: 14, w: 120, h: 56 })
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  function stackedGroupBook(): { book: Book; groupId: string; c1: string; c2: string } {
    const c1 = createObject('button', 'btnTop', { x: 0, y: 0, w: 100, h: 50 })
    const c2 = createObject('button', 'btnBottom', { x: 100, y: 50, w: 100, h: 50 })
    const group = createGroup('grp', { x: 100, y: 100, w: 200, h: 100 }, [c1, c2])
    const book: Book = {
      id: 'bg',
      title: 'G',
      canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
    }
    return { book, groupId: group.id, c1: c1.id, c2: c2.id }
  }

  it('resizing from the W handle keeps members inside the box, fixed right edge', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const { book, groupId, c1, c2 } = stackedGroupBook()
      load(root, book)

      pointer(root, 'pointerdown', 150, 120) // select the group
      pointer(root, 'pointerup', 150, 120)
      const handle = overlayOf(root).querySelector<HTMLElement>('.tb-handle[data-dir="w"]')!
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 150, button: 0, bubbles: true }))
      overlayOf(root).dispatchEvent(
        new MouseEvent('pointermove', { clientX: 140, clientY: 150, bubbles: true }),
      )

      // mid-drag: the layout box is untouched — only the CSS transform scales
      const gEl = root.querySelector<HTMLElement>('[data-tb-name="grp"]')!
      expect(gEl.style.width).toBe('200px')
      expect(gEl.style.transform).toContain('scale(0.8')

      handle.dispatchEvent(new MouseEvent('pointerup', { clientX: 140, clientY: 150, bubbles: true }))

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      const byId = Object.fromEntries(commit.objects.map((o) => [o.id, o.rect]))
      // ghost: x 100→140, w 200→160 (fx 0.8, fy 1), fixed edge = right (300)
      expect(byId[groupId]).toEqual({ x: 140, y: 100, w: 160, h: 100 })
      expect(byId[c1]).toEqual({ x: 140, y: 100, w: 80, h: 50 })
      expect(byId[c2]).toEqual({ x: 220, y: 150, w: 80, h: 50 })
      // every member inside the ghost, and the union is exactly the ghost
      for (const id of [groupId, c1, c2]) {
        const r = byId[id]!
        expect(r.x).toBeGreaterThanOrEqual(140)
        expect(r.x + r.w).toBeLessThanOrEqual(300)
      }
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('resizing from the N handle scales heights around the fixed bottom edge', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const { book, groupId, c1, c2 } = stackedGroupBook()
      load(root, book)

      pointer(root, 'pointerdown', 150, 120)
      pointer(root, 'pointerup', 150, 120)
      const handle = overlayOf(root).querySelector<HTMLElement>('.tb-handle[data-dir="n"]')!
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, clientY: 100, button: 0, bubbles: true }))
      overlayOf(root).dispatchEvent(
        new MouseEvent('pointermove', { clientX: 100, clientY: 164, bubbles: true }),
      )
      handle.dispatchEvent(new MouseEvent('pointerup', { clientX: 160, clientY: 164, bubbles: true }))

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      const byId = Object.fromEntries(commit.objects.map((o) => [o.id, o.rect]))
      // ghost: y 100→164 (8px snap), h 100→36 (fy 0.36, fx 1), fixed edge = bottom (200)
      expect(byId[groupId]).toEqual({ x: 100, y: 164, w: 200, h: 36 })
      expect(byId[c1]).toEqual({ x: 100, y: 164, w: 100, h: 18 })
      expect(byId[c2]).toEqual({ x: 200, y: 182, w: 100, h: 18 })
      for (const id of [groupId, c1, c2]) {
        const r = byId[id]!
        expect(r.y).toBeGreaterThanOrEqual(160)
        expect(r.y + r.h).toBeLessThanOrEqual(200)
      }
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('a selected member moves individually: the group stays put', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[]; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const child = createObject('button', 'kid', { x: 10, y: 10, w: 100, h: 40 })
      const group = createGroup('grp', { x: 40, y: 40, w: 200, h: 100 }, [child])
      const book: Book = {
        id: 'bg',
        title: 'G',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
      }
      load(root, book)

      // enter the group (alt-click selects the member), then drag it +48/+0
      pointer(root, 'pointerdown', 60, 60, { altKey: true })
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([child.id])

      pointer(root, 'pointerdown', 60, 60) // plain press on the member (already selected)
      pointer(root, 'pointermove', 108, 60)
      pointer(root, 'pointerup', 108, 60)

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(child.id)
      // member moved +48 in page coords; the group commit is absent
      expect(commit.objects[0]!.rect).toEqual({ x: 98, y: 50, w: 100, h: 40 })

      // the member's DOM position is parent-relative and actually moved
      const rel = root.querySelector<HTMLElement>('[data-tb-name="kid"]')!.style.left
      expect(rel).toBe('58px')
      // the group wrapper never moved
      const gw = root.querySelector<HTMLElement>('[data-tb-name="grp"]')!.style.left
      expect(gw).toBe('40px')
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('the selection outline follows objects while dragging', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = sampleBook()
      const a = book.pages[0]!.objects[0]!.id
      load(root, book, [a])

      pointer(root, 'pointerdown', 200, 120)
      pointer(root, 'pointermove', 248, 168)
      pointer(root, 'pointerup', 248, 248)

      const box = root.querySelector<HTMLElement>('.tb-sel')!
      expect(box.style.left).toBe('144px')
      expect(box.style.top).toBe('144px')
      expect(box.style.width).toBe('480px')
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('canvas keydowns forward reorder + delete in design mode only', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; action?: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = sampleBook()
      load(root, book, [book.pages[0]!.objects[0]!.id])

      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'BracketRight', key: ']', metaKey: true }),
      )
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'BracketLeft', key: '[', metaKey: true, shiftKey: true }),
      )
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
      expect(sent.filter((m) => m.type === 'toolback:reorder').map((m) => m.action)).toEqual([
        'forward',
        'back',
      ])
      expect(sent.some((m) => m.type === 'toolback:deleteSelection')).toBe(true)

      // in run mode neither reorder nor delete forwards
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: false } }),
      )
      const before = sent.length
      window.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'BracketRight', key: ']', metaKey: true }),
      )
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
      expect(sent.length).toBe(before)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})

describe('nested group drill-in', () => {
  function nestedBook(): Book {
    const btn = createObject('button', 'btn', { x: 10, y: 30, w: 40, h: 20 })
    const inner = createGroup('inner', { x: 40, y: 40, w: 200, h: 100 }, [btn])
    const outer = createGroup('outer', { x: 0, y: 0, w: 300, h: 300 }, [inner])
    return {
      id: 'bn',
      title: 'N',
      canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [outer] }],
    }
  }
  // btn sits at page (50, 70)
  const BTN = { x: 55, y: 75 }

  function dbl(root: HTMLElement): void {
    overlayOf(root).dispatchEvent(new MouseEvent('dblclick', { clientX: BTN.x, clientY: BTN.y, bubbles: true }))
  }

  it('repeated double-clicks descend one level at a time to the target member', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const [outer] = book.pages[0]!.objects
      const inner = outer!.children![0]!
      const btn = inner.children![0]!
      load(root, book)

      dbl(root)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer!.id])
      dbl(root)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])
      dbl(root)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([btn.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('dragging a drilled member moves only that member, not the outer group', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[]; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const btn = book.pages[0]!.objects[0]!.children![0]!.children![0]!
      load(root, book)

      // drill all the way down: 3 double-clicks select the member
      for (let i = 0; i < 3; i++) dbl(root)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([btn.id])

      // plain press-and-drag on the member moves ONLY the member
      pointer(root, 'pointerdown', BTN.x, BTN.y)
      pointer(root, 'pointermove', BTN.x + 48, BTN.y)
      pointer(root, 'pointerup', BTN.x + 48, BTN.y)

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(btn.id)
      expect(commit.objects[0]!.rect).toEqual({ x: 98, y: 70, w: 40, h: 20 })
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('a gentle click after drilling keeps the drilled group selected', () => {
    // user scenario: double-clicking over a member selects the sub-group; a
    // follow-up gentle click on a deeper button must NOT drill further
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const inner = book.pages[0]!.objects[0]!.children![0]!
      load(root, book)

      dbl(root) // selects the outer group
      dbl(root) // descends past it: selects the inner group
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])

      // a gentle click on the member point keeps the INNER group selected
      pointer(root, 'pointerdown', BTN.x, BTN.y)
      pointer(root, 'pointerup', BTN.x, BTN.y)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('dragging a drilled sub-group moves only that sub-group', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[]; objects?: Array<{ id: string; rect: Rect }> }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const inner = book.pages[0]!.objects[0]!.children![0]!
      load(root, book)

      dbl(root)
      dbl(root) // inner group selected
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])

      pointer(root, 'pointerdown', BTN.x, BTN.y)
      pointer(root, 'pointermove', BTN.x + 48, BTN.y)
      pointer(root, 'pointerup', BTN.x + 48, BTN.y)
      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(inner.id)
      expect(commit.objects[0]!.rect).toEqual({ x: 88, y: 40, w: 200, h: 100 })
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('Escape steps out one level at a time and ignores the outermost selection', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const [outer] = book.pages[0]!.objects
      const inner = outer!.children![0]!
      load(root, book)

      for (let i = 0; i < 3; i++) dbl(root)
      expect(selectionMsgs(sent).at(-1)!.ids).not.toEqual([])

      const esc = (): void => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      }
      esc()
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])
      esc()
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer!.id])
      // at the outermost level Esc is ignored — it never deselects
      esc()
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer!.id])
      esc()
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer!.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('a sync re-load restores the drilled context from the selection', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const inner = book.pages[0]!.objects[0]!.children![0]!
      const btn = inner.children![0]!
      load(root, book)

      // alt-click fast-drills to the member
      pointer(root, 'pointerdown', BTN.x, BTN.y, { altKey: true })
      pointer(root, 'pointerup', BTN.x, BTN.y)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([btn.id])

      // editor sync re-renders with the member selected (as if after a commit)
      load(root, book, [btn.id])

      // the context survived: the gentle click keeps the member selected
      pointer(root, 'pointerdown', BTN.x, BTN.y)
      pointer(root, 'pointerup', BTN.x, BTN.y)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([btn.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('single-level dblclick from a selected group reaches the member in one dblclick', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const child = createObject('button', 'kid', { x: 10, y: 10, w: 100, h: 40 })
      const group = createGroup('grp', { x: 40, y: 40, w: 200, h: 100 }, [child])
      const book: Book = {
        id: 'bg',
        title: 'G',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
      }
      load(root, book)

      // gentle click selects the group; one dblclick then reaches the member
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([group.id])

      overlayOf(root).dispatchEvent(new MouseEvent('dblclick', { clientX: 60, clientY: 60, bubbles: true }))
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([child.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('background objects on a page are locked: clicks report toolback:bgClick, not selection', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const navBtn = createObject('button', 'navBtn', { x: 40, y: 40, w: 120, h: 40 })
      const pageBtn = createObject('button', 'pageBtn', { x: 200, y: 200, w: 120, h: 40 })
      const book: Book = {
        id: 'bg',
        title: 'G',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [
          {
            id: 'bg1',
            name: 'Background 1',
            color: '#ffffff',
            script: '',
            objects: [navBtn],
          },
        ],
        pages: [
          { id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [pageBtn] },
        ],
      }
      load(root, book, [pageBtn.id])

      // click squarely on the background's navBtn: hint sent, never selected
      pointer(root, 'pointerdown', 60, 60)
      pointer(root, 'pointerup', 60, 60)
      expect(sent.some((m) => m.type === 'toolback:bgClick')).toBe(true)
      // navBtn appears in no selection message (the empty click deselects,
      // which is the ordinary marquee behaviour)
      for (const sel of selectionMsgs(sent)) expect(sel.ids).not.toContain(navBtn.id)

      // a click on empty space also avoids selecting the locked object
      const bgClicks = sent.filter((m) => m.type === 'toolback:bgClick').length
      pointer(root, 'pointerdown', 700, 500)
      pointer(root, 'pointerup', 700, 500)
      expect(sent.filter((m) => m.type === 'toolback:bgClick')).toHaveLength(bgClicks)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('marquee at the drilled level selects direct members of the drilled group', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const inner = book.pages[0]!.objects[0]!.children![0]!
      load(root, book)

      // descend into the outer group (inner group is selected, drilled one level)
      dbl(root)
      dbl(root)

      // sweep a marquee over the inner group, starting from outer's empty area
      pointer(root, 'pointerdown', 280, 280)
      pointer(root, 'pointermove', 20, 20)
      pointer(root, 'pointerup', 20, 20)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})

function absRect(el: HTMLElement): DOMRect {
    let x = 0
    let y = 0
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
      if (node.classList?.contains('tb-object')) {
        x += parseFloat(node.style.left) || 0
        y += parseFloat(node.style.top) || 0
      }
      if (node.classList?.contains('tb-page')) break
    }
    const px = (s: string): number => parseFloat(s) || 0
    const w = px(el.style.width)
    const h = px(el.style.height)
    return {
      left: x,
      top: y,
      width: w,
      height: px(el.style.height),
      right: x + w,
      bottom: y + px(el.style.height),
      x,
      y,
      toJSON: () => ({}),
    } as DOMRect
  }

  function zeroRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      width: 1280,
      height: 800,
      right: 1280,
      bottom: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }

  let savedGBCR: ((this: HTMLElement) => DOMRect) | null = null

  /** fake layout: wrapper/overlay at (0,0), objects at their style positions */
  function patchRects(): void {
    if (savedGBCR) return
    savedGBCR = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement): DOMRect {
      if (this.dataset?.tbId) return absRect(this)
      const cls = this.classList
      if (cls?.contains('tb-canvas-root') || cls?.contains('tb-design-overlay')) return zeroRect()
      return savedGBCR!.call(this)
    }
  }

  function unpatchRects(): void {
    if (!savedGBCR) return
    HTMLElement.prototype.getBoundingClientRect = savedGBCR
    savedGBCR = null
  }

  function load(root: HTMLElement, book: Book, selection: string[] = []): void {
    patchRects()
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'toolback:load', book, design: true, selection },
      }),
    )
  }

  function overlayOf(root: HTMLElement): HTMLElement {
    return root.querySelector<HTMLElement>('.tb-design-overlay')!
  }

  function pointer(
    root: HTMLElement,
    type: string,
    x: number,
    y: number,
    init: PointerEventInit = {},
  ): void {
    const target = root.querySelector<HTMLElement>('.tb-design-overlay')!
    target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, ...init }))
  }

  function selectionMsgs(sent: Array<{ type: string; ids?: string[] }>): Array<{ ids: string[] }> {
    return sent.filter((m) => m.type === 'toolback:selection') as Array<{ ids: string[] }>
  }


function reads(): unknown {
  return 0
}

describe('design mode — clip indicators', () => {
  it('draws a clip outline for objects sticking out of the page', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    // happy-dom has no layout engine — make getBoundingClientRect derive
    // geometry from the inline styles the renderer sets (position/size)
    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLStyleElement & HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }

    try {
      // an 800x600 book with one object partially off the bottom edge
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'o', name: 'o', control: 'button', rect: { x: 100, y: 580, w: 1200, h: 100 }, props: { text: 'x' }, on: {} },
            ],
          },
        ],
      } as unknown as Book

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )

      // the object's visible part inside the page is outlined; fully off-page
      // objects get nothing (unreachable anyway — the status chip counts them)
      const clip = root.querySelector<HTMLElement>('.tb-clip')
      expect(clip).not.toBeNull()
      expect(clip!.style.display).toBe('block')
      // clip box = the visible overlap (clamped to the page, width 800-100)
      expect(parseInt(clip!.style.width)).toBe(700)
      expect(parseInt(clip!.style.height)).toBe(20)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })

  it('draws glue springs for objects with real constraints (right+bottom, not default left/top)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }

    try {
      // an 800x600 book; one right+top-glued button, explicitly selected
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              {
                id: 'o',
                name: 'o',
                control: 'button',
                rect: { x: 700, y: 100, w: 100, h: 50 },
                props: { text: 'x' },
                on: {},
                fit: { x: 'right', y: 'bottom' },
              },
            ],
          },
        ],
      } as unknown as Book

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, selection: ['o'] } }),
      )

      const hint = root.querySelector<HTMLElement>('.tb-fithint')
      expect(hint).not.toBeNull()
      // horizontal: a line from the object's right edge (800) to the page edge,
      // plus a tick at the page edge = 2 line/tick elements or more
      const lines = Array.from(hint!.querySelectorAll<HTMLElement>('.tb-fithint-line'))
      // the right spring collapses to a stub (object flush with the page edge)
      expect(lines.length).toBeGreaterThanOrEqual(1)
      // right spring: object's right edge (800) == page width (800) — the
      // coil collapses to a stub, so the anchor square carries the edge
      const anchors = Array.from(hint!.querySelectorAll<HTMLElement>('.tb-fithint-anchor'))
      expect(anchors.length).toBe(2) // right edge + bottom edge anchors
      expect(anchors.some((a) => parseFloat(a.style.left) > 790)).toBe(true)
      // bottom spring: a zigzag coil SVG at the object's center x=750 from
      // its bottom (150) down to the page height (600)
      const springs = Array.from(hint!.querySelectorAll<SVGElement>('svg.tb-fithint-spring'))
      const vSpring = springs.find((s) => Math.abs(parseFloat(s.style.left) - 745) < 1)!
      expect(parseFloat(vSpring.style.height)).toBeCloseTo(600 - 150 + 10, 0)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })

  it('absolutely positions every hint shape so its inline left/top take effect', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }

    try {
      // x: center draws two coils; y: bottom draws a coil
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              {
                id: 'o',
                name: 'o',
                control: 'button',
                rect: { x: 320, y: 100, w: 160, h: 50 },
                props: { text: 'x' },
                on: {},
                fit: { x: 'center', y: 'bottom' },
              },
            ],
          },
        ],
      } as unknown as Book

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )

      const hint = root.querySelector<HTMLElement>('.tb-fithint')!
      // Regression: the spring <svg> and stub line used to default to
      // `position: static`, which silently ignores left/top — the shapes
      // collapsed to the page corner while only the anchors stayed on the edge.
      const shapes = [
        ...hint.querySelectorAll<HTMLElement>('svg.tb-fithint-spring'),
        ...hint.querySelectorAll<HTMLElement>('.tb-fithint-line'),
      ]
      expect(shapes.length).toBeGreaterThan(0)
      for (const el of shapes) expect(getComputedStyle(el).position).toBe('absolute')
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })

  it('draws springs for ALL constrained objects, not just the selection', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }

    try {
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'a', name: 'a', control: 'button', rect: { x: 700, y: 40, w: 100, h: 50 }, props: { text: 'a' }, on: {}, fit: { x: 'right' } },
              { id: 'b', name: 'b', control: 'label', rect: { x: 40, y: 500, w: 200, h: 40 }, props: { text: 'b' }, on: {}, fit: { y: 'bottom' } },
              { id: 'c', name: 'c', control: 'button', rect: { x: 300, y: 160, w: 100, h: 50 }, props: { text: 'c' }, on: {} }, // default — no spring
            ],
          },
        ],
      } as unknown as Book

      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )

      const hint = root.querySelector<HTMLElement>('.tb-fithint')
      expect(hint).not.toBeNull()
      // a-right spring: from x=800 to page width 800 → horizontal line at y=65
      // b-bottom spring: vertical line at x=140 from y=540 to 600
      const springs = Array.from(hint!.querySelectorAll<SVGElement>('svg.tb-fithint-spring'))
      const stubs = Array.from(hint!.querySelectorAll<HTMLElement>('.tb-fithint-line'))
      const anchors = Array.from(hint!.querySelectorAll<HTMLElement>('.tb-fithint-anchor'))
      // a-right (flush with the page edge): coil → stub + anchor
      // b-bottom: coil + anchor
      expect(stubs.length).toBe(1)
      expect(springs.length).toBe(1)
      expect(anchors.length).toBe(2)
      // c (default) contributes nothing
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })

  it('fitHints:off in the load hides all springs', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      return { left: 0, top: 0, width: 800, height: 600 } as DOMRect
    }

    try {
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'a', name: 'a', control: 'button', rect: { x: 700, y: 40, w: 100, h: 50 }, props: { text: 'a' }, on: {}, fit: { x: 'right' } },
            ],
          },
        ],
      } as unknown as Book
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, fitHints: 'off' } }),
      )
      expect(root.querySelector('.tb-fithint')).toBeNull()
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })

  it('center/middle draw two springs from both sides without a centerline', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }

    try {
      const book = {
        id: 'b',
        title: 't',
        canvas: { desktop: { width: 800, height: 600 } },
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'o', name: 'o', control: 'button', rect: { x: 320, y: 276, w: 160, h: 48 }, props: { text: 'x' }, on: {}, fit: { x: 'center', y: 'center' } },
            ],
          },
        ],
      } as unknown as Book
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )
      const hint = root.querySelector<HTMLElement>('.tb-fithint')!
      const coils = Array.from(hint.querySelectorAll<SVGElement>('svg.tb-fithint-spring'))
      const anchors = Array.from(hint.querySelectorAll<HTMLElement>('.tb-fithint-anchor'))
      // horizontal: left spring (0→320) + right spring (480→800)
      // vertical: top spring + bottom spring
      expect(coils.length).toBe(4)
      expect(anchors.length).toBe(4)
      // no centerline axis is drawn over the object
      expect(hint.querySelectorAll('.tb-fithint-axis').length).toBe(0)
      // the left spring touches the object's left edge (320)
      expect(coils.some((s) => Math.abs((parseFloat(s.style.left) + parseFloat(s.style.width)) - 320) < 6)).toBe(true)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real
      cleanup()
      root.remove()
    }
  })
})

describe('glue-spring hint modes', () => {
  let root: HTMLElement
  let real: typeof HTMLElement.prototype.getBoundingClientRect
  let cleanup: () => void

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
    cleanup = listenForEditor(root, () => {})
    real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const s = (this as HTMLElement).style ?? ({} as CSSStyleDeclaration)
      const l = parseFloat(s.left ?? '') || 0
      const t = parseFloat(s.top ?? '') || 0
      const w = parseFloat(s.width ?? '') || (this.classList?.contains?.('tb-page') ? 800 : 0)
      const h = parseFloat(s.height ?? '') || (this.classList?.contains?.('tb-page') ? 600 : 0)
      return { left: l, top: t, width: w, height: h } as DOMRect
    }
  })

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = real
    cleanup()
    root.remove()
  })

  // two glued objects plus one unglued: a → right spring (flush with the page
  // edge → stub line + anchor), b → bottom spring (zigzag + anchor), c → nothing.
  function scene(): Book {
    return {
      id: 'b',
      title: 't',
      canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          objects: [
            { id: 'a', name: 'a', control: 'button', rect: { x: 700, y: 40, w: 100, h: 50 }, props: { text: 'a' }, on: {}, fit: { x: 'right' } },
            { id: 'b', name: 'b', control: 'label', rect: { x: 40, y: 500, w: 200, h: 40 }, props: { text: 'b' }, on: {}, fit: { y: 'bottom' } },
            { id: 'c', name: 'c', control: 'button', rect: { x: 300, y: 160, w: 100, h: 50 }, props: { text: 'c' }, on: {} },
          ],
        },
      ],
    } as unknown as Book
  }

  const load = (extra: Record<string, unknown>): void => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'toolback:load', book: scene(), design: true, ...extra },
      }),
    )
  }

  function counts(): { stubs: number; springs: number; anchors: number } {
    const hint = root.querySelector<HTMLElement>('.tb-fithint')!
    return {
      stubs: hint.querySelectorAll('.tb-fithint-line').length,
      springs: hint.querySelectorAll('svg.tb-fithint-spring').length,
      anchors: hint.querySelectorAll('.tb-fithint-anchor').length,
    }
  }

  it('selected mode draws springs only for the selected object', () => {
    load({ fitHints: 'selected', selection: ['a'] })
    // only a's flush right spring: stub + anchor, no coil; b contributes nothing
    expect(counts()).toEqual({ stubs: 1, springs: 0, anchors: 1 })
  })

  it('selected mode with an empty selection draws nothing', () => {
    load({ fitHints: 'selected', selection: [] })
    expect(root.querySelector('.tb-fithint')).toBeNull()
  })

  it('explicit "all" draws springs for every glued object', () => {
    load({ fitHints: 'all' })
    expect(counts()).toEqual({ stubs: 1, springs: 1, anchors: 2 })
  })

  it('a later load with a new selection swaps which object is shown', () => {
    load({ fitHints: 'selected', selection: ['a'] })
    expect(counts()).toEqual({ stubs: 1, springs: 0, anchors: 1 })
    load({ fitHints: 'selected', selection: ['b'] })
    expect(counts()).toEqual({ stubs: 0, springs: 1, anchors: 1 })
  })

  function loadBook(fit: Record<string, string>): void {
    const book = {
      id: 'b',
      title: 't',
      canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          objects: [
            {
              id: 'o',
              name: 'o',
              control: 'button',
              rect: { x: 320, y: 276, w: 160, h: 48 },
              props: { text: 'x' },
              on: {},
              fit,
            },
          ],
        },
      ],
    } as unknown as Book
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
    )
  }

  it('edge springs are solid zigzags with square anchors and direction arrows', () => {
    load({ fitHints: 'all' })
    expect(root.querySelector('svg.tb-fithint-spring')!.classList.contains('tb-fithint-spring--edge')).toBe(true)
    expect(root.querySelector('.tb-fithint-anchor--edge')).not.toBeNull()
    // a is right-glued (arrow points left, at the object) and b is bottom-glued (up)
    expect(root.querySelector('.tb-fithint-arrow--left')).not.toBeNull()
    expect(root.querySelector('.tb-fithint-arrow--up')).not.toBeNull()
  })

  it('center draws plain dashed connector lines with circle anchors and no arrows', () => {
    loadBook({ x: 'center', y: 'center' })
    const springs = root.querySelectorAll('svg.tb-fithint-spring--center')
    expect(springs.length).toBe(4) // two per axis
    expect(root.querySelectorAll('.tb-fithint-anchor--center').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-arrow').length).toBe(0)
    // the connector is a straight segment, not a zigzag/coil
    const d = springs[0]!.querySelector('path')!.getAttribute('d')!
    expect((d.match(/ L /g) ?? []).length).toBe(1)
  })

  it('stretch draws dashed circular coils with triangle anchors', () => {
    loadBook({ x: 'stretch', y: 'stretch' })
    expect(root.querySelectorAll('svg.tb-fithint-spring--stretch').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-anchor--stretch').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-arrow').length).toBe(0)
  })
})

describe('design mode — viewer scrolling', () => {
  it('forwards a wheel over an overflowing markdown viewer to its own scroll', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    patchRects()
    try {
      const book = sampleBook()
      const obj = book.pages[0]!.objects[0]!
      obj.control = 'markdown'
      obj.props = { text: '# Hi' }
      load(root, book, [])
      const viewer = root.querySelector<HTMLElement>('.tb-page .tb-markdown')!
      expect(viewer).not.toBeNull()
      // happy-dom has no layout engine — fake a scrollable box
      Object.defineProperty(viewer, 'scrollHeight', { value: 400, configurable: true })
      Object.defineProperty(viewer, 'clientHeight', { value: 100, configurable: true })
      Object.defineProperty(viewer, 'scrollWidth', { value: 100, configurable: true })
      Object.defineProperty(viewer, 'clientWidth', { value: 100, configurable: true })

      // happy-dom's WheelEvent drops client coords — pin them on the event
      const ev = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
      Object.defineProperty(ev, 'clientX', { value: 120 })
      Object.defineProperty(ev, 'clientY', { value: 110 })
      overlayOf(root).dispatchEvent(ev)
      expect(viewer.scrollTop).toBe(50)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('leaves the wheel alone when the viewer does not overflow', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    patchRects()
    try {
      const book = sampleBook()
      const obj = book.pages[0]!.objects[0]!
      obj.control = 'markdown'
      obj.props = { text: '# Hi' }
      load(root, book, [])
      const viewer = root.querySelector<HTMLElement>('.tb-page .tb-markdown')!
      Object.defineProperty(viewer, 'scrollHeight', { value: 50, configurable: true })
      Object.defineProperty(viewer, 'clientHeight', { value: 50, configurable: true })
      const ev = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
      Object.defineProperty(ev, 'clientX', { value: 120 })
      Object.defineProperty(ev, 'clientY', { value: 110 })
      overlayOf(root).dispatchEvent(ev)
      // not cancelled → the canvas (or page) keeps the scroll
      expect(ev.defaultPrevented).toBe(false)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})
