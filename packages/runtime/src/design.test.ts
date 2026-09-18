import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createGroup,
  createObject,
  DEFAULT_FIT_HINTS,
  type Book,
  type FitHintOptions,
  type PageObject,
  type Rect,
  type XEdge,
  type YEdge,
} from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import {
  badgePosition,
  scrollClampShift,
  createDesignController,
  groupOutlineIds,
  isCornerHandle,
  resizeRect,
  resizeRectAspect,
  snap,
} from './design'
import { listenForEditor } from './editorLink'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

/**
 * happy-dom has no layout engine, so tests fake getBoundingClientRect from the
 * inline styles the renderer sets. This resolves every edge-constraint shape
 * (`left`/`top`, `right`/`bottom`, `both`, `calc(50% …)`) against a containing
 * box, accumulating ancestor group offsets so members resolve inside their
 * group's box.
 */
function styleRectOf(el: HTMLElement, pageW = 800, pageH = 600): DOMRect {
  const px = (v: string): number => parseFloat(v) || 0
  const rect = (left: number, top: number, width: number, height: number): DOMRect =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  const s = el.style
  if (el.classList?.contains('tb-page')) {
    return rect(0, 0, s.width.endsWith('px') ? px(s.width) : pageW, s.height.endsWith('px') ? px(s.height) : pageH)
  }
  // containing box: the nearest ancestor object's resolved rect, else the page
  const parentObj = el.parentElement?.closest<HTMLElement>('.tb-object') ?? null
  const box = parentObj ? styleRectOf(parentObj, pageW, pageH) : rect(0, 0, pageW, pageH)
  const len = (v: string): number => (v.endsWith('px') ? px(v) : NaN)
  const wAttr = len(s.width)
  const hAttr = len(s.height)
  let width: number
  let left: number
  if (s.left !== '' && s.right !== '') {
    left = px(s.left)
    width = box.width - px(s.left) - px(s.right)
  } else if (s.left.includes('calc(50%')) {
    width = Number.isNaN(wAttr) ? 0 : wAttr
    left = (box.width - width) / 2
  } else if (s.right !== '') {
    width = Number.isNaN(wAttr) ? 0 : wAttr
    left = box.width - px(s.right) - width
  } else {
    width = Number.isNaN(wAttr) ? 0 : wAttr
    left = s.left !== '' ? px(s.left) : 0
  }
  let height: number
  let top: number
  if (s.top !== '' && s.bottom !== '') {
    top = px(s.top)
    height = box.height - px(s.top) - px(s.bottom)
  } else if (s.top.includes('calc(50%')) {
    height = Number.isNaN(hAttr) ? 0 : hAttr
    top = (box.height - height) / 2
  } else if (s.bottom !== '') {
    height = Number.isNaN(hAttr) ? 0 : hAttr
    top = box.height - px(s.bottom) - height
  } else {
    height = Number.isNaN(hAttr) ? 0 : hAttr
    top = s.top !== '' ? px(s.top) : 0
  }
  return rect(box.left + left, box.top + top, width, height)
}

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

  it('aspect resize holds the start ratio from a corner, fixing the opposite corner', () => {
    const start = { x: 100, y: 100, w: 200, h: 100 } // ratio 2:1
    // drive by width (se): w 200→248, h follows 124
    const se = resizeRectAspect(start, 'se', 48, 0)
    expect(se).toEqual({ x: 100, y: 100, w: 248, h: 124 })
    // drive by height (se): h 100→140, w follows 280
    const seH = resizeRectAspect(start, 'se', 0, 40)
    expect(seH.w).toBe(280)
    expect(seH.h).toBe(140)
    // nw keeps the bottom-right corner fixed
    const nw = resizeRectAspect(start, 'nw', -48, 0)
    expect(nw.x + nw.w).toBe(300)
    expect(nw.y + nw.h).toBe(200)
    expect(nw.w / nw.h).toBeCloseTo(2, 5)
  })

  it('isCornerHandle separates corners from edges', () => {
    expect(isCornerHandle('nw')).toBe(true)
    expect(isCornerHandle('se')).toBe(true)
    expect(isCornerHandle('n')).toBe(false)
    expect(isCornerHandle('e')).toBe(false)
  })

  it('badgePosition sits below an object when there is room', () => {
    expect(badgePosition({ x: 96, y: 96, w: 176, h: 48 }, { width: 1280, height: 800 }, { width: 60, height: 18 })).toEqual({ x: 96, y: 152 })
  })

  it('badgePosition flips above a bottom-edge object so it stays on the page', () => {
    // object flush with the 800-high page: below would be 776+8+18 > 800
    expect(badgePosition({ x: 96, y: 752, w: 176, h: 48 }, { width: 1280, height: 800 }, { width: 60, height: 18 })).toEqual({ x: 96, y: 726 })
  })

  it('badgePosition clamps inside the page on the right and bottom edges', () => {
    expect(badgePosition({ x: 1220, y: 40, w: 176, h: 48 }, { width: 1280, height: 800 }, { width: 60, height: 18 })).toEqual({ x: 1216, y: 96 })
  })

  it('badgePosition clamps to the inset when the object is off-page', () => {
    expect(badgePosition({ x: -500, y: 900, w: 176, h: 48 }, { width: 800, height: 600 }, { width: 60, height: 18 })).toEqual({ x: 4, y: 578 })
  })

  it('scrollClampShift is a no-op when the page is not scrolled', () => {
    expect(
      scrollClampShift({
        viewport: { w: 1006, h: 654 },
        scroll: { x: 0, y: 0 },
        padding: 200,
        rightFixed: 0,
        rightMoved: 780,
        bottomFixed: 0,
        bottomMoved: 0,
      }),
    ).toEqual({ dx: 0, dy: 0 })
  })

  it('scrollClampShift offsets the move by the clamped scroll so it keeps its screen spot', () => {
    // page was 1276 wide (scroll 270); the moved object now ends at 780, so the
    // page fits the 1006 viewport and the scroll clamps to 0 → nudge by -270
    expect(
      scrollClampShift({
        viewport: { w: 1006, h: 654 },
        scroll: { x: 270, y: 120 },
        padding: 200,
        rightFixed: 0,
        rightMoved: 780,
        bottomFixed: 0,
        bottomMoved: 500,
      }),
    ).toEqual({ dx: -270, dy: -120 })
  })

  it('scrollClampShift does nothing while other content still scrolls the page', () => {
    expect(
      scrollClampShift({
        viewport: { w: 1006, h: 654 },
        scroll: { x: 270, y: 0 },
        padding: 0,
        rightFixed: 2000,
        rightMoved: 780,
        bottomFixed: 0,
        bottomMoved: 0,
      }),
    ).toEqual({ dx: 0, dy: 0 })
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

  it('clips the design overlay to the page so off-page chrome cannot grow the iframe scroll area', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const book = sampleBook()
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
      )
      const overlay = root.querySelector<HTMLElement>('.tb-design-overlay')!
      // an object dragged past the page edge is clipped by .tb-page; the
      // selection outline/handles/size badge must be clipped with it, or their
      // overflow makes the iframe document scrollable into phantom space
      expect(getComputedStyle(overlay).overflow).toBe('hidden')
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

it('resizing a group commits only the group box; members are not scaled', () => {
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
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
      }
      load(root, book)
      const groupId = group.id

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
      // only the group's own box is committed — members resolve themselves
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(groupId)
      expect(commit.objects[0]!.rect).toEqual({ x: 0, y: 0, w: 240, h: 140 })
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

      // mid-drag: the layout box is untouched; a transform anchored on the
      // fixed (right) edge previews the scaled subtree
      const gEl = root.querySelector<HTMLElement>('[data-tb-name="grp"]')!
      expect(gEl.style.width).toBe('200px')
      expect(gEl.style.left).toBe('100px')
      expect(gEl.style.transform).toBe('scale(0.8, 1)')
      expect(gEl.style.transformOrigin).toBe('100% 0%')

      handle.dispatchEvent(new MouseEvent('pointerup', { clientX: 140, clientY: 150, bubbles: true }))

      const commit = sent.filter((m) => m.type === 'toolback:commit').at(-1) as unknown as {
        objects: Array<{ id: string; rect: Rect }>
      }
      // ghost: x 100→140, w 200→160 — only the group is committed
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(groupId)
      expect(commit.objects[0]!.rect).toEqual({ x: 140, y: 100, w: 160, h: 100 })
      void c1
      void c2
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('a group resize previews a corner-anchored scale', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const { book } = stackedGroupBook()
      load(root, book)

      pointer(root, 'pointerdown', 150, 120)
      pointer(root, 'pointerup', 150, 120)
      const handle = overlayOf(root).querySelector<HTMLElement>('.tb-handle[data-dir="se"]')!
      handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: 300, clientY: 200, button: 0, bubbles: true }))
      overlayOf(root).dispatchEvent(
        new MouseEvent('pointermove', { clientX: 400, clientY: 250, bubbles: true }),
      )

      const gEl = root.querySelector<HTMLElement>('[data-tb-name="grp"]')!
      // ghost 200×100 → 304×148 (8px snap), fixed top-left corner
      expect(gEl.style.transform).toBe('scale(1.52, 1.48)')
      expect(gEl.style.transformOrigin).toBe('0% 0%')
      expect(gEl.style.width).toBe('200px')
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('resizing from the N handle commits only the group box', () => {
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
      // ghost: y 100→164 (8px snap), h 100→36 — only the group is committed
      expect(commit.objects).toHaveLength(1)
      expect(commit.objects[0]!.id).toBe(groupId)
      expect(commit.objects[0]!.rect).toEqual({ x: 100, y: 164, w: 200, h: 36 })
      void c1
      void c2
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
  // these tests assert against an 800×600 page, which is now the measured
  // viewport rather than a stored breakpoint size
  let prevW = 0
  let prevH = 0
  beforeEach(() => {
    prevW = window.innerWidth
    prevH = window.innerHeight
    window.innerWidth = 800
    window.innerHeight = 600
  })
  afterEach(() => {
    window.innerWidth = prevW
    window.innerHeight = prevH
  })

  it('draws a clip outline for objects sticking out of the page', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})

    // happy-dom has no layout engine — make getBoundingClientRect derive
    // geometry from the inline styles the renderer sets (position/size)
    const real = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return styleRectOf(this)
    }

    try {
      // a fixed 800x600 dialog with one object partially off both edges. A
      // fluid page would instead grow to contain it (covered in background.test).
      const book = {
        id: 'b',
        title: 't',
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            size: { width: 800, height: 600 },
            objects: [
              { id: 'o', name: 'o', control: 'button', x: { mode: 'left', left: 100, width: 1200 }, y: { mode: 'top', top: 580, height: 100 }, props: { text: 'x' }, on: {} },
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
      // clip box = the visible overlap (clamped to the fixed page)
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
      return styleRectOf(this)
    }

    try {
      // an 800x600 book; one right+top-glued button, explicitly selected
      const book = {
        id: 'b',
        title: 't',
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
                x: { mode: 'right', right: 0, width: 100 },
                y: { mode: 'bottom', bottom: 450, height: 50 },
                props: { text: 'x' },
                on: {},
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
      return styleRectOf(this)
    }

    try {
      // x: center draws two coils; y: bottom draws a coil
      const book = {
        id: 'b',
        title: 't',
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
                x: { mode: 'center', width: 160 },
                y: { mode: 'bottom', bottom: 450, height: 50 },
                props: { text: 'x' },
                on: {},
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
      return styleRectOf(this)
    }

    try {
      const book = {
        id: 'b',
        title: 't',
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'a', name: 'a', control: 'button', x: { mode: 'right', right: 0, width: 100 }, y: { mode: 'top', top: 40, height: 50 }, props: { text: 'a' }, on: {} },
              { id: 'b', name: 'b', control: 'label', x: { mode: 'left', left: 40, width: 200 }, y: { mode: 'bottom', bottom: 60, height: 40 }, props: { text: 'b' }, on: {} },
              { id: 'c', name: 'c', control: 'button', x: { mode: 'left', left: 300, width: 100 }, y: { mode: 'top', top: 160, height: 50 }, props: { text: 'c' }, on: {} }, // default — no spring
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
      // every object draws a spring for each edge it follows:
      // a → flush right stub + top spring; b → left + bottom; c → left + top
      expect(stubs.length).toBe(1)
      expect(springs.length).toBe(5)
      expect(anchors.length).toBe(6)
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
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'a', name: 'a', control: 'button', x: { mode: 'right', right: 0, width: 100 }, y: { mode: 'top', top: 40, height: 50 }, props: { text: 'a' }, on: {} },
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
      return styleRectOf(this)
    }

    try {
      const book = {
        id: 'b',
        title: 't',
        backgrounds: [],
        pages: [
          {
            id: 'p',
            name: 'p',
            objects: [
              { id: 'o', name: 'o', control: 'button', x: { mode: 'center', width: 160 }, y: { mode: 'center', height: 48 }, props: { text: 'x' }, on: {} },
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
      return styleRectOf(this)
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
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          objects: [
            { id: 'a', name: 'a', control: 'button', x: { mode: 'right', right: 0, width: 100 }, y: { mode: 'top', top: 40, height: 50 }, props: { text: 'a' }, on: {} },
            { id: 'b', name: 'b', control: 'label', x: { mode: 'left', left: 40, width: 200 }, y: { mode: 'bottom', bottom: 60, height: 40 }, props: { text: 'b' }, on: {} },
            { id: 'c', name: 'c', control: 'button', x: { mode: 'left', left: 300, width: 100 }, y: { mode: 'top', top: 160, height: 50 }, props: { text: 'c' }, on: {} },
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
    // a: flush right stub + a top spring
    expect(counts()).toEqual({ stubs: 1, springs: 1, anchors: 2 })
  })

  it('selected mode with an empty selection draws nothing', () => {
    load({ fitHints: 'selected', selection: [] })
    expect(root.querySelector('.tb-fithint')).toBeNull()
  })

  it('explicit "all" draws springs for every edge of every object', () => {
    load({ fitHints: 'all' })
    expect(counts()).toEqual({ stubs: 1, springs: 5, anchors: 6 })
  })

  it('labels each spring with the edge word and its pixel distance', () => {
    load({ fitHints: 'all' })
    const labels = [...root.querySelectorAll<HTMLElement>('.tb-fithint-label')].map((e) => e.textContent)
    expect(labels).toEqual(
      expect.arrayContaining(['top 40', 'left 40', 'bottom 60', 'left 300', 'top 160']),
    )
    // a flush (0 px) distance is the default that skipZeroLabels hides
    expect(labels).not.toContain('right 0')
  })

  it('draws springs inside groups, measured against the group box', () => {
    const book = {
      id: 'b',
      title: 't',
      backgrounds: [],
      pages: [
        {
          id: 'p',
          name: 'p',
          objects: [
            {
              id: 'g',
              name: 'g',
              control: 'group',
              x: { mode: 'left', left: 100, width: 200 },
              y: { mode: 'top', top: 100, height: 100 },
              props: {},
              on: {},
              children: [
                {
                  id: 'm',
                  name: 'm',
                  control: 'button',
                  x: { mode: 'left', left: 10, width: 40 },
                  y: { mode: 'top', top: 10, height: 20 },
                  props: { text: 'm' },
                  on: {},
                },
              ],
            },
          ],
        },
      ],
    } as unknown as Book
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'toolback:load', book, design: true } }),
    )
    const labels = [...root.querySelectorAll<HTMLElement>('.tb-fithint-label')].map((e) => e.textContent)
    // the member's distances are to the group box (10), not the page (110)
    expect(labels).toContain('left 10')
    expect(labels).toContain('top 10')
    expect(labels).not.toContain('left 110')
  })

  it('a later load with a new selection swaps which object is shown', () => {
    load({ fitHints: 'selected', selection: ['a'] })
    expect(counts()).toEqual({ stubs: 1, springs: 1, anchors: 2 })
    load({ fitHints: 'selected', selection: ['b'] })
    expect(counts()).toEqual({ stubs: 0, springs: 2, anchors: 2 })
  })

  function loadBook(x: XEdge, y: YEdge): void {
    const book = {
      id: 'b',
      title: 't',
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
              x,
              y,
              props: { text: 'x' },
              on: {},
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

  it('center draws plain straight connector lines with circle anchors and no arrows', () => {
    loadBook({ mode: 'center', width: 160 }, { mode: 'center', height: 48 })
    const springs = root.querySelectorAll('svg.tb-fithint-spring--center')
    expect(springs.length).toBe(4) // two per axis
    expect(root.querySelectorAll('.tb-fithint-anchor--center').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-arrow').length).toBe(0)
    // the connector is a straight segment, not a zigzag
    const d = springs[0]!.querySelector('path')!.getAttribute('d')!
    expect((d.match(/ L /g) ?? []).length).toBe(1)
  })

  it('follows-both draws solid edge springs from both sides', () => {
    loadBook({ mode: 'both', left: 100, right: 100 }, { mode: 'both', top: 100, bottom: 100 })
    expect(root.querySelectorAll('svg.tb-fithint-spring--edge').length).toBe(4)
    expect(root.querySelectorAll('svg.tb-fithint-spring--fixed').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-anchor--edge').length).toBe(4)
    expect(root.querySelectorAll('.tb-fithint-arrow').length).toBeGreaterThan(0)
  })

  it('right + top draw solid edge springs with end anchors', () => {
    loadBook({ mode: 'right', right: 100, width: 160 }, { mode: 'top', top: 276, height: 48 })
    expect(root.querySelectorAll('svg.tb-fithint-spring--edge').length).toBe(2)
    expect(root.querySelectorAll('svg.tb-fithint-spring--fixed').length).toBe(2)
    expect(root.querySelectorAll('.tb-fithint-anchor--edge').length).toBe(2)
  })
})

describe('spring display options', () => {
  function opts(patch: Partial<FitHintOptions>): FitHintOptions {
    return { ...DEFAULT_FIT_HINTS, ...patch }
  }

  function flatBook(objects: PageObject[]): Book {
    return {
      id: 'b',
      title: 't',
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects }],
    }
  }

  function button(
    id: string,
    x: PageObject['x'],
    y: PageObject['y'],
  ): PageObject {
    return { id, name: id, control: 'button', x, y, props: { text: id }, on: {} }
  }

  function mount(
    book: Book,
    fitHints: FitHintOptions,
    selection: string[] = [],
  ): { root: HTMLElement; cleanup: () => void } {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    // styleRectOf resolves every constraint shape from the inline styles, so
    // right/bottom and the page box measure correctly (happy-dom has no layout)
    if (!savedGBCR) savedGBCR = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return styleRectOf(this)
    }
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, fitHints, selection } }),
    )
    return { root, cleanup }
  }

  function labelEls(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('.tb-fithint-label')]
  }

  function labels(root: HTMLElement): string[] {
    return labelEls(root).map((e) => e.textContent ?? '')
  }

  it('labels:false draws the springs but no captions', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 }),
    ])
    const { root, cleanup } = mount(book, opts({ labels: false }))
    try {
      expect(labels(root)).toHaveLength(0)
      expect(root.querySelectorAll('svg.tb-fithint-spring, .tb-fithint-line').length).toBeGreaterThan(0)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('lengths:false keeps the edge word but drops the pixel number', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 }),
    ])
    const { root, cleanup } = mount(book, opts({ lengths: false }))
    try {
      expect(labels(root).sort()).toEqual(['left', 'top'])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('nonDefaultOnly hides objects that are only default left + top', () => {
    const book = flatBook([
      button('a', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 }),
      button('b', { mode: 'right', right: 100, width: 100 }, { mode: 'bottom', bottom: 60, height: 50 }),
    ])
    const { root, cleanup } = mount(book, opts({ nonDefaultOnly: true }))
    try {
      const text = labels(root)
      expect(text).toEqual(expect.arrayContaining(['right 100', 'bottom 60']))
      expect(text).not.toContain('left 40')
      expect(text).not.toContain('top 40')
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('hiding member springs (groupMembers / nonDefaultOnly) keeps the group outline', () => {
    const member = button('m', { mode: 'left', left: 7, width: 40 }, { mode: 'top', top: 9, height: 20 })
    const group = createGroup('g', { x: 100, y: 100, w: 200, h: 100 }, [member])
    const book = flatBook([group])

    const on = mount(book, opts({ groupMembers: true }))
    try {
      expect(labels(on.root)).toEqual(expect.arrayContaining(['left 7', 'top 9', 'left 100', 'top 100']))
      const outlines = [...on.root.querySelectorAll<HTMLElement>('.tb-group-outline')].filter(
        (e) => e.style.display === 'block',
      )
      expect(outlines).toHaveLength(1)
    } finally {
      unpatchRects()
      on.cleanup()
      on.root.remove()
    }

    // both display filters hide member springs; neither may hide the group box
    for (const patch of [{ groupMembers: false }, { nonDefaultOnly: true }]) {
      const off = mount(book, opts(patch))
      try {
        expect(labels(off.root)).not.toContain('left 7')
        expect(labels(off.root)).not.toContain('top 9')
        const outlines = [...off.root.querySelectorAll<HTMLElement>('.tb-group-outline')].filter(
          (e) => e.style.display === 'block',
        )
        expect(outlines).toHaveLength(1)
      } finally {
        unpatchRects()
        off.cleanup()
        off.root.remove()
      }
    }
  })

  it('skipZeroLabels drops flush (0 px) captions but keeps the spring', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 0, width: 100 }, { mode: 'top', top: 10, height: 50 }),
    ])
    const show = mount(book, opts({ skipZeroLabels: false }))
    try {
      expect(labels(show.root)).toContain('left 0')
    } finally {
      unpatchRects()
      show.cleanup()
      show.root.remove()
    }

    const skip = mount(book, opts({ skipZeroLabels: true }))
    try {
      expect(labels(skip.root)).not.toContain('left 0')
      expect(skip.root.querySelectorAll('.tb-fithint-anchor').length).toBeGreaterThan(0)
    } finally {
      unpatchRects()
      skip.cleanup()
      skip.root.remove()
    }
  })

  it('moves a group with its members’ springs following the ghost (no lag)', () => {
    const member = button('m', { mode: 'left', left: 10, width: 40 }, { mode: 'top', top: 10, height: 20 })
    const group = createGroup('g', { x: 40, y: 40, w: 200, h: 100 }, [member])
    const book = flatBook([group])
    const { root, cleanup } = mount(book, opts({}))
    const at = (type: string, x: number, y: number): void => {
      overlayOf(root).dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }))
    }
    const stubLefts = (): number[] =>
      [...root.querySelectorAll<HTMLElement>('.tb-fithint-line')].map((e) => parseFloat(e.style.left))
    try {
      // the member's short left spring is a stub at the group's left edge (40)
      expect(stubLefts()).toContain(40)

      // grab the group's empty area (the member sits at page 50,50..90,70) and
      // drag in two steps — a member's cached rect must track the *cumulative*
      // ghost, not compound the delta on each move
      at('pointerdown', 150, 120)
      at('pointermove', 174, 144) // +24/+24
      at('pointermove', 198, 168) // +48/+48 total
      expect(stubLefts()).toContain(88)
      expect(stubLefts()).not.toContain(112)
      at('pointerup', 198, 168)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('clamps a flush page-edge caption back inside the page box', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 0, height: 50 }),
    ])
    const { root, cleanup } = mount(book, opts({ skipZeroLabels: false }))
    try {
      const top = labelEls(root).find((e) => e.textContent === 'top 0')
      expect(top).toBeTruthy()
      // a 0-length vertical spring would otherwise sit on y=0; the clamp
      // pushes it below the page's top edge
      expect(parseFloat(top!.style.top)).toBeGreaterThanOrEqual(8)
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('shades the page padding along the far edges in "all" mode', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 }),
    ])
    book.pages[0]!.padding = 24
    const { root, cleanup } = mount(book, opts({ mode: 'all' }))
    try {
      const bands = [...root.querySelectorAll<HTMLElement>('.tb-fithint-padding')].map((b) => ({
        left: parseFloat(b.style.left),
        top: parseFloat(b.style.top),
        width: parseFloat(b.style.width),
        height: parseFloat(b.style.height),
      }))
      // the 800x600 page (test rects), 24px strips at the right and bottom edges
      expect(bands).toEqual(
        expect.arrayContaining([
          { left: 776, top: 0, width: 24, height: 600 },
          { left: 0, top: 576, width: 800, height: 24 },
        ]),
      )
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('in "selected" mode shades padding only for a near-edge (left/top) selection, when it is in effect', () => {
    const left = button('L', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 })
    const right = button('R', { mode: 'right', right: 40, width: 100 }, { mode: 'bottom', bottom: 40, height: 50 })
    const book = flatBook([left, right])
    book.pages[0]!.padding = 24
    const viewport = document.documentElement as unknown as { clientWidth?: number; clientHeight?: number }
    // window smaller than the 800x600 page → the padding is real
    Object.defineProperty(viewport, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: 300, configurable: true })
    const { root, cleanup } = mount(book, opts({ mode: 'selected' }), ['L'])
    try {
      expect(root.querySelectorAll('.tb-fithint-padding').length).toBe(2)
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, design: true, fitHints: opts({ mode: 'selected' }), selection: ['R'] },
        }),
      )
      expect(root.querySelectorAll('.tb-fithint-padding').length).toBe(0)
    } finally {
      delete viewport.clientWidth
      delete viewport.clientHeight
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('in "selected" mode hides padding when the window already fits the content', () => {
    const left = button('L', { mode: 'left', left: 40, width: 100 }, { mode: 'top', top: 40, height: 50 })
    const book = flatBook([left])
    book.pages[0]!.padding = 24
    const viewport = document.documentElement as unknown as { clientWidth?: number; clientHeight?: number }
    // window bigger than the 800x600 page → the padding is masked
    Object.defineProperty(viewport, 'clientWidth', { value: 1200, configurable: true })
    Object.defineProperty(viewport, 'clientHeight', { value: 900, configurable: true })
    const { root, cleanup } = mount(book, opts({ mode: 'selected' }), ['L'])
    try {
      expect(root.querySelectorAll('.tb-fithint-padding').length).toBe(0)
      // "all" still outlines the configured padding
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, design: true, fitHints: opts({ mode: 'all' }), selection: ['L'] },
        }),
      )
      expect(root.querySelectorAll('.tb-fithint-padding').length).toBe(2)
    } finally {
      delete viewport.clientWidth
      delete viewport.clientHeight
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('scrolls the page’s far edge into view when the padding changes', () => {
    const book = flatBook([
      button('o', { mode: 'left', left: 100, width: 100 }, { mode: 'top', top: 50, height: 40 }),
    ])
    const { root, cleanup } = mount(book, opts({ mode: 'all' }))
    const proto = HTMLElement.prototype as unknown as { scrollIntoView?: () => void }
    const real = proto.scrollIntoView
    const seen: HTMLElement[] = []
    proto.scrollIntoView = function (this: HTMLElement) {
      seen.push(this)
    }
    try {
      book.pages[0]!.padding = 40
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, design: true, fitHints: opts({ mode: 'all' }) },
        }),
      )
      expect(seen.length).toBeGreaterThan(0)
    } finally {
      proto.scrollIntoView = real
      unpatchRects()
      cleanup()
      root.remove()
    }
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

