import type { Background, Book, Breakpoint, CanvasSize, Page, PageObject, Rect } from '@toolback/format'
import { backgroundFor, resolveObjectRect, resolvePageSize, scaleRect } from '@toolback/format'
import { registerControls, renderObject } from '@toolback/controls'
import { stylesCss } from './styles'

export type { Breakpoint, Rect } from '@toolback/format'
export { snap, snapRect, resizeRect, GRID, MIN_SIZE } from './design'
export type { HandleDir, DesignController } from './design'
export {
  runBook,
  stopRun,
  createStore,
  extractFunctionNames,
  shortNamesFor,
  renderDynamicText,
  popupEscape,
} from './player'
export type { ToolbackStore, ControlApi, RunHandle, PopupHandle, PopupOptions } from './player'
export { startAuthorMode, stopAuthor, authorActive, syncAuthorScripts } from './author'
export type { AuthorHandle, AuthorCaller, AuthorOp, AuthorObject, AuthorObjectRef } from './author'
export { isAuthorObjectRef } from './author'
export type { AuthorReplyMessage } from './editorLink'
export type { EditorToCanvasMessage, CanvasToEditorMessage, CanvasMessageSender, ToolbackView } from './editorLink'
export { listenForEditor, shouldToggleRun, zOrderActionOf, isDeleteSelectionKey, isUndoKey, isDuplicateKey, isGroupKey, isCopyKey, isCutKey, isPasteKey, serializeStoreValue, isStoreLabelSentinel } from './editorLink'
export {
  scanLibImports,
  basePackageName,
  isBareSpecifier,
  rewriteLibImports,
  libUrlFor,
  toolbackImport,
  normalizeModule,
  setLibMap,
  loadShelfManifest,
} from './libs'

let stylesInjected = false

function injectStyles(doc: Document): void {
  if (stylesInjected) return
  const style = doc.createElement('style')
  style.textContent = stylesCss
  doc.head.appendChild(style)
  stylesInjected = true
}

function rectFor(obj: PageObject): Rect {
  return obj.rect
}

export function renderObjectInto(
  pageRoot: HTMLElement,
  obj: PageObject,
  breakpoint: Breakpoint,
  opts?: { bg?: boolean; size?: { page: CanvasSize; ref: CanvasSize }; overrideRect?: Rect },
): HTMLElement {
  const wrapper = pageRoot.ownerDocument.createElement('div')
  wrapper.className = 'tb-object'
  wrapper.dataset.tbId = obj.id
  wrapper.dataset.tbName = obj.name
  if (opts?.bg) wrapper.dataset.tbBg = '1'
  if (obj.fit?.x) wrapper.dataset.tbFitX = obj.fit.x
  if (obj.fit?.y) wrapper.dataset.tbFitY = obj.fit.y
  // which axes the glue lens actually produced — the design controller clamps
  // drags on a locked Center axis only while the lens is live here
  const lensLive = Boolean(opts?.size) && !opts?.overrideRect
  if (lensLive && obj.fit?.x && obj.fit.x !== 'free') wrapper.dataset.tbLensX = '1'
  if (lensLive && obj.fit?.y && obj.fit.y !== 'free') wrapper.dataset.tbLensY = '1'
  const rect =
    opts?.overrideRect ?? (opts?.size ? resolveObjectRect(obj, opts.size.page, opts.size.ref) : rectFor(obj))
  wrapper.style.left = `${rect.x}px`
  wrapper.style.top = `${rect.y}px`
  wrapper.style.width = `${rect.w}px`
  wrapper.style.height = `${rect.h}px`

  if (obj.control === 'group' && obj.children?.length) {
    // members render inside the group wrapper; their rects are relative to it.
    // Members scale with the box ONLY for a real scale — a stretch lens, or a
    // parent scaling a nested group; an interactive resize already scaled the
    // members in the store, so it is not applied twice.
    const desktop = rectFor(obj)
    const parentScaled = Boolean(opts?.overrideRect)
    const stretchX = parentScaled || obj.fit?.x === 'stretch'
    const stretchY = parentScaled || obj.fit?.y === 'stretch'
    const fx = stretchX && desktop.w !== 0 ? rect.w / desktop.w : 1
    const fy = stretchY && desktop.h !== 0 ? rect.h / desktop.h : 1
    wrapper.appendChild(renderObject(obj))
    const inner = wrapper.firstElementChild as HTMLElement
    for (const child of obj.children) {
      const childRect = rectFor(child)
      const scaled =
        fx !== 1 && fy !== 1
          ? scaleRect(childRect, { x: 0, y: 0 }, fx, fy)
          : fx !== 1
            ? { x: Math.round(childRect.x * fx), y: childRect.y, w: Math.max(1, Math.round(childRect.w * fx)), h: childRect.h }
            : fy !== 1
              ? { x: childRect.x, y: Math.round(childRect.y * fy), w: childRect.w, h: Math.max(1, Math.round(childRect.h * fy)) }
              : null
      renderObjectInto(inner, child, breakpoint, scaled ? { overrideRect: scaled } : undefined)
    }
  } else {
    wrapper.appendChild(renderObject(obj))
  }

  pageRoot.appendChild(wrapper)
  return wrapper
}

