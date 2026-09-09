import type { Book, Breakpoint, Rect } from '@toolback/format'
import { getObjectRects, renderBook } from './index'
import { createDesignController, type DesignOutMessage } from './design'
import type { ObjectRects } from './index'

export type EditorToCanvasMessage = {
  type: 'toolback:load'
  book: Book
  breakpoint?: Breakpoint
  design?: boolean
  selection?: string | null
}

export type CanvasToEditorMessage =
  | { type: 'toolback:ready' }
  | { type: 'toolback:rects'; rects: ObjectRects }
  | { type: 'toolback:selection'; id: string | null }
  | { type: 'toolback:commit'; kind: 'move' | 'resize'; id: string; rect: Rect }
  | { type: 'toolback:error'; message: string }

export type CanvasMessageSender = (msg: CanvasToEditorMessage) => void

export function listenForEditor(
  root: HTMLElement = document.body,
  send: CanvasMessageSender = (m) => window.parent.postMessage(m, '*'),
): () => void {
  const design = createDesignController((msg: DesignOutMessage) => send(msg))

  let wrapper: HTMLElement | null = null
  let holder: HTMLElement | null = null

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
    if (!data || data.type !== 'toolback:load') return
    try {
      ensureStructure()
      renderBook(data.book, holder!, data.breakpoint ?? 'desktop')
      const pageRoot = holder!.querySelector<HTMLElement>('.tb-page')
      send({ type: 'toolback:rects', rects: pageRoot ? getObjectRects(pageRoot) : {} })
      design.setEnabled(data.design ?? false)
      if (data.design) design.onRendered(data.selection ?? null)
    } catch (err) {
      send({ type: 'toolback:error', message: String(err) })
    }
  }

  window.addEventListener('message', onMessage)
  send({ type: 'toolback:ready' })

  return () => {
    window.removeEventListener('message', onMessage)
  }
}