describe('group outlines', () => {
  const BTN = { x: 55, y: 75 }

  function nestedBook(): Book {
    const btn = createObject('button', 'btn', { x: 10, y: 30, w: 40, h: 20 })
    const inner = createGroup('inner', { x: 40, y: 40, w: 200, h: 100 }, [btn])
    const outer = createGroup('outer', { x: 0, y: 0, w: 300, h: 300 }, [inner])
    return {
      id: 'bn',
      title: 'N',
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [outer] }],
    }
  }

  function loadBook(root: HTMLElement, book: Book, extra: Record<string, unknown> = {}): void {
    patchRects()
    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'toolback:load', book, design: true, ...extra } }),
    )
  }

  function dbl(root: HTMLElement, x = BTN.x, y = BTN.y): void {
    overlayOf(root).dispatchEvent(new MouseEvent('dblclick', { clientX: x, clientY: y, bubbles: true }))
  }

  function outlineIds(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('.tb-group-outline'))
      .filter((el) => el.style.display === 'block')
      .map((el) => el.dataset.tbGroupOutlineId!)
      .sort()
  }

  it('computes the outline set from drill path and spring parents, minus selected groups', () => {
    expect(
      groupOutlineIds({
        drillPath: ['outer', 'inner'],
        selected: [],
        hintParentIds: [],
        mode: 'off',
      }),
    ).toEqual(['outer', 'inner'])
    expect(
      groupOutlineIds({ drillPath: [], selected: ['grp'], hintParentIds: ['grp'], mode: 'all' }),
    ).toEqual([])
    expect(
      groupOutlineIds({ drillPath: [], selected: [], hintParentIds: ['g1'], mode: 'off' }),
    ).toEqual([])
  })

  it('outlines every drilled ancestor, but never the selected group or leaf', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const outer = book.pages[0]!.objects[0]!
      const inner = outer.children![0]!
      const btn = inner.children![0]!

      // hints off so only the drill context can drive outlines
      loadBook(root, book, { fitHints: 'off' })
      expect(outlineIds(root)).toEqual([])

      dbl(root) // selects the outer group: selected groups get the loud box
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer.id])
      expect(outlineIds(root)).toEqual([])

      dbl(root) // descends to the inner group: outer stays quietly outlined
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([inner.id])
      expect(outlineIds(root)).toEqual([outer.id])

      dbl(root) // descends to the leaf: both ancestor groups outlined
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([btn.id])
      expect(outlineIds(root)).toEqual([inner.id, outer.id].sort())
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('outlines groups whose members have springs showing, with no selection', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const book = nestedBook()
      const outer = book.pages[0]!.objects[0]!
      const inner = outer.children![0]!

      loadBook(root, book) // default All hints
      expect(outlineIds(root)).toEqual([inner.id, outer.id].sort())

      // the outline tracks the group's box
      const box = root.querySelector<HTMLElement>(
        `.tb-group-outline[data-tb-group-outline-id="${inner.id}"]`,
      )!
      expect(box.style.left).toBe('40px')
      expect(box.style.top).toBe('40px')
      expect(box.style.width).toBe('200px')
      expect(box.style.height).toBe('100px')
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('traces borderless markdown/HTML viewers even with the hints off', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const md = createObject('markdown', 'doc', { x: 60, y: 80, w: 200, h: 120 })
      const html = createObject('html', 'raw', { x: 300, y: 80, w: 200, h: 120 })
      const book: Book = {
        id: 'bv',
        title: 'V',
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [md, html] }],
      }
      loadBook(root, book, { fitHints: 'off' })
      expect(outlineIds(root)).toEqual([html.id, md.id].sort())
      const box = root.querySelector<HTMLElement>(
        `.tb-group-outline[data-tb-group-outline-id="${md.id}"]`,
      )!
      expect(box.style.left).toBe('60px')
      expect(box.style.top).toBe('80px')
      expect(box.style.width).toBe('200px')
      expect(box.style.height).toBe('120px')

      // selecting a viewer drops its outline (the loud .tb-sel box takes over)
      pointer(root, 'pointerdown', 100, 100)
      pointer(root, 'pointerup', 100, 100)
      expect(outlineIds(root)).toEqual([html.id])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('traces borderless labels even with the hints off', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const cleanup = listenForEditor(root, () => {})
    try {
      const label = createObject('label', 'score', { x: 60, y: 80, w: 200, h: 40 })
      const btn = createObject('button', 'go', { x: 300, y: 80, w: 120, h: 40 })
      const book: Book = {
        id: 'bl',
        title: 'L',
        backgrounds: [BG],
        pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [label, btn] }],
      }
      loadBook(root, book, { fitHints: 'off' })
      // only the label is borderless; a button has its own chrome
      expect(outlineIds(root)).toEqual([label.id])
      const box = root.querySelector<HTMLElement>(
        `.tb-group-outline[data-tb-group-outline-id="${label.id}"]`,
      )!
      expect(box.style.left).toBe('60px')
      expect(box.style.top).toBe('80px')
      expect(box.style.width).toBe('200px')
      expect(box.style.height).toBe('40px')

      // selecting the label drops its outline (the loud .tb-sel box takes over)
      pointer(root, 'pointerdown', 100, 100)
      pointer(root, 'pointerup', 100, 100)
      expect(outlineIds(root)).toEqual([])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })

  it('drops the outline for a selected group, and shows none when hints are off', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string; ids?: string[] }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      const book = nestedBook()
      const outer = book.pages[0]!.objects[0]!
      const inner = outer.children![0]!

      loadBook(root, book) // All: both groups outlined
      expect(outlineIds(root)).toEqual([inner.id, outer.id].sort())

      // click outer's empty lower area (below the inner group) to select it
      pointer(root, 'pointerdown', 150, 250)
      pointer(root, 'pointerup', 150, 250)
      expect(selectionMsgs(sent).at(-1)!.ids).toEqual([outer.id])
      expect(outlineIds(root)).toEqual([inner.id])

      // hints off: selection still drops its outline, and the rest clear too
      loadBook(root, book, { fitHints: 'off', selection: [outer.id] })
      expect(outlineIds(root)).toEqual([])
    } finally {
      unpatchRects()
      cleanup()
      root.remove()
    }
  })
})
