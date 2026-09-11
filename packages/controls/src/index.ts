import type { ControlKind, PageObject } from '@toolback/format'

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

export function renderButton(obj: PageObject): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'tb-button'
  el.textContent = textProp(obj, 'text', 'Button')
  const fs = numProp(obj, 'fontSize')
  if (fs) el.style.fontSize = `${fs}px`
  return el
}

export function renderLabel(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-label'
  el.textContent = textProp(obj, 'text', 'Label')
  const fs = numProp(obj, 'fontSize')
  if (fs) el.style.fontSize = `${fs}px`
  return el
}

export function renderInput(obj: PageObject): HTMLElement {
  const el = document.createElement('input')
  el.type = 'text'
  el.className = 'tb-input'
  el.placeholder = textProp(obj, 'placeholder', 'Type here')
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
  body.textContent = textProp(obj, 'text')
  el.appendChild(title)
  el.appendChild(body)
  return el
}

export function renderContainer(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-container'
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
  registerControl('group', renderGroup)
}
