import type { Background, Book, CanvasSize, Page, PageObject, Rect } from '@toolback/format'
import { backgroundFor, contentExtent, marginOf, rectForObject, resolvePageBox } from '@toolback/format'
import { registerControls, renderObject } from '@toolback/controls'
import { stylesCss } from './styles'

export type { Rect } from '@toolback/format'
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

/**
 * Position an object wrapper from its edge constraints with pure CSS, so the
 * browser repositions it on resize with no JavaScript. Percentages resolve
 * against the containing box (the page, or the parent group wrapper).
 */
export function applyEdgeStyles(el: HTMLElement, obj: PageObject): void {
  const s = el.style
  s.left = ''
  s.right = ''
  s.width = ''
  s.top = ''
  s.bottom = ''
  s.height = ''
  const m = marginOf(obj)
  switch (obj.x.mode) {
    case 'left':
      s.left = `${obj.x.left + m.left}px`
      s.width = `${obj.x.width}px`
      break
    case 'right':
      s.right = `${obj.x.right + m.right}px`
      s.width = `${obj.x.width}px`
      break
    case 'both':
      s.left = `${obj.x.left + m.left}px`
      s.right = `${obj.x.right + m.right}px`
      break
    case 'center': {
      // centre the margin box: equal left/right margins cancel out
      const half = obj.x.width / 2 - (m.left - m.right) / 2
      s.left =
        half < 0 ? `calc(50% + ${-half}px)` : `calc(50% - ${half}px)`
      s.width = `${obj.x.width}px`
      break
    }
  }
  switch (obj.y.mode) {
    case 'top':
      s.top = `${obj.y.top + m.top}px`
      s.height = `${obj.y.height}px`
      break
    case 'bottom':
      s.bottom = `${obj.y.bottom + m.bottom}px`
      s.height = `${obj.y.height}px`
      break
    case 'both':
      s.top = `${obj.y.top + m.top}px`
      s.bottom = `${obj.y.bottom + m.bottom}px`
      break
    case 'center': {
      const half = obj.y.height / 2 - (m.top - m.bottom) / 2
      s.top =
        half < 0 ? `calc(50% + ${-half}px)` : `calc(50% - ${half}px)`
      s.height = `${obj.y.height}px`
      break
    }
  }
}

export function renderObjectInto(
  pageRoot: HTMLElement,
  obj: PageObject,
  opts?: { bg?: boolean },
): HTMLElement {
  const wrapper = pageRoot.ownerDocument.createElement('div')
  wrapper.className = 'tb-object'
  wrapper.dataset.tbId = obj.id
  wrapper.dataset.tbName = obj.name
  wrapper.dataset.tbEdgeX = obj.x.mode
  wrapper.dataset.tbEdgeY = obj.y.mode
  if (opts?.bg) wrapper.dataset.tbBg = '1'
  applyEdgeStyles(wrapper, obj)

  if (obj.control === 'group' && obj.children?.length) {
    // members render inside the group wrapper and constrain to its box; the
    // group box carries its own edges and members are never scaled with it
    wrapper.appendChild(renderObject(obj))
    const inner = wrapper.firstElementChild as HTMLElement
    for (const child of obj.children) {
      renderObjectInto(inner, child)
    }
  } else {
    wrapper.appendChild(renderObject(obj))
  }

  pageRoot.appendChild(wrapper)
  return wrapper
}

