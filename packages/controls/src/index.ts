import { marked } from 'marked'
import type { ControlKind, PageObject, TextAlign, VerticalAlign } from '@toolback/format'
import {
  BORDER_DEFAULTS,
  BOX_KINDS,
  FONT_STACKS,
  resolveBorderStyle,
  resolveColor,
  resolveShapeType,
  resolveTextAlign,
  resolveVerticalAlign,
  type FontFamily,
} from '@toolback/format'

export type ControlRenderer = (obj: PageObject) => HTMLElement

const registry = new Map<ControlKind, ControlRenderer>()

export function registerControl(kind: ControlKind, render: ControlRenderer): void {
  registry.set(kind, render)
}

export function renderObject(obj: PageObject): HTMLElement {
  const render = registry.get(obj.control)
  if (!render) {
    const el = document.createElement('div')
    el.className = 'tb-missing'
    el.textContent = `control "${obj.control}" not implemented yet`
    return el
  }
  return render(obj)
}

export function textProp(obj: PageObject, key = 'text', fallback = ''): string {
  const v = obj.props[key]
  return typeof v === 'string' ? v : fallback
}

/** optional numeric prop (e.g. fontSize) — ignores empty/invalid values */
export function numProp(obj: PageObject, key: string): number | null {
  const v = obj.props[key]
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const VERTICAL_JUSTIFY: Record<VerticalAlign, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}

/** fontFamily + fontSize; clearing the prop restores the control's CSS default */
export function applyFontProps(el: HTMLElement, obj: PageObject): void {
  const font = obj.props['fontFamily']
  el.style.fontFamily =
    typeof font === 'string' && font in FONT_STACKS ? FONT_STACKS[font as FontFamily] : ''
  const fs = numProp(obj, 'fontSize')
  el.style.fontSize = fs ? `${fs}px` : ''
}

/** bold / italic toggles */
export function applyTextDecoration(el: HTMLElement, obj: PageObject): void {
  el.style.fontWeight = obj.props['bold'] === true ? '600' : ''
  el.style.fontStyle = obj.props['italic'] === true ? 'italic' : ''
}

/**
 * `textColor` wins; `colorAsText` lets the legacy `color` prop stand in as the
 * text colour for text-kind controls (labels, viewers).
 */
export function applyTextColor(
  el: HTMLElement,
  obj: PageObject,
  opts: { colorAsText?: boolean } = {},
): void {
  const c = resolveColor(obj.props['textColor']) ?? (opts.colorAsText ? resolveColor(obj.props['color']) : null)
  el.style.color = c ?? ''
}

/**
 * `background` wins; `colorAsSurface` lets the legacy `color` prop stand in as
 * the fill for surface-kind controls (buttons, cards, containers).
 */
export function applyBackground(
  el: HTMLElement,
  obj: PageObject,
  opts: { colorAsSurface?: boolean } = {},
): void {
  const b = resolveColor(obj.props['background']) ?? (opts.colorAsSurface ? resolveColor(obj.props['color']) : null)
  el.style.background = b ?? ''
}

/** horizontal alignment — `text-align` (label/button are flex columns whose
 *  text item stretches full width, so this is the horizontal axis) */
export function applyTextAlign(el: HTMLElement, obj: PageObject): void {
  el.style.textAlign = resolveTextAlign(obj.props['textAlign']) ?? ''
}

/** vertical alignment for flex columns (labels, buttons) — the main axis */
export function applyVerticalAlign(el: HTMLElement, obj: PageObject): void {
  const v = resolveVerticalAlign(obj.props['vAlign'])
  el.style.justifyContent = v ? VERTICAL_JUSTIFY[v] : ''
}

