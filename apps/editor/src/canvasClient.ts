import type { CanvasToEditorMessage, EditorToCanvasMessage } from '@toolback/runtime'
import { executeAuthorOp } from './authorBridge'
import { setDirectSender, setSyncSender, useBookStore } from './stores/book'

let wired = false

export function wireCanvas(iframe: HTMLIFrameElement): void {
  if (wired) return
  wired = true
  const store = useBookStore()

  const sendLoad = (): void => {
    const msg: EditorToCanvasMessage = {
      type: 'toolback:load',
      book: JSON.parse(JSON.stringify(store.book)),
      breakpoint: store.breakpoint,
      pageIndex: store.currentPageIndex,
      view:
        store.editing.kind === 'background'
          ? { kind: 'background', id: store.editing.id }
          : { kind: 'page', index: store.currentPageIndex },
      design: !store.isRunning,
      selection: [...store.selectionIds],
      fitHints: store.fitHintMode,
    }
    iframe.contentWindow?.postMessage(msg, '*')
  }
  setSyncSender(sendLoad)
  setDirectSender((msg) => iframe.contentWindow?.postMessage(msg, '*'))

  window.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as CanvasToEditorMessage | undefined
    if (!msg?.type?.startsWith('toolback:')) return

    switch (msg.type) {
      case 'toolback:ready':
        sendLoad()
        break
      case 'toolback:rects':
        store.rects = msg.rects
        store.canvasReady = true
        break
      case 'toolback:selection':
        store.applySelection(msg.ids)
        break
      case 'toolback:commit':
        store.applyRects(msg.objects, { dir: msg.dir })
        break
      case 'toolback:scriptError':
        store.scriptError = msg.message
        break
      case 'toolback:error':
        store.error = msg.message
        break
      case 'toolback:runToggle':
        store.toggleRun()
        break
      case 'toolback:store':
        store.storeEntries = msg.entries
        break
      case 'toolback:popups':
        store.popupsOpen = msg.open
        break
      case 'toolback:authorCall': {
        try {
          const result = executeAuthorOp(store, msg.op, msg.args)
          // JSON round-trip: Pinia-proxied results are not structured-cloneable
          const plain = JSON.parse(JSON.stringify(result ?? null))
          iframe.contentWindow?.postMessage({ type: 'toolback:authorReply', id: msg.id, ok: true, result: plain }, '*')
        } catch (err) {
          iframe.contentWindow?.postMessage({ type: 'toolback:authorReply', id: msg.id, ok: false, error: String(err) }, '*')
        }
        break
      }
      case 'toolback:authorState':
        store.setAuthorActive(msg.active ? (msg.pageName ?? store.authorActive) : null)
        break
      case 'toolback:bgClick':
        store.flashCanvasNote('That object lives on the background — edit it from the Backgrounds panel')
        break
      case 'toolback:reorder':
        store.reorderSelection(msg.action)
        break
      case 'toolback:deleteSelection':
        store.removeSelected()
        break
      case 'toolback:undo':
        store.undo()
        break
      case 'toolback:redo':
        store.redo()
        break
      case 'toolback:duplicate':
        store.duplicateSelected()
        break
      case 'toolback:group':
        store.groupSelected()
        break
      case 'toolback:ungroup':
        store.ungroupSelected()
        break
    }
  })
}
