import { DEFAULT_SIZES, type ControlKind, type Rect } from '@toolback/format'
import { snap } from '@toolback/runtime'
import { useBookStore } from './stores/book'

type DragOverMessage = { type: 'toolback:dragOver'; control: ControlKind; rect: Rect }

let dragInFlight = false

export function startPaletteDrag(
  event: PointerEvent,
  kind: ControlKind,
  iframe: HTMLIFrameElement,
): void {
  const store = useBookStore()
  if (store.isRunning || dragInFlight) return
  dragInFlight = true
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

  let raf = 0
  let pending: DragOverMessage | null = null

  const overCanvas = (x: number, y: number): boolean => {
    const r = iframe.getBoundingClientRect()
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  const rectAt = (x: number, y: number): Rect => {
    const r = iframe.getBoundingClientRect()
    const size = DEFAULT_SIZES[kind]
    return {
      x: snap(x - r.left - size.w / 2),
      y: snap(y - r.top - size.h / 2),
      w: size.w,
      h: size.h,
    }
  }

  const sendDrag = (): void => {
    raf = 0
    if (pending) iframe.contentWindow?.postMessage(pending, '*')
  }

  const onMove = (e: PointerEvent): void => {
    place(e.clientX, e.clientY)
    const inside = overCanvas(e.clientX, e.clientY)
    store.dragOverCanvas = inside
    // over the canvas, the real control preview inside the iframe is the
    // feedback — the editor-side chip would only get in the way
    ghost.style.visibility = inside ? 'hidden' : 'visible'
    pending = inside
      ? { type: 'toolback:dragOver', control: kind, rect: rectAt(e.clientX, e.clientY) }
      : null
    if (pending && !raf) raf = requestAnimationFrame(sendDrag)
  }

  const cleanup = (): void => {
    dragInFlight = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    if (raf) cancelAnimationFrame(raf)
    ghost.remove()
    document.body.classList.remove('tb-palette-dragging')
    store.dragOverCanvas = false
    iframe.contentWindow?.postMessage({ type: 'toolback:dragEnd' }, '*')
  }

  const onUp = (e: PointerEvent): void => {
    const inside = overCanvas(e.clientX, e.clientY)
    const rect = inside ? rectAt(e.clientX, e.clientY) : null
    cleanup()
    // the ghost in the canvas sits exactly here — the sync swap is seamless
    if (rect) store.addObject(kind, rect)
  }

  const onCancel = (): void => {
    cleanup()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') cleanup()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
}
