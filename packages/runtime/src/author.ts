import type { Book, Breakpoint, Rect } from '@toolback/format'
import { flattenObjects } from '@toolback/format'
import { renderBookPage } from './index'
import { rewriteLibImports, toolbackImport } from './libs'
import {
  controlWrapper,
  extractFunctionNames,
  makeControlApi,
  wireDynamicText,
  type ControlApi,
  type ToolbackStore,
} from './player'

/**
 * Author mode (M6c): a page runs as a floating "plugin" while the book stays
 * fully editable underneath. Plugin scripts get the regular API (page,
 * controls, store) plus `author` — an async bridge to the editor (selection,
 * insertion, properties, commands). `pageEnter()` on the plugin page fires
 * when the box opens, so one convention covers both run and author mode.
 */

/** ops the editor executes; see authorBridge.ts on the editor side */
export type AuthorOp =
  | 'getSelection'
  | 'getSelectionJson'
  | 'selectionJson'
  | 'getObject'
  | 'insertControl'
  | 'updateProps'
  | 'moveObject'
  | 'command'
  | 'pageInfo'
  | 'message'

export type AuthorCaller = (op: AuthorOp, args: unknown) => Promise<unknown>

export interface AuthorHandle {
  readonly pageName: string
  readonly store: ToolbackStore
  stop(): void
}

/**
 * A live reference to an object in the book being edited. Returned by
 * `author.selected()`, `author.insertControl()` and `author.command('group')`.
 * Methods are async (every call is a fresh round-trip — no stale snapshots):
 *
 *   const g = await author.command('group')  // the handle IS the group
 *   await g.move(20, 0)
 *   await g.set({ color: 'navy', x: 120 })
 *   const y = await g.get('y')
 */
export interface AuthorObject {
  /** stable id — usable with author.updateProps / author.selectionJson */
  readonly id: string
  readonly name: string
  readonly control: string
  /** read one property (x, y, width, height, text, color, …) or all (no key) */
  get(key?: string): Promise<unknown>
  /** write props AND geometry (x/y/width/height), resolved editor-side */
  set(patch: Record<string, unknown>): Promise<{ id: string }>
  /** offset this object by (dx, dy) — one undoable step */
  move(dx: number, dy: number): Promise<{ id: string }>
}

/**
 * Wire format for a handle crossing the bridge (the runtime swaps this for
 * a live AuthorObject before user code sees it).
 */
export interface AuthorObjectRef {
  __authorRef: true
  id: string
  name: string
  control: string
}

export function isAuthorObjectRef(v: unknown): v is AuthorObjectRef {
  return typeof v === 'object' && v !== null && (v as AuthorObjectRef)['__authorRef'] === true
}

