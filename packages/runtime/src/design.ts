import type { Rect } from '@toolback/format'

export const GRID = 8
export const MIN_SIZE = 24

export type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLE_DIRS: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid
}

export function snapRect(r: Rect, grid = GRID): Rect {
  return { x: snap(r.x, grid), y: snap(r.y, grid), w: snap(r.w, grid), h: snap(r.h, grid) }
}

export function resizeRect(start: Rect, dir: HandleDir, dx: number, dy: number, min = MIN_SIZE): Rect {
  let { x, y, w, h } = start
  const ddx = snap(dx)
  const ddy = snap(dy)
  if (dir.includes('e')) w = start.w + ddx
  if (dir.includes('s')) h = start.h + ddy
  if (dir.includes('w')) {
    x = start.x + ddx
    w = start.w - ddx
  }
  if (dir.includes('n')) {
    y = start.y + ddy
    h = start.h - ddy
  }
  if (w < min) {
    w = min
    if (dir.includes('w')) x = start.x + start.w - min
  }
  if (h < min) {
    h = min
    if (dir.includes('n')) y = start.y + start.h - min
  }
  return { x, y, w, h }
}

export type DesignOutMessage =
  | { type: 'toolback:selection'; id: string | null }
  | { type: 'toolback:commit'; kind: 'move' | 'resize'; id: string; rect: Rect }

export interface DesignController {
  attach(wrapper: HTMLElement): void
  setEnabled(enabled: boolean): void
  onRendered(selection: string | null): void
  readonly selectedId: string | null
}

type DragState =
  | {
      mode: 'move'
      id: string
      startX: number
      startY: number
      rect: Rect
      ghost: Rect
      moved: boolean
    }
  | {
      mode: 'resize'
      id: string
      dir: HandleDir
      startX: number
      startY: number
      rect: Rect
      ghost: Rect
      moved: boolean
    }
  | null

const HANDLE_OFFSET = 6

