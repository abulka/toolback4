import type { EditorToCanvasMessage } from '@toolback/runtime'
import { useBookStore } from './stores/book'

export function wireCanvas(iframe: HTMLIFrameElement): void {
  const store = useBookStore()

  window.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as { type?: string } | null
    if (!msg?.type?.startsWith('toolback:')) return

    switch (msg.type) {
      case 'toolback:ready': {
        // Reactive proxies are not structured-cloneable; send a plain JSON copy.
        const load: EditorToCanvasMessage = {
          type: 'toolback:load',
          book: JSON.parse(JSON.stringify(store.book)),
        }
        iframe.contentWindow?.postMessage(load, '*')
        break
      }
      case 'toolback:rects': {
        store.rects = (msg as { rects: typeof store.rects }).rects
        store.canvasReady = true
        break
      }
      case 'toolback:error': {
        store.error = (msg as { message: string }).message
        break
      }
    }
  })
}
