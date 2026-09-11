import type { ControlKind, Rect } from '@toolback/format'
import { scaleRect } from '@toolback/format'
import { DEFAULT_PROPS } from '@toolback/format'
import { renderObject } from '@toolback/controls'

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

/** transform-origin that keeps the resize-opposite corner fixed while scaling */
function scaleOriginFor(dir: HandleDir): string {
  return `${dir.includes('w') ? '100' : '0'}% ${dir.includes('n') ? '100' : '0'}%`
}

export type DesignOutMessage =
  | { type: 'toolback:selection'; ids: string[] }
  | { type: 'toolback:bgClick' }
  | {
      type: 'toolback:commit'
      kind: 'move' | 'resize'
      objects: Array<{ id: string; rect: Rect }>
    }

export interface DesignController {
  attach(wrapper: HTMLElement): void
  setEnabled(enabled: boolean): void
  onRendered(selection: string[]): void
  dragOver(control: ControlKind, rect: Rect): void
  dragEnd(): void
  /** Escape: steps out one group level (selecting the group you were in); at
   *  the outermost level it does nothing — Esc never deselects */
  escape(): void
  readonly selectedIds: string[]
  readonly enabled: boolean
}

type DragState =
  | {
      mode: 'move'
      ids: string[]
      start: Map<string, Rect>
      startX: number
      startY: number
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
  | {
      mode: 'marquee'
      additive: boolean
      startX: number
      startY: number
      moved: boolean
    }
  | null

const HANDLE_OFFSET = 6

const HANDLE_POS = (r: Rect): Record<HandleDir, [number, number]> => ({
  nw: [r.x, r.y],
  n: [r.x + r.w / 2, r.y],
  ne: [r.x + r.w, r.y],
  e: [r.x + r.w, r.y + r.h / 2],
  se: [r.x + r.w, r.y + r.h],
  s: [r.x + r.w / 2, r.y + r.h],
  sw: [r.x, r.y + r.h],
  w: [r.x, r.y + r.h / 2],
})

export function createDesignController(send: (msg: DesignOutMessage) => void): DesignController {
  let wrapper: HTMLElement | null = null
  let overlay: HTMLElement | null = null
  let marquee: HTMLElement | null = null
  let badge: HTMLElement | null = null
  let handles: HTMLElement[] = []
  let selBoxes = new Map<string, HTMLElement>()
  let pageRoot: HTMLElement | null = null
  let selected = new Set<string>()
  // groups we've drilled into, outermost→innermost. Objects at the "current
  // level" live at chain[drillPath.length] under the pointer.
  let drillPath: string[] = []
  let rects = new Map<string, Rect>()
  // locked background objects (page view): not selectable, but remembered so
  // clicking one can explain why nothing got selected
  let bgRects = new Map<string, Rect>()
  let drag: DragState = null
  let enabled = false
  let phantom: HTMLElement | null = null
  let phantomKind: ControlKind | null = null

  function buildOverlay(): void {
    if (!wrapper || overlay) return
    overlay = wrapper.ownerDocument.createElement('div')
    overlay.className = 'tb-design-overlay'
    marquee = wrapper.ownerDocument.createElement('div')
    marquee.className = 'tb-marquee'
    badge = wrapper.ownerDocument.createElement('div')
    badge.className = 'tb-sizebadge'
    handles = HANDLE_DIRS.map((dir) => {
      const h = wrapper!.ownerDocument.createElement('div')
      h.className = 'tb-handle'
      h.dataset.dir = dir
      return h
    })
    overlay.appendChild(marquee)
    for (const h of handles) overlay.appendChild(h)
    overlay.appendChild(badge)
    overlay.addEventListener('pointerdown', onPointerDown)
    overlay.addEventListener('pointermove', onPointerMove)
    overlay.addEventListener('pointerup', onPointerUp)
    overlay.addEventListener('dblclick', onDblClick)
    wrapper.appendChild(overlay)
  }

  function selBoxFor(id: string): HTMLElement {
    let box = selBoxes.get(id)
    if (!box) {
      box = wrapper!.ownerDocument.createElement('div')
      box.className = 'tb-sel'
      box.dataset.tbSelId = id
      overlay!.appendChild(box)
      selBoxes.set(id, box)
    }
    return box
  }

  function refreshRects(): void {
    rects = new Map()
    bgRects = new Map()
    if (!wrapper || !pageRoot) return
    const base = wrapper.getBoundingClientRect()
    for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      const id = el.dataset.tbId
      if (!id) continue
      const r = el.getBoundingClientRect()
      const rel = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
      if (el.closest('[data-tb-bg]')) bgRects.set(id, rel)
      else rects.set(id, rel)
    }
  }

  /** group wrapper element of an object (null for top-level) */
  function groupElOf(id: string): HTMLElement | null {
    return objectEl(id)?.parentElement?.closest('[data-tb-id]') ?? null
  }

  /** group ids from the page down to the object's nearest ancestor, outermost→innermost */
  function ancestorChainOf(el: HTMLElement): string[] {
    const ids: string[] = []
    let cur = el.parentElement?.closest<HTMLElement>('[data-tb-id]') ?? null
    while (cur) {
      ids.unshift(cur.dataset.tbId!)
      cur = cur.parentElement?.closest<HTMLElement>('[data-tb-id]') ?? null
    }
    return ids
  }

  /** number of group ancestors (0 = top-level object) */
  function depthOf(el: HTMLElement): number {
    let d = 0
    let cur = el.parentElement?.closest<HTMLElement>('[data-tb-id]') ?? null
    while (cur) {
      d++
      cur = cur.parentElement?.closest<HTMLElement>('[data-tb-id]') ?? null
    }
    return d
  }

  function isPrefix(prefix: string[], chain: string[]): boolean {
    if (prefix.length > chain.length) return false
    for (let i = 0; i < prefix.length; i++) if (prefix[i] !== chain[i]) return false
    return true
  }

  /** full ancestor chain (outermost→innermost) of the deepest object under (x,y) */
  function chainAt(x: number, y: number): string[] {
    if (!pageRoot) return []
    const els = pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]')
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i]!
      const id = el.dataset.tbId
      if (!id) continue
      const r = rects.get(id)
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return [...ancestorChainOf(el), id]
      }
    }
    return []
  }

  /** the drilled context (group chain) a restored selection represents */
  function contextOf(id: string): string[] {
    const el = objectEl(id)
    if (!el) return []
    return ancestorChainOf(el)
  }

  /** object a plain/alt click under the pointer selects, plus the drill path
   *  that selection implies (null = nothing at the current level → marquee) */
  function resolveClickTarget(
    chain: string[],
    alt: boolean,
  ): { id: string; path: string[] } | null {
    if (alt) return { id: chain[chain.length - 1]!, path: chain.slice(0, -1) }
    if (drillPath.length && isPrefix(drillPath, chain)) {
      if (chain.length > drillPath.length) return { id: chain[drillPath.length]!, path: drillPath }
      return null // on the drilled group's own box, nothing deeper → empty
    }
    return { id: chain[0]!, path: [] }
  }

  function objectEl(id: string): HTMLElement | null {
    return pageRoot?.querySelector<HTMLElement>(`[data-tb-id="${CSS.escape(id)}"]`) ?? null
  }

  function applyGhostRect(id: string, r: Rect): void {
    const el = objectEl(id)
    if (!el) return
    // member elements are positioned parent-relative — convert page-absolute
    // ghost coords to the parent group's frame before writing
    const pid = groupElOf(id)?.getAttribute('data-tb-id')
    const parentRect = pid ? rects.get(pid) : undefined
    el.style.left = `${r.x - (parentRect?.x ?? 0)}px`
    el.style.top = `${r.y - (parentRect?.y ?? 0)}px`
    el.style.width = `${r.w}px`
    el.style.height = `${r.h}px`
  }

  /** live feedback for group resize: CSS-scale the whole subtree from the fixed corner */
  function applyGroupTransform(id: string, ghost: Rect, start: Rect, dir: HandleDir): void {
    const el = objectEl(id)
    if (!el) return
    const fx = start.w === 0 ? 1 : ghost.w / start.w
    const fy = start.h === 0 ? 1 : ghost.h / start.h
    el.style.transformOrigin = `${dir.includes('w') ? '100' : '0'}% ${dir.includes('n') ? '100' : '0'}%`
    el.style.transform = `scale(${fx}, ${fy})`
  }

  function descendantsOf(id: string): Array<{ id: string; rect: Rect }> {
    const el = objectEl(id)
    if (!el) return []
    const out: Array<{ id: string; rect: Rect }> = []
    for (const d of Array.from(el.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      const did = d.dataset.tbId
      if (did && rects.has(did)) out.push({ id: did, rect: rects.get(did)! })
    }
    return out
  }

  function isGroupEl(id: string): boolean {
    return objectEl(id)?.querySelector('[data-tb-id]') != null
  }

  function redrawSelection(override?: Rect): void {
    if (!wrapper || !marquee || !badge) return
    // create boxes lazily for the current selection, hide stale ones
    for (const id of selected) selBoxFor(id)
    for (const [id, box] of selBoxes) {
      const r = selected.has(id) ? (selected.size === 1 && override ? override : rects.get(id)) : undefined
      if (!r) {
        box.style.display = 'none'
        continue
      }
      box.style.display = 'block'
      box.style.left = `${r.x}px`
      box.style.top = `${r.y}px`
      box.style.width = `${r.w}px`
      box.style.height = `${r.h}px`
    }
    if (selected.size === 1) {
      const id = [...selected][0]!
      const r = override ?? rects.get(id)
      if (r) {
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
        return
      }
    }
    for (const h of handles) h.style.display = 'none'
    badge.style.display = 'none'
  }

  function setSelected(ids: Iterable<string>): void {
    selected = new Set([...ids].filter((id) => rects.has(id)))
    redrawSelection()
  }

  function sendSelection(): void {
    send({ type: 'toolback:selection', ids: [...selected] })
  }

  function removePhantom(): void {
    phantom?.remove()
    phantom = null
    phantomKind = null
  }

  function pointerPos(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const base = overlay!.getBoundingClientRect()
    return { x: e.clientX - base.left, y: e.clientY - base.top }
  }

  function onPointerDown(e: PointerEvent): void {
    if (!overlay || e.button !== 0) return
    // pointer presses preventDefault the default focus action, so the iframe
    // never gains keyboard focus on its own — without it the canvas-side key
    // handlers (Esc drill-out, F3, ⌘Z, ⌥D/⌥G/⌥U, z-order, delete) never fire
    // after clicking into the canvas. Claim focus explicitly.
    window.focus()
    const target = e.target as HTMLElement
    const dir = target?.dataset?.dir as HandleDir | undefined
    if (dir && selected.size === 1) {
      const id = [...selected][0]!
      const r = rects.get(id)
      if (r) {
        drag = {
          mode: 'resize',
          dir,
          id,
          startX: e.clientX,
          startY: e.clientY,
          rect: r,
          ghost: r,
          moved: false,
        }
        overlay.setPointerCapture?.(e.pointerId)
        e.preventDefault()
      }
      return
    }

    const pt = pointerPos(e)
    const chain = chainAt(pt.x, pt.y)
    const hit = chain.length ? resolveClickTarget(chain, e.altKey) : null
    if (hit) {      drillPath = hit.path
      if (e.shiftKey) {
        if (selected.has(hit.id)) selected.delete(hit.id)
        else selected.add(hit.id)
      } else if (!selected.has(hit.id)) {
        selected = new Set([hit.id])
      }
      sendSelection()
      redrawSelection()
      const start = new Map<string, Rect>()
      const ids = [...selected].filter((id) => {
        const el = objectEl(id)
        if (!el) return false
        // dragging a group must not double-move its selected members
        const group = groupElOf(id)
        return !(group && selected.has(group.getAttribute('data-tb-id') ?? ''))
      })
      for (const id of ids) {
        const r = rects.get(id)
        if (r) start.set(id, r)
      }
      drag = {
        mode: 'move',
        ids,
        start,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      }
    } else {
      // nothing selectable here — if the pointer is on a background-locked
      // object, tell the editor so it can explain the lock
      for (const r of bgRects.values()) {
        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
          send({ type: 'toolback:bgClick' })
          break
        }
      }
      // no object at the current level under the pointer: marquee selection
      // (shift adds to the current selection). A truly-empty point (nothing
      // anywhere) exits the drill; a point on the drilled group's own box
      // keeps the context so the marquee can select at the current level.
      if (!e.shiftKey) {
        selected = new Set()
        if (chain.length === 0) drillPath = []
        sendSelection()
        redrawSelection()
      }
      drag = { mode: 'marquee', additive: e.shiftKey, startX: e.clientX, startY: e.clientY, moved: false }
    }
    overlay.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || !overlay) return
    if (drag.mode === 'marquee') {
      const base = overlay.getBoundingClientRect()
      marquee!.style.display = 'block'
      marquee!.style.left = `${Math.min(drag.startX, e.clientX) - base.left}px`
      marquee!.style.top = `${Math.min(drag.startY, e.clientY) - base.top}px`
      marquee!.style.width = `${Math.abs(e.clientX - drag.startX)}px`
      marquee!.style.height = `${Math.abs(e.clientY - drag.startY)}px`
      drag.moved = true
      return
    }
    const rawDx = e.clientX - drag.startX
    const rawDy = e.clientY - drag.startY
    if (!drag.moved && Math.abs(rawDx) < 3 && Math.abs(rawDy) < 3) return
    drag.moved = true
    if (drag.mode === 'move') {
      const dx = snap(rawDx)
      const dy = snap(rawDy)
      for (const id of drag.ids) {
        const base = drag.start.get(id)
        if (!base) continue
        const moved = { x: base.x + dx, y: base.y + dy, w: base.w, h: base.h }
        rects.set(id, moved) // keep the hit-test/outline map in sync so the outline follows
        applyGhostRect(id, moved)
      }
      redrawSelection()
    } else {
      drag.ghost = resizeRect(drag.rect, drag.dir, rawDx, rawDy)
      if (isGroupEl(drag.id)) {
        // live feedback: CSS-scale the subtree from the fixed corner only —
        // the layout box must stay untouched, or the visual double-scales and
        // members appear to escape the bounds mid-drag. The transform maps
        // the old box exactly onto the ghost, matching the commit math.
        applyGroupTransform(drag.id, drag.ghost, drag.rect, drag.dir)
      } else {
        applyGhostRect(drag.id, drag.ghost)
      }
      redrawSelection(drag.ghost)
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag) return
    if (drag.mode === 'move' && drag.moved) {
      const objects: Array<{ id: string; rect: Rect }> = []
      const base = wrapper!.getBoundingClientRect()
      for (const id of drag.ids) {
        const el = objectEl(id)
        if (!el) continue
        const r = el.getBoundingClientRect()
        objects.push({
          id,
          rect: { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height },
        })
      }
      send({ type: 'toolback:commit', kind: 'move', objects })
    } else if (drag.mode === 'resize' && drag.moved) {
      const objects: Array<{ id: string; rect: Rect }> = [{ id: drag.id, rect: drag.ghost }]
      if (isGroupEl(drag.id)) {
        // members scale around the FIXED corner of the handle (same origin as
        // the CSS transform preview): 'w' keeps the right edge, 'n' keeps the
        // bottom. The store converts these page-absolute rects to
        // parent-relative (group commit is applied first in the batch), then
        // snaps the group box to the tight union of the scaled members.
        const G = drag.rect
        const fx = G.w === 0 ? 1 : drag.ghost.w / G.w
        const fy = G.h === 0 ? 1 : drag.ghost.h / G.h
        const ox = drag.dir.includes('w') ? G.x + G.w : G.x
        const oy = drag.dir.includes('n') ? G.y + G.h : G.y
        for (const d of descendantsOf(drag.id)) {
          objects.push({ id: d.id, rect: scaleRect(d.rect, { x: ox, y: oy }, fx, fy) })
        }
      }
      send({ type: 'toolback:commit', kind: 'resize', objects })
      // leave the transform in place: it maps the stale layout exactly onto
      // the committed state until the sync re-renders (clearing it here would
      // flicker the group back to its pre-resize size for a frame)
    } else if (drag.mode === 'marquee') {
      marquee!.style.display = 'none'
      if (drag.moved) {
        const base = overlay!.getBoundingClientRect()
        const x1 = Math.min(drag.startX, e.clientX) - base.left
        const y1 = Math.min(drag.startY, e.clientY) - base.top
        const x2 = Math.max(drag.startX, e.clientX) - base.left
        const y2 = Math.max(drag.startY, e.clientY) - base.top
        const hits: string[] = []
        for (const el of Array.from(pageRoot?.querySelectorAll<HTMLElement>('[data-tb-id]') ?? [])) {
          // marquee selects objects at the current level (drilled: direct
          // members of the innermost group; page level: top-level objects)
          if (depthOf(el) !== drillPath.length) continue
          const id = el.dataset.tbId
          const r = id ? rects.get(id) : undefined
          if (!id || !r) continue
          if (r.x < x2 && r.x + r.w > x1 && r.y < y2 && r.y + r.h > y1) hits.push(id)
        }
        const next = drag.additive ? new Set(selected) : new Set<string>()
        for (const id of hits) next.add(id)
        selected = next
        sendSelection()
        redrawSelection()
      }
    }
    drag = null
  }

  function onDblClick(e: MouseEvent): void {
    if (!overlay || !enabled) return
    const pt = pointerPos(e)
    const chain = chainAt(pt.x, pt.y)
    if (!chain.length) return
    const selId = selected.size === 1 ? [...selected][0]! : null
    const atLevel = chain[drillPath.length]

    let target: string
    let path: string[]
    if (drillPath.length && !isPrefix(drillPath, chain)) {
      // clicked outside the drilled context: start over at the top level
      target = chain[0]!
      path = []
    } else if (selId && atLevel === selId && chain.length > drillPath.length + 1) {
      // descend exactly one level past the selected object
      target = chain[drillPath.length + 1]!
      path = [...drillPath, selId]
    } else if (chain.length > drillPath.length) {
      // (re)select the object at the current level — never deeper, so the
      // drilled selection is stable under gentle clicks
      target = atLevel!
      path = drillPath
    } else {
      return // nothing at this level under the pointer
    }
    drillPath = path
    selected = new Set([target])
    sendSelection()
    redrawSelection()
  }

  function applyEnabled(on: boolean): void {
    enabled = on
    if (!wrapper || !overlay) return
    wrapper.classList.toggle('tb-design', on)
    overlay.style.display = on ? 'block' : 'none'
    if (!on) {
      drag = null
      removePhantom()
      selected = new Set()
      drillPath = []
      redrawSelection()
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
    dragOver(control: ControlKind, rect: Rect): void {
      if (!wrapper || !enabled) return
      if (!phantom || phantomKind !== control) {
        removePhantom()
        const holder = wrapper.querySelector<HTMLElement>('.tb-page-holder')
        if (!holder) return
        phantom = wrapper.ownerDocument.createElement('div')
        phantom.className = 'tb-object tb-ghost'
        phantom.appendChild(
          renderObject({
            id: 'ghost',
            name: 'ghost',
            control,
            rects: { desktop: rect },
            props: { ...DEFAULT_PROPS[control] },
            on: {},
          }),
        )
        holder.appendChild(phantom)
        phantomKind = control
      }
      phantom!.style.left = `${rect.x}px`
      phantom!.style.top = `${rect.y}px`
      phantom!.style.width = `${rect.w}px`
      phantom!.style.height = `${rect.h}px`
    },
    dragEnd(): void {
      removePhantom()
    },
    onRendered(selection: string[]): void {
      pageRoot = wrapper?.querySelector<HTMLElement>('.tb-page') ?? null
      refreshRects()
      drillPath = selection.length ? contextOf(selection[0]!) : []
      setSelected(selection)
    },
    escape(): void {
      // at the outermost level Esc is ignored — it never deselects the
      // top-level selection
      if (!drillPath.length) return
      // step out one level: select the group we were inside
      const stepped = drillPath[drillPath.length - 1]!
      drillPath.pop()
      selected = new Set([stepped])
      sendSelection()
      redrawSelection()
    },
    get selectedIds(): string[] {
      return [...selected]
    },
    get enabled(): boolean {
      return enabled
    },
  }
}