export function createDesignController(send: (msg: DesignOutMessage) => void): DesignController {
  let wrapper: HTMLElement | null = null
  let overlay: HTMLElement | null = null
  let selBox: HTMLElement | null = null
  let badge: HTMLElement | null = null
  let handles: HTMLElement[] = []
  let pageRoot: HTMLElement | null = null
  let selectedId: string | null = null
  let rects = new Map<string, Rect>()
  let drag: DragState = null
  let enabled = false

  function buildOverlay(): void {
    if (!wrapper || overlay) return
    overlay = wrapper.ownerDocument.createElement('div')
    overlay.className = 'tb-design-overlay'
    selBox = wrapper.ownerDocument.createElement('div')
    selBox.className = 'tb-sel'
    badge = wrapper.ownerDocument.createElement('div')
    badge.className = 'tb-sizebadge'
    handles = HANDLE_DIRS.map((dir) => {
      const h = wrapper!.ownerDocument.createElement('div')
      h.className = 'tb-handle'
      h.dataset.dir = dir
      return h
    })
    overlay.appendChild(selBox)
    for (const h of handles) overlay.appendChild(h)
    overlay.appendChild(badge)

    overlay.addEventListener('pointerdown', onPointerDown)
    overlay.addEventListener('pointermove', onPointerMove)
    overlay.addEventListener('pointerup', onPointerUp)
    wrapper.appendChild(overlay)
  }

  function refreshRects(): void {
    rects = new Map()
    if (!wrapper || !pageRoot) return
    const base = wrapper.getBoundingClientRect()
    for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      const id = el.dataset.tbId
      if (!id) continue
      const r = el.getBoundingClientRect()
      rects.set(id, { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height })
    }
  }

  function objectAt(x: number, y: number): { id: string; rect: Rect } | null {
    if (!pageRoot) return null
    const els = pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]')
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]!
      const id = el.dataset.tbId
      if (!id) continue
      const r = rects.get(id)
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { id, rect: r }
    }
    return null
  }

  function objectEl(id: string): HTMLElement | null {
    return pageRoot?.querySelector<HTMLElement>(`[data-tb-id="${CSS.escape(id)}"]`) ?? null
  }

  function applyGhost(ghost: Rect): void {
    if (!drag) return
    const el = objectEl(drag.id)
    if (el) {
      el.style.left = `${ghost.x}px`
      el.style.top = `${ghost.y}px`
      el.style.width = `${ghost.w}px`
      el.style.height = `${ghost.h}px`
    }
    redrawSelection(ghost)
  }

  function redrawSelection(override?: Rect): void {
    if (!wrapper || !selBox || !badge) return
    const r = override ?? (selectedId ? rects.get(selectedId) : undefined)
    if (!selectedId || !r) {
      selBox.style.display = 'none'
      badge.style.display = 'none'
      for (const h of handles) h.style.display = 'none'
      return
    }
    selBox.style.display = 'block'
    selBox.style.left = `${r.x}px`
    selBox.style.top = `${r.y}px`
    selBox.style.width = `${r.w}px`
    selBox.style.height = `${r.h}px`
    const pos: Record<HandleDir, [number, number]> = {
      nw: [r.x, r.y],
      n: [r.x + r.w / 2, r.y],
      ne: [r.x + r.w, r.y],
      e: [r.x + r.w, r.y + r.h / 2],
      se: [r.x + r.w, r.y + r.h],
      s: [r.x + r.w / 2, r.y + r.h],
      sw: [r.x, r.y + r.h],
      w: [r.x, r.y + r.h / 2],
    }
    for (const h of handles) {
      const dir = h.dataset.dir as HandleDir
      const [cx, cy] = pos[dir]
      h.style.display = 'block'
      h.style.left = `${cx - HANDLE_OFFSET}px`
      h.style.top = `${cy - HANDLE_OFFSET}px`
    }
    badge.style.display = 'block'
    badge.style.left = `${r.x}px`
    badge.style.top = `${r.y + r.h + 8}px`
    badge.textContent = `${Math.round(r.w)} × ${Math.round(r.h)}`
  }

  function setSelected(id: string | null): void {
    selectedId = id && rects.has(id) ? id : null
    redrawSelection()
  }

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const base = overlay!.getBoundingClientRect()
    return { x: e.clientX - base.left, y: e.clientY - base.top }
  }

  function onPointerDown(e: PointerEvent): void {
    if (!overlay || e.button !== 0) return
    const target = e.target as HTMLElement
    const dir = target?.dataset?.dir as HandleDir | undefined
    if (dir && selectedId && rects.has(selectedId)) {
      drag = {
        mode: 'resize',
        dir,
        id: selectedId,
        startX: e.clientX,
        startY: e.clientY,
        rect: rects.get(selectedId)!,
        ghost: rects.get(selectedId)!,
        moved: false,
      }
    } else {
      const pt = pointerPos(e)
      const hit = objectAt(pt.x, pt.y)
      setSelected(hit?.id ?? null)
      send({ type: 'toolback:selection', id: hit?.id ?? null })
      if (!hit) return
      drag = {
        mode: 'move',
        id: hit.id,
        startX: e.clientX,
        startY: e.clientY,
        rect: hit.rect,
        ghost: hit.rect,
        moved: false,
      }
    }
    overlay.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag) return
    const rawDx = e.clientX - drag.startX
    const rawDy = e.clientY - drag.startY
    if (!drag.moved && Math.abs(rawDx) < 3 && Math.abs(rawDy) < 3) return
    drag.moved = true
    if (drag.mode === 'move') {
      drag.ghost = {
        x: drag.rect.x + snap(rawDx),
        y: drag.rect.y + snap(rawDy),
        w: drag.rect.w,
        h: drag.rect.h,
      }
    } else {
      drag.ghost = resizeRect(drag.rect, drag.dir, rawDx, rawDy)
    }
    applyGhost(drag.ghost)
  }

  function onPointerUp(): void {
    if (drag && drag.moved) {
      send({ type: 'toolback:commit', kind: drag.mode, id: drag.id, rect: drag.ghost })
    }
    drag = null
  }

  function applyEnabled(on: boolean): void {
    enabled = on
    if (!wrapper || !overlay) return
    wrapper.classList.toggle('tb-design', on)
    overlay.style.display = on ? 'block' : 'none'
    if (!on) {
      drag = null
      setSelected(null)
    }
  }

  return {
    attach(w: HTMLElement): void {
      wrapper = w
      wrapper.classList.add('tb-design')
      buildOverlay()
      applyEnabled(enabled)
    },
    setEnabled(on: boolean): void {
      applyEnabled(on)
    },
    onRendered(selection: string | null): void {
      pageRoot = wrapper?.querySelector<HTMLElement>('.tb-page') ?? null
      refreshRects()
      setSelected(selection)
    },
    get selectedId(): string | null {
      return selectedId
    },
  }
}