export function renderPage(
  page: Page,
  root: HTMLElement,
  container: CanvasSize | undefined,
  background: Background | undefined,
  objects: PageObject[],
): HTMLElement {
  const doc = root.ownerDocument
  injectStyles(doc)

  const pageRoot = doc.createElement('div')
  pageRoot.className = 'tb-page'
  pageRoot.dataset.tbPageId = page.id
  pageRoot.style.background = background?.color ?? '#ffffff'
  if (page.size) {
    pageRoot.style.width = `${page.size.width}px`
    pageRoot.style.height = `${page.size.height}px`
  } else {
    // fluid: fill the container, grow to the content extent past the fold.
    // `100vh` when the page is the root surface; `100%` inside a sized box.
    const extent = contentExtent(objects)
    pageRoot.style.width = '100%'
    pageRoot.style.height = container ? '100%' : '100vh'
    pageRoot.style.minWidth = `${Math.ceil(extent.right)}px`
    pageRoot.style.minHeight = `${Math.ceil(extent.bottom)}px`
  }

  // background objects paint below the page's own objects and are tagged so
  // the editor can lock them (they belong to the background resource)
  if (background) {
    for (const obj of background.objects) {
      renderObjectInto(pageRoot, obj, { bg: true })
    }
  }
  for (const obj of page.objects) {
    renderObjectInto(pageRoot, obj)
  }

  root.appendChild(pageRoot)
  return pageRoot
}

/**
 * The browser-like viewport the page is shown in: the document's client box
 * (in the editor canvas iframe the canvas area, at runtime the browser
 * window). Nested surfaces (popups, author windows) pass their own box as an
 * explicit container instead.
 */
export function measureViewport(root: HTMLElement): CanvasSize {
  const de = root.ownerDocument.documentElement
  const win = root.ownerDocument.defaultView
  return {
    width: Math.max(1, de.clientWidth || win?.innerWidth || root.clientWidth || 1),
    height: Math.max(1, de.clientHeight || win?.innerHeight || root.clientHeight || 1),
  }
}

export function renderBook(book: Book, root: HTMLElement): HTMLElement {
  return renderBookPage(book, 0, root)
}

export function renderBookPage(
  book: Book,
  pageIndex: number,
  root: HTMLElement,
  container?: CanvasSize,
): HTMLElement {
  for (const child of Array.from(root.children)) {
    root.removeChild(child)
  }
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const background = backgroundFor(book, page)
  const objects = [...(background?.objects ?? []), ...page.objects]
  return renderPage(page, root, container, background, objects)
}

/**
 * Design view of a background: only the background's own objects, fully
 * editable (no `data-tb-bg` tagging). The background is a fluid page.
 */
export function renderBackgroundView(
  book: Book,
  backgroundId: string,
  root: HTMLElement,
): HTMLElement {
  for (const child of Array.from(root.children)) {
    root.removeChild(child)
  }
  const background =
    book.backgrounds.find((b) => b.id === backgroundId) ?? book.backgrounds[0]!
  const synthetic: Page = {
    id: `bgview:${background.id}`,
    name: background.name,
    script: '',
    backgroundId: background.id,
    objects: [],
  }
  const pageRoot = renderPage(synthetic, root, undefined, undefined, background.objects)
  pageRoot.style.background = background.color
  pageRoot.dataset.tbBackgroundId = background.id
  for (const obj of background.objects) {
    renderObjectInto(pageRoot, obj)
  }
  // corner badge so the author can tell they're editing a background
  const badge = root.ownerDocument.createElement('div')
  badge.className = 'tb-bg-badge'
  badge.textContent = `Background · ${background.name}`
  pageRoot.appendChild(badge)
  return pageRoot
}

/**
 * The containing box each object's edge constraints resolve against: the page
 * box for top-level objects, the resolved group box for members. Used by the
 * ControlApi so `x`/`width` reads and writes agree with the render.
 */
export function parentBoxMap(objects: PageObject[], pageBox: CanvasSize): Map<string, CanvasSize> {
  const out = new Map<string, CanvasSize>()
  const walk = (objs: PageObject[], box: CanvasSize): void => {
    for (const o of objs) {
      out.set(o.id, box)
      if (o.children?.length) {
        const r = rectForObject(o, box)
        walk(o.children, { width: r.w, height: r.h })
      }
    }
  }
  walk(objects, pageBox)
  return out
}

/** the resolved page box for a page shown in `container` (see format) */
export function pageBoxFor(
  page: Page,
  container: CanvasSize,
  objects: PageObject[],
): CanvasSize {
  return resolvePageBox(page, container, objects)
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
