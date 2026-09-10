import type { Book, Breakpoint, PageObject } from '@toolback/format'
import { renderBookPage } from './index'

export interface ToolbackStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  subscribe(fn: () => void): () => void
}

export function createStore(): ToolbackStore {
  const data = new Map<string, unknown>()
  const subs = new Set<() => void>()
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value)
      for (const fn of subs) fn()
    },
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

export interface ControlApi {
  readonly el: HTMLElement
  readonly name: string
  text: string
  value: string
  visible: boolean
  enabled: boolean
  on(event: string, fn: (e: Event) => void): void
}

export function extractFunctionNames(source: string): string[] {
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  return [...source.matchAll(re)].map((m) => m[1]!)
}

function escapeSel(name: string): string {
  return name.replace(/[\\"]/g, '\\$&')
}

function controlElement(pageRoot: HTMLElement, name: string): HTMLElement | null {
  const wrapper = pageRoot.querySelector<HTMLElement>(`[data-tb-name="${escapeSel(name)}"]`)
  return (wrapper?.firstElementChild as HTMLElement) ?? null
}

function makeControlApi(
  obj: PageObject,
  el: HTMLElement,
  listeners: Array<() => void>,
): ControlApi {
  const input = el instanceof HTMLInputElement ? el : null
  return {
    el,
    name: obj.name,
    get text() {
      return input ? input.value : (el.textContent ?? '')
    },
    set text(v: string) {
      if (input) input.value = String(v)
      else el.textContent = String(v)
    },
    get value() {
      return input ? input.value : ''
    },
    set value(v: string) {
      if (input) input.value = String(v)
    },
    get visible() {
      return el.style.display !== 'none'
    },
    set visible(v: boolean) {
      el.style.display = v ? '' : 'none'
    },
    get enabled() {
      return !((el as HTMLButtonElement).disabled ?? false)
    },
    set enabled(v: boolean) {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = !v
      }
    },
    on(event: string, fn: (e: Event) => void) {
      el.addEventListener(event, fn)
      listeners.push(() => el.removeEventListener(event, fn))
    },
  }
}

const DYN_RE = /\{\{\s*([\w$]+)\s*\}\}/g

function wireDynamicText(
  pageRoot: HTMLElement,
  page: { objects: PageObject[] },
  store: ToolbackStore,
  listeners: Array<() => void>,
): void {
  const entries: Array<{ el: HTMLElement; template: string }> = []
  for (const obj of page.objects) {
    const t = obj.props['text']
    if (typeof t !== 'string' || !t.includes('{{')) continue
    const el = controlElement(pageRoot, obj.name)
    if (!el) continue
    entries.push({ el, template: t })
  }
  if (entries.length === 0) return
  const render = () => {
    for (const e of entries) {
      e.el.textContent = e.template.replace(DYN_RE, (_, k: string) => String(store.get(k) ?? ''))
    }
  }
  render()
  listeners.push(store.subscribe(render))
}

interface RunState {
  book: Book
  root: HTMLElement
  breakpoint: Breakpoint
  onError?: (message: string) => void
  store: ToolbackStore
  pageApi: unknown
  controls: Record<string, ControlApi>
  listeners: Array<() => void>
  pageFns: Record<string, (e?: unknown) => unknown>
  idx: number
  navLock: boolean
}

function safeRun(st: RunState, what: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    st.onError?.(`${what}: ${String(err)}`)
  }
}

function runPage(st: RunState, idx: number): void {
  if (st.navLock) return
  st.navLock = true
  try {
    const leave = st.pageFns['pageLeave']
    if (typeof leave === 'function') {
      safeRun(st, 'pageLeave', () => {
        Promise.resolve(leave()).catch((err) => st.onError?.(`pageLeave: ${String(err)}`))
      })
    }
    for (const un of st.listeners) un()
    st.listeners = []

    st.idx = idx
    const page = st.book.pages[idx] ?? st.book.pages[0]!
    renderBookPage(st.book, idx, st.root, st.breakpoint)
    const pageRoot = st.root.querySelector<HTMLElement>('.tb-page')!

    for (const k of Object.keys(st.controls)) delete st.controls[k]
    for (const obj of page.objects) {
      const el = controlElement(pageRoot, obj.name)
      if (el) st.controls[obj.name] = makeControlApi(obj, el, st.listeners)
    }

    const api = { page: st.pageApi, controls: st.controls, store: st.store }

    st.pageFns = {}
    if (page.script.trim()) {
      safeRun(st, 'page script', () => {
        const names = extractFunctionNames(page.script)
        const returnObj = names
          .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
          .join(',')
        const factory = new Function(
          'api',
          `"use strict";\nconst { page, controls, store } = api;\n${page.script}\n;return { ${returnObj} };`,
        )
        st.pageFns = (factory(api) ?? {}) as Record<string, (e?: unknown) => unknown>
      })
    }
    const fnNames = Object.keys(st.pageFns)
    const fnValues = fnNames.map((n) => st.pageFns[n])

    for (const obj of page.objects) {
      const ctl = st.controls[obj.name]
      if (!ctl) continue
      for (const [eventName, script] of Object.entries(obj.on)) {
        if (!script || !script.trim()) continue
        try {
          const factory = new Function(
            'api',
            ...fnNames,
            'event',
            `"use strict";\nconst { page, controls, store } = api;\nreturn (async () => {\n${script}\n})();`,
          )
          const handler = (e: Event) => {
            safeRun(st, `${obj.name}.${eventName}`, () => {
              Promise.resolve(factory(api, ...fnValues, e)).catch((err) =>
                st.onError?.(`${obj.name}.${eventName}: ${String(err)}`),
              )
            })
          }
          ctl.el.addEventListener(eventName, handler)
          st.listeners.push(() => ctl.el.removeEventListener(eventName, handler))
        } catch (err) {
          st.onError?.(`${obj.name}.${eventName}: ${String(err)}`)
        }
      }
    }

    wireDynamicText(pageRoot, page, st.store, st.listeners)

    st.navLock = false
    const enter = st.pageFns['pageEnter']
    if (typeof enter === 'function') {
      safeRun(st, 'pageEnter', () => {
        Promise.resolve(enter()).catch((err) => st.onError?.(`pageEnter: ${String(err)}`))
      })
    }
  } finally {
    st.navLock = false
  }
}

export interface RunHandle {
  store: ToolbackStore
  controls: Record<string, ControlApi>
  stop(): void
}

let active: RunHandle | null = null

export function stopRun(): void {
  active?.stop()
  active = null
}

export function runBook(
  book: Book,
  root: HTMLElement,
  breakpoint: Breakpoint = 'desktop',
  onError?: (message: string) => void,
  startPageIndex = 0,
): RunHandle {
  stopRun()

  const store = createStore()
  const st: RunState = {
    book,
    root,
    breakpoint,
    onError,
    store,
    pageApi: null,
    controls: {},
    listeners: [],
    pageFns: {},
    idx: startPageIndex,
    navLock: false,
  }

  st.pageApi = {
    get name(): string {
      return (book.pages[st.idx] ?? book.pages[0]!).name
    },
    names: book.pages.map((p) => p.name),
    go(name: string): void {
      const i = book.pages.findIndex((p) => p.name === name)
      if (i === -1) {
        onError?.(`page.go: no page named "${name}"`)
        return
      }
      runPage(st, i)
    },
  }

  runPage(st, startPageIndex)

  active = {
    store,
    get controls() {
      return st.controls
    },
    stop: () => {
      for (const un of st.listeners) un()
      st.listeners = []
    },
  }
  return active
}
