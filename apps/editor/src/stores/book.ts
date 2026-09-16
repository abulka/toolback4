import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  alignRects,
  applyRectToObject,
  backgroundFor,
  centerBlockRects,
  createBackground,
  createBook,
  createGroup,
  createObject,
  createPage,
  DEFAULT_FIT_HINTS,
  DEFAULT_PROPS,
  distributeRects,
  flattenObjects,
  matchSizeRects,
  newId,
  normalizeFitHints,
  parseBook,
  rebaseRect,
  rectForObject,
  resolvePageBox,
  resolveStartPageIndex,
  scaleSubtreeEdges,
  unionRects,
  writeRectPart,
  xEdgeFromRect,
  yEdgeFromRect,
  type AlignMode,
  type Background,
  type Book,
  type CanvasSize,
  type ControlKind,
  type FitHintMode,
  type FitHintOptions,
  type MatchDim,
  type Page,
  type PageObject,
  type Rect,
  type XEdgeMode,
  type YEdgeMode,
} from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import type { EditorToCanvasMessage, HandleDir, ObjectRects } from '@toolback/runtime'
import { clipboardToJson, copyText } from '../copyJson'
import {
  getRecentBook,
  getRecents,
  loadAutosave,
  putRecentBook,
  removeBook,
  saveAutosave,
  type RecentEntry,
} from '../persist'

let sendSync: ((msg: EditorToCanvasMessage) => void) | null = null
/** posts a protocol message verbatim (sendSync is the load-only sync —
 * its implementation ignores the argument and builds its own load) */
let sendDirect: ((msg: EditorToCanvasMessage) => void) | null = null

export function setSyncSender(fn: (msg: EditorToCanvasMessage) => void): void {
  sendSync = fn
}

export function setDirectSender(fn: (msg: EditorToCanvasMessage) => void): void {
  sendDirect = fn
}