/** border / corner radius / opacity; absent props fall back to the CSS default */
export function applyBoxStyle(el: HTMLElement, obj: PageObject): void {
  const touched =
    obj.props['borderWidth'] !== undefined ||
    obj.props['borderStyle'] !== undefined ||
    obj.props['borderColor'] !== undefined
  if (touched) {
    // any one of the three switches the border on: the rest take the control's
    // default, so changing just the style/colour is not a silent no-op
    const def = BORDER_DEFAULTS[obj.control]
    const w = numProp(obj, 'borderWidth') ?? def.width
    const style = obj.props['borderStyle'] !== undefined ? resolveBorderStyle(obj.props['borderStyle']) : def.style
    const color = resolveColor(obj.props['borderColor']) ?? def.color
    el.style.borderWidth = `${Math.max(0, w)}px`
    el.style.borderStyle = style
    el.style.borderColor = color
  } else {
    el.style.borderWidth = ''
    el.style.borderStyle = ''
    el.style.borderColor = ''
  }
  const radius = numProp(obj, 'radius')
  el.style.borderRadius = radius !== null ? `${Math.max(0, radius)}px` : ''
  const opacity = numProp(obj, 'opacity')
  el.style.opacity = opacity !== null ? String(Math.min(1, Math.max(0, opacity))) : ''
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const ARROW_MARKER = 'M0,0 L10,5 L0,10 Z'

/**
 * The shape control paints an SVG `<path>`-style geometry. `fill` comes from
 * `background`/`color`, the outline from the border props (mapped to
 * `stroke`), and `radius` rounds the rectangle. Line/arrow have no fill and a
 * default stroke so they show even before a border is set.
 */
function applyShapeStyle(root: HTMLElement, obj: PageObject): void {
  const geom = root.querySelector<SVGElement>('.tb-shape-geom')
  if (!geom) return
  const type = resolveShapeType(obj.props['shape'])
  const strokeOnly = type === 'line' || type === 'arrow'
  const fill = resolveColor(obj.props['background']) ?? resolveColor(obj.props['color'])
  geom.style.fill = fill ?? (strokeOnly ? 'none' : '')
  if (geom.tagName.toLowerCase() === 'rect') {
    const r = numProp(obj, 'radius')
    if (r !== null && r > 0) {
      geom.setAttribute('rx', String(Math.min(50, r)))
      geom.setAttribute('ry', String(Math.min(50, r)))
    } else {
      geom.removeAttribute('rx')
      geom.removeAttribute('ry')
    }
  }
  const touched =
    obj.props['borderWidth'] !== undefined ||
    obj.props['borderStyle'] !== undefined ||
    obj.props['borderColor'] !== undefined
  if (touched) {
    const def = BORDER_DEFAULTS[obj.control]
    const w = numProp(obj, 'borderWidth') ?? def.width
    const style = obj.props['borderStyle'] !== undefined ? resolveBorderStyle(obj.props['borderStyle']) : def.style
    const color = resolveColor(obj.props['borderColor']) ?? def.color
    geom.style.stroke = color
    geom.style.strokeWidth = `${Math.max(0, w)}px`
    geom.style.strokeDasharray = style === 'dashed' ? '6 4' : ''
  } else {
    geom.style.stroke = ''
    geom.style.strokeWidth = ''
    geom.style.strokeDasharray = ''
  }
  const opacity = numProp(obj, 'opacity')
  root.style.opacity = opacity !== null ? String(Math.min(1, Math.max(0, opacity))) : ''
}

function polygonPoints(sides: number): string {
  const n = Math.min(20, Math.max(3, Math.round(sides)))
  const out: string[] = []
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step
    out.push(`${(50 + 50 * Math.cos(a)).toFixed(2)},${(50 + 50 * Math.sin(a)).toFixed(2)}`)
  }
  return out.join(' ')
}

function starPoints(points: number, innerRatio: number): string {
  const n = Math.min(20, Math.max(3, Math.round(points)))
  const ratio = Math.min(1, Math.max(0.05, innerRatio))
  const out: string[] = []
  const step = Math.PI / n
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? 50 : 50 * ratio
    const a = -Math.PI / 2 + i * step
    out.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return out.join(' ')
}

