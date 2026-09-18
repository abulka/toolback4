import type { Book, ControlKind, FitHintMode, FitHintOptions, Rect } from '@toolback/format'
import { normalizeFitHints, resolveStartPageIndex } from '@toolback/format'
import {
  createStore,
  getObjectRects,
  measureViewport,
  renderBackgroundView,
  renderBookPage,
  renderDynamicText,
} from './index'
import { createDesignController, type DesignOutMessage, type HandleDir } from './design'
import { popupEscape, runBook, stopRun, isRunActive } from './player'
import { startAuthorMode, stopAuthor, syncAuthorScripts } from './author'
import { loadShelfManifest, setLibMap } from './libs'
import type { ObjectRects } from './index'

/**
 * What the canvas is showing: a page (runtime + design), or a background's
 * own objects in design view. Run mode always resolves to a page — the first
 * page using that background.
 */
export type ToolbackView = { kind: 'page'; index: number } | { kind: 'background'; id: string }

export type EditorToCanvasMessage =
  | {
      type: 'toolback:load'
      book: Book
      pageIndex?: number
      view?: ToolbackView
      design?: boolean
      selection?: string[] | null
      /** how edge-spring hints are drawn (toolbar control: mode + options) */
      fitHints?: FitHintOptions | FitHintMode
    }
  | { type: 'toolback:dragOver'; control: ControlKind; rect: Rect }
  | { type: 'toolback:dragEnd' }
  | { type: 'toolback:esc' }
  | { type: 'toolback:authorStart'; book: Book; pageIndex: number }
  | { type: 'toolback:authorStop' }
  | { type: 'toolback:smoke'; id: number; book: Book }

export type CanvasToEditorMessage =
  | { type: 'toolback:ready' }
  | { type: 'toolback:viewport'; width: number; height: number }
  | { type: 'toolback:rects'; rects: ObjectRects }
  | { type: 'toolback:selection'; ids: string[] }
  | { type: 'toolback:commit'; kind: 'move' | 'resize'; objects: Array<{ id: string; rect: Rect }>; dir?: HandleDir }
  | { type: 'toolback:scriptError'; message: string }
  | { type: 'toolback:error'; message: string }
  | { type: 'toolback:runToggle' }
  | { type: 'toolback:store'; entries: Array<[string, unknown]> }
  | { type: 'toolback:popups'; open: string[] }
  | { type: 'toolback:bgClick' }
  | { type: 'toolback:authorCall'; id: number; op: string; args: unknown }
  | { type: 'toolback:authorState'; active: boolean; pageName?: string }
  | { type: 'toolback:reorder'; action: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'toolback:deleteSelection' }
  | { type: 'toolback:undo' }
  | { type: 'toolback:redo' }
  | { type: 'toolback:duplicate' }
  | { type: 'toolback:group' }
  | { type: 'toolback:ungroup' }
  | { type: 'toolback:copy' }
  | { type: 'toolback:cut' }
  | { type: 'toolback:paste' }
  | { type: 'toolback:smokeResult'; id: number; errors: string[] }

/** reply leg of the author bridge (editor → canvas) */
export type AuthorReplyMessage = {
  type: 'toolback:authorReply'
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

export type CanvasMessageSender = (msg: CanvasToEditorMessage) => void

/**
 * Z-order shortcut (⌘]/⌘[ and ⌘⇧]/⌘⇧[): forward/backward / to-front/to-back.
 * null when the keys don't map to a z-order action.
 */
export function zOrderActionOf(e: KeyboardEvent): 'front' | 'back' | 'forward' | 'backward' | null {
  if (!e.metaKey || e.altKey || e.ctrlKey) return null
  if (e.code === 'BracketRight') return e.shiftKey ? 'front' : 'forward'
  if (e.code === 'BracketLeft') return e.shiftKey ? 'back' : 'backward'
  return null
}

/** Delete/Backspace deletes the current selection (design tools convention) */
export function isDeleteSelectionKey(e: KeyboardEvent): boolean {
  return (
    !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace')
  )
}

/** Undo/redo shortcut (⌘Z / ⌘⇧Z, or Ctrl): 'undo' | 'redo' | null */
export function isUndoKey(e: KeyboardEvent): 'undo' | 'redo' | null {
  if ((!e.metaKey && !e.ctrlKey) || e.altKey) return null
  if (e.key.toLowerCase() !== 'z') return null
  return e.shiftKey ? 'redo' : 'undo'
}

/**
 * Whether e is an Alt+<letter> shortcut we own. Alt combos are text characters
 * on Mac (⌥D = ∂, ⌥G = ‰, ⌥U = umlaut dead key), so editable targets are
 * always excluded and left to the OS/IME.
 */
function isAltShortcutKey(e: KeyboardEvent, code: string): boolean {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false
  if (e.code !== code) return false
  const el = e.target as HTMLElement | null
  if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) {
    return false
  }
  return true
}

