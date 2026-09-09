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

export function textProp(obj: PageObject, fallback = ''): string {
  const v = obj.props['text']
  return typeof v === 'string' ? v : fallback
}

export function renderButton(obj: PageObject): HTMLElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'tb-button'
  el.textContent = textProp(obj, 'Button')
  return el
}

export function renderLabel(obj: PageObject): HTMLElement {
  const el = document.createElement('div')
  el.className = 'tb-label'
  el.textContent = textProp(obj, 'Label')
  return el
}

export function registerBasics(): void {
  registerControl('button', renderButton)
  registerControl('label', renderLabel)
}
