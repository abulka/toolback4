import type { CanvasToEditorMessage, EditorToCanvasMessage } from '@toolback/runtime'
import { setSyncSender, useBookStore } from './stores/book'

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
      design: !store.isRunning,
      selection: [...store.selectionIds],
    }
    iframe.contentWindow?.postMessage(msg, '*')
  }
  setSyncSender(sendLoad)

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
        store.applyRects(msg.objects)
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
