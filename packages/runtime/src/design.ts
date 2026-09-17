import type { ControlKind, FitHintMode, FitHintOptions, Rect, XEdgeMode, YEdgeMode } from '@toolback/format'
import { DEFAULT_FIT_HINTS, DEFAULT_PROPS, normalizeFitHints } from '@toolback/format'
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

/**
 * Where the selection size badge sits relative to an object's rect: just below
 * it when there is room, flipped above when there is not, and clamped inside
 * the page either way — so a control on the bottom/right page edge keeps its
 * badge on the page instead of clipping it away.
 */
export function badgePosition(
  r: Rect,
  page: { width: number; height: number },
  badge: { width: number; height: number },
  gap = 8,
): { x: number; y: number } {
  const inset = 4
  let x = r.x
  let y = r.y + r.h + gap
  if (y + badge.height > page.height) y = r.y - badge.height - gap
  x = Math.min(Math.max(x, inset), Math.max(inset, page.width - badge.width - inset))
  y = Math.min(Math.max(y, inset), Math.max(inset, page.height - badge.height - inset))
  return { x, y }
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

/**
 * Corner resize with the start aspect ratio held (Shift-drag). Drives the
 * dominant axis so the pointer stays near the corner, then derives the other
 * dimension from the ratio, keeping the fixed opposite corner in place.
 */
export function resizeRectAspect(
  start: Rect,
  dir: HandleDir,
  dx: number,
  dy: number,
  min = MIN_SIZE,
): Rect {
  if (start.w === 0 || start.h === 0) return resizeRect(start, dir, dx, dy, min)
  const ratio = start.w / start.h
  const ddx = snap(dx)
  const ddy = snap(dy)
  const driveByWidth = Math.abs(ddx) * start.h >= Math.abs(ddy) * start.w
  let w: number
  let h: number
  if (driveByWidth) {
    w = start.w + (dir.includes('e') ? ddx : -ddx)
    h = w / ratio
  } else {
    h = start.h + (dir.includes('s') ? ddy : -ddy)
    w = h * ratio
  }
  w = Math.max(min, Math.round(w))
  h = Math.max(min, Math.round(h))
  const x = dir.includes('w') ? start.x + start.w - w : start.x
  const y = dir.includes('n') ? start.y + start.h - h : start.y
  return { x, y, w, h }
}

/** corner handles carry both a horizontal and a vertical direction */
export function isCornerHandle(dir: HandleDir): boolean {
  return dir.length === 2
}

/**
 * The groups that should carry a subtle outline: every group we've drilled
 * into (so each nesting level stays faintly visible while inner children are
 * selected) plus every group whose members are currently drawing edge springs
 * (so the springs always land on a visible edge). A selected group is left out
 * — its loud selection box already shows the box.
 */
export function groupOutlineIds(input: {
  drillPath: string[]
  selected: Iterable<string>
  hintParentIds: Iterable<string>
  mode: FitHintMode
}): string[] {
  const wanted = new Set<string>()
  for (const id of input.drillPath) wanted.add(id)
  if (input.mode !== 'off') for (const id of input.hintParentIds) wanted.add(id)
  for (const id of input.selected) wanted.delete(id)
  return [...wanted]
}

export type DesignOutMessage =
  | { type: 'toolback:selection'; ids: string[] }
  | { type: 'toolback:bgClick' }
  | {
      type: 'toolback:commit'
      kind: 'move' | 'resize'
      objects: Array<{ id: string; rect: Rect }>
      /** resize handle direction (which edge/corner the pointer moved) */
      dir?: HandleDir
    }

export interface DesignController {
  attach(wrapper: HTMLElement): void
  setEnabled(enabled: boolean): void
  /** how the edge-spring hints are drawn (mode + captions + filters) */
  setFitHints(options: FitHintOptions | FitHintMode): void
  onRendered(selection: string[]): void
  /** re-measure the rendered rects after a browser reflow (window resize) */
  refresh(): void
  dragOver(control: ControlKind, rect: Rect): void
  dragEnd(): void
  /** Escape: steps out one group level (selecting the group you were in); at
   *  the outermost level it does nothing — Esc never deselects */
  escape(): void
  /** clear the selection (clicking the empty gutter outside the page) */
  clearSelection(): void
  readonly selectedIds: string[]
  readonly enabled: boolean
}

type DragState =
  | {
      mode: 'move'
      ids: string[]
      start: Map<string, Rect>
      /** members of the moved ids and their start rects, so their cached rects
       *  track the group ghost live instead of lagging until the commit */
      followers: Map<string, { rect: Rect; owner: string }>
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
  let groupOutlines = new Map<string, HTMLElement>()
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

  function groupOutlineFor(id: string): HTMLElement {
    let box = groupOutlines.get(id)
    if (!box) {
      box = wrapper!.ownerDocument.createElement('div')
      box.className = 'tb-group-outline'
      box.dataset.tbGroupOutlineId = id
      overlay!.appendChild(box)
      groupOutlines.set(id, box)
    }
    return box
  }

  /**
   * Draw the subtle boxes: the drilled ancestors plus any group whose members
   * are in view at the current mode. Markdown/HTML viewers have no chrome of
   * their own, so their box is traced too whenever they're not the selection
   * (otherwise an empty viewer is invisible at design time). Selected objects
   * are skipped (their `.tb-sel` box is the loud one). Keeps and hides stale
   * boxes, like `.tb-sel`.
   *
   * Uses `modeAllows` rather than `springShown`: hiding member springs (the
   * "group members in All" / "custom constraints only" options) must NOT hide
   * the group box itself — the box is still what the members are laid out in.
   */
  function redrawGroupOutlines(): void {
    if (!wrapper || !overlay) return
    const hintParentIds = new Set<string>()
    const viewerIds = new Set<string>()
    if (enabled && pageRoot) {
      for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
        const id = el.dataset.tbId
        if (!id || el.closest('[data-tb-bg]')) continue
        if (isViewerObject(id)) viewerIds.add(id)
        if (fitHints.mode === 'off' || !modeAllows(el)) continue
        const pid = el.parentElement?.closest<HTMLElement>('[data-tb-id]')?.dataset.tbId
        if (pid) hintParentIds.add(pid)
      }
    }
    const wanted = new Set(
      groupOutlineIds({
        drillPath: enabled ? drillPath : [],
        selected: enabled ? selected : [],
        hintParentIds,
        mode: enabled ? fitHints.mode : 'off',
      }),
    )
    // viewer boxes show independently of the spring mode — they're the only
    // thing that makes a borderless viewer's bounds visible
    for (const id of viewerIds) if (!selected.has(id)) wanted.add(id)
    for (const id of [...wanted]) if (!isGroupObject(id) && !viewerIds.has(id)) wanted.delete(id)
    for (const id of wanted) groupOutlineFor(id)
    for (const [id, box] of groupOutlines) {
      const r = wanted.has(id) ? (rects.get(id) ?? bgRects.get(id)) : undefined
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
   * The edges every object follows, drawn as slate "springs": one from the
   * object to each page edge it anchors to (with a square anchor at the edge);
   * `center` draws a straight connector from either side. So you can see at a
   * glance what every object follows — background objects included. Configured
   * by the ≋ toolbar control (All / Selected / Off plus its options popover).
   */
  let fitHints: FitHintOptions = { ...DEFAULT_FIT_HINTS }
  let fitHint: HTMLElement | null = null

  function clearFitHint(): void {
    fitHint?.remove()
    fitHint = null
  }

  /** the mode gate alone (All = everything, Selected = the selection, Off = none) */
  function modeAllows(el: HTMLElement): boolean {
    const id = el.dataset.tbId
    if (!id) return false
    if (fitHints.mode === 'off') return false
    if (fitHints.mode === 'selected' && !selected.has(id)) return false
    return true
  }

  /**
   * Whether this object draws springs under the current options: the mode gate
   * plus the "skip group members in All" and "only non-default constraints"
   * filters. The group-outline pass uses `modeAllows` instead, so hiding a
   * member's spring never hides the group box it is laid out in.
   */
  function springShown(el: HTMLElement): boolean {
    if (!modeAllows(el)) return false
    const inGroup = !!el.parentElement?.closest<HTMLElement>('[data-tb-id]')
    if (fitHints.mode === 'all' && !fitHints.groupMembers && inGroup) return false
    if (fitHints.nonDefaultOnly && el.dataset.tbEdgeX === 'left' && el.dataset.tbEdgeY === 'top')
      return false
    return true
  }

  /** the caption text for one edge, or null when captions/this caption are off */
  function captionFor(edge: string, distance: number): string | null {
    if (!fitHints.labels) return null
    if (fitHints.skipZeroLabels && Math.round(distance) === 0) return null
    return fitHints.lengths ? `${edge} ${Math.round(distance)}` : edge
  }

  /**
   * A spring's shape is the anchor: an `edge` choice (left/right/top/bottom,
   * or both) is a zigzag, `center` is a straight connector. Distances are
   * always fixed, so every spring is solid. Each is drawn twice — a translucent
   * white halo under the coloured stroke — so it stays legible on dark pages.
   * Short edge spans fall back to a stub.
   */
  type SpringKind = 'edge' | 'center'
  type SpringStyle = 'fixed' | 'scaled'
  type SpringDir = 'left' | 'right' | 'top' | 'bottom' | 'up' | 'down'

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const SPRING_AMP = 3
  const SPRING_COIL = 9

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

  type LabelPlacement = 'above' | 'below' | 'left' | 'right'

  // captions are sized from the text, not measured after paint: the clamp then
  // works on the first frame and is deterministic under happy-dom (no layout)
  const LABEL_CHAR = 5.5
  const LABEL_HEIGHT = 12
  const LABEL_GAP = 4

  function labelSize(text: string): { w: number; h: number } {
    return { w: Math.max(14, text.length * LABEL_CHAR), h: LABEL_HEIGHT }
  }

  /** one short caption beside a spring: the edge word + its pixel distance */
  function drawLabel(
    hint: HTMLElement,
    doc: Document,
    x: number,
    y: number,
    text: string,
    placement: LabelPlacement,
    box: Box,
  ): void {
    const e = doc.createElement('div')
    e.className = 'tb-fithint-label'
    e.textContent = text
    const { w, h } = labelSize(text)
    const pad = 2
    // clamp along the spring so the caption stays fully inside the page/group
    // box — a flush or page-edge spring would otherwise sit on the border
    if (placement === 'above' || placement === 'below') {
      const min = box.x + w / 2 + pad
      const max = box.x + box.w - w / 2 - pad
      x = max >= min ? Math.min(Math.max(x, min), max) : box.x + box.w / 2
    } else {
      const min = box.y + h / 2 + pad
      const max = box.y + box.h - h / 2 - pad
      y = max >= min ? Math.min(Math.max(y, min), max) : box.y + box.h / 2
    }
    e.style.left = `${x}px`
    e.style.top = `${y}px`
    e.style.transform =
      placement === 'above'
        ? `translate(-50%, calc(-100% - ${LABEL_GAP}px))`
        : placement === 'below'
          ? `translate(-50%, ${LABEL_GAP}px)`
          : placement === 'left'
            ? `translate(calc(-100% - ${LABEL_GAP}px), -50%)`
            : `translate(${LABEL_GAP}px, -50%)`
    hint.appendChild(e)
  }

  /** choose the roomier side for a caption so it does not sit on an edge */
  function labelPlacement(axis: 'h' | 'v', x1: number, y1: number, x2: number, y2: number, box: Box): LabelPlacement {
    if (axis === 'h') {
      const cy = (y1 + y2) / 2
      return cy - box.y >= box.y + box.h - cy ? 'above' : 'below'
    }
    const cx = (x1 + x2) / 2
    return cx > box.x + box.w / 2 ? 'left' : 'right'
  }

  function drawSpring(
    hint: HTMLElement,
    doc: Document,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    kind: SpringKind,
    style: SpringStyle,
    box: Box,
    label?: { text: string; axis: 'h' | 'v' },
  ): void {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const labelAt = (): void => {
      if (!label) return
      drawLabel(
        hint,
        doc,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        label.text,
        labelPlacement(label.axis, x1, y1, x2, y2, box),
        box,
      )
    }
    if (kind !== 'center' && len < 12) {
      const e = doc.createElement('div')
      e.className = `tb-fithint-line tb-fithint-line--${kind} tb-fithint-line--${style}`
      e.style.left = `${Math.min(x1, x2)}px`
      e.style.top = `${Math.min(y1, y2) - 1}px`
      e.style.width = `${Math.max(2, Math.abs(x2 - x1))}px`
      e.style.height = `${Math.max(2, Math.abs(y2 - y1))}px`
      hint.appendChild(e)
      labelAt()
      return
    }
    if (kind === 'center' && len < 1) {
      labelAt()
      return
    }
    const reach = kind === 'edge' ? SPRING_AMP : 2
    const pad = reach + 2
    const minx = Math.min(x1, x2) - pad
    const miny = Math.min(y1, y2) - pad
    const w = Math.abs(x2 - x1) + pad * 2
    const h = Math.abs(y2 - y1) + pad * 2
    const svg = doc.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', `tb-fithint-spring tb-fithint-spring--${kind} tb-fithint-spring--${style}`)
    svg.style.left = `${minx}px`
    svg.style.top = `${miny}px`
    svg.style.width = `${w}px`
    svg.style.height = `${h}px`
    svg.style.overflow = 'visible'
    const d = kind === 'edge' ? zigzagD(x1, y1, x2, y2, minx, miny, len) : lineD(x1, y1, x2, y2, minx, miny)
    addPath(svg, doc, d, 'tb-fithint-halo', 'rgba(255, 255, 255, 0.55)', 4)
    addPath(svg, doc, d, 'tb-fithint-spring-path', 'currentColor', 1.5)
    hint.appendChild(svg)
    labelAt()
  }

  /** anchor glyph at a page edge: square (edge), circle (center) */
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

  /** the containing box a spring is measured against (page or parent group) */
  type Box = { x: number; y: number; w: number; h: number }

  /** horizontal edge spring(s) for one object: shape = edge anchor / centre */
  function drawAxisH(
    hint: HTMLElement,
    doc: Document,
    r: Rect,
    box: Box,
    mode: XEdgeMode | undefined,
  ): void {
    const cy = r.y + r.h / 2
    const left = box.x
    const right = box.x + box.w
    const near = (): void => {
      const text = captionFor('left', r.x - left)
      drawSpring(hint, doc, left, cy, r.x, cy, 'edge', 'fixed', box, text ? { text, axis: 'h' } : undefined)
      drawAnchor(hint, doc, left, cy, 'edge', 'left')
      drawArrow(hint, doc, r.x, cy, 'right')
    }
    const far = (): void => {
      const text = captionFor('right', right - (r.x + r.w))
      drawSpring(hint, doc, r.x + r.w, cy, right, cy, 'edge', 'fixed', box, text ? { text, axis: 'h' } : undefined)
      drawAnchor(hint, doc, right, cy, 'edge', 'right')
      drawArrow(hint, doc, r.x + r.w, cy, 'left')
    }
    switch (mode) {
      case undefined:
        return
      case 'left':
        near()
        break
      case 'right':
        far()
        break
      case 'both':
        near()
        far()
        break
      case 'center':
        drawSpring(hint, doc, left, cy, r.x, cy, 'center', 'fixed', box, fitHints.labels ? { text: 'centre', axis: 'h' } : undefined)
        drawSpring(hint, doc, r.x + r.w, cy, right, cy, 'center', 'fixed', box)
        drawAnchor(hint, doc, left, cy, 'center', 'left')
        drawAnchor(hint, doc, right, cy, 'center', 'right')
        break
    }
  }

  /** vertical mirror */
  function drawAxisV(
    hint: HTMLElement,
    doc: Document,
    r: Rect,
    box: Box,
    mode: YEdgeMode | undefined,
  ): void {
    const cx = r.x + r.w / 2
    const top = box.y
    const bottom = box.y + box.h
    const near = (): void => {
      const text = captionFor('top', r.y - top)
      drawSpring(hint, doc, cx, top, cx, r.y, 'edge', 'fixed', box, text ? { text, axis: 'v' } : undefined)
      drawAnchor(hint, doc, cx, top, 'edge', 'top')
      drawArrow(hint, doc, cx, r.y, 'down')
    }
    const far = (): void => {
      const text = captionFor('bottom', bottom - (r.y + r.h))
      drawSpring(hint, doc, cx, r.y + r.h, cx, bottom, 'edge', 'fixed', box, text ? { text, axis: 'v' } : undefined)
      drawAnchor(hint, doc, cx, bottom, 'edge', 'bottom')
      drawArrow(hint, doc, cx, r.y + r.h, 'up')
    }
    switch (mode) {
      case undefined:
        return
      case 'top':
        near()
        break
      case 'bottom':
        far()
        break
      case 'both':
        near()
        far()
        break
      case 'center':
        drawSpring(hint, doc, cx, top, cx, r.y, 'center', 'fixed', box, fitHints.labels ? { text: 'centre', axis: 'v' } : undefined)
        drawSpring(hint, doc, cx, r.y + r.h, cx, bottom, 'center', 'fixed', box)
        drawAnchor(hint, doc, cx, top, 'center', 'top')
        drawAnchor(hint, doc, cx, bottom, 'center', 'bottom')
        break
    }
  }

  function drawFitHints(): void {
    clearFitHint()
    if (!overlay || !enabled || !pageRoot || fitHints.mode === 'off') return
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
      if (!id || !springShown(el)) continue
      const r = rects.get(id) ?? bgRects.get(id)
      if (!r) continue
      // a top-level object is measured against the page box, a member against
      // its parent group's box — both in wrapper coordinates (the hint frame)
      const parentEl = el.parentElement?.closest<HTMLElement>('[data-tb-id]') ?? null
      let box: Box
      if (parentEl) {
        const pid = parentEl.dataset.tbId
        const pr = pid ? (rects.get(pid) ?? bgRects.get(pid)) : undefined
        if (!pr) continue
        box = { x: pr.x, y: pr.y, w: pr.w, h: pr.h }
      } else {
        box = { x: origin.x, y: origin.y, w: bounds.w, h: bounds.h }
      }
      const fx = el.dataset.tbEdgeX as XEdgeMode | undefined
      const fy = el.dataset.tbEdgeY as YEdgeMode | undefined
      drawAxisH(hint, doc, r, box, fx)
      drawAxisV(hint, doc, r, box, fy)
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

  /**
   * The members of a moved object, with their start rects. The DOM rides along
   * (members are positioned relative to the group), but `rects` is not
   * re-measured mid-drag, so their cached rects are re-derived from these on
   * every move — otherwise their springs lag behind the group ghost until the
   * commit re-renders.
   */
  function followersOf(id: string): Map<string, { rect: Rect; owner: string }> {
    const out = new Map<string, { rect: Rect; owner: string }>()
    const root = objectEl(id)
    if (!root) return out
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      const childId = el.dataset.tbId
      if (!childId) continue
      const r = rects.get(childId)
      if (r) out.set(childId, { rect: r, owner: id })
    }
    return out
  }

  /** is this object a group (its object element wraps a `.tb-group`)? */
  function isGroupObject(id: string): boolean {
    return !!objectEl(id)?.firstElementChild?.classList.contains('tb-group')
  }

  /** is this object a borderless viewer (markdown / HTML)? Their box is
   *  invisible otherwise, so design mode traces it. */
  function isViewerObject(id: string): boolean {
    const cls = objectEl(id)?.firstElementChild?.classList
    return !!cls && (cls.contains('tb-markdown') || cls.contains('tb-html'))
  }

  /**
   * Live preview of a group resize: leave the layout box alone and scale the
   * whole subtree with a CSS transform anchored at the corner the handle keeps
   * fixed. The commit scales the stored edge distances, so the preview maps
   * exactly onto the re-rendered result (the store's resize path).
   */
  function applyGroupScale(id: string, start: Rect, ghost: Rect, dir: HandleDir): void {
    const el = objectEl(id)
    if (!el || start.w <= 0 || start.h <= 0) return
    const ox = dir.includes('w') ? '100%' : '0%'
    const oy = dir.includes('n') ? '100%' : '0%'
    el.style.transformOrigin = `${ox} ${oy}`
    el.style.transform = `scale(${ghost.w / start.w}, ${ghost.h / start.h})`
  }

  /** drop any preview transform left on the page (a load rebuilds the DOM) */
  function clearTransforms(): void {
    if (!pageRoot) return
    for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
      if (el.style.transform) {
        el.style.transform = ''
        el.style.transformOrigin = ''
      }
    }
  }

  function redrawSelection(override?: Rect): void {
    if (!wrapper || !overlay || !marquee || !badge) return
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
        badge.textContent = `${Math.round(r.w)} × ${Math.round(r.h)}`
        // keep the badge on the page (the overlay clips to it) — flip it above
        // a bottom-edge object and clamp it inside the page box
        const at = badgePosition(
          r,
          { width: overlay.clientWidth, height: overlay.clientHeight },
          { width: badge.offsetWidth, height: badge.offsetHeight },
        )
        badge.style.left = `${at.x}px`
        badge.style.top = `${at.y}px`
        drawFitHints()
        redrawGroupOutlines()
        return
      }
    }
    for (const h of handles) h.style.display = 'none'
    badge.style.display = 'none'
    drawFitHints()
    redrawGroupOutlines()
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
    clearTransforms()
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
      const followers = new Map<string, { rect: Rect; owner: string }>()
      for (const id of ids) for (const [cid, f] of followersOf(id)) followers.set(cid, f)
      drag = {
        mode: 'move',
        ids,
        start,
        followers,
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
        // a centred object's position is fully determined by its box: don't
        // let the ghost slide on a locked axis
        const el = objectEl(id)
        const lockX = el?.dataset.tbEdgeX === 'center'
        const lockY = el?.dataset.tbEdgeY === 'center'
        const moved = {
          x: base.x + (lockX ? 0 : dx),
          y: base.y + (lockY ? 0 : dy),
          w: base.w,
          h: base.h,
        }
        rects.set(id, moved) // keep the hit-test/outline map in sync so the outline follows
        applyGhostRect(id, moved)
      }
      // members inside a moved group ride the ghost too (their DOM already
      // does); re-derive their cached rects from the start so their springs
      // follow live instead of lagging until the commit re-renders
      for (const [cid, f] of drag.followers) {
        const base = drag.start.get(f.owner)
        const owner = rects.get(f.owner)
        if (!base || !owner) continue
        rects.set(cid, {
          ...f.rect,
          x: f.rect.x + (owner.x - base.x),
          y: f.rect.y + (owner.y - base.y),
        })
      }
      redrawSelection()
      drawClipIndicators()
    } else {
      // Shift on a corner handle keeps the start aspect ratio (images/cards)
      drag.ghost =
        e.shiftKey && isCornerHandle(drag.dir)
          ? resizeRectAspect(drag.rect, drag.dir, rawDx, rawDy)
          : resizeRect(drag.rect, drag.dir, rawDx, rawDy)
      rects.set(drag.id, drag.ghost) // clip indicator tracks the ghost live
      // a group resize scales the whole subtree; other objects just resize
      // their box (members then resolve their own edges against it)
      if (isGroupObject(drag.id)) {
        applyGroupScale(drag.id, drag.rect, drag.ghost, drag.dir)
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
      send({ type: 'toolback:commit', kind: 'resize', objects, dir: drag.dir })
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
    setFitHints(raw: FitHintOptions | FitHintMode): void {
      const next = normalizeFitHints(raw)
      const same =
        next.mode === fitHints.mode &&
        next.labels === fitHints.labels &&
        next.lengths === fitHints.lengths &&
        next.groupMembers === fitHints.groupMembers &&
        next.nonDefaultOnly === fitHints.nonDefaultOnly &&
        next.skipZeroLabels === fitHints.skipZeroLabels
      if (same) return
      fitHints = next
      if (fitHints.mode === 'off') clearFitHint()
      else if (enabled && pageRoot) drawFitHints()
      redrawGroupOutlines()
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
            x: { mode: 'left', left: rect.x, width: rect.w },
            y: { mode: 'top', top: rect.y, height: rect.h },
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
    refresh(): void {
      if (!pageRoot?.isConnected) pageRoot = wrapper?.querySelector<HTMLElement>('.tb-page') ?? null
      if (!pageRoot) return
      refreshRects()
      redrawSelection()
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
    clearSelection(): void {
      if (selected.size === 0 && drillPath.length === 0) return
      selected = new Set()
      drillPath = []
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