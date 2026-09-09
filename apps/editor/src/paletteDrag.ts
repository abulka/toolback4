import { DEFAULT_SIZES, type ControlKind, type Rect } from '@toolback/format'
import { snap } from '@toolback/runtime'
import { useBookStore } from './stores/book'

export function startPaletteDrag(
  event: PointerEvent,
  kind: ControlKind,
  iframe: HTMLIFrameElement,
): void {
  const store = useBookStore()
  event.preventDefault()

  // Capture the pointer so move/up keep firing on the editor side even when
  // the pointer travels over the canvas iframe (events would otherwise be
  // dispatched inside the iframe's document and never reach this window).
  const captureTarget = event.currentTarget as HTMLElement
  captureTarget?.setPointerCapture(event.pointerId)

  const ghost = document.createElement('div')
  ghost.className = 'tb-drag-ghost'
  ghost.textContent = kind
  document.body.appendChild(ghost)
  document.body.classList.add('tb-palette-dragging')

  const place = (x: number, y: number): void => {
    ghost.style.left = `${x + 14}px`
    ghost.style.top = `${y + 14}px`
  }
  place(event.clientX, event.clientY)

  const overCanvas = (x: number, y: number): boolean => {
    const r = iframe.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  const onMove = (e: PointerEvent): void => {
    place(e.clientX, e.clientY)
    store.dragOverCanvas = overCanvas(e.clientX, e.clientY)
  }

  const cleanup = (): void => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    ghost.remove()
    document.body.classList.remove('tb-palette-dragging')
    store.dragOverCanvas = false
  }

  const onUp = (e: PointerEvent): void => {
    if (!overCanvas(e.clientX, e.clientY)) {
      cleanup()
      return
    }
    const r = iframe.getBoundingClientRect()
    const size = DEFAULT_SIZES[kind]
    const rect: Rect = {
      x: snap(e.clientX - r.left - size.w / 2),
      y: snap(e.clientY - r.top - size.h / 2),
      w: size.w,
      h: size.h,
    }
    cleanup()
    store.addObject(kind, rect)
  }

  const onCancel = (): void => {
    cleanup()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
}
