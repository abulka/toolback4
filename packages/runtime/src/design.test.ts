import { describe, expect, it } from 'vitest'
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
      const child = createObject('button', 'kid', { desktop: { x: 10, y: 10, w: 100, h: 40 } })
      const child2 = createObject('label', 'kid2', { desktop: { x: 10, y: 60, w: 100, h: 20 } })
      const group = createGroup('grp', { desktop: { x: 40, y: 40, w: 200, h: 100 } }, [child, child2])
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
      const child = createObject('button', 'kid', { desktop: { x: 10, y: 10, w: 100, h: 40 } })
      const group = createGroup('grp', { desktop: { x: 0, y: 0, w: 200, h: 100 } }, [child])
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
    const c1 = createObject('button', 'btnTop', { desktop: { x: 0, y: 0, w: 100, h: 50 } })
    const c2 = createObject('button', 'btnBottom', { desktop: { x: 100, y: 50, w: 100, h: 50 } })
    const group = createGroup('grp', { desktop: { x: 100, y: 100, w: 200, h: 100 } }, [c1, c2])
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
      const child = createObject('button', 'kid', { desktop: { x: 10, y: 10, w: 100, h: 40 } })
      const group = createGroup('grp', { desktop: { x: 40, y: 40, w: 200, h: 100 } }, [child])
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
    const btn = createObject('button', 'btn', { desktop: { x: 10, y: 30, w: 40, h: 20 } })
    const inner = createGroup('inner', { desktop: { x: 40, y: 40, w: 200, h: 100 } }, [btn])
    const outer = createGroup('outer', { desktop: { x: 0, y: 0, w: 300, h: 300 } }, [inner])
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
      const child = createObject('button', 'kid', { desktop: { x: 10, y: 10, w: 100, h: 40 } })
      const group = createGroup('grp', { desktop: { x: 40, y: 40, w: 200, h: 100 } }, [child])
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
      const navBtn = createObject('button', 'navBtn', { desktop: { x: 40, y: 40, w: 120, h: 40 } })
      const pageBtn = createObject('button', 'pageBtn', { desktop: { x: 200, y: 200, w: 120, h: 40 } })
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