function shapeGeometry(doc: Document, obj: PageObject): SVGElement {
  const type = resolveShapeType(obj.props['shape'])
  const make = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
    doc.createElementNS(SVG_NS, tag)
  const polygon = (points: string): SVGElement => {
    const el = make('polygon')
    el.setAttribute('points', points)
    return el
  }
  switch (type) {
    case 'rectangle': {
      const el = make('rect')
      el.setAttribute('x', '0')
      el.setAttribute('y', '0')
      el.setAttribute('width', '100')
      el.setAttribute('height', '100')
      const r = numProp(obj, 'radius')
      if (r !== null && r > 0) {
        el.setAttribute('rx', String(Math.min(50, r)))
        el.setAttribute('ry', String(Math.min(50, r)))
      }
      return el
    }
    case 'circle': {
      const el = make('circle')
      el.setAttribute('cx', '50')
      el.setAttribute('cy', '50')
      el.setAttribute('r', '50')
      return el
    }
    case 'line':
    case 'arrow': {
      const el = make('line')
      el.setAttribute('x1', '0')
      el.setAttribute('y1', '0')
      el.setAttribute('x2', '100')
      el.setAttribute('y2', '100')
      if (type === 'arrow') el.setAttribute('marker-end', `url(#tb-arrow-${obj.id})`)
      return el
    }
    case 'triangle':
      return polygon('50,2 98,98 2,98')
    case 'diamond':
      return polygon('50,2 98,50 50,98 2,50')
    case 'polygon':
      return polygon(polygonPoints(numProp(obj, 'sides') ?? 5))
    case 'star':
      return polygon(starPoints(numProp(obj, 'points') ?? 5, numProp(obj, 'innerRatio') ?? 0.5))
    case 'path': {
      const el = make('path')
      el.setAttribute('d', textProp(obj, 'path', 'M 10 90 L 50 10 L 90 90 Z'))
      return el
    }
    default: {
      const el = make('ellipse')
      el.setAttribute('cx', '50')
      el.setAttribute('cy', '50')
      el.setAttribute('rx', '50')
      el.setAttribute('ry', '50')
      return el
    }
  }
}

function arrowDefs(doc: Document, obj: PageObject): SVGElement {
  const defs = doc.createElementNS(SVG_NS, 'defs')
  const marker = doc.createElementNS(SVG_NS, 'marker')
  marker.setAttribute('id', `tb-arrow-${obj.id}`)
  marker.setAttribute('markerWidth', '6')
  marker.setAttribute('markerHeight', '6')
  marker.setAttribute('refX', '8')
  marker.setAttribute('refY', '5')
  marker.setAttribute('orient', 'auto-start-reverse')
  marker.setAttribute('markerUnits', 'strokeWidth')
  marker.setAttribute('viewBox', '0 0 10 10')
  const head = doc.createElementNS(SVG_NS, 'path')
  head.setAttribute('d', ARROW_MARKER)
  head.setAttribute('fill', 'context-stroke')
  marker.appendChild(head)
  defs.appendChild(marker)
  return defs
}

const BOX_KIND_SET = new Set<string>(BOX_KINDS)

/**
 * Apply every style prop to a rendered control's element tree — the single
 * place that knows which node each kind paints. Renderers call it on a fresh
 * element; the runtime calls it again after a live prop write, so the two stay
 * in lockstep.
 */
export function applyStyleToTree(root: HTMLElement, obj: PageObject): void {
  if (BOX_KIND_SET.has(obj.control) && obj.control !== 'shape') applyBoxStyle(root, obj)
  switch (obj.control) {
    case 'shape':
      applyShapeStyle(root, obj)
      return
    case 'button':
      applyFontProps(root, obj)
      applyTextDecoration(root, obj)
      applyTextColor(root, obj)
      applyBackground(root, obj, { colorAsSurface: true })
      applyVerticalAlign(root, obj)
      applyTextAlign(root, obj)
      root.classList.toggle('tb-colored', Boolean(resolveColor(obj.props['color'])))
      return
    case 'label':
      applyFontProps(root, obj)
      applyTextDecoration(root, obj)
      applyTextColor(root, obj, { colorAsText: true })
      applyBackground(root, obj)
      applyVerticalAlign(root, obj)
      applyTextAlign(root, obj)
      return
    case 'input':
      applyFontProps(root, obj)
      applyTextDecoration(root, obj)
      applyTextColor(root, obj, { colorAsText: true })
      applyBackground(root, obj)
      applyTextAlign(root, obj)
      return
    case 'switch': {
      const track = resolveColor(obj.props['trackColor']) ?? resolveColor(obj.props['color'])
      if (track) root.style.setProperty('--tb-switch-on', track)
      else root.style.removeProperty('--tb-switch-on')
      const txt = root.querySelector<HTMLElement>('.tb-switch-text')
      if (!txt) return
      applyFontProps(txt, obj)
      applyTextDecoration(txt, obj)
      applyTextColor(txt, obj)
      return
    }
    case 'card': {
      applyFontProps(root, obj)
      applyBackground(root, obj, { colorAsSurface: true })
      const fs = numProp(obj, 'fontSize')
      for (const part of Array.from(root.querySelectorAll<HTMLElement>('.tb-card-title, .tb-card-body'))) {
        applyFontProps(part, obj)
        const scaled = part.classList.contains('tb-card-title') && fs ? Math.round(fs * 1.15) : fs
        part.style.fontSize = scaled ? `${scaled}px` : ''
        applyTextDecoration(part, obj)
        applyTextColor(part, obj, { colorAsText: true })
        applyTextAlign(part, obj)
      }
      return
    }
    case 'markdown':
    case 'html':
      applyFontProps(root, obj)
      applyTextDecoration(root, obj)
      applyTextColor(root, obj, { colorAsText: true })
      applyBackground(root, obj)
      applyTextAlign(root, obj)
      return
    case 'container':
      applyFontProps(root, obj)
      applyBackground(root, obj, { colorAsSurface: true })
      return
    default:
      return
  }
}

/**
 * Which prop holds each control's templatable content — the one `{{key}}`
 * bindings substitute into. `null`/absent = the control has no text content
 * that templates resolve against. The runtime reads this so a store change
 * re-renders the *source* (markdown/HTML) rather than overwriting the DOM.
 */
export const CONTENT_PROPS: Partial<Record<ControlKind, string>> = {
  button: 'text',
  label: 'text',
  card: 'text',
  switch: 'text',
  markdown: 'text',
  html: 'html',
}

export function contentKeyFor(kind: ControlKind): string | null {
  return CONTENT_PROPS[kind] ?? null
}

function viewerEmpty(el: HTMLElement, icon: string, label: string): void {
  el.classList.add('tb-viewer-empty')
  el.innerHTML = ''
  const wrap = el.ownerDocument.createElement('div')
  const mark = el.ownerDocument.createElement('span')
  mark.className = 'tb-viewer-empty-icon'
  mark.textContent = icon
  const text = el.ownerDocument.createElement('span')
  text.textContent = label
  wrap.appendChild(mark)
  wrap.appendChild(text)
  el.appendChild(wrap)
}

/**
 * Apply a control's resolved content source. Plain text controls get
 * `textContent` (card body and switch label are targeted, never the root — a
 * root write would wipe the card title / switch structure). Markdown and HTML
 * re-parse the source into the element; empty sources show a placeholder.
 */
export function applyContent(el: HTMLElement, kind: ControlKind, source: string): void {
  switch (kind) {
    case 'markdown': {
      if (!source.trim()) {
        viewerEmpty(el, '#', 'No markdown yet')
        return
      }
      el.classList.remove('tb-viewer-empty')
      el.innerHTML = marked.parse(source, { async: false }) as string
      return
    }
    case 'html': {
      if (!source.trim()) {
        viewerEmpty(el, '</>', 'No HTML yet')
        return
      }
      el.classList.remove('tb-viewer-empty')
      el.innerHTML = source
      return
    }
    case 'card': {
      const body = el.querySelector('.tb-card-body')
      if (body) body.textContent = source
      return
    }
    case 'switch': {
      const text = el.querySelector('.tb-switch-text')
      if (text) text.textContent = source
      return
    }
    default:
      el.textContent = source
  }
}

export function renderButton(obj: PageObject): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'tb-button'
  el.textContent = textProp(obj, 'text', 'Button')
  applyStyleToTree(el, obj)
  return el
}

export function renderLabel(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-label'
  el.textContent = textProp(obj, 'text', 'Label')
  applyStyleToTree(el, obj)
  return el
}

