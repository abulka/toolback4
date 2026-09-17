import { marked } from 'marked'
import type { ControlKind, PageObject, TextAlign, VerticalAlign } from '@toolback/format'
import {
  FONT_STACKS,
  resolveColor,
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

/**
 * Apply every text-style prop to a rendered control's element tree — the single
 * place that knows which node each kind paints. Renderers call it on a fresh
 * element; the runtime calls it again after a live prop write, so the two stay
 * in lockstep.
 */
export function applyTextStyleToTree(root: HTMLElement, obj: PageObject): void {
  switch (obj.control) {
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
  applyTextStyleToTree(el, obj)
  return el
}

export function renderLabel(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-label'
  el.textContent = textProp(obj, 'text', 'Label')
  applyTextStyleToTree(el, obj)
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
  const color = resolveColor(obj.props['color'])
  if (color) el.style.setProperty('--tb-switch-on', color)
  // text styling goes ON the text span — its own `font` shorthand would
  // otherwise override anything inherited from the switch element
  applyTextStyleToTree(el, obj)
  return el
}

export function renderInput(obj: PageObject): HTMLElement {
  const el = document.createElement('input')
  el.type = 'text'
  el.className = 'tb-input'
  el.placeholder = textProp(obj, 'placeholder', 'Type here')
  applyTextStyleToTree(el, obj)
  return el
}

export function renderImage(obj: PageObject): HTMLElement {
  const src = textProp(obj, 'src')
  if (!src) {
    const el = document.createElement('div')
    el.className = 'tb-image-empty'
    el.textContent = '🖼'
    el.title = textProp(obj, 'alt', 'No image URL set')
    return el
  }
  const el = document.createElement('img')
  el.className = 'tb-image'
  el.src = src
  el.alt = textProp(obj, 'alt')
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
  applyTextStyleToTree(el, obj)
  return el
}

/** markdown viewer: the `text` prop rendered from Markdown to styled HTML */
export function renderMarkdown(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-markdown'
  applyTextStyleToTree(el, obj)
  applyContent(el, 'markdown', textProp(obj, 'text'))
  return el
}

/** html viewer: the `html` prop injected as raw markup (author-trusted) */
export function renderHtml(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-html'
  applyTextStyleToTree(el, obj)
  applyContent(el, 'html', textProp(obj, 'html'))
  return el
}

export function renderContainer(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-container'
  applyTextStyleToTree(el, obj)
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
}