export function renderPage(
  page: Page,
  breakpoint: Breakpoint,
  root: HTMLElement,
  canvasSize?: { width: number; height: number },
  background?: Background,
  refSize?: { width: number; height: number },
): HTMLElement {
  const doc = root.ownerDocument
  injectStyles(doc)

  const pageRoot = doc.createElement('div')
  pageRoot.className = 'tb-page'
  pageRoot.dataset.tbPageId = page.id
  pageRoot.style.background = background?.color ?? '#ffffff'
  if (canvasSize) {
    pageRoot.style.width = `${canvasSize.width}px`
    pageRoot.style.height = `${canvasSize.height}px`
  }

  // fit-aware render when both the target and the desktop reference sizes are
  // known: page objects AND background objects react to the page size
  const size =
    canvasSize && refSize ? { page: canvasSize, ref: refSize } : null
  // background objects paint below the page's own objects and are tagged so
  // the editor can lock them (they belong to the background resource)
  if (background) {
    for (const obj of background.objects) {
      renderObjectInto(pageRoot, obj, breakpoint, { bg: true, size: size ?? undefined })
    }
  }
  for (const obj of page.objects) {
    renderObjectInto(pageRoot, obj, breakpoint, size ? { size } : undefined)
  }

  root.appendChild(pageRoot)
  return pageRoot
}

export function renderBook(
  book: Book,
  root: HTMLElement,
  breakpoint: Breakpoint = 'desktop',
): HTMLElement {
  return renderBookPage(book, 0, root, breakpoint)
}

export function renderBookPage(
  book: Book,
  pageIndex: number,
  root: HTMLElement,
  breakpoint: Breakpoint = 'desktop',
): HTMLElement {
  for (const child of Array.from(root.children)) {
    root.removeChild(child)
  }
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const background = backgroundFor(book, page)
  const canvasSize = resolvePageSize(book, background, breakpoint)
  const refSize = resolvePageSize(book, background, 'desktop')
  return renderPage(page, breakpoint, root, canvasSize, background, refSize)
}

/**
 * Design view of a background: only the background's own objects, fully
 * editable (no `data-tb-bg` tagging). Sized per the background's override.
 */
export function renderBackgroundView(
  book: Book,
  backgroundId: string,
  root: HTMLElement,
  breakpoint: Breakpoint = 'desktop',
): HTMLElement {
  for (const child of Array.from(root.children)) {
    root.removeChild(child)
  }
  const background =
    book.backgrounds.find((b) => b.id === backgroundId) ?? book.backgrounds[0]!
  const canvasSize = resolvePageSize(book, background, breakpoint)
  const refSize = resolvePageSize(book, background, 'desktop')
  const size = { page: canvasSize, ref: refSize }
  const pageRoot = renderPage(
    { id: `bgview:${background.id}`, name: background.name, script: '', backgroundId: background.id, objects: [] },
    breakpoint,
    root,
    canvasSize,
    undefined,
    refSize,
  )
  pageRoot.style.background = background.color
  pageRoot.dataset.tbBackgroundId = background.id
  for (const obj of background.objects) {
    renderObjectInto(pageRoot, obj, breakpoint, { size })
  }
  // corner badge so the author can tell they're editing a background
  const badge = root.ownerDocument.createElement('div')
  badge.className = 'tb-bg-badge'
  badge.textContent = `Background · ${background.name}`
  pageRoot.appendChild(badge)
  return pageRoot
}

export type ObjectRects = Record<string, Rect>

export function getObjectRects(pageRoot: HTMLElement): ObjectRects {
  const out: ObjectRects = {}
  const base = pageRoot.getBoundingClientRect()
  for (const el of Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-tb-id]'))) {
    const id = el.dataset.tbId
    if (!id) continue
    const r = el.getBoundingClientRect()
    out[id] = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
  }
  return out
}

registerControls()
