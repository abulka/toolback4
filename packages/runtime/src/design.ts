import type { ControlKind, FitHMode, FitHintMode, FitVMode, Rect } from '@toolback/format'
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
      /** resize handle direction, so the store can scale a glued group's
       *  members around the same fixed corner */
      dir?: HandleDir
    }

export interface DesignController {
  attach(wrapper: HTMLElement): void
  setEnabled(enabled: boolean): void
  /** which objects draw the glue-spring hints on the canvas */
  setFitHintMode(mode: FitHintMode): void
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
    // viewers stay click-through in design mode (so selection works), but the
    // overlay forwards the wheel to an overflowing markdown/HTML viewer so its
    // content can be scrolled without entering run mode
    overlay.addEventListener('wheel', onWheel, { passive: false })
    wrapper.appendChild(overlay)
  }

  /**
   * Forward a wheel over a viewer object to its own scroll offset. Design mode
   * gives page content `pointer-events: none`, so the viewer can't scroll
   * natively — the overlay (which *is* interactive) hit-tests and scrolls it.
   */
  function onWheel(e: WheelEvent): void {
    if (!enabled || !overlay || !pageRoot) return
    const base = overlay.getBoundingClientRect()
    const chain = chainAt(e.clientX - base.left, e.clientY - base.top)
    const id = chain[chain.length - 1]
    if (!id) return
    const viewer = objectEl(id)?.querySelector<HTMLElement>('.tb-markdown, .tb-html')
    if (!viewer) return
    const canY = viewer.scrollHeight > viewer.clientHeight
    const canX = viewer.scrollWidth > viewer.clientWidth
    if (!canY && !canX) return
    if (canY) viewer.scrollTop += e.deltaY
    if (canX) viewer.scrollLeft += e.deltaX
    e.preventDefault()
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
    drawClipIndicators()
    drawFitHints()
  }

  /** the page box relative to the overlay (the "viewport" clips against) */
  function pageBounds(): { w: number; h: number } {
    const page = pageRoot
    if (!page) return { w: 0, h: 0 }
    const base = wrapper!.getBoundingClientRect()
    const r = page.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  /** the page's top-left relative to the wrapper/overlay (rects are wrapper-relative) */
  function pageOrigin(): { x: number; y: number } {
    const page = pageRoot
    if (!page) return { x: 0, y: 0 }
    const base = wrapper!.getBoundingClientRect()
    const r = page.getBoundingClientRect()
    return { x: r.left - base.left, y: r.top - base.top }
  }

  /** objects sticking out of the page get a dashed red outline so the
   *  "dumb clipping" is visible instead of mysterious */
  let clipBoxes = new Map<string, HTMLElement>()
  function drawClipIndicators(): void {
    if (!overlay || !enabled || !pageRoot) return
    const bounds = pageBounds()
    const seen = new Set<string>()
    for (const [id, r] of [...rects, ...bgRects]) {
      const clipped =
        r.x < -0.5 || r.y < -0.5 || r.x + r.w > bounds.w + 0.5 || r.y + r.h > bounds.h + 0.5
      seen.add(id)
      if (clipped) {
        let box = clipBoxes.get(id)
        if (!box) {
          box = wrapper!.ownerDocument.createElement('div')
          box.className = 'tb-clip'
          overlay!.appendChild(box)
          clipBoxes.set(id, box)
        }
        box.style.display = 'block'
        box.style.left = `${Math.max(0, r.x)}px`
        box.style.top = `${Math.max(0, r.y)}px`
        box.style.width = `${Math.min(r.w, bounds.w - r.x)}px`
        box.style.height = `${Math.min(r.h, bounds.h - r.y)}px`
      } else {
        const box = clipBoxes.get(id)
        if (box) box.style.display = 'none'
      }
    }
    for (const [id, box] of clipBoxes) {
      if (!seen.has(id)) box.remove()
    }
    clipBoxes = new Map([...clipBoxes].filter(([id, box]) => seen.has(id) && box.isConnected))
  }

  /**
   * The declared responsive glue of every object drawn as slate "springs":
   * coil springs from each constrained object to the page edge it's glued to
   * (with a square anchor at the edge); center/middle draws two springs
   * pushing from either side onto the object's two sides. So you can see at a
   * glance what every object is constrained to — background objects included.
   * Default Free (left/top) draws nothing. Hidden by the ≋ toolbar control
   * (All / Selected / Off).
   */
  let fitHintMode: FitHintMode = 'all'
  let fitHint: HTMLElement | null = null

  function clearFitHint(): void {
    fitHint?.remove()
    fitHint = null
  }

  /**
   * A spring between two points. `edge` glue is a solid zigzag; `center` is a
   * plain straight (dashed) line; `stretch` is a circular coil (a real spring)
   * dashed. Every spring is drawn twice — a translucent white halo under the
   * coloured stroke — so it stays legible on dark pages. Short edge/stretch
   * spans fall back to a plain stub.
   */
  type SpringKind = 'edge' | 'center' | 'stretch'
  type SpringDir = 'left' | 'right' | 'top' | 'bottom' | 'up' | 'down'

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const SPRING_AMP = 3
  const SPRING_COIL = 9
  const COIL_RADIUS = 3.5
  const COIL_PITCH = 10

  /** triangular-wave path touching both ends */
  function zigzagD(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    minx: number,
    miny: number,
    len: number,
  ): string {
    const coils = Math.max(2, Math.round(len / SPRING_COIL))
    const step = len / coils
    const ux = (x2 - x1) / len
    const uy = (y2 - y1) / len
    const px = -uy
    const py = ux
    let d = `M ${x1 - minx} ${y1 - miny}`
    for (let k = 1; k < coils; k++) {
      const t = k * step
      const side = k % 2 === 1 ? -1 : 1
      d += ` L ${(x1 + ux * t + px * side * SPRING_AMP - minx).toFixed(1)} ${(y1 + uy * t + py * side * SPRING_AMP - miny).toFixed(1)}`
    }
    d += ` L ${x2 - minx} ${y2 - miny}`
    return d
  }

  /**
   * A helix projected onto the page (prolate cycloid) — loops when the loop
   * radius beats L/(2πN), which is what makes it read as a coiled spring
   * rather than a wave. `perp` is 0 at both ends so it touches each terminus.
   */
  function coilD(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    minx: number,
    miny: number,
    len: number,
    n: number,
  ): string {
    const loopRadius = (len / n) * 0.35
    const ux = (x2 - x1) / len
    const uy = (y2 - y1) / len
    const px = -uy
    const py = ux
    const steps = n * 18
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const th = (2 * Math.PI * n * i) / steps
      const along = len * (i / steps) + loopRadius * Math.sin(th)
      const perp = COIL_RADIUS * Math.sin(th)
      const x = x1 + ux * along + px * perp
      const y = y1 + uy * along + py * perp
      d += `${i === 0 ? 'M' : ' L'} ${(x - minx).toFixed(1)} ${(y - miny).toFixed(1)}`
    }
    return d
  }

  /** a plain straight segment (the center connector) */
  function lineD(x1: number, y1: number, x2: number, y2: number, minx: number, miny: number): string {
    return `M ${(x1 - minx).toFixed(1)} ${(y1 - miny).toFixed(1)} L ${(x2 - minx).toFixed(1)} ${(y2 - miny).toFixed(1)}`
  }

  function addPath(svg: Element, doc: Document, d: string, cls: string, stroke: string, width: number): void {
    const path = doc.createElementNS(SVG_NS, 'path')
    path.setAttribute('class', cls)
    path.setAttribute('d', d)
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', String(width))
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('stroke-linecap', 'round')
    svg.appendChild(path)
  }

  function drawSpring(
    hint: HTMLElement,
    doc: Document,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    kind: SpringKind,
  ): void {
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (kind !== 'center' && len < (kind === 'edge' ? 12 : 16)) {
      const e = doc.createElement('div')
      e.className = `tb-fithint-line tb-fithint-line--${kind}`
      e.style.left = `${Math.min(x1, x2)}px`
      e.style.top = `${Math.min(y1, y2) - 1}px`
      e.style.width = `${Math.max(2, Math.abs(x2 - x1))}px`
      e.style.height = `${Math.max(2, Math.abs(y2 - y1))}px`
      hint.appendChild(e)
      return
    }
    if (kind === 'center' && len < 1) return
    const n = Math.max(2, Math.round(len / COIL_PITCH))
    const reach = kind === 'edge' ? SPRING_AMP : kind === 'center' ? 2 : Math.max(COIL_RADIUS, (len / n) * 0.35)
    const pad = reach + 2
    const minx = Math.min(x1, x2) - pad
    const miny = Math.min(y1, y2) - pad
    const w = Math.abs(x2 - x1) + pad * 2
    const h = Math.abs(y2 - y1) + pad * 2
    const svg = doc.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', `tb-fithint-spring tb-fithint-spring--${kind}`)
    svg.style.left = `${minx}px`
    svg.style.top = `${miny}px`
    svg.style.width = `${w}px`
    svg.style.height = `${h}px`
    svg.style.overflow = 'visible'
    const d =
      kind === 'edge'
        ? zigzagD(x1, y1, x2, y2, minx, miny, len)
        : kind === 'center'
          ? lineD(x1, y1, x2, y2, minx, miny)
          : coilD(x1, y1, x2, y2, minx, miny, len, n)
    addPath(svg, doc, d, 'tb-fithint-halo', 'rgba(255, 255, 255, 0.55)', 4)
    addPath(svg, doc, d, 'tb-fithint-spring-path', 'currentColor', 1.5)
    hint.appendChild(svg)
  }

  /** anchor glyph at a page edge: square (edge), circle (center), triangle (stretch) */
  function drawAnchor(
    hint: HTMLElement,
    doc: Document,
    x: number,
    y: number,
    kind: SpringKind,
    dir: SpringDir,
  ): void {
    // the hint layer is inside the page (which clips at its edges); nudge the
    // glyph just inside its edge so the whole marker stays visible
    const nudge = 3.5
    let ax = x
    let ay = y
    if (dir === 'left') ax += nudge
    else if (dir === 'right') ax -= nudge
    else if (dir === 'top') ay += nudge
    else if (dir === 'bottom') ay -= nudge
    const e = doc.createElement('div')
    e.className = `tb-fithint-anchor tb-fithint-anchor--${kind} tb-fithint-anchor--${dir}`
    e.style.left = `${ax - 3}px`
    e.style.top = `${ay - 3}px`
    hint.appendChild(e)
  }

  /** arrowhead at the object end of an edge spring, pointing at the object */
  function drawArrow(hint: HTMLElement, doc: Document, x: number, y: number, dir: SpringDir): void {
    const e = doc.createElement('div')
    e.className = `tb-fithint-arrow tb-fithint-arrow--${dir}`
    e.style.left = `${x - 4}px`
    e.style.top = `${y - 4}px`
    hint.appendChild(e)
  }

  /** horizontal glue spring for one object */
  function drawAxisH(
    hint: HTMLElement,
    doc: Document,
    r: Rect,
    bounds: { w: number; h: number },
    fx: FitHMode | undefined,
  ): void {
    const cy = r.y + r.h / 2
    switch (fx) {
      case undefined:
      case 'free':
        return // Free = no constraint, nothing to show
      case 'right':
        drawSpring(hint, doc, r.x + r.w, cy, bounds.w, cy, 'edge')
        drawAnchor(hint, doc, bounds.w, cy, 'edge', 'right')
        drawArrow(hint, doc, r.x + r.w, cy, 'left')
        break
      case 'center':
        // two coils pushing from either side onto the object's two sides
        drawSpring(hint, doc, 0, cy, r.x, cy, 'center')
        drawSpring(hint, doc, r.x + r.w, cy, bounds.w, cy, 'center')
        drawAnchor(hint, doc, 0, cy, 'center', 'left')
        drawAnchor(hint, doc, bounds.w, cy, 'center', 'right')
        break
      case 'stretch':
        drawSpring(hint, doc, 0, cy, r.x, cy, 'stretch')
        drawSpring(hint, doc, r.x + r.w, cy, bounds.w, cy, 'stretch')
        drawAnchor(hint, doc, 0, cy, 'stretch', 'left')
        drawAnchor(hint, doc, bounds.w, cy, 'stretch', 'right')
        break
      case 'left':
        drawSpring(hint, doc, 0, cy, r.x, cy, 'edge')
        drawAnchor(hint, doc, 0, cy, 'edge', 'left')
        drawArrow(hint, doc, r.x, cy, 'right')
        break
    }
  }

  /** vertical mirror */
  function drawAxisV(
    hint: HTMLElement,
    doc: Document,
    r: Rect,
    bounds: { w: number; h: number },
    fy: FitVMode | undefined,
  ): void {
    const cx = r.x + r.w / 2
    switch (fy) {
      case undefined:
      case 'free':
        return // Free = no constraint, nothing to show
      case 'bottom':
        drawSpring(hint, doc, cx, r.y + r.h, cx, bounds.h, 'edge')
        drawAnchor(hint, doc, cx, bounds.h, 'edge', 'bottom')
        drawArrow(hint, doc, cx, r.y + r.h, 'up')
        break
      case 'center':
        drawSpring(hint, doc, cx, 0, cx, r.y, 'center')
        drawSpring(hint, doc, cx, r.y + r.h, cx, bounds.h, 'center')
        drawAnchor(hint, doc, cx, 0, 'center', 'top')
        drawAnchor(hint, doc, cx, bounds.h, 'center', 'bottom')
        break
      case 'stretch':
        drawSpring(hint, doc, cx, 0, cx, r.y, 'stretch')
        drawSpring(hint, doc, cx, r.y + r.h, cx, bounds.h, 'stretch')
        drawAnchor(hint, doc, cx, 0, 'stretch', 'top')
        drawAnchor(hint, doc, cx, bounds.h, 'stretch', 'bottom')
        break
      case 'top':
        drawSpring(hint, doc, cx, 0, cx, r.y, 'edge')
        drawAnchor(hint, doc, cx, 0, 'edge', 'top')
        drawArrow(hint, doc, cx, r.y, 'down')
        break
    }
  }

  function drawFitHints(): void {
    clearFitHint()
    if (!overlay || !enabled || !pageRoot || fitHintMode === 'off') return
    const bounds = pageBounds()
    if (bounds.w <= 0 || bounds.h <= 0) return

    const doc = wrapper!.ownerDocument
    const hint = doc.createElement('div')
    hint.className = 'tb-fithint'
    // draw underneath the page's controls (but above the page background) rather
    // than over them: the hint is the page's first child, so later object
    // siblings paint on top. Its box is shifted/ sized so drawing can keep using
    // wrapper-relative coordinates.
    const origin = pageOrigin()
    hint.style.left = `${-origin.x}px`
    hint.style.top = `${-origin.y}px`
    hint.style.width = `${bounds.w}px`
    hint.style.height = `${bounds.h}px`
    pageRoot.insertBefore(hint, pageRoot.firstChild)
    fitHint = hint

    let drew = false
    for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      const id = el.dataset.tbId
      if (!id) continue
      // group members are relative to their group — no independent fit
      if (el.parentElement?.closest('[data-tb-id]')) continue
      if (fitHintMode === 'selected' && !selected.has(id)) continue
      const r = rects.get(id) ?? bgRects.get(id)
      if (!r) continue
      const fx = el.dataset.tbFitX as FitHMode | undefined
      const fy = el.dataset.tbFitY as FitVMode | undefined
      if ((!fx || fx === 'free') && (!fy || fy === 'free')) continue
      drawAxisH(hint, doc, r, bounds, fx)
      drawAxisV(hint, doc, r, bounds, fy)
      drew = true
    }
    if (!drew) clearFitHint()
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
        drawFitHints()
        return
      }
    }
    for (const h of handles) h.style.display = 'none'
    badge.style.display = 'none'
    drawFitHints()
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
        // Center/Middle position is fully determined by the page: don't let the
        // ghost slide on a locked axis while the glue lens is live there
        const el = objectEl(id)
        const lockX = el?.dataset.tbLensX === '1' && el.dataset.tbFitX === 'center'
        const lockY = el?.dataset.tbLensY === '1' && el.dataset.tbFitY === 'center'
        const moved = {
          x: base.x + (lockX ? 0 : dx),
          y: base.y + (lockY ? 0 : dy),
          w: base.w,
          h: base.h,
        }
        rects.set(id, moved) // keep the hit-test/outline map in sync so the outline follows
        applyGhostRect(id, moved)
      }
      redrawSelection()
      drawClipIndicators()
    } else {
      drag.ghost = resizeRect(drag.rect, drag.dir, rawDx, rawDy)
      rects.set(drag.id, drag.ghost) // clip indicator tracks the ghost live
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
      drawClipIndicators()
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
      send({ type: 'toolback:commit', kind: 'resize', objects, dir: drag.dir })
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
    setFitHintMode(mode: FitHintMode): void {
      if (fitHintMode === mode) return
      fitHintMode = mode
      if (mode === 'off') clearFitHint()
      else if (enabled && pageRoot) drawFitHints()
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
            rect,
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