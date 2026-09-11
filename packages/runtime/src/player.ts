import type { Book, Breakpoint, PageObject, Rect } from '@toolback/format'
import { flattenObjects } from '@toolback/format'
import { renderBookPage } from './index'

export interface ToolbackStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  snapshot(): Array<[string, unknown]>
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
    snapshot: () => Array.from(data.entries()),
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
  /** Left edge (px) on the canvas */
  x: number
  /** Top edge (px) on the canvas */
  y: number
  /** Width (px) */
  width: number
  /** Height (px) */
  height: number
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
  return controlWrapper(pageRoot, name)?.firstElementChild as HTMLElement | null
}

function controlWrapper(pageRoot: HTMLElement, name: string): HTMLElement | null {
  return pageRoot.querySelector<HTMLElement>(`[data-tb-name="${escapeSel(name)}"]`)
}

function makeControlApi(
  obj: PageObject,
  el: HTMLElement,
  wrapper: HTMLElement,
  breakpoint: Breakpoint,
  listeners: Array<() => void>,
): ControlApi {
  const input = el instanceof HTMLInputElement ? el : null
  // groups have no content of their own — writing textContent would wipe
  // the member DOM, so text/value are inert for them
  const isGroup = obj.control === 'group'

  const rectNow = (): Rect => obj.rects[breakpoint] ?? obj.rects.desktop
  const writeRect = (r: Rect): void => {
    obj.rects = { ...obj.rects, [breakpoint]: r }
    wrapper.style.left = `${r.x}px`
    wrapper.style.top = `${r.y}px`
    wrapper.style.width = `${r.w}px`
    wrapper.style.height = `${r.h}px`
  }
  const setRectPart = (part: 'x' | 'y' | 'w' | 'h', v: unknown): void => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return
    const r = { ...rectNow() }
    r[part] = part === 'x' || part === 'y' ? Math.round(n) : Math.max(1, Math.round(n))
    writeRect(r)
  }

  return {
    el,
    name: obj.name,
    get text() {
      return isGroup ? '' : input ? input.value : (el.textContent ?? '')
    },
    set text(v: string) {
      if (isGroup) return
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
    get x() {
      return rectNow().x
    },
    set x(v: number) {
      setRectPart('x', v)
    },
    get y() {
      return rectNow().y
    },
    set y(v: number) {
      setRectPart('y', v)
    },
    get width() {
      return rectNow().w
    },
    set width(v: number) {
      setRectPart('w', v)
    },
    get height() {
      return rectNow().h
    },
    set height(v: number) {
      setRectPart('h', v)
    },
    on(event: string, fn: (e: Event) => void) {
      el.addEventListener(event, fn)
      listeners.push(() => el.removeEventListener(event, fn))
    },
  }
}

const DYN_RE = /\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g

const NAME_RESERVED = new Set(['page', 'controls', 'store', 'event', 'target', 'self', 'this'])
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/**
 * Bare object names usable as identifiers in scripts: valid identifiers,
 * not colliding with the runtime API or the page's own function declarations.
 */
export function shortNamesFor(objectNames: string[], exclude: Iterable<string>): string[] {
  const ex = new Set(exclude)
  return objectNames.filter((n) => IDENT_RE.test(n) && !NAME_RESERVED.has(n) && !ex.has(n))
}