/** Duplicate shortcut (⌥D / Alt+D). Skipped in editable targets. */
export function isDuplicateKey(e: KeyboardEvent): boolean {
  return isAltShortcutKey(e, 'KeyD')
}

/** Group/ungroup shortcut (⌥G / ⌥U, Alt+G / Alt+U): 'group' | 'ungroup' | null */
export function isGroupKey(e: KeyboardEvent): 'group' | 'ungroup' | null {
  if (isAltShortcutKey(e, 'KeyG')) return 'group'
  if (isAltShortcutKey(e, 'KeyU')) return 'ungroup'
  return null
}

/**
 * Clipboard shortcut (⌘C / ⌘V / ⌘X, or Ctrl): copy/paste/cut for the object
 * selection — but only outside editable targets, where the browser's own
 * text clipboard (script editors, inputs) must win.
 */
function isClipboardShortcut(e: KeyboardEvent, letter: string): boolean {
  if ((!e.metaKey && !e.ctrlKey) || e.altKey) return false
  if (e.key.toLowerCase() !== letter) return false
  const el = e.target as HTMLElement | null
  if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) {
    return false
  }
  return true
}

export function isCopyKey(e: KeyboardEvent): boolean {
  return isClipboardShortcut(e, 'c')
}

export function isCutKey(e: KeyboardEvent): boolean {
  return isClipboardShortcut(e, 'x')
}

export function isPasteKey(e: KeyboardEvent): boolean {
  return isClipboardShortcut(e, 'v')
}

