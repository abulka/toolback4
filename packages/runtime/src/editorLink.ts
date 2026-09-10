import type { Book, Breakpoint, ControlKind, Rect } from '@toolback/format'
import { getObjectRects, renderBookPage } from './index'
import { createDesignController, type DesignOutMessage } from './design'
import { runBook, stopRun } from './player'
import type { ObjectRects } from './index'

export type EditorToCanvasMessage =
  | {
      type: 'toolback:load'
      book: Book
      breakpoint?: Breakpoint
      pageIndex?: number
      design?: boolean
      selection?: string[] | null
    }
  | { type: 'toolback:dragOver'; control: ControlKind; rect: Rect }
  | { type: 'toolback:dragEnd' }

export type CanvasToEditorMessage =
  | { type: 'toolback:ready' }
  | { type: 'toolback:rects'; rects: ObjectRects }
  | { type: 'toolback:selection'; ids: string[] }
  | { type: 'toolback:commit'; kind: 'move' | 'resize'; objects: Array<{ id: string; rect: Rect }> }
  | { type: 'toolback:scriptError'; message: string }
  | { type: 'toolback:error'; message: string }
  | { type: 'toolback:runToggle' }
  | { type: 'toolback:store'; entries: Array<[string, string]> }
  | { type: 'toolback:reorder'; action: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'toolback:deleteSelection' }

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
 * Run-mode toggle keys: F3 (ToolBook heritage) and ⌥3 / Alt+3 (no fn-key needed).
 * ⌥3 is skipped while typing in editable targets — on Mac it is a text character.
 */
export function shouldToggleRun(e: KeyboardEvent): boolean {
  if (e.repeat) return false
  const isF3 = e.key === 'F3' || e.code === 'F3'
  if (isF3) return true
  const isAlt3 =
    e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'Digit3'
  if (!isAlt3) return false
  const el = e.target as HTMLElement | null
  const editable =
    !!el &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el.isContentEditable)
  return !editable
}

export function listenForEditor(
  root: HTMLElement = document.body,
  send: CanvasMessageSender = (m) => window.parent.postMessage(m, '*'),
): () => void {
  const design = createDesignController((msg: DesignOutMessage) => send(msg))

  let wrapper: HTMLElement | null = null
  let holder: HTMLElement | null = null
  let storeUnsub: (() => void) | null = null

  function stopStoreStream(): void {
    storeUnsub?.()
    storeUnsub = null
    send({ type: 'toolback:store', entries: [] })
  }

  function ensureStructure(): void {
    if (wrapper && wrapper.isConnected && holder) return
    const doc = root.ownerDocument
    wrapper = doc.createElement('div')
    wrapper.className = 'tb-canvas-root'
    holder = doc.createElement('div')
    holder.className = 'tb-page-holder'
    wrapper.appendChild(holder)
    root.appendChild(wrapper)
    design.attach(wrapper)
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
    if (data.type !== 'toolback:load') return
    try {
      ensureStructure()
      const pageIndex = Number.isInteger(data.pageIndex) ? (data.pageIndex as number) : 0
      if (data.design) {
        stopStoreStream()
        stopRun()
        renderBookPage(data.book, pageIndex, holder!, data.breakpoint ?? 'desktop')
        const pageRoot = holder!.querySelector<HTMLElement>('.tb-page')
        send({ type: 'toolback:rects', rects: pageRoot ? getObjectRects(pageRoot) : {} })
        design.setEnabled(true)
        design.onRendered(data.selection ?? [])
      } else {
        design.setEnabled(false)
        const handle = runBook(
          data.book,
          holder!,
          data.breakpoint ?? 'desktop',
          (message) => send({ type: 'toolback:scriptError', message }),
          pageIndex,
        )
        const pageRoot = holder!.querySelector<HTMLElement>('.tb-page')
        send({ type: 'toolback:rects', rects: pageRoot ? getObjectRects(pageRoot) : {} })

        // stream store contents to the editor's store browser
        stopStoreStream()
        const sendStore = (): void => {
          send({
            type: 'toolback:store',
            entries: handle.store.snapshot().map(([k, v]) => [k, storeValueLabel(v)]),
          })
        }
        sendStore()
        storeUnsub = handle.store.subscribe(sendStore)
      }
    } catch (err) {
      send({ type: 'toolback:error', message: String(err) })
    }
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
    }
  }
  window.addEventListener('keydown', onKey, true)

  window.addEventListener('message', onMessage)
  send({ type: 'toolback:ready' })

  return () => {
    window.removeEventListener('message', onMessage)
    window.removeEventListener('keydown', onKey, true)
  }
}