export const useBookStore = defineStore('book', () => {
  const book = ref(sampleBook())
  /** the measured canvas viewport; fluid pages fill it and grow past it */
  const viewport = ref<CanvasSize>({ width: 1280, height: 800 })
  /** the rendered page's box relative to the canvas iframe (for editor chrome) */
  const pageRect = ref<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const selectionIds = ref<string[]>([])
  const canvasReady = ref(false)
  const rects = ref<ObjectRects>({})
  const error = ref('')
  const dragOverCanvas = ref(false)
  const isRunning = ref(false)
  const scriptError = ref('')
  const storeEntries = ref<Array<[string, unknown]>>([])
  const popupsOpen = ref<string[]>([])
  const currentPageIndex = ref(0)
  /** what the canvas is editing: a page, or a background's own objects */
  const editing = ref<{ kind: 'page' } | { kind: 'background'; id: string }>({ kind: 'page' })
  const backgroundDialogId = ref<string | null>(null)
  /** author-mode plugin: null, or the running plugin page's name */
  const authorActive = ref<null | string>(null)
  const recents = ref<RecentEntry[]>([])
  const autosaveAt = ref<number | null>(null)
  /** when the current book was last explicitly saved (IndexedDB named snapshot) */
  const savedAt = ref<number | null>(null)
  const fileNote = ref('')
  const propsWidth = ref<number>(
    Number(localStorage.getItem('toolback.propsWidth')) || 330,
  )
  const paletteWidth = ref<number>(
    Number(localStorage.getItem('toolback.paletteWidth')) || 220,
  )
  /** how edge-spring hints are drawn (toolbar control + its options popover) */
  function readFitHints(): FitHintOptions {
    const raw = localStorage.getItem('toolback.fitHints')
    if (!raw) return { ...DEFAULT_FIT_HINTS }
    if (raw.trim().startsWith('{')) {
      try {
        return normalizeFitHints(JSON.parse(raw) as FitHintOptions)
      } catch {
        // fall through to the legacy coercion below
      }
    }
    // legacy values were a bare mode string or '1'/'0'
    return normalizeFitHints(raw)
  }
  const fitHints = ref<FitHintOptions>(readFitHints())
  const fitHintMode = computed(() => fitHints.value.mode)

  function setFitHints(patch: Partial<FitHintOptions>): void {
    fitHints.value = { ...fitHints.value, ...patch }
    localStorage.setItem('toolback.fitHints', JSON.stringify(fitHints.value))
    sync()
  }

  /** the All/Sel/Off quick buttons patch only the mode */
  function setFitHintMode(mode: FitHintMode): void {
    setFitHints({ mode })
  }

  /**
   * The toolback clipboard: deep-cloned plain copies of the last copied/cut
   * selection, so pasting stays independent of later edits. Pasting reads this
   * in-app mirror; the tagged JSON is also written to the OS clipboard
   * (durable + inspectable elsewhere).
   */
  const clipboard = ref<PageObject[] | null>(null)
  const canPaste = computed(() => !!clipboard.value && !isRunning.value)


  const activePage = computed(
    () => book.value.pages[currentPageIndex.value] ?? book.value.pages[0]!,
  )
  const activeBackground = computed<Background | null>(() => {
    const target = editing.value
    return target.kind === 'background'
      ? (book.value.backgrounds.find((b) => b.id === target.id) ?? null)
      : null
  })
  /** the object container currently being edited (page objects or background objects) */
  const targetObjects = computed<PageObject[]>(() =>
    editing.value.kind === 'background'
      ? (activeBackground.value?.objects ?? [])
      : activePage.value.objects,
  )
  /** pages that render on the background being edited */
  const backgroundPageCount = computed<number>(() => {
    if (editing.value.kind !== 'background') return 0
    const id = activeBackground.value?.id
    return id ? book.value.pages.filter((p) => p.backgroundId === id).length : 0
  })
  /** the background that governs the current edit target (page or background) */
  const targetBackground = computed<Background | undefined>(() =>
    editing.value.kind === 'background'
      ? (activeBackground.value ?? undefined)
      : backgroundFor(book.value, activePage.value),
  )
  /** every object rendered in the current target (page + its background) */
  const contentObjects = computed<PageObject[]>(() =>
    editing.value.kind === 'background'
      ? (activeBackground.value?.objects ?? [])
      : [...(targetBackground.value?.objects ?? []), ...activePage.value.objects],
  )
  /** a background has no page of its own — edit it as a fluid page */
  function targetPage(): Page {
    if (editing.value.kind === 'background') {
      return { id: 'bgview', name: '', script: '', backgroundId: '', objects: [] }
    }
    return activePage.value
  }
  /** the page box for the current edit target (fixed page size, else the
   *  viewport grown by top/left-anchored content) */
  function pageBox(objects: PageObject[] = contentObjects.value): CanvasSize {
    return resolvePageBox(targetPage(), viewport.value, objects)
  }
  /** canvas (iframe) box of the current edit target */
  const activeCanvasSize = computed<CanvasSize>(() => pageBox())
  const objectCount = computed(() => flattenObjects(targetObjects.value).length)
  const allObjects = computed(() => flattenObjects(targetObjects.value))
  const selectedObjects = computed(() =>
    allObjects.value.filter((o) => selectionIds.value.includes(o.id)),
  )
  const selectedObject = computed(() =>
    selectionIds.value.length === 1 ? (selectedObjects.value[0] ?? null) : null,
  )
  const selectionParentId = computed(() => {
    if (selectionIds.value.length === 0) return null
    let parent: string | null | undefined = undefined
    for (const id of selectionIds.value) {
      const p = parentIdOf(id)
      if (parent === undefined) parent = p
      else if (parent !== p) return 'mixed'
    }
    return parent ?? null
  })
  const groupEligible = computed(
    () => selectionIds.value.length >= 2 && selectionParentId.value !== 'mixed',
  )
  const ungroupEligible = computed(
    () => selectionIds.value.length === 1 && selectedObject.value?.control === 'group',
  )

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined
  let noteTimer: ReturnType<typeof setTimeout> | undefined

  /** transient status-bar hint (e.g. clicking a background-locked object) */
  const canvasNote = ref('')
  function flashCanvasNote(message: string): void {
    canvasNote.value = message
    clearTimeout(noteTimer)
    noteTimer = setTimeout(() => {
      canvasNote.value = ''
    }, 3200)
  }

  // ---- undo/redo: whole-book snapshots. The store is the single source of
  // truth for every content mutation, so a pre-mutation deep clone of the
  // book (plus selection/page so undone deletes re-select) covers objects,
  // scripts, pages, groups, z-order and breakpoints with one mechanism.

  interface HistorySnapshot {
    book: Book
    selectionIds: string[]
    currentPageIndex: number
    editing: { kind: 'page' } | { kind: 'background'; id: string }
  }
  interface HistoryEntry {
    label: string
    coalesceKey?: string
    at: number
    snapshot: HistorySnapshot
  }
  const MAX_HISTORY = 100
  const COALESCE_MS = 800
  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])

  function captureSnapshot(): HistorySnapshot {
    return {
      book: JSON.parse(JSON.stringify(book.value)) as Book,
      selectionIds: [...selectionIds.value],
      currentPageIndex: currentPageIndex.value,
      editing: JSON.parse(JSON.stringify(editing.value)),
    }
  }

  function record(label: string, coalesceKey?: string): void {
    if (isRunning.value) return
    const at = Date.now()
    const last = undoStack.value[undoStack.value.length - 1]
    // merge continuous edits (typing in Monaco / a prop field) into one step
    if (last && coalesceKey && last.coalesceKey === coalesceKey && at - last.at < COALESCE_MS) {
      return
    }
    undoStack.value.push({ label, coalesceKey, at, snapshot: captureSnapshot() })
    if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
    redoStack.value = []
  }

  function clearHistory(): void {
    undoStack.value = []
    redoStack.value = []
  }

  function restoreSnapshot(snapshot: HistorySnapshot): void {
    book.value = snapshot.book
    currentPageIndex.value = Math.max(
      0,
      Math.min(snapshot.currentPageIndex, book.value.pages.length - 1),
    )
    const restored = snapshot.editing
    editing.value =
      restored.kind === 'background' && book.value.backgrounds.some((b) => b.id === restored.id)
        ? restored
        : { kind: 'page' }
    // validate selection against the restored edit target's objects
    const target = editing.value
    const container =
      target.kind === 'background'
        ? (book.value.backgrounds.find((b) => b.id === target.id)?.objects ?? [])
        : (book.value.pages[currentPageIndex.value]?.objects ?? [])
    const valid = new Set(flattenObjects(container).map((o) => o.id))
    selectionIds.value = snapshot.selectionIds.filter((id) => valid.has(id))
    sync()
  }

  function undo(): void {
    if (isRunning.value || undoStack.value.length === 0) return
    const entry = undoStack.value.pop()!
    redoStack.value.push({ ...entry, snapshot: captureSnapshot() })
    restoreSnapshot(entry.snapshot)
  }

  function redo(): void {
    if (isRunning.value || redoStack.value.length === 0) return
    const entry = redoStack.value.pop()!
    // the state we're leaving behind is what the next undo returns to (redo
    // entries hold the post-action state, so a follow-up undo would otherwise
    // bounce back to the same spot). coalesceKey cleared: a fresh edit right
    // after redo must be its own step.
    undoStack.value.push({ ...entry, snapshot: captureSnapshot(), coalesceKey: undefined })
    restoreSnapshot(entry.snapshot)
  }

  const canUndo = computed(() => !isRunning.value && undoStack.value.length > 0)
  const canRedo = computed(() => !isRunning.value && redoStack.value.length > 0)

  function sync(): void {
    // a page box change (a control moved, the page resized) must not leave a
    // stretch group larger than its members: re-hug them before the canvas
    // re-renders
    rehugStretchedGroups()
    if (!sendSync) return
    sendSync({
      type: 'toolback:load',
      book: JSON.parse(JSON.stringify(book.value)),
      pageIndex: currentPageIndex.value,
      view:
        editing.value.kind === 'background'
          ? { kind: 'background', id: editing.value.id }
          : { kind: 'page', index: currentPageIndex.value },
      design: !isRunning.value,
      selection: selectionIds.value,
      fitHints: { ...fitHints.value },
    })
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify(book.value)) as Book
      void saveAutosave(snapshot).then(() => {
        autosaveAt.value = Date.now()
      })
    }, 800)
  }

  function uniquePageName(): string {
    const existing = new Set(book.value.pages.map((p) => p.name))
    let n = book.value.pages.length + 1
    while (existing.has(`Page ${n}`)) n++
    return `Page ${n}`
  }

  interface Located {
    obj: PageObject
    siblings: PageObject[]
    parent: PageObject | null
  }

  function locateObj(id: string): Located | null {
    const walk = (objs: PageObject[], parent: PageObject | null): Located | null => {
      for (const o of objs) {
        if (o.id === id) return { obj: o, siblings: objs, parent }
        if (o.children?.length) {
          const found = walk(o.children, o)
          if (found) return found
        }
      }
      return null
    }
    return walk(targetObjects.value, null)
  }

  function parentIdOf(id: string): string | null {
    return locateObj(id)?.parent?.id ?? null
  }

  /** chain from the edit target root to the object (for accumulated group origins) */
  function locateChain(id: string): PageObject[] | null {
    const walk = (objs: PageObject[], chain: PageObject[]): PageObject[] | null => {
      for (const o of objs) {
        if (o.id === id) return [...chain, o]
        if (o.children?.length) {
          const found = walk(o.children, [...chain, o])
          if (found) return found
        }
      }
      return null
    }
    return walk(targetObjects.value, [])
  }

  /** the containing box an object's edge constraints resolve against: the page
   *  box for a top-level object, the resolved group box for a member */
  function boxForObject(obj: PageObject): CanvasSize {
    const found = locateObj(obj.id)
    if (!found || !found.parent) return pageBox()
    const pr = renderedRectOf(found.parent)
    return { width: pr.w, height: pr.h }
  }

  /** the rect an object renders at, in its parent's frame */
  function renderedRectOf(obj: PageObject): Rect {
    return rectForObject(obj, boxForObject(obj))
  }

  /** absolute page-space origin of an object (sum of ancestor group origins) */
  function absOriginOf(id: string): { x: number; y: number } {
    const chain = locateChain(id)
    if (!chain || chain.length < 2) return { x: 0, y: 0 }
    let x = 0
    let y = 0
    for (let i = 0; i < chain.length - 1; i++) {
      const g = chain[i]!
      const r = renderedRectOf(g)
      x += r.x
      y += r.y
    }
    return { x, y }
  }

  function selectPage(i: number): void {
    editing.value = { kind: 'page' }
    currentPageIndex.value = Math.max(0, Math.min(i, book.value.pages.length - 1))
    selectionIds.value = []
    sync()
  }

  function editPage(i: number): void {
    selectPage(i)
  }

  function editBackground(id: string): void {
    if (!book.value.backgrounds.some((b) => b.id === id)) return
    editing.value = { kind: 'background', id }
    selectionIds.value = []
    sync()
  }

  function addPage(): void {
    record('Add page')
    // new pages join the background in context (the one being edited, else
    // the current page's background)
    const backgroundId =
      editing.value.kind === 'background'
        ? editing.value.id
        : backgroundFor(book.value, activePage.value).id
    book.value.pages.push(createPage(uniquePageName(), backgroundId))
    selectPage(book.value.pages.length - 1)
  }

  function duplicatePage(i: number): void {
    const src = book.value.pages[i]
    if (!src) return
    record('Duplicate page')
    const copy = JSON.parse(JSON.stringify(src)) as typeof src
    copy.id = newId('page')
    copy.name = uniquePageName()
    const reid = (objs: PageObject[]): void => {
      for (const o of objs) {
        o.id = newId('obj')
        if (o.children?.length) reid(o.children)
      }
    }
    reid(copy.objects)
    book.value.pages.splice(i + 1, 0, copy)
    selectPage(i + 1)
  }

  function removePage(i: number): void {
    if (book.value.pages.length <= 1) return
    record('Delete page')
    const removed = book.value.pages[i]
    book.value.pages.splice(i, 1)
    if (removed && book.value.startPageId === removed.id) delete book.value.startPageId
    selectPage(Math.min(currentPageIndex.value, book.value.pages.length - 1))
  }

  function renamePage(i: number, name: string): void {
    const page = book.value.pages[i]
    if (!page) return
    const trimmed = name.trim()
    if (trimmed) {
      record('Rename page')
      page.name = trimmed
    }
    sync()
  }

  // ---- backgrounds ----

  function uniqueBackgroundName(): string {
    const existing = new Set(book.value.backgrounds.map((b) => b.name))
    let n = book.value.backgrounds.length + 1
    while (existing.has(`Background ${n}`)) n++
    return `Background ${n}`
  }

  function addBackground(): void {
    record('Add background')
    const bg = createBackground(uniqueBackgroundName())
    book.value.backgrounds.push(bg)
    editing.value = { kind: 'background', id: bg.id }
    selectionIds.value = []
    sync()
  }

  function duplicateBackground(id: string): void {
    const src = book.value.backgrounds.find((b) => b.id === id)
    if (!src) return
    record('Duplicate background')
    const copy = JSON.parse(JSON.stringify(src)) as Background
    copy.id = newId('bg')
    copy.name = uniqueBackgroundName()
    const reid = (objs: PageObject[]): void => {
      for (const o of objs) {
        o.id = newId('obj')
        if (o.children?.length) reid(o.children)
      }
    }
    reid(copy.objects)
    book.value.backgrounds.push(copy)
    editBackground(copy.id)
  }

  /**
   * Delete a background. When pages still use it, `deletePages` removes them
   * too (the UI confirms first); the last remaining background cannot go.
   */
  function removeBackground(id: string, deletePages = false): void {
    if (book.value.backgrounds.length <= 1) return
    const usedBy = book.value.pages.filter((p) => p.backgroundId === id)
    if (usedBy.length > 0 && !deletePages) return
    record('Delete background')
    book.value.backgrounds = book.value.backgrounds.filter((b) => b.id !== id)
    if (usedBy.length > 0) {
      const ids = new Set(usedBy.map((p) => p.id))
      book.value.pages = book.value.pages.filter((p) => !ids.has(p.id))
    }
    if (book.value.pages.length === 0) {
      // a book always keeps at least one page — park it on the first
      // surviving background
      book.value.pages.push(createPage(uniquePageName(), book.value.backgrounds[0]!.id))
    }
    if (editing.value.kind === 'background' && editing.value.id === id) {
      editing.value = { kind: 'page' }
      currentPageIndex.value = 0
    } else {
      currentPageIndex.value = Math.min(currentPageIndex.value, book.value.pages.length - 1)
    }
    selectionIds.value = []
    sync()
  }

  function renameBackground(id: string, name: string): void {
    const bg = book.value.backgrounds.find((b) => b.id === id)
    if (!bg) return
    const trimmed = name.trim()
    if (trimmed) {
      record('Rename background')
      bg.name = trimmed
    }
    sync()
  }

  function setBackgroundProp(id: string, patch: Partial<Pick<Background, 'name' | 'color'>>): void {
    const bg = book.value.backgrounds.find((b) => b.id === id)
    if (!bg) return
    record('Edit background', `bg:${id}`)
    Object.assign(bg, patch)
    sync()
  }

  function setBackgroundScript(code: string): void {
    const bg = activeBackground.value
    if (!bg) return
    record('Edit background script', `bgscript:${bg.id}`)
    bg.script = code
    sync()
  }

  /**
   * Fixed size for a page (a dialog / popup / author window). `null` makes the
   * page fluid again (fills the window, grows with content).
   */
  function setPageSize(pageIndex: number, size: CanvasSize | null): void {
    const page = book.value.pages[pageIndex]
    if (!page) return
    record('Page size', `pagesize:${page.id}`)
    if (size === null) delete page.size
    else page.size = { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) }
    sync()
  }

  /** move a page onto another background */
  function movePageToBackground(pageIndex: number, backgroundId: string): void {
    const page = book.value.pages[pageIndex]
    if (!page || !book.value.backgrounds.some((b) => b.id === backgroundId)) return
    if (page.backgroundId === backgroundId) return
    record('Move page to background')
    page.backgroundId = backgroundId
    sync()
  }

  /**
   * Drag-reorder from the panel: reposition `from` at `to` (indices in the
   * pages array, `to` in original terms) and optionally re-home it onto
   * another background. The edited page follows its content.
   */
  function reorderPage(from: number, to: number, backgroundId?: string): void {
    const pages = book.value.pages
    if (from < 0 || from >= pages.length) return
    const bgChange =
      !!backgroundId &&
      book.value.backgrounds.some((b) => b.id === backgroundId) &&
      pages[from]!.backgroundId !== backgroundId
    // `to` is in original-array terms (0..length; length = append at end)
    const originalTarget = Math.max(0, Math.min(to, pages.length))
    if (originalTarget === from && !bgChange) return
    record('Rearrange page')
    const [page] = pages.splice(from, 1)
    let insertAt = originalTarget
    if (from < originalTarget) insertAt -= 1
    pages.splice(Math.max(0, Math.min(insertAt, pages.length)), 0, page!)
    if (bgChange) page!.backgroundId = backgroundId
    currentPageIndex.value = pages.indexOf(page!)
    sync()
  }

  function setViewport(size: CanvasSize): void {
    viewport.value = { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) }
  }

  function setPageRect(rect: { x: number; y: number; w: number; h: number }): void {
    pageRect.value = rect
  }

  function setPropsWidth(w: number): void {
    propsWidth.value = w
  }

  function savePropsWidth(): void {
    localStorage.setItem('toolback.propsWidth', String(propsWidth.value))
  }

  function resetPropsWidth(): void {
    propsWidth.value = 330
    savePropsWidth()
  }

  function setPaletteWidth(w: number): void {
    paletteWidth.value = Math.round(Math.min(480, Math.max(160, w)))
  }

  function savePaletteWidth(): void {
    localStorage.setItem('toolback.paletteWidth', String(paletteWidth.value))
  }

  function resetPaletteWidth(): void {
    paletteWidth.value = 220
    savePaletteWidth()
  }

  function newBook(): void {
    clearHistory()
    book.value = createBook('Untitled')
    viewport.value = { width: 1280, height: 800 }
    currentPageIndex.value = resolveStartPageIndex(book.value)
    selectionIds.value = []
    editing.value = { kind: 'page' }
    isRunning.value = false
    popupsOpen.value = []
    savedAt.value = null
    sync()
  }

  function hydrate(raw: unknown): boolean {
    try {
      book.value = parseBook(JSON.parse(JSON.stringify(raw)))
    } catch (err) {
      error.value = `Invalid book file: ${String(err)}`
      return false
    }
    clearHistory()
    viewport.value = { width: 1280, height: 800 }
    selectionIds.value = []
    editing.value = { kind: 'page' }
    isRunning.value = false
    popupsOpen.value = []
    savedAt.value = null
    currentPageIndex.value = resolveStartPageIndex(book.value)
    sync()
    return true
  }

  async function restoreAutosave(): Promise<boolean> {
    const saved = await loadAutosave()
    if (!saved?.book) return false
    try {
      book.value = parseBook(saved.book)
    } catch {
      return false
    }
    clearHistory()
    viewport.value = { width: 1280, height: 800 }
    currentPageIndex.value = resolveStartPageIndex(book.value)
    selectionIds.value = []
    editing.value = { kind: 'page' }
    autosaveAt.value = saved.at
    savedAt.value = null
    sync()
    return true
  }

  async function refreshRecents(): Promise<void> {
    recents.value = await getRecents()
  }

  async function rememberCurrent(): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(book.value)) as Book
    recents.value = await putRecentBook(snapshot)
  }

  /** explicit save: durable named snapshot + the boot-restore autosave slot */
  async function save(): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(book.value)) as Book
    recents.value = await putRecentBook(snapshot)
    await saveAutosave(snapshot)
    autosaveAt.value = Date.now()
    savedAt.value = Date.now()
    fileNote.value = ''
  }

  /** rename the project — drives the recents entry and the export filename */
  async function renameBook(title: string): Promise<void> {
    const trimmed = title.trim()
    if (!trimmed || trimmed === book.value.title) return
    record('Rename project')
    book.value.title = trimmed
    sync()
    await rememberCurrent()
  }

  /** rename a saved project from the Open dialog — updates the stored
   *  snapshot and its recents entry (the open book, if this is it, too) */
  async function renameRecent(id: string, title: string): Promise<void> {
    const trimmed = title.trim()
    if (!trimmed) return
    let target: Book
    if (id === book.value.id) {
      if (trimmed === book.value.title) return
      record('Rename project')
      book.value.title = trimmed
      target = JSON.parse(JSON.stringify(book.value)) as Book
      sync()
    } else {
      const saved = await getRecentBook(id)
      if (!saved || saved.title === trimmed) return
      target = saved
      target.title = trimmed
    }
    recents.value = await putRecentBook(target)
  }

  /** delete a saved project snapshot (and its recents entry) */
  async function deleteRecent(id: string): Promise<void> {
    await removeBook(id)
    recents.value = await getRecents()
  }

  async function openRecent(id: string): Promise<void> {
    const recent = await getRecentBook(id)
    if (recent) hydrate(recent)
  }

  function toggleRun(): void {
    if (!isRunning.value) stopAuthor()
    isRunning.value = !isRunning.value
    if (isRunning.value) {
      scriptError.value = ''
    } else {
      // a stopped run tears its popup stack down with it
      popupsOpen.value = []
    }
    sync()
  }

  // ---- author mode (M6c): a page runs as a plugin over the editable book ----

  function setAuthorActive(name: null | string): void {
    authorActive.value = name
  }

  /** the page to run as a plugin (index into book.pages) */
  function startAuthor(pageIndex: number): void {
    if (isRunning.value) return
    const page = book.value.pages[pageIndex]
    if (!page) return
    authorActive.value = page.name
    if (sendDirect) {
      sendDirect({
        type: 'toolback:authorStart',
        book: JSON.parse(JSON.stringify(book.value)),
        pageIndex,
      })
    }
  }

  function stopAuthor(): void {
    if (authorActive.value === null) return
    authorActive.value = null
    if (sendDirect) sendDirect({ type: 'toolback:authorStop' })
  }

  /** flag/unflag the page as a plugin (⭐ shown in the Author menu) */
  function setPageAuthorFlag(pageIndex: number, author: boolean): void {
    const page = book.value.pages[pageIndex]
    if (!page) return
    record(author ? 'Mark plugin page' : 'Unmark plugin page')
    if (author) page.author = true
    else delete page.author
    sync()
  }

  /** the page a run opens on (published app + editor load); null = first page */
  function setStartPage(pageIndex: number | null): void {
    const page = pageIndex === null ? null : book.value.pages[pageIndex]
    if (pageIndex !== null && !page) return
    record(page ? 'Set start page' : 'Clear start page')
    if (page) book.value.startPageId = page.id
    else delete book.value.startPageId
    sync()
  }

  function setEventScript(id: string, event: string, code: string): void {
    const obj = locateObj(id)?.obj
    if (!obj) return
    record('Edit script', `script:${id}:${event}`)
    if (code.trim()) obj.on[event] = code
    else delete obj.on[event]
    sync()
  }

  /**
   * Replace the design-time store (ordered [key, value] pairs). Values are
   * JSON data — the book crosses the iframe as a JSON clone, so nothing else
   * can be persisted here. Undoable/redoable like any book edit and recordable
   * active only when not running (like every other design-time edit).
   */
  function setDesignStore(entries: Array<[string, unknown]>): void {
    if (!isRunning.value) record('Edit store', 'designstore')
    book.value.store = entries
    sync()
  }

  function setPageScript(code: string): void {
    record('Edit page script', `script:page:${activePage.value.id}`)
    activePage.value.script = code
    sync()
  }

  function uniqueName(control: ControlKind): string {
    // names are script handles (controls[name]): a background's objects and
    // its member pages' objects share one namespace at run time, so both
    // sides are reserved in either editing context
    const existing = collectUsedNames()
    let n = 1
    while (existing.has(`${control}${n}`)) n++
    return `${control}${n}`
  }

  function addObject(control: ControlKind, rect: Rect): void {
    record('Add ' + control)
    // a fresh object is placed at the drop rect, anchored left + top
    const obj = createObject(control, uniqueName(control), rect, { ...DEFAULT_PROPS[control] })
    targetObjects.value.push(obj)
    selectionIds.value = [obj.id]
    sync()
  }

  /**
   * Apply committed geometry from a canvas drag. The design controller sends
   * page-absolute rects; each is converted to the object's edge constraints
   * against its page/group box, keeping which edges it follows. A member is
   * positioned relative to its group's rendered box. A group handle resize
   * scales every descendant (sizes and edges) so the tight box maps onto the
   * dragged box; a plain member edit lets the box re-hug without scaling.
   */
  function applyRects(
    list: Array<{ id: string; rect: Rect }>,
    opts?: { dir?: HandleDir },
  ): void {
    if (!list.some(({ id }) => locateObj(id))) return
    const key = 'rect:' + [...new Set(list.map((l) => l.id))].sort().join(',')
    record('Move/Resize', key)
    const affectedParents = new Set<PageObject>()
    for (const { id, rect } of list) {
      const found = locateObj(id)
      if (!found) continue
      const box = boxForObject(found.obj)
      const local = found.parent ? rebaseRect(rect, absOriginOf(id)) : rect
      const isGroup = found.obj.control === 'group' && !!found.obj.children?.length
      if (isGroup && opts?.dir) {
        resizeGroupBox(found.obj, local, box, opts.dir)
        if (found.parent) affectedParents.add(found.parent)
        continue
      }
      applyRectToObject(found.obj, local, box)
      // a group's box is the tight bounds of its members: after a member edit
      // re-derive it (members keep their own edges). Its own parent still needs
      // re-hugging whether or not the group changed.
      if (isGroup) {
        expandGroup(found.obj)
      }
      if (found.parent) affectedParents.add(found.parent)
    }
    for (const parent of affectedParents) expandGroup(parent)
    sync()
  }

  /**
   * Size a group by an explicit box: scale every descendant's edges by the
   * change in the box, then write the group's own box. A stretch axis (follows
   * both) that the handle moved becomes a fixed near-edge size, so a hand
   * resize sticks instead of continuing to stretch with the page. The edge
   * distances are relative to the box, so scaling by the box ratio is the same
   * as scaling around whichever corner the handle left fixed — the ghost's
   * x/y already carries the corner.
   */
  function resizeGroupBox(group: PageObject, local: Rect, box: CanvasSize, dir: HandleDir): void {
    const pr = rectForObject(group, box)
    const fx = pr.w > 0 ? local.w / pr.w : 1
    const fy = pr.h > 0 ? local.h / pr.h : 1
    for (const child of group.children ?? []) scaleSubtreeEdges(child, fx, fy)
    const modes: { x?: XEdgeMode; y?: YEdgeMode } = {}
    if (group.x.mode === 'both' && (dir.includes('e') || dir.includes('w'))) modes.x = 'left'
    if (group.y.mode === 'both' && (dir.includes('n') || dir.includes('s'))) modes.y = 'top'
    applyRectToObject(group, local, box, modes)
    expandGroup(group)
  }

  /**
   * One undoable geometry patch (panel fields + author bridge). Each field is
   * a rendered coordinate; it is written onto the edge constraints, keeping
   * the edges the control follows (see the script geometry rules). A width or
   * height patch on a group scales its descendants like a handle resize.
   */
  function setGeometry(id: string, patch: { x?: number; y?: number; w?: number; h?: number }): void {
    const found = locateObj(id)
    if (!found) return
    const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined)
    if (!keys.length) return
    record('Geometry', `geo:${id}:${keys.sort().join(',')}`)
    const obj = found.obj
    const box = boxForObject(obj)
    const isGroup = obj.control === 'group' && !!obj.children?.length
    const sized = isGroup && (patch.w !== undefined || patch.h !== undefined)
    if (sized) {
      const pr = rectForObject(obj, box)
      const fx = patch.w !== undefined && pr.w > 0 ? patch.w / pr.w : 1
      const fy = patch.h !== undefined && pr.h > 0 ? patch.h / pr.h : 1
      for (const child of obj.children ?? []) scaleSubtreeEdges(child, fx, fy)
    }
    if (patch.x !== undefined) writeRectPart(obj, 'x', patch.x, box)
    if (patch.y !== undefined) writeRectPart(obj, 'y', patch.y, box)
    if (patch.w !== undefined) writeRectPart(obj, 'w', patch.w, box)
    if (patch.h !== undefined) writeRectPart(obj, 'h', patch.h, box)
    if (sized) expandGroup(obj)
    if (found.parent) expandGroup(found.parent)
    sync()
  }

  /**
   * Keep a group's box hugging its members: solve every member against the
   * current group box, shift the group so the union starts at its local origin
   * (near/far members keep their absolute positions), and set the box to the
   * union. Members keep their own edge constraints; nothing is scaled. A
   * centred member re-centres when the box changes, so this iterates until the
   * union is stable (a centred member defining an extent needs a narrower box
   * to become tight). Recurses up for nested groups.
   */
  function expandGroup(parent: PageObject): void {
    const kids = parent.children ?? []
    if (!kids.length) return
    let changed = false
    for (let iter = 0; iter < 12; iter++) {
      const box = boxForObject(parent)
      const pr = rectForObject(parent, box)
      const memberBox = { width: pr.w, height: pr.h }
      const rel = kids.map((c) => rectForObject(c, memberBox))
      const union = unionRects(rel)
      const dx = -union.x
      const dy = -union.y
      if (dx === 0 && dy === 0 && union.w === pr.w && union.h === pr.h) break
      const newBox = { width: Math.max(1, union.w), height: Math.max(1, union.h) }
      for (let i = 0; i < kids.length; i++) {
        const r = rel[i]!
        applyRectToObject(kids[i]!, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, newBox)
      }
      applyRectToObject(
        parent,
        { x: pr.x + union.x, y: pr.y + union.y, w: newBox.width, h: newBox.height },
        box,
      )
      changed = true
    }
    if (changed) {
      const grand = locateObj(parent.id)?.parent
      if (grand) expandGroup(grand)
    }
  }

  /**
   * Re-hug every stretch (`both`) group in the current edit target. A page box
   * change caused by moving another control (or resizing the page) enlarges a
   * `both` group's box but leaves its members where they were, so the box no
   * longer hugs them until something calls `expandGroup`. Only `both` groups are
   * affected — a fixed-size group never changes with the page — and nested
   * groups run depth-first so the inner box is tight before the outer measures
   * it. Idempotent: a no-op when every stretched box already hugs.
   */
  function rehugStretchedGroups(): void {
    const walk = (objs: PageObject[]): void => {
      for (const o of objs) {
        if (o.children?.length) {
          walk(o.children)
          if (o.control === 'group' && (o.x.mode === 'both' || o.y.mode === 'both')) {
            expandGroup(o)
          }
        }
      }
    }
    walk(targetObjects.value)
  }

  function applyRect(id: string, rect: Rect): void {
    applyRects([{ id, rect }])
  }

  function updateProps(id: string, patch: Record<string, unknown>): void {
    const obj = locateObj(id)?.obj
    if (!obj) return
    record('Edit properties', `props:${id}`)
    const next = { ...obj.props, ...patch }
    // a patch value of undefined removes the key (e.g. a cleared font size)
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k]
    obj.props = next
    sync()
  }

  /**
   * Set one axis's edge choice (left/right/both/center or top/bottom/both/
   * center). Switching re-derives the distances from the current rendered rect,
   * so the object stays put now and only changes how it follows its page/group
   * box from here on. Members constrain to their group box like everything
   * else.
   */
  function setObjectEdge(id: string, axis: 'x' | 'y', mode: XEdgeMode | YEdgeMode): void {
    const found = locateObj(id)
    if (!found) return
    const obj = found.obj
    record('Responsive', `edge:${id}`)
    const box = boxForObject(obj)
    const r = rectForObject(obj, box)
    if (axis === 'x') obj.x = xEdgeFromRect(r, box.width, mode as XEdgeMode)
    else obj.y = yEdgeFromRect(r, box.height, mode as YEdgeMode)
    // a member's new edge can change what the group must surround
    if (found.parent) expandGroup(found.parent)
    sync()
  }

  /** effective (rendered) rect of an object — what the canvas actually shows
   *  (the X/Y/W/H fields must match it) */
  function effectiveRectOf(id: string): Rect | null {
    const obj = locateObj(id)?.obj
    if (!obj) return null
    return renderedRectOf(obj)
  }

  /** Glue a top-level object to both page edges (a fixed margin on each). */
  function fillObjectToPage(id: string, margin: number): void {
    const found = locateObj(id)
    if (!found || found.parent) return
    record('Fill page', `fill:${id}`)
    const m = Math.max(0, Math.round(margin))
    found.obj.x = { mode: 'both', left: m, right: m }
    found.obj.y = { mode: 'both', top: m, bottom: m }
    sync()
  }

  /** Glue a top-level object to both page edges horizontally. */
  function fillObjectWidth(id: string, margin: number): void {
    const found = locateObj(id)
    if (!found || found.parent) return
    record('Fill width', `fill:${id}`)
    const m = Math.max(0, Math.round(margin))
    found.obj.x = { mode: 'both', left: m, right: m }
    sync()
  }

  /** Glue a top-level object to both page edges vertically. */
  function fillObjectHeight(id: string, margin: number): void {
    const found = locateObj(id)
    if (!found || found.parent) return
    record('Fill height', `fill:${id}`)
    const m = Math.max(0, Math.round(margin))
    found.obj.y = { mode: 'both', top: m, bottom: m }
    sync()
  }

  /** Centre a top-level object on the page (both axes). */
  function centerObjectInPage(id: string): void {
    const found = locateObj(id)
    if (!found || found.parent) return
    record('Center on page', `edge:${id}`)
    const r = rectForObject(found.obj, boxForObject(found.obj))
    found.obj.x = { mode: 'center', width: r.w }
    found.obj.y = { mode: 'center', height: r.h }
    sync()
  }

  /** the page-absolute rect an object renders at (sum of ancestor group boxes) */
  function renderedPageRectOf(id: string): Rect | null {
    const chain = locateChain(id)
    if (!chain || chain.length === 0) return null
    const own = renderedRectOf(chain[chain.length - 1]!)
    const origin = absOriginOf(id)
    return { x: origin.x + own.x, y: origin.y + own.y, w: own.w, h: own.h }
  }

  /**
   * Write page-absolute rendered rects back onto edge constraints — the seam
   * align/distribute/match share. Members rebase into their group's local
   * frame; every object keeps the edges it already follows. One undo step.
   */
  function writeRenderedRects(entries: Array<{ id: string; rect: Rect }>, label: string): void {
    if (!entries.length) return
    record(label, 'align:' + entries.map((e) => e.id).sort().join(','))
    const affectedParents = new Set<PageObject>()
    for (const { id, rect } of entries) {
      const found = locateObj(id)
      if (!found) continue
      const box = boxForObject(found.obj)
      const local = found.parent ? rebaseRect(rect, absOriginOf(id)) : rect
      applyRectToObject(found.obj, local, box)
      if (found.parent) affectedParents.add(found.parent)
    }
    for (const parent of affectedParents) expandGroup(parent)
    sync()
  }

  /** align the selection to its own bounding box (Figma semantics) */
  function alignSelection(mode: AlignMode): void {
    const ids = selectionIds.value
    if (ids.length < 2 || selectionParentId.value === 'mixed') return
    const rects = ids.map(renderedPageRectOf)
    if (rects.some((r) => !r)) return
    const next = alignRects(rects as Rect[], mode)
    writeRenderedRects(ids.map((id, i) => ({ id, rect: next[i]! })), 'Align')
  }

  /** center the selection as a block on the page (the OK/Cancel case) */
  function centerSelectionOnPage(): void {
    const ids = selectionIds.value
    if (!ids.length || selectionParentId.value === 'mixed') return
    const rects = ids.map(renderedPageRectOf)
    if (rects.some((r) => !r)) return
    const next = centerBlockRects(rects as Rect[], pageBox())
    writeRenderedRects(ids.map((id, i) => ({ id, rect: next[i]! })), 'Center on page')
  }

  /** space the selection evenly along an axis (outer two fixed) */
  function distributeSelection(axis: 'x' | 'y'): void {
    const ids = selectionIds.value
    if (ids.length < 3 || selectionParentId.value === 'mixed') return
    const rects = ids.map(renderedPageRectOf)
    if (rects.some((r) => !r)) return
    const next = distributeRects(rects as Rect[], axis)
    writeRenderedRects(ids.map((id, i) => ({ id, rect: next[i]! })), 'Distribute')
  }

  /** match the selection's width/height to the largest in the selection */
  function matchSizeSelection(dim: MatchDim): void {
    const ids = selectionIds.value
    if (ids.length < 2 || selectionParentId.value === 'mixed') return
    const rects = ids.map(renderedPageRectOf)
    if (rects.some((r) => !r)) return
    const next = matchSizeRects(rects as Rect[], dim)
    writeRenderedRects(ids.map((id, i) => ({ id, rect: next[i]! })), 'Match size')
  }

  function removeSelected(): void {
    if (selectionIds.value.length === 0) return
    if (!selectionIds.value.some((id) => locateObj(id))) return
    record('Delete')
    const affectedParents = new Set<PageObject>()
    for (const id of [...selectionIds.value]) {
      const found = locateObj(id)
      if (!found) continue
      const idx = found.siblings.findIndex((o) => o.id === id)
      if (idx !== -1) found.siblings.splice(idx, 1)
      if (found.parent) affectedParents.add(found.parent)
    }
    for (const parent of affectedParents) expandGroup(parent)
    selectionIds.value = []
    sync()
  }

  /** how far a duplicate/paste nudges copies down-right so they separate */
  const DUP_OFFSET = 24

  /** all script-handle names in the current page+background namespace */
  function collectUsedNames(): Set<string> {
    // names are script handles (controls[name]): a background's objects and
    // its member pages' objects share one namespace at run time, so both
    // sides are reserved in either editing context
    const names = new Set(flattenObjects(targetObjects.value).map((o) => o.name))
    if (editing.value.kind === 'background') {
      for (const p of book.value.pages) {
        if (p.backgroundId === editing.value.id) {
          for (const o of flattenObjects(p.objects)) names.add(o.name)
        }
      }
    } else {
      const bg = backgroundFor(book.value, activePage.value)
      if (bg) for (const o of flattenObjects(bg.objects)) names.add(o.name)
    }
    return names
  }

  /** fresh-name allocator: `(control) => labelN`, reserving each issued name
   *  so nested group levels never collide within one batch */
  function nameAllocator(used: Set<string>): (control: ControlKind) => string {
    return (control: ControlKind): string => {
      let n = 1
      while (used.has(`${control}${n}`)) n++
      used.add(`${control}${n}`)
      return `${control}${n}`
    }
  }

  /** deep clone of an object (or whole group subtree) with a fresh id and name */
  function cloneObjectTree(src: PageObject, freshName: (c: ControlKind) => string): PageObject {
    const copy = JSON.parse(JSON.stringify(src)) as PageObject
    copy.id = newId('obj')
    copy.name = freshName(src.control)
    if (copy.children?.length) {
      const kids: PageObject[] = []
      for (const k of src.children!) kids.push(cloneObjectTree(k, freshName))
      copy.children = kids
    }
    return copy
  }

  /** nudge a copy down-right, keeping the edges it follows (a centred axis
   *  becomes a fixed near edge so the nudge is visible) */
  function offsetCopyRects(copy: PageObject, offset: number, box: CanvasSize): void {
    const r = rectForObject(copy, box)
    applyRectToObject(
      copy,
      { x: r.x + offset, y: r.y + offset, w: r.w, h: r.h },
      box,
      {
        x: copy.x.mode === 'center' ? 'left' : copy.x.mode,
        y: copy.y.mode === 'center' ? 'top' : copy.y.mode,
      },
    )
  }

  /** the selection's top-level originals: members of a selected group are
   *  skipped — their copies ride inside the group's subtree copy */
  function topLevelSelection(): PageObject[] {
    const sel = new Set(selectionIds.value)
    const originals: PageObject[] = []
    for (const id of selectionIds.value) {
      const found = locateObj(id)
      if (!found) continue
      // skip members of a selected group — their copies ride inside the
      // group's subtree copy already
      const chain = locateChain(id)
      const underSelected = chain
        ? chain.slice(0, -1).some((a) => sel.has(a.id))
        : false
      if (underSelected) continue
      originals.push(found.obj)
    }
    return originals
  }

  /**
   * Duplicate the selection: deep copies (groups copy their whole `children`
   * subtree), every object re-ided and re-named, inserted directly after its
   * original, duplicates selected. Undoable in one step.
   */
  function duplicateSelected(): void {
    if (selectionIds.value.length === 0) return
    const originals = topLevelSelection()
    if (!originals.length) return

    record('Duplicate')
    const freshName = nameAllocator(collectUsedNames())
    const copies: PageObject[] = []
    for (const o of originals) {
      const found = locateObj(o.id)!
      const at = found.siblings.findIndex((x) => x.id === o.id)
      const copy = cloneObjectTree(o, freshName)
      // only nudge the copy's own geometry — members stay relative to their
      // group, which moves as a whole
      offsetCopyRects(copy, DUP_OFFSET, boxForObject(found.obj))
      found.siblings.splice(at + 1, 0, copy)
      copies.push(copy)
    }
    selectionIds.value = copies.map((c) => c.id)
    sync()
  }

  // ---- copy / cut / paste ----

  /**
   * Copy the selection onto the clipboard: internal deep clone (the paste
   * source) plus the tagged `__toolback` JSON written to the OS clipboard
   * (durable, inspectable in other apps). Not undoable — nothing changed.
   * Returns how many top-level objects were copied.
   */
  function copySelected(): number {
    const originals = topLevelSelection()
    if (!originals.length) return 0
    // Pinia-proxied objects are not structured-cloneable — mirror plain data
    const snapshot = JSON.parse(JSON.stringify(originals)) as PageObject[]
    clipboard.value = snapshot
    copyText(clipboardToJson(snapshot)).catch(() => {})
    return snapshot.length
  }

  /**
   * Cut the selection: same clipboard capture as copy, then the originals are
   * removed — one undoable step. Returns how many top-level objects were cut.
   */
  function cutSelected(): number {
    const originals = topLevelSelection()
    if (!originals.length) return 0
    record('Cut')
    const snapshot = JSON.parse(JSON.stringify(originals)) as PageObject[]
    clipboard.value = snapshot
    copyText(clipboardToJson(snapshot)).catch(() => {})
    const affectedParents = new Set<PageObject>()
    for (const o of originals) {
      const found = locateObj(o.id)
      if (!found) continue
      const idx = found.siblings.findIndex((x) => x.id === o.id)
      if (idx !== -1) found.siblings.splice(idx, 1)
      if (found.parent) affectedParents.add(found.parent)
    }
    for (const parent of affectedParents) expandGroup(parent)
    selectionIds.value = []
    sync()
    return snapshot.length
  }

  /** where paste inserts: the group all selected objects share as parent
   *  (so pasting while drilled into a group lands inside it), else the top
   *  level of the page/background being edited */
  function pasteContainer(): { siblings: PageObject[]; parent: PageObject | null } {
    const sp = selectionParentId.value
    if (sp && sp !== 'mixed') {
      const found = locateObj(sp)
      if (found && found.obj.control === 'group') {
        const group = found.obj
        if (!group.children) group.children = []
        return { siblings: group.children, parent: group }
      }
    }
    return { siblings: targetObjects.value, parent: null }
  }

  /**
   * Paste the clipboard into the current edit target (or the selected group
   * when the selection shares one). Fresh ids + names, nudged +24px down-right
   * of the copied positions so repeat pastes cascade, pasted copies selected.
   * One undoable step.
   */
  function pasteClipboard(): number {
    const src = clipboard.value
    if (!src || !src.length) return 0
    record('Paste')
    const freshName = nameAllocator(collectUsedNames())
    const { siblings, parent } = pasteContainer()
    const box = parent
      ? (() => {
          const pr = renderedRectOf(parent)
          return { width: pr.w, height: pr.h }
        })()
      : pageBox()
    const copies: PageObject[] = []
    for (const o of src) {
      const copy = cloneObjectTree(o, freshName)
      offsetCopyRects(copy, DUP_OFFSET, box)
      siblings.push(copy)
      copies.push(copy)
    }
    if (parent) expandGroup(parent)
    // the in-app mirror now tracks the pasted positions, so the next paste
    // cascades another 24px (the OS clipboard still holds the original copy)
    clipboard.value = copies
    selectionIds.value = copies.map((c) => c.id)
    sync()
    return copies.length
  }

  function reorderSelection(action: 'front' | 'back' | 'forward' | 'backward'): void {
    const found = selectionIds.value.length === 1 ? locateObj(selectionIds.value[0]!) : null
    if (!found) return
    const idx = found.siblings.findIndex((o) => o.id === found.obj.id)
    if (idx === -1) return
    record('Reorder')
    const [obj] = found.siblings.splice(idx, 1)
    let target: number
    switch (action) {
      case 'front':
        target = found.siblings.length
        break
      case 'back':
        target = 0
        break
      case 'forward':
        target = Math.min(found.siblings.length, idx + 1)
        break
      case 'backward':
        target = Math.max(0, idx - 1)
        break
    }
    found.siblings.splice(target, 0, obj!)
    sync()
  }

  function groupSelected(): void {
    if (!groupEligible.value) return
    const parentId = selectionParentId.value
    const members: PageObject[] = []
    for (const id of selectionIds.value) {
      const found = locateObj(id)
      if (!found || (found.parent?.id ?? null) !== parentId) continue
      members.push(found.obj)
    }
    if (members.length < 2) return
    const siblings = locateObj(members[0]!.id)!.siblings
    const indices = members.map((m) => siblings.indexOf(m))
    const insertAt = Math.max(...indices) - (members.length - 1)

    record('Group')
    // members share a parent, so they all resolve against the same box
    const box = boxForObject(members[0]!)
    const rel = members.map((m) => rectForObject(m, box))
    const groupRect = unionRects(rel)
    const groupBox = { width: Math.max(1, groupRect.w), height: Math.max(1, groupRect.h) }
    const rebased = members.map((m, i) => {
      const next: PageObject = JSON.parse(JSON.stringify(m))
      const r = rel[i]!
      applyRectToObject(next, { x: r.x - groupRect.x, y: r.y - groupRect.y, w: r.w, h: r.h }, groupBox)
      return next
    })
    const group = createGroup(uniqueName('group'), groupRect, rebased)

    for (const m of members) {
      const i = siblings.indexOf(m)
      if (i !== -1) siblings.splice(i, 1)
    }
    siblings.splice(Math.max(0, Math.min(insertAt, siblings.length)), 0, group)
    selectionIds.value = [group.id]
    sync()
  }

  function ungroupSelected(): void {
    const found = ungroupEligible.value ? locateObj(selectionIds.value[0]!) : null
    if (!found || found.obj.control !== 'group' || !found.obj.children?.length) return
    record('Ungroup')
    const group = found.obj
    const idx = found.siblings.findIndex((o) => o.id === found.obj.id)
    const children = group.children ?? []
    // place members where the group is rendered so ungrouping never jumps them
    const parentBox = boxForObject(group)
    const groupR = rectForObject(group, parentBox)
    const groupBox = { width: groupR.w, height: groupR.h }
    for (const child of children) {
      const cr = rectForObject(child, groupBox)
      applyRectToObject(
        child,
        { x: groupR.x + cr.x, y: groupR.y + cr.y, w: cr.w, h: cr.h },
        parentBox,
      )
    }
    found.siblings.splice(idx, 1, ...children)
    selectionIds.value = children.map((c) => c.id)
    sync()
  }

  function setSelection(ids: string[] | string | null): void {
    selectionIds.value = ids === null ? [] : Array.isArray(ids) ? ids : [ids]
    sync()
  }

  function applySelection(ids: string[] | null): void {
    const valid = new Set(allObjects.value.map((o) => o.id))
    selectionIds.value = (ids ?? []).filter((id) => valid.has(id))
  }

  return {
    book,
    viewport,
    pageRect,
    selectionIds,
    canvasReady,
    rects,
    error,
    dragOverCanvas,
    isRunning,
    scriptError,
    storeEntries,
    popupsOpen,
    currentPageIndex,
    editing,
    backgroundDialogId,
    authorActive,
    recents,
    autosaveAt,
    savedAt,
    fileNote,
    propsWidth,
    paletteWidth,
    activePage,
    activeBackground,
    targetObjects,
    backgroundPageCount,
    activeCanvasSize,
    allObjects,
    objectCount,
    selectedObjects,
    selectedObject,
    selectionParentId,
    groupEligible,
    ungroupEligible,
    sync,
    toggleRun,
    setAuthorActive,
    startAuthor,
    stopAuthor,
    setPageAuthorFlag,
    setStartPage,
    setViewport,
    setPageRect,
    setPageSize,
    setPropsWidth,
    savePropsWidth,
    resetPropsWidth,
    setPaletteWidth,
    savePaletteWidth,
    resetPaletteWidth,
    fitHints,
    fitHintMode,
    setFitHints,
    setFitHintMode,
    setEventScript,
    setPageScript,
    setDesignStore,
    selectPage,
    editPage,
    editBackground,
    addPage,
    duplicatePage,
    removePage,
    renamePage,
    reorderPage,
    addBackground,
    duplicateBackground,
    removeBackground,
    renameBackground,
    setBackgroundProp,
    setBackgroundScript,
    movePageToBackground,
    newBook,
    hydrate,
    restoreAutosave,
    refreshRecents,
    rememberCurrent,
    save,
    renameBook,
    renameRecent,
    deleteRecent,
    openRecent,
    addObject,
    applyRect,
    applyRects,
    updateProps,
    setObjectEdge,
    setGeometry,
    effectiveRectOf,
    fillObjectToPage,
    fillObjectWidth,
    fillObjectHeight,
    centerObjectInPage,
    alignSelection,
    centerSelectionOnPage,
    distributeSelection,
    matchSizeSelection,
    removeSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteClipboard,
    clipboard,
    canPaste,
    reorderSelection,
    groupSelected,
    ungroupSelected,
    setSelection,
    applySelection,
    flashCanvasNote,
    canvasNote,
    undo,
    redo,
    canUndo,
    canRedo,
  }
})