/** switch: a real checkbox styled as a pill toggle + its label */
export function renderSwitch(obj: PageObject): HTMLElement {
  const el = document.createElement('label')
  el.className = 'tb-switch'
  const box = document.createElement('input')
  box.type = 'checkbox'
  el.appendChild(box)
  const track = document.createElement('span')
  track.className = 'tb-switch-track'
  track.appendChild(document.createElement('span'))
  el.appendChild(track)
  const txt = document.createElement('span')
  txt.className = 'tb-switch-text'
  el.appendChild(txt)
  applyContent(el, 'switch', textProp(obj, 'text'))
  el.classList.toggle('tb-switch-on', obj.props['checked'] === true)
  box.checked = obj.props['checked'] === true
  // text styling goes ON the text span — its own `font` shorthand would
  // otherwise override anything inherited from the switch element
  applyStyleToTree(el, obj)
  return el
}

export function renderInput(obj: PageObject): HTMLElement {
  const el = document.createElement('input')
  el.type = 'text'
  el.className = 'tb-input'
  el.placeholder = textProp(obj, 'placeholder', 'Type here')
  applyStyleToTree(el, obj)
  return el
}

export function renderImage(obj: PageObject): HTMLElement {
  const src = textProp(obj, 'src')
  if (!src) {
    const el = document.createElement('div')
    el.className = 'tb-image-empty'
    el.textContent = '🖼'
    el.title = textProp(obj, 'alt', 'No image URL set')
    applyStyleToTree(el, obj)
    return el
  }
  const el = document.createElement('img')
  el.className = 'tb-image'
  el.src = src
  el.alt = textProp(obj, 'alt')
  applyStyleToTree(el, obj)
  return el
}

export function renderCard(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-card'
  const title = document.createElement('div')
  title.className = 'tb-card-title'
  title.textContent = textProp(obj, 'title', 'Card')
  const body = document.createElement('div')
  body.className = 'tb-card-body'
  el.appendChild(title)
  el.appendChild(body)
  applyContent(el, 'card', textProp(obj, 'text'))
  applyStyleToTree(el, obj)
  return el
}

/** markdown viewer: the `text` prop rendered from Markdown to styled HTML */
export function renderMarkdown(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-markdown'
  applyStyleToTree(el, obj)
  applyContent(el, 'markdown', textProp(obj, 'text'))
  return el
}

/** html viewer: the `html` prop injected as raw markup (author-trusted) */
export function renderHtml(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-html'
  applyStyleToTree(el, obj)
  applyContent(el, 'html', textProp(obj, 'html'))
  return el
}

export function renderContainer(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-container'
  applyStyleToTree(el, obj)
  return el
}

/** shape: an inline SVG geometry sized to the object box (viewBox 0–100) */
export function renderShape(obj: PageObject): HTMLElement {
  const type = resolveShapeType(obj.props['shape'])
  const el = document.createElementNS(SVG_NS, 'svg') as unknown as HTMLElement
  el.setAttribute('class', 'tb-shape')
  el.setAttribute('viewBox', '0 0 100 100')
  el.setAttribute('preserveAspectRatio', type === 'circle' ? 'xMidYMid meet' : 'none')
  if (type === 'arrow') el.appendChild(arrowDefs(document, obj))
  const geom = shapeGeometry(document, obj)
  geom.setAttribute('class', 'tb-shape-geom')
  geom.setAttribute('vector-effect', 'non-scaling-stroke')
  geom.setAttribute('data-shape', type)
  el.appendChild(geom)
  applyStyleToTree(el, obj)
  return el
}

/**
 * Groups render as an invisible wrapper; the runtime injects member objects
 * (each in its own .tb-object) inside it. pointer-events: none on the wrapper
 * means only members receive clicks — but events still bubble through, so a
 * group's event handlers fire for any member.
 */
export function renderGroup(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-group'
  void obj
  return el
}

export function registerControls(): void {
  registerControl('button', renderButton)
  registerControl('label', renderLabel)
  registerControl('input', renderInput)
  registerControl('image', renderImage)
  registerControl('card', renderCard)
  registerControl('container', renderContainer)
  registerControl('switch', renderSwitch)
  registerControl('group', renderGroup)
  registerControl('markdown', renderMarkdown)
  registerControl('html', renderHtml)
  registerControl('shape', renderShape)
}
