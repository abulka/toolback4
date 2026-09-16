import type { Background, Book, CanvasSize, PageObject, Rect } from '@toolback/format'
import { backgroundFor, DEFAULT_DIALOG_SIZE, flattenObjects, FONT_STACKS, rectForObject, resolveColor, scaleSubtreeEdges, writeRectPart } from '@toolback/format'
import { applyContent, contentKeyFor } from '@toolback/controls'
import { applyEdgeStyles, measureViewport, pageBoxFor, parentBoxMap, renderBookPage } from './index'
import { rewriteLibImports, toolbackImport } from './libs'

export interface ToolbackStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  snapshot(): Array<[string, unknown]>
  subscribe(fn: () => void): () => void
}

export function createStore(initial?: Iterable<readonly [string, unknown]>): ToolbackStore {
  const data = new Map<string, unknown>(initial)
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
  /** input text, or a switch's checked state */
  value: unknown
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
  /** colour name (red, navy…) or any CSS colour; '' = default */
  color: string
  /** simplified font family (system, sans, serif, mono, rounded) */
  fontFamily: string
  on(event: string, fn: (e: Event) => void): void
}

export function extractFunctionNames(source: string): string[] {
  const re = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  return [...source.matchAll(re)].map((m) => m[1]!)
}

function escapeSel(name: string): string {
  return name.replace(/[\\"]/g, '\\$&')
}

export function controlElement(pageRoot: HTMLElement, name: string): HTMLElement | null {
  return controlWrapper(pageRoot, name)?.firstElementChild as HTMLElement | null
}

export function controlWrapper(pageRoot: HTMLElement, name: string): HTMLElement | null {
  return pageRoot.querySelector<HTMLElement>(`[data-tb-name="${escapeSel(name)}"]`)
}

export function makeControlApi(
  obj: PageObject,
  el: HTMLElement,
  wrapper: HTMLElement,
  listeners: Array<() => void>,
  parentBox?: CanvasSize,
): ControlApi {
  const input = el instanceof HTMLInputElement ? el : null
  const checkbox = el instanceof HTMLInputElement ? null : (el.querySelector?.('input[type="checkbox"]') as HTMLInputElement | null)
  // groups have no content of their own — writing textContent would wipe
  // the member DOM, so text/value are inert for them
  const isGroup = obj.control === 'group'
  // viewers read/write their SOURCE prop (markdown text / html) and re-render
  const contentKey = contentKeyFor(obj.control)
  const isViewer = obj.control === 'markdown' || obj.control === 'html'

  const box = (): CanvasSize => parentBox ?? { width: 0, height: 0 }
  const rectNow = (): Rect => rectForObject(obj, box())
  /** re-stamp a descendant object's wrapper after its edges changed */
  const restampSubtree = (node: PageObject): void => {
    const w = el.querySelector<HTMLElement>(`[data-tb-id="${CSS.escape(node.id)}"]`)
    if (w) {
      w.dataset.tbEdgeX = node.x.mode
      w.dataset.tbEdgeY = node.y.mode
      applyEdgeStyles(w, node)
    }
    for (const child of node.children ?? []) restampSubtree(child)
  }
  const setRectPart = (part: 'x' | 'y' | 'w' | 'h', v: unknown): void => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return
    // keep which edges the control follows; the free distance is adjusted so
    // the control lands at the requested position/size. Sizing a group scales
    // its descendants, so the box and its contents grow together.
    if (isGroup && (part === 'w' || part === 'h')) {
      const before = rectNow()
      writeRectPart(obj, part, n, box())
      const after = rectNow()
      const fx = part === 'w' && before.w > 0 ? after.w / before.w : 1
      const fy = part === 'h' && before.h > 0 ? after.h / before.h : 1
      if (fx !== 1 || fy !== 1) {
        for (const child of obj.children ?? []) {
          scaleSubtreeEdges(child, fx, fy)
          restampSubtree(child)
        }
      }
    } else {
      writeRectPart(obj, part, n, box())
    }
    wrapper.dataset.tbEdgeX = obj.x.mode
    wrapper.dataset.tbEdgeY = obj.y.mode
    applyEdgeStyles(wrapper, obj)
  }

  return {
    el,
    name: obj.name,
    get text() {
      if (isGroup) return ''
      if (input) return input.value
      if (isViewer && contentKey) {
        const src = obj.props[contentKey]
        return typeof src === 'string' ? src : ''
      }
      return el.textContent ?? ''
    },
    set text(v: string) {
      if (isGroup) return
      const s = String(v)
      if (input) {
        input.value = s
        return
      }
      if (isViewer && contentKey) {
        obj.props = { ...obj.props, [contentKey]: s }
        applyContent(el, obj.control, s)
        return
      }
      // switch label lives in its own span — a root write would wipe the
      // checkbox/track, so route every text-bearing control through applyContent
      applyContent(el, obj.control, s)
    },
    get value() {
      return input ? input.value : checkbox ? checkbox.checked : ''
    },
    set value(v: unknown) {
      if (input) input.value = String(v)
      else if (checkbox) checkbox.checked = Boolean(v)
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
    get color() {
      return typeof obj.props['color'] === 'string' ? (obj.props['color'] as string) : ''
    },
    set color(v: string) {
      obj.props = { ...obj.props, color: v }
      const resolved = resolveColor(v)
      if (!resolved) return
      // surface controls paint their background; labels/switches paint text
      if (el.classList.contains('tb-card') || el.classList.contains('tb-container')) {
        el.style.background = resolved
      } else if (el.classList.contains('tb-button')) {
        el.style.background = resolved
      } else if (checkbox) {
        el.style.setProperty('--tb-switch-on', resolved)
      } else {
        el.style.color = resolved
      }
    },
    get fontFamily() {
      return typeof obj.props['fontFamily'] === 'string' ? (obj.props['fontFamily'] as string) : ''
    },
    set fontFamily(v: string) {
      if (!(v in FONT_STACKS)) return
      obj.props = { ...obj.props, fontFamily: v }
      el.style.fontFamily = FONT_STACKS[v as keyof typeof FONT_STACKS]
    },
    on(event: string, fn: (e: Event) => void) {
      el.addEventListener(event, fn)
      listeners.push(() => el.removeEventListener(event, fn))
    },
  }
}

const DYN_RE = /\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g

const NAME_RESERVED = new Set(['page', 'controls', 'store', 'event', 'target', 'self', 'this', '__tbImport'])
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/**
 * Bare object names usable as identifiers in scripts: valid identifiers,
 * not colliding with the runtime API or the page's own function declarations.
 */
export function shortNamesFor(objectNames: string[], exclude: Iterable<string>): string[] {
  const ex = new Set(exclude)
  return objectNames.filter((n) => IDENT_RE.test(n) && !NAME_RESERVED.has(n) && !ex.has(n))
}

/**
 * One-shot `{{…}}` label resolution for a rendered page, reading through a
 * store-like `get`. Used by the live run-time wiring (via `wireDynamicText`)
 * and by the design-time preview, where the canvas shows the book's stored
 * values instead of the literal template.
 */
export function renderDynamicText(
  pageRoot: HTMLElement,
  page: { objects: PageObject[] },
  store: Pick<ToolbackStore, 'get'>,
): void {
  const resolveDyn = (path: string, obj: PageObject): string => {
    const dot = path.indexOf('.')
    if (dot === -1) return String(store.get(path) ?? '')
    // dotted paths resolve against the object itself: {{self.name}} /
    // {{this.name}} — every copy of an object shows its own name
    const [head, member] = [path.slice(0, dot), path.slice(dot + 1)]
    if ((head === 'self' || head === 'this') && member === 'name') return obj.name
    return '' // unsupported member — renders empty, like an unset store key
  }
  for (const obj of flattenObjects(page.objects)) {
    const key = contentKeyFor(obj.control)
    if (!key) continue
    const t = obj.props[key]
    if (typeof t !== 'string' || !t.includes('{{')) continue
    const el = controlElement(pageRoot, obj.name)
    if (!el) continue
    // resolve against the SOURCE, then render through the control's content
    // applier — markdown/HTML re-parse the substituted markup instead of
    // having their rendered DOM swapped for plain text
    applyContent(el, obj.control, t.replace(DYN_RE, (_, path: string) => resolveDyn(path, obj)))
  }
}

export function wireDynamicText(
  pageRoot: HTMLElement,
  page: { objects: PageObject[] },
  store: ToolbackStore,
  listeners: Array<() => void>,
): void {
  const hasTemplates = flattenObjects(page.objects).some((o) => {
    const key = contentKeyFor(o.control)
    if (!key) return false
    const v = o.props[key]
    return typeof v === 'string' && v.includes('{{')
  })
  if (!hasTemplates) return
  renderDynamicText(pageRoot, page, store)
  listeners.push(store.subscribe(() => renderDynamicText(pageRoot, page, store)))
}

// ---- popups (the ToolBook viewer mechanism) ----

export interface PopupOptions {
  /** block the page behind (default true); backdrop click closes */
  modal?: boolean
  /** 'auto' = styled title bar with the page name + ✕; 'none' = bare page */
  chrome?: 'auto' | 'none'
  /** position in canvas coordinates; default centred over the page */
  x?: number
  y?: number
}

export interface PopupHandle {
  readonly name: string
  close(): void
}

/**
 * One execution context: the base page (scopes[0]) or an open popup.
 * Controls/listeners/page functions are per scope; book/store
 * are shared through the RunState.
 */
interface Scope {
  idx: number
  root: HTMLElement
  /** explicit box for a nested surface (popup); the base page measures the window */
  container?: CanvasSize
  controls: Record<string, ControlApi>
  listeners: Array<() => void>
  pageFns: Record<string, (e?: unknown) => unknown>
  popup: { name: string; modal: boolean; chrome: 'auto' | 'none'; box: HTMLElement; backdrop: HTMLElement | null } | null
  navLock: boolean
}

interface RunState {
  book: Book
  root: HTMLElement
  onError?: (message: string) => void
  onPopups?: (open: string[]) => void
  store: ToolbackStore
  scopes: Scope[]
  bgFns: Map<string, Record<string, (e?: unknown) => unknown>>
  popupLayer: HTMLElement | null
}

function safeRun(st: RunState, what: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    st.onError?.(`${what}: ${String(err)}`)
  }
}

function scopeOfPageName(st: RunState, name: string): Scope | null {
  return st.scopes.find((s) => (st.book.pages[s.idx] ?? st.book.pages[0]!).name === name) ?? null
}

function openPopupNames(st: RunState): string[] {
  return st.scopes.slice(1).map((s) => (st.book.pages[s.idx] ?? st.book.pages[0]!).name)
}

function notifyPopups(st: RunState): void {
  st.onPopups?.(openPopupNames(st))
}

function popupLayerOf(st: RunState): HTMLElement {
  if (st.popupLayer?.isConnected) return st.popupLayer
  const doc = st.root.ownerDocument
  const layer = doc.createElement('div')
  layer.className = 'tb-popup-layer'
  ;(st.root.parentElement ?? st.root).appendChild(layer)
  st.popupLayer = layer
  return layer
}

function removePopupLayer(st: RunState): void {
  st.popupLayer?.remove()
  st.popupLayer = null
}

/** close one popup: pageLeave → listeners off → DOM + scope out */
function closePopup(st: RunState, scope: Scope): void {
  const i = st.scopes.indexOf(scope)
  if (i === -1) return
  st.scopes.splice(i, 1)
  const leave = scope.pageFns['pageLeave']
  if (typeof leave === 'function') {
    safeRun(st, 'pageLeave', () => {
      Promise.resolve(leave()).catch((err) => st.onError?.(`pageLeave: ${String(err)}`))
    })
  }
  for (const un of scope.listeners) un()
  scope.listeners = []
  scope.popup?.backdrop?.remove()
  scope.popup?.box.remove()
  notifyPopups(st)
}

function closeTopModalPopup(st: RunState): boolean {
  for (let i = st.scopes.length - 1; i >= 1; i--) {
    const s = st.scopes[i]!
    if (s.popup?.modal) {
      closePopup(st, s)
      return true
    }
  }
  return false
}

/** Esc in run mode: closes the topmost modal popup, if any. */
export function popupEscape(): boolean {
  if (!active) return false
  return closeTopModalPopup((active as unknown as { st: RunState }).st)
}

function ensureBackgroundFns(st: RunState, bg: Background | undefined, pageApi: unknown): Record<string, (e?: unknown) => unknown> {
  if (!bg) return {}
  let fns = st.bgFns.get(bg.id)
  if (!fns) {
    fns = {}
    if (bg.script?.trim()) {
      safeRun(st, 'background script', () => {
        const names = extractFunctionNames(bg.script)
        const returnObj = names
          .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
          .join(',')
        const factory = new Function(
          'api',
          'self',
          '__tbImport',
          `"use strict";\nconst { page, controls, store } = api;\n${rewriteLibImports(bg.script)}\n;return { ${returnObj} };`,
        )
        fns = ((factory({ page: pageApi, controls: {}, store: st.store }, undefined, toolbackImport) ?? {}) as Record<string, (e?: unknown) => unknown>)
      })
    }
    st.bgFns.set(bg.id, fns)
    const enter = fns['backgroundEnter']
    if (typeof enter === 'function') {
      safeRun(st, 'backgroundEnter', () => {
        Promise.resolve(enter()).catch((err) => st.onError?.(`backgroundEnter: ${String(err)}`))
      })
    }
  }
  return fns
}

function runPage(st: RunState, scope: Scope, idx: number): void {
  if (scope.navLock) return
  scope.navLock = true
  try {
    // navigating the base page closes any open popups (their pageLeave runs)
    if (scope === st.scopes[0] && st.scopes.length > 1) {
      for (const s of [...st.scopes.slice(1)]) closePopup(st, s)
    }
    const leave = scope.pageFns['pageLeave']
    if (typeof leave === 'function') {
      safeRun(st, 'pageLeave', () => {
        Promise.resolve(leave()).catch((err) => st.onError?.(`pageLeave: ${String(err)}`))
      })
    }
    for (const un of scope.listeners) un()
    scope.listeners = []

    scope.idx = idx
    const page = st.book.pages[idx] ?? st.book.pages[0]!
    const bg = backgroundFor(st.book, page)
    renderBookPage(st.book, idx, scope.root, scope.container)
    const pageRoot = scope.root.querySelector<HTMLElement>('.tb-page')!
    // background objects are first-class at run time: they get ControlApis,
    // can carry event scripts, and are addressable as controls[name] (names
    // are unique across the page and its background)
    const topLevel = [...(bg?.objects ?? []), ...page.objects]
    const flat = flattenObjects(topLevel)
    // the containing box each control's edges resolve against (used so
    // ControlApi reads agree with the render)
    const boxes = parentBoxMap(
      topLevel,
      pageBoxFor(page, scope.container ?? measureViewport(scope.root), topLevel),
    )

    for (const k of Object.keys(scope.controls)) delete scope.controls[k]
    for (const obj of flat) {
      const wrapper = controlWrapper(pageRoot, obj.name)
      const el = (wrapper?.firstElementChild as HTMLElement | null) ?? null
      if (el && wrapper) {
        scope.controls[obj.name] = makeControlApi(obj, el, wrapper, scope.listeners, boxes.get(obj.id))
      }
    }

    // per-scope page API: `page.go` in a popup navigates that popup
    const pageApi = makePageApi(st, scope)
    const api = { page: pageApi, controls: scope.controls, store: st.store }

    // background script first: its functions back the page script and the
    // backgroundEnter hook fires once per run, on the first member page
    const bgFns = ensureBackgroundFns(st, bg, pageApi)
    const bgFnNames = Object.keys(bgFns)

    scope.pageFns = {}
    if (page.script.trim()) {
      safeRun(st, 'page script', () => {
        const names = extractFunctionNames(page.script)
        const returnObj = names
          .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
          .join(',')
        const bare = shortNamesFor(
          flat.map((o) => o.name),
          [...names, ...bgFnNames],
        )
        const shortNames = bare.length > 0 ? `const { ${bare.join(', ')} } = controls;` : ''
        const factory = new Function(
          'api',
          'self',
          ...bgFnNames,
          '__tbImport',
          `"use strict";\nconst { page, controls, store } = api;\n${shortNames}\n${rewriteLibImports(page.script)}\n;return { ${returnObj} };`,
        )
        // `self` in a page script is the page API (self.name = the page name);
        // background functions arrive as parameters so page scripts can call them
        scope.pageFns = (factory(api, pageApi, ...bgFnNames.map((n) => bgFns[n]), toolbackImport) ?? {}) as Record<string, (e?: unknown) => unknown>
      })
    }
    const fnNames = Object.keys(scope.pageFns)

    /** the object that actually received the event — nearest data-tb-name element */
    const resolveTarget = (e: Event, fallback: ControlApi): ControlApi => {
      let el = e.target as HTMLElement | null
      while (el) {
        const name = el.dataset?.tbName
        if (name) {
          const found = scope.controls[name]
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
    walkTree([...(bg?.objects ?? []), ...page.objects], null)

    // compile every owner's event scripts once per page render
    const compiled = new Map<string, Map<string, (e: Event, self: ControlApi, forward: () => void) => void>>()
    for (const obj of flat) {
      const ctl = scope.controls[obj.name]
      if (!ctl) continue
      const perEvent = new Map<string, (e: Event, self: ControlApi, forward: () => void) => void>()
      for (const [eventName, script] of Object.entries(obj.on)) {
        if (!script || !script.trim()) continue
        try {
          const bare = shortNamesFor(flat.map((o) => o.name), [...fnNames, ...bgFnNames])
          const shortNames =
            bare.length > 0 ? `const { ${bare.join(', ')} } = controls;` : ''
          // `target` = the member that received the event; `self` = the
          // script owner (in a group script: the group itself); `forward()`
          // continues the message to the next enclosing handler. Page
          // functions with colliding names lose the reserved slots.
          const paramNames = [...new Set([...bgFnNames, ...fnNames, 'event', 'target', 'self', 'forward', '__tbImport'])]
          const factory = new Function(
            'api',
            ...paramNames,
            `"use strict";\nconst { page, controls, store } = api;\nreturn (async () => {\n${shortNames}\n${rewriteLibImports(script)}\n})();`,
          )
          perEvent.set(eventName, (e, self, forward) => {
            const args: unknown[] = [api]
            for (const p of paramNames) {
              if (p === 'event') args.push(e)
              else if (p === 'target') args.push(resolveTarget(e, ctl))
              else if (p === 'self') args.push(self)
              else if (p === 'forward') args.push(forward)
              else if (p === '__tbImport') args.push(toolbackImport)
              else args.push(scope.pageFns[p] ?? bgFns[p])
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
      const ctl = scope.controls[obj.name]
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
            compiled.get(owner.name)!.get(eventName)!(e, scope.controls[owner.name]!, forward)
          }
          forward()
        }
        ctl.el.addEventListener(eventName, dispatch)
        scope.listeners.push(() => ctl.el.removeEventListener(eventName, dispatch))
      }
    }

    wireDynamicText(pageRoot, { objects: [...(bg?.objects ?? []), ...page.objects] }, st.store, scope.listeners)

    scope.navLock = false
    const enter = scope.pageFns['pageEnter']
    if (typeof enter === 'function') {
      safeRun(st, 'pageEnter', () => {
        Promise.resolve(enter()).catch((err) => st.onError?.(`pageEnter: ${String(err)}`))
      })
    }
  } finally {
    scope.navLock = false
  }
}

function makePageApi(st: RunState, scope: Scope) {
  return {
    get name(): string {
      return (st.book.pages[scope.idx] ?? st.book.pages[0]!).name
    },
    get names(): string[] {
      return st.book.pages.map((p) => p.name)
    },
    get popups(): string[] {
      return openPopupNames(st)
    },
    go(name: string): void {
      const i = st.book.pages.findIndex((p) => p.name === name)
      if (i === -1) {
        st.onError?.(`page.go: no page named "${name}"`)
        return
      }
      // a popup navigates itself; the base page navigates the book
      runPage(st, scope.popup ? scope : st.scopes[0]!, i)
    },
    popupOpen(pageName: string, opts: PopupOptions = {}): PopupHandle | null {
      const i = st.book.pages.findIndex((p) => p.name === pageName)
      if (i === -1) {
        st.onError?.(`page.popupOpen: no page named "${pageName}"`)
        return null
      }
      if (scopeOfPageName(st, pageName)) {
        st.onError?.(`page.popupOpen: "${pageName}" is already open`)
        return null
      }
      const page = st.book.pages[i]!
      const modal = opts.modal ?? true
      const chrome = opts.chrome ?? 'auto'
      const layer = popupLayerOf(st)
      const doc = layer.ownerDocument

      const box = doc.createElement('div')
      box.className = 'tb-popup'
      // the popup's own scope is created below — chrome/backdrop handlers
      // close IT (not the script's owning scope, which is often the base)
      const me: { scope: Scope | null } = { scope: null }
      const closeSelf = (): void => {
        if (me.scope) closePopup(st, me.scope)
      }
      let backdrop: HTMLElement | null = null
      if (modal) {
        backdrop = doc.createElement('div')
        backdrop.className = 'tb-popup-backdrop'
        backdrop.addEventListener('click', () => me.scope && closePopup(st, me.scope))
        layer.appendChild(backdrop)
      }
      if (chrome === 'auto') {
        const bar = doc.createElement('div')
        bar.className = 'tb-popup-chrome'
        const title = doc.createElement('span')
        title.textContent = page.name
        const close = doc.createElement('button')
        close.className = 'tb-popup-close'
        close.title = 'Close'
        close.textContent = '✕'
        close.addEventListener('click', () => me.scope && closePopup(st, me.scope))
        bar.append(title, close)
        // drag by the title bar to move the popup
        bar.addEventListener('pointerdown', (e: PointerEvent) => {
          if ((e.target as HTMLElement).closest('.tb-popup-close')) return
          e.preventDefault()
          const startX = e.clientX
          const startY = e.clientY
          const originX = box.offsetLeft
          const originY = box.offsetTop
          const move = (ev: PointerEvent): void => {
            box.style.left = `${originX + (ev.clientX - startX)}px`
            box.style.top = `${originY + (ev.clientY - startY)}px`
          }
          const up = (): void => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        })
        box.appendChild(bar)
      }
      const content = doc.createElement('div')
      content.className = 'tb-popup-content'
      box.appendChild(content)

      // size + position: a fixed page uses its own size, otherwise a sensible
      // default dialog size; placement defaults to centred over the base page
      const size = page.size ?? DEFAULT_DIALOG_SIZE
      content.style.width = `${size.width}px`
      content.style.height = `${size.height}px`
      const holder = st.root
      const x = opts.x ?? Math.round((holder.offsetWidth - size.width) / 2)
      const y = opts.y ?? Math.round((holder.offsetHeight - size.height) / 2)
      box.style.left = `${Math.max(0, holder.offsetLeft + x)}px`
      box.style.top = `${Math.max(0, holder.offsetTop + y)}px`
      layer.appendChild(box)

      const popupScope: Scope = {
        idx: i,
        root: content,
        container: size,
        controls: {},
        listeners: [],
        pageFns: {},
        popup: { name: page.name, modal, chrome, box, backdrop },
        navLock: false,
      }
      me.scope = popupScope
      st.scopes.push(popupScope)
      runPage(st, popupScope, i)
      notifyPopups(st)
      return {
        name: page.name,
        close: () => closePopup(st, popupScope),
      }
    },
    popupClose(name?: string): void {
      if (name === undefined) {
        const top = st.scopes[st.scopes.length - 1]
        if (top && top.popup) closePopup(st, top)
        return
      }
      const target = scopeOfPageName(st, name)
      if (target?.popup) closePopup(st, target)
      else st.onError?.(`page.popupClose: no popup named "${name}"`)
    },
    popupCloseAll(): void {
      for (const s of [...st.scopes.slice(1)]) closePopup(st, s)
    },
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
  onError?: (message: string) => void,
  startPageIndex = 0,
  onPopups?: (open: string[]) => void,
): RunHandle {
  stopRun()

  // every run starts from the book's design-time store — run mutations are
  // ephemeral and never write back into the book
  const store = createStore(book.store ?? [])
  const baseScope: Scope = {
    idx: startPageIndex,
    root,
    controls: {},
    listeners: [],
    pageFns: {},
    popup: null,
    navLock: false,
  }
  const st: RunState = {
    book,
    root,
    onError,
    onPopups,
    store,
    scopes: [baseScope],
    bgFns: new Map(),
    popupLayer: null,
  }

  runPage(st, baseScope, startPageIndex)

  active = {
    store,
    get controls() {
      // base page + open popups; popups win on name collisions while open
      const merged: Record<string, ControlApi> = {}
      for (const s of st.scopes) Object.assign(merged, s.controls)
      return merged
    },
    stop: () => {
      for (const s of st.scopes) {
        for (const un of s.listeners) un()
        s.listeners = []
      }
      removePopupLayer(st)
      st.scopes = st.scopes.slice(0, 1)
    },
  }
  // expose the raw state for popupEscape()
  ;(active as unknown as { st: RunState }).st = st
  return active
}