/** Display label for a store value in the editor's store browser */
function storeValueLabel(v: unknown): string {
  if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}`
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/**
 * Store values cross postMessage as structured clones — functions (and other
 * non-cloneables) can't travel that way, so they arrive as a label sentinel.
 * Usable values (strings/numbers/booleans/null/plain data) are sent raw so
 * the editor can offer an exact "copy to design".
 */
export function serializeStoreValue(v: unknown): unknown {
  if (typeof v === 'function') return { ['__tbLabel']: storeValueLabel(v) }
  try {
    structuredClone(v)
    return v
  } catch {
    return { ['__tbLabel']: storeValueLabel(v) }
  }
}

export function isStoreLabelSentinel(v: unknown): v is { __tbLabel: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { __tbLabel?: unknown }).__tbLabel === 'string'
  )
}

/**
 * Run-mode toggle keys: F3 (ToolBook heritage) and ⌥3 / Alt+3 (no fn-key needed).
 * ⌥3 toggles everywhere, even in editable targets — the capture-phase handler
 * preventDefaults before Monaco/OS text insertion, so no £ is typed.
 */
export function shouldToggleRun(e: KeyboardEvent): boolean {
  if (e.repeat) return false
  const isF3 = e.key === 'F3' || e.code === 'F3'
  if (isF3) return true
  return (
    e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'Digit3'
  )
}

export function listenForEditor(
  root: HTMLElement = document.body,
  send: CanvasMessageSender = (m) => window.parent.postMessage(m, '*'),
): () => void {
  // preview parity for user-script library imports: shelf URLs, esm.sh fallback
  // happens lazily inside __tbImport for anything not on the shelf
  void loadShelfManifest()
    .then(setLibMap)
    .catch(() => setLibMap({}))

  const design = createDesignController((msg: DesignOutMessage) => send(msg))

  let wrapper: HTMLElement | null = null
  let holder: HTMLElement | null = null
  let storeUnsub: (() => void) | null = null

  function stopStoreStream(): void {
    storeUnsub?.()
    storeUnsub = null
    send({ type: 'toolback:store', entries: [] })
  }

  // ---- author-mode bridge: plugin scripts call author.<op>(args) which
  // round-trips through the editor; replies resolve the pending promise ----
  let authorCallId = 0
  const authorPending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

  function authorCaller(op: string, args: unknown): Promise<unknown> {
    const id = ++authorCallId
    return new Promise((resolve, reject) => {
      authorPending.set(id, { resolve, reject })
      send({ type: 'toolback:authorCall', id, op, args })
    })
  }

  function handleAuthorReply(data: { id: number; ok: boolean; result?: unknown; error?: string }): void {
    const pending = authorPending.get(data.id)
    if (!pending) return
    authorPending.delete(data.id)
    if (data.ok) pending.resolve(data.result)
    else pending.reject(new Error(data.error ?? 'author op failed'))
  }

  function ensureStructure(): void {
    if (wrapper && wrapper.isConnected && holder) return
    const doc = root.ownerDocument
    // a full-viewport gutter sits behind the (centred, page-sized) wrapper so a
    // click outside a fixed-size page deselects, just like empty page space
    const gutter = doc.createElement('div')
    gutter.className = 'tb-canvas-gutter'
    gutter.addEventListener('pointerdown', () => {
      if (design.enabled) design.clearSelection()
    })
    root.appendChild(gutter)
    wrapper = doc.createElement('div')
    wrapper.className = 'tb-canvas-root'
    holder = doc.createElement('div')
    holder.className = 'tb-page-holder'
    wrapper.appendChild(holder)
    root.appendChild(wrapper)
    design.attach(wrapper)
  }

  function sendViewport(): void {
    if (!holder) return
    const size = measureViewport(holder)
    send({ type: 'toolback:viewport', width: size.width, height: size.height })
  }

  /**
   * Run a book off-screen for a short window and report its script errors.
   * Used to smoke-test AI-generated books before they touch the real project.
   * Skipped while a design run is active so it can't disturb the user.
   */
  function runSmoke(book: Book, id: number): void {
    if (isRunActive()) {
      send({ type: 'toolback:smokeResult', id, errors: [] })
      return
    }
    const doc = root.ownerDocument
    const errors: string[] = []
    const hidden = doc.createElement('div')
    hidden.style.cssText =
      'position:absolute;left:-10000px;top:0;width:800px;height:600px;overflow:hidden'
    root.appendChild(hidden)
    let handle: ReturnType<typeof runBook> | null = null
    try {
      handle = runBook(book, hidden, (message) => errors.push(message), resolveStartPageIndex(book))
    } catch (err) {
      errors.push(String(err))
    }
    setTimeout(() => {
      try {
        handle?.stop()
      } catch {
        /* already stopped */
      }
      hidden.remove()
      send({ type: 'toolback:smokeResult', id, errors })
    }, 400)
  }

  /** a fluid page fills the viewport, so its wrapper spans the full width; a
   *  fixed page keeps the wrapper at the page size so it can centre */
  function syncCanvasWidth(): void {
    if (!wrapper || !holder) return
    const pageRoot = holder.querySelector<HTMLElement>('.tb-page')
    const fluid = !!pageRoot && pageRoot.style.width === '100%'
    wrapper.classList.toggle('tb-canvas-root--fluid', fluid)
  }

  function renderLoad(data: Extract<EditorToCanvasMessage, { type: 'toolback:load' }>): void {
    try {
      ensureStructure()
      // note: design re-renders (undo, prop edits, plugin-driven inserts)
      // must NOT tear the author plugin down — the box lives in its own
      // layer beside the page holder; it stops via authorStop/toggleRun
      const fallbackIndex = Number.isInteger(data.pageIndex) ? (data.pageIndex as number) : 0
      const view: ToolbackView = data.view ?? { kind: 'page', index: fallbackIndex }
      // run mode always plays a page: a background view resolves to the first
      // page using that background
      const runIndexFor = (): number => {
        if (view.kind === 'page') return view.index
        const i = data.book.pages.findIndex((p) => p.backgroundId === view.id)
        return i === -1 ? 0 : i
      }
      if (data.design) {
        stopStoreStream()
        stopRun()
        if (view.kind === 'background') {
          renderBackgroundView(data.book, view.id, holder!)
        } else {
          renderBookPage(data.book, view.index, holder!)
        }
        const pageRoot = holder!.querySelector<HTMLElement>('.tb-page')
        // set the fluid wrapper class BEFORE measuring: a fluid page is
        // `width:100%`, so the wrapper must span the viewport first or the
        // first-measured rects/page box come out against a collapsed wrapper
        // (right/bottom anchors then look wrong until the next navigation)
        syncCanvasWidth()
        // design-time preview: {{key}} labels resolve against the book's
        // stored values, so the canvas shows what a run will seed (unset keys
        // render empty, exactly like at run time)
        if (pageRoot) {
          const page =
            view.kind === 'background'
              ? { objects: data.book.backgrounds.find((b) => b.id === view.id)?.objects ?? [] }
              : (data.book.pages[view.index] ?? data.book.pages[0]!)
          renderDynamicText(pageRoot, page, createStore(data.book.store ?? []))
        }
        send({ type: 'toolback:rects', rects: pageRoot ? getObjectRects(pageRoot) : {} })
        design.setEnabled(true)
        design.setFitHints(normalizeFitHints(data.fitHints))
        design.onRendered(data.selection ?? [])
        // a running author plugin hot-reloads when its page's scripts changed
        syncAuthorScripts(data.book)
      } else {
        design.setEnabled(false)
        const handle = runBook(
          data.book,
          holder!,
          (message) => send({ type: 'toolback:scriptError', message }),
          runIndexFor(),
          (open) => send({ type: 'toolback:popups', open }),
        )
        const pageRoot = holder!.querySelector<HTMLElement>('.tb-page')
        syncCanvasWidth()
        send({ type: 'toolback:rects', rects: pageRoot ? getObjectRects(pageRoot) : {} })

        // stream store contents to the editor's store browser
        stopStoreStream()
        const sendStore = (): void => {
          send({
            type: 'toolback:store',
            entries: handle.store.snapshot().map(([k, v]) => [k, serializeStoreValue(v)]),
          })
        }
        sendStore()
        storeUnsub = handle.store.subscribe(sendStore)
      }
      sendViewport()
    } catch (err) {
      send({ type: 'toolback:error', message: String(err) })
    }
  }

  const onMessage = (e: MessageEvent): void => {
    const data = e.data as EditorToCanvasMessage | undefined
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('toolback:')) return
    if (data.type === 'toolback:dragOver') {
      design.dragOver(data.control, data.rect)
      return
    }
    if (data.type === 'toolback:dragEnd') {
      design.dragEnd()
      return
    }
    if (data.type === 'toolback:esc') {
      // editor-window Esc: close the topmost modal popup in run mode
      popupEscape()
      return
    }
    if (data.type === 'toolback:authorStart') {
      try {
        ensureStructure()
        const handle = startAuthorMode(
          data.book,
          data.pageIndex,
          holder!,
          (message) => send({ type: 'toolback:scriptError', message }),
          (op, args) => authorCaller(op, args),
          (active) => send({ type: 'toolback:authorState', active }),
        )
        // the sync onState(true) above has no page name — send the full state
        send({ type: 'toolback:authorState', active: true, pageName: handle.pageName })
      } catch (err) {
        send({ type: 'toolback:error', message: String(err) })
      }
      return
    }
    if (data.type === 'toolback:authorStop') {
      stopAuthor()
      return
    }
    if (data.type === 'toolback:smoke') {
      runSmoke(data.book, data.id)
      return
    }
    // the bridge reply path (typed loosely — it's a distinct message kind)
    if ((data as { type?: string }).type === 'toolback:authorReply') {
      handleAuthorReply(data as unknown as { id: number; ok: boolean; result?: unknown; error?: string })
      return
    }
    if (data.type !== 'toolback:load') return
    renderLoad(data)
  }

  // keydowns inside the canvas never reach the editor window, so editor-wide
// shortcuts must also live here (focus is commonly in the canvas, e.g. right
// after clicking Run and interacting with the page). Z-order and Delete only
// apply in design mode.
const onKey = (e: KeyboardEvent): void => {
  if (e.repeat) return
  if (shouldToggleRun(e)) {
    e.preventDefault()
    e.stopPropagation()
    send({ type: 'toolback:runToggle' })
    return
  }
  if (design.enabled) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      design.escape()
      return
    }
    const ur = isUndoKey(e)
    if (ur) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: ur === 'undo' ? 'toolback:undo' : 'toolback:redo' })
      return
    }
    if (isDuplicateKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:duplicate' })
      return
    }
    const gk = isGroupKey(e)
    if (gk) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: gk === 'group' ? 'toolback:group' : 'toolback:ungroup' })
      return
    }
    if (isCopyKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:copy' })
      return
    }
    if (isCutKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:cut' })
      return
    }
    if (isPasteKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:paste' })
      return
    }
    const action = zOrderActionOf(e)
    if (action) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:reorder', action })
      return
    }
    if (isDeleteSelectionKey(e)) {
      e.preventDefault()
      e.stopPropagation()
      send({ type: 'toolback:deleteSelection' })
      return
    }
  } else {
    // run mode: Esc closes the topmost modal popup
    if (e.key === 'Escape' && popupEscape()) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}
  // CSS repositions the page and its controls on resize, so design mode only
  // re-measures the overlay (no re-render, which would reset selection/scroll);
  // the editor store still needs the fresh viewport for its own geometry
  const onResize = (): void => {
    if (!wrapper) return
    sendViewport()
    if (design.enabled) design.refresh()
  }

  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', onResize)

  window.addEventListener('message', onMessage)
  send({ type: 'toolback:ready' })

  return () => {
    window.removeEventListener('message', onMessage)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', onResize)
  }
}