function wireDynamicText(
  pageRoot: HTMLElement,
  page: { objects: PageObject[] },
  store: ToolbackStore,
  listeners: Array<() => void>,
): void {
  const entries: Array<{ el: HTMLElement; template: string; obj: PageObject }> = []
  for (const obj of flattenObjects(page.objects)) {
    const t = obj.props['text']
    if (typeof t !== 'string' || !t.includes('{{')) continue
    const el = controlElement(pageRoot, obj.name)
    if (!el) continue
    entries.push({ el, template: t, obj })
  }
  if (entries.length === 0) return
  const resolveDyn = (path: string, obj: PageObject): string => {
    const dot = path.indexOf('.')
    if (dot === -1) return String(store.get(path) ?? '')
    // dotted paths resolve against the object itself: {{self.name}} /
    // {{this.name}} — every copy of an object shows its own name
    const [head, member] = [path.slice(0, dot), path.slice(dot + 1)]
    if ((head === 'self' || head === 'this') && member === 'name') return obj.name
    return '' // unsupported member — renders empty, like an unset store key
  }
  const render = () => {
    for (const e of entries) {
      e.el.textContent = e.template.replace(DYN_RE, (_, path: string) => resolveDyn(path, e.obj))
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
    const flat = flattenObjects(page.objects)

    for (const k of Object.keys(st.controls)) delete st.controls[k]
    for (const obj of flat) {
      const wrapper = controlWrapper(pageRoot, obj.name)
      const el = (wrapper?.firstElementChild as HTMLElement | null) ?? null
      if (el && wrapper) {
        st.controls[obj.name] = makeControlApi(obj, el, wrapper, st.breakpoint, st.listeners)
      }
    }

    const api = { page: st.pageApi, controls: st.controls, store: st.store }

    st.pageFns = {}
    if (page.script.trim()) {
      safeRun(st, 'page script', () => {
        const names = extractFunctionNames(page.script)
        const returnObj = names
          .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
          .join(',')
        const bare = shortNamesFor(
          flat.map((o) => o.name),
          names,
        )
        const shortNames = bare.length > 0 ? `const { ${bare.join(', ')} } = controls;` : ''
        const factory = new Function(
          'api',
          'self',
          `"use strict";\nconst { page, controls, store } = api;\n${shortNames}\n${page.script}\n;return { ${returnObj} };`,
        )
        // `self` in a page script is the page API (self.name = the page name)
        st.pageFns = (factory(api, st.pageApi) ?? {}) as Record<string, (e?: unknown) => unknown>
      })
    }
    const fnNames = Object.keys(st.pageFns)

    /** the object that actually received the event — nearest data-tb-name element */
    const resolveTarget = (e: Event, fallback: ControlApi): ControlApi => {
      let el = e.target as HTMLElement | null
      while (el) {
        const name = el.dataset?.tbName
        if (name) {
          const found = st.controls[name]
          if (found) return found
        }
        el = el.parentElement
      }
      return fallback
    }

    // ---- ToolBook event model: an explicit owner chain, not DOM bubbling ----
    // The innermost handler runs and STOPS unless it calls forward(); an
    // owner with no handler for the event auto-continues to its parent group.
    // Each owner's `self` is its own ControlApi (the group itself for group
    // scripts) while `target` stays the member that received the event.
    // Walking the chain explicitly (instead of relying on DOM bubbling) also
    // makes non-bubbling events like mouseenter reach group handlers.

    const parentOf = new Map<string, PageObject | null>()
    const walkTree = (objs: PageObject[], parent: PageObject | null): void => {
      for (const o of objs) {
        parentOf.set(o.name, parent)
        if (o.children?.length) walkTree(o.children, o)
      }
    }
    walkTree(page.objects, null)

    // compile every owner's event scripts once per page render
    const compiled = new Map<string, Map<string, (e: Event, self: ControlApi, forward: () => void) => void>>()
    for (const obj of flat) {
      const ctl = st.controls[obj.name]
      if (!ctl) continue
      const perEvent = new Map<string, (e: Event, self: ControlApi, forward: () => void) => void>()
      for (const [eventName, script] of Object.entries(obj.on)) {
        if (!script || !script.trim()) continue
        try {
          const bare = shortNamesFor(flat.map((o) => o.name), fnNames)
          const shortNames =
            bare.length > 0 ? `const { ${bare.join(', ')} } = controls;` : ''
          // `target` = the member that received the event; `self` = the
          // script owner (in a group script: the group itself); `forward()`
          // continues the message to the next enclosing handler. Page
          // functions with colliding names lose the reserved slots.
          const paramNames = [...new Set([...fnNames, 'event', 'target', 'self', 'forward'])]
          const factory = new Function(
            'api',
            ...paramNames,
            `"use strict";\nconst { page, controls, store } = api;\nreturn (async () => {\n${shortNames}\n${script}\n})();`,
          )
          perEvent.set(eventName, (e, self, forward) => {
            const args: unknown[] = [api]
            for (const p of paramNames) {
              if (p === 'event') args.push(e)
              else if (p === 'target') args.push(resolveTarget(e, ctl))
              else if (p === 'self') args.push(self)
              else if (p === 'forward') args.push(forward)
              else args.push(st.pageFns[p])
            }
            safeRun(st, `${obj.name}.${eventName}`, () => {
              // `this` inside the script is the script owner (=== self)
              Promise.resolve(factory.call(self, ...args)).catch((err) =>
                st.onError?.(`${obj.name}.${eventName}: ${String(err)}`),
              )
            })
          })
        } catch (err) {
          st.onError?.(`${obj.name}.${eventName}: ${String(err)}`)
        }
      }
      if (perEvent.size) compiled.set(obj.name, perEvent)
    }

    // attach one dispatcher per leaf element per event type used anywhere in
    // its owner chain — the chain walk decides which handlers actually run
    const chainOf = (obj: PageObject): PageObject[] => {
      const chain: PageObject[] = []
      let cur: PageObject | null = obj
      while (cur) {
        chain.push(cur)
        cur = parentOf.get(cur.name) ?? null
      }
      return chain
    }
    for (const obj of flat) {
      // group wrappers have pointer-events: none — events originate on
      // members, and group handlers are reached through the chain walk
      if (obj.control === 'group') continue
      const ctl = st.controls[obj.name]
      if (!ctl) continue
      const chain = chainOf(obj)
      const types = new Set<string>()
      for (const o of chain) for (const t of Object.keys(o.on)) types.add(t)
      for (const eventName of types) {
        const dispatch = (e: Event): void => {
          let i = 0
          const forward = (): void => {
            while (i < chain.length && !compiled.get(chain[i]!.name)?.has(eventName)) i++
            if (i >= chain.length) return
            const owner = chain[i++]!
            compiled.get(owner.name)!.get(eventName)!(e, st.controls[owner.name]!, forward)
          }
          forward()
        }
        ctl.el.addEventListener(eventName, dispatch)
        st.listeners.push(() => ctl.el.removeEventListener(eventName, dispatch))
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