function escapeSel(name: string): string {
  return name.replace(/[\\"]/g, '\\$&')
}

function safeRun(onError: ((m: string) => void) | undefined, what: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    onError?.(`${what}: ${String(err)}`)
  }
}

let activeAuthor: AuthorHandle | null = null

/**
 * Everything needed to hot-reload a running plugin: the author box compiles
 * scripts once at start, so without this book edits (fixing a script while
 * the plugin is live) would never take effect.
 */
interface AuthorSession {
  handle: AuthorHandle
  pageId: string
  fingerprint: string
  box: HTMLElement
  start: {
    holder: HTMLElement
    breakpoint: Breakpoint
    onError?: (message: string) => void
    call?: AuthorCaller
    onState?: (active: boolean) => void
  }
}

let activeSession: AuthorSession | null = null

/** what the plugin compiles: its page script + every object's event handlers */
function scriptFingerprint(page: { script: string; objects: import('@toolback/format').PageObject[] }): string {
  const handlers = flattenObjects(page.objects)
    .filter((o) => Object.keys(o.on ?? {}).length > 0)
    .map((o) => [o.id, o.on])
  return page.script + '\u0000' + JSON.stringify(handlers)
}

/**
 * Hot-reload the running plugin when its scripts changed in the book
 * (called by the editor link on every design render). A restart re-runs
 * `pageEnter()` and resets the plugin's session store — the natural
 * "I changed the code" expectation. Stops the plugin if its page is gone.
 */
export function syncAuthorScripts(book: Book): void {
  const s = activeSession
  if (!s) return
  const page = book.pages.find((p) => p.id === s.pageId)
  if (!page) {
    s.handle.stop()
    return
  }
  const fp = scriptFingerprint(page)
  if (fp === s.fingerprint) return
  // preserve the author's box position across the restart
  const position = { left: s.box.style.left, top: s.box.style.top }
  s.handle.stop()
  startAuthorMode(
    book,
    book.pages.indexOf(page),
    s.start.holder,
    s.start.breakpoint,
    s.start.onError,
    s.start.call,
    s.start.onState,
  )
  if (activeSession) {
    activeSession.box.style.left = position.left
    activeSession.box.style.top = position.top
  }
}

export function stopAuthor(): void {
  activeAuthor?.stop()
  activeAuthor = null
}

export function authorActive(): boolean {
  return activeAuthor !== null
}

/**
 * Open `pageIndex` in a floating author box. `call` is the bridge to the
 * editor; the plugin's `pageEnter()` fires once the box is live.
 */
export function startAuthorMode(
  book: Book,
  pageIndex: number,
  holder: HTMLElement,
  breakpoint: Breakpoint,
  onError?: (message: string) => void,
  call?: AuthorCaller,
  onState?: (active: boolean) => void,
): AuthorHandle {
  stopAuthor()

  const doc = holder.ownerDocument
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const layer = doc.createElement('div')
  layer.className = 'tb-author-layer'
  const box = doc.createElement('div')
  box.className = 'tb-popup tb-author'
  const bar = doc.createElement('div')
  bar.className = 'tb-popup-chrome'
  const title = doc.createElement('span')
  title.textContent = `Author · ${page.name}`
  const close = doc.createElement('button')
  close.className = 'tb-popup-close'
  close.title = 'Stop author plugin'
  close.textContent = '✕'
  bar.append(title, close)
  const content = doc.createElement('div')
  content.className = 'tb-popup-content'
  box.append(bar, content)
  layer.appendChild(box)
  ;(holder.parentElement ?? holder).appendChild(layer)

  const stop = (): void => {
    for (const un of listeners) un()
    listeners.length = 0
    layer.remove()
    if (activeAuthor === handle) activeAuthor = null
    if (activeSession && activeSession.handle === handle) activeSession = null
    onState?.(false)
  }
  close.addEventListener('click', stop)

  // drag by the title bar (same pattern as run-mode popups)
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

  const store = ((): ToolbackStore => {
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
  })()

  // geometry: the plugin page renders like any page (its background decides
  // the size — a 320×240 background makes a compact plugin window)
  renderBookPage(book, pageIndex, content, breakpoint)
  const pageRoot = content.querySelector<HTMLElement>('.tb-page')!

  // placed top-left with a small offset so the base page stays visible
  box.style.left = `${holder.offsetLeft + 40}px`
  box.style.top = `${holder.offsetTop + 40}px`

  const listeners: Array<() => void> = []

  // ControlApis for the plugin page's objects; the background objects of the
  // plugin's background come along like at run time
  const bgObjects = book.backgrounds.find((b) => b.id === page.backgroundId)?.objects ?? []
  const flat = flattenObjects([...bgObjects, ...page.objects])

  const controls: Record<string, ControlApi> = {}
  for (const obj of flat) {
    const wrapper = controlWrapper(pageRoot, obj.name)
    const el = wrapper?.firstElementChild as HTMLElement | null
    if (el && wrapper) {
      controls[obj.name] = makeControlApi(obj, el, wrapper, breakpoint, listeners)
    }
  }

  const pageApi = {
    get name(): string {
      return page.name
    },
    names: book.pages.map((p) => p.name),
    go(): void {
      onError?.('page.go is not available in author mode (the book is being edited)')
    },
  }

  /**
   * Materialise a live AuthorObject from a bridge reply. Recurses arrays and
   * plain objects, so replies like `{ok, id, name}` with embedded refs or
   * arrays of refs come back fully usable.
   */
  const materialise = (v: unknown): unknown => {
    if (isAuthorObjectRef(v)) {
      return makeAuthorObject(v.id, v.name, v.control)
    }
    if (Array.isArray(v)) return v.map((x) => materialise(x))
    if (typeof v === 'object' && v !== null) {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v)) out[k] = materialise(val)
      return out
    }
    return v
  }

  /** a live handle: plain fields + async get/set/move through the bridge */
  const makeAuthorObject = (id: string, name: string, control: string): AuthorObject => ({
    id,
    name,
    control,
    async get(key?: string): Promise<unknown> {
      if (!call) throw new Error('author bridge unavailable')
      const snapshot = (await call('getObject', { id })) as Record<string, unknown> | null
      if (!snapshot) throw new Error(`author: object "${id}" no longer exists`)
      return key === undefined ? snapshot : snapshot[key]
    },
    async set(patch: Record<string, unknown>): Promise<{ id: string }> {
      if (!call) throw new Error('author bridge unavailable')
      const result = (await call('updateProps', [id, patch])) as { id: string }
      return { id: result.id }
    },
    async move(dx: number, dy: number): Promise<{ id: string }> {
      if (!call) throw new Error('author bridge unavailable')
      return (await call('moveObject', [id, dx, dy])) as { id: string }
    },
  })

  /** handles for the current selection (no extra round-trip: the
   * getSelection reply already carries ids/names/kinds) */
  const selected = async (): Promise<AuthorObject[]> => {
    if (!call) throw new Error('author bridge unavailable')
    const sel = (await call('getSelection', {})) as { ids: string[]; names: string[]; kinds: string[] }
    return sel.ids.map((id, i) => makeAuthorObject(id, sel.names[i] ?? '', sel.kinds[i] ?? ''))
  }
  /** full JSON snapshot of the selection (power tool — prefer handles) */
  const selectionJson = async (): Promise<unknown[]> => {
    if (!call) throw new Error('author bridge unavailable')
    return (await call('getSelectionJson', {})) as unknown[]
  }

  /** author.<op>(...args): round-trips through the editor, materialising any
   * object refs in the reply into live handles. `selected` and
   * `selectionJson` are handled locally and never reach the switch. */
  const authorApi = new Proxy({} as Record<string, unknown>, {
    get(_t, op: string): (...args: unknown[]) => Promise<unknown> | unknown {
      if (op === 'selected') return selected
      if (op === 'selectionJson') return selectionJson
      return async (...args: unknown[]) => {
        if (!call) throw new Error('author bridge unavailable')
        const reply = await call(op as never, args)
        return materialise(reply)
      }
    },
  })

  const api = { page: pageApi, controls, store, author: authorApi }

  const pageFns: Record<string, (e?: unknown) => unknown> = {}
  if (page.script.trim()) {
    safeRun(onError, 'author page script', () => {
      const names = extractFunctionNames(page.script)
      const returnObj = names
        .map((n) => `${JSON.stringify(n)}: typeof ${n} === 'function' ? ${n} : undefined`)
        .join(',')
      const bare = flattenObjects(page.objects)
        .map((o) => o.name)
        .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && !['page', 'controls', 'store', 'author', 'event', 'target', 'self', 'this', '__tbImport'].includes(n) && !names.includes(n))
      const shortNames = bare.length ? `const { ${bare.join(', ')} } = controls;` : ''
      const factory = new Function(
        'api',
        'self',
        '__tbImport',
        `"use strict";\nconst { page, controls, store, author } = api;\n${shortNames}\n${rewriteLibImports(page.script)}\n;return { ${returnObj} };`,
      )
      Object.assign(pageFns, (factory(api, pageApi, toolbackImport) ?? {}) as Record<string, (e?: unknown) => unknown>)
    })
  }

  // object event handlers (direct: no group chain in author mode v1)
  for (const obj of flattenObjects(page.objects)) {
    if (obj.control === 'group') continue
    const ctl = controls[obj.name]
    if (!ctl) continue
    for (const [eventName, script] of Object.entries(obj.on)) {
      if (!script?.trim()) continue
      try {
        const fnNames = Object.keys(pageFns)
        const paramNames = [...new Set([...fnNames, 'event', 'target', 'self', '__tbImport'])]
        const bare = flattenObjects(page.objects)
          .map((o) => o.name)
          .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && !['page', 'controls', 'store', 'author', 'event', 'target', 'self', 'this', '__tbImport'].includes(n) && !paramNames.includes(n))
        const shortNames = bare.length ? `const { ${bare.join(', ')} } = controls;` : ''
        const factory = new Function(
          'api',
          ...paramNames,
          `"use strict";\nconst { page, controls, store, author } = api;\nreturn (async () => {\n${shortNames}\n${rewriteLibImports(script)}\n})();`,
        )
        const handler = (e: Event): void => {
          const args: unknown[] = [api]
          for (const p of paramNames) {
            if (p === 'event') args.push(e)
            else if (p === 'target' || p === 'self') args.push(ctl)
            else if (p === '__tbImport') args.push(toolbackImport)
            else args.push(pageFns[p])
          }
          safeRun(onError, `${obj.name}.${eventName}`, () => {
            Promise.resolve(factory.call(ctl, ...args)).catch((err) =>
              onError?.(`${obj.name}.${eventName}: ${String(err)}`),
            )
          })
        }
        ctl.el.addEventListener(eventName, handler)
        listeners.push(() => ctl.el.removeEventListener(eventName, handler))
      } catch (err) {
        onError?.(`${obj.name}.${eventName}: ${String(err)}`)
      }
    }
  }

  wireDynamicText(pageRoot, { objects: flat }, store, listeners)

  const handle: AuthorHandle = {
    pageName: page.name,
    store,
    stop,
  }
  activeAuthor = handle
  activeSession = {
    handle,
    pageId: page.id,
    fingerprint: scriptFingerprint(page),
    box,
    start: {
      holder,
      breakpoint,
      onError,
      call,
      onState,
    },
  }
  onState?.(true)

  const enter = pageFns['pageEnter']
  if (typeof enter === 'function') {
    safeRun(onError, 'author pageEnter', () => {
      Promise.resolve(enter()).catch((err) => onError?.(`author pageEnter: ${String(err)}`))
    })
  }

  return handle
}
