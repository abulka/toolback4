import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  backgroundFor,
  createBackground,
  createBook,
  createGroup,
  createObject,
  createPage,
  DEFAULT_PROPS,
  flattenObjects,
  newId,
  parseBook,
  rebaseRect,
  resolvePageSize,
  unionRects,
  unrebaseRect,
  BREAKPOINTS,
  type Background,
  type Book,
  type Breakpoint,
  type CanvasSize,
  type ControlKind,
  type PageObject,
  type Rect,
} from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import type { EditorToCanvasMessage, ObjectRects } from '@toolback/runtime'
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
  const breakpoint = ref<Breakpoint>('desktop')
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
  /** canvas (iframe) size of the current edit target at the current breakpoint */
  const activeCanvasSize = computed<CanvasSize>(() => {
    const bg =
      editing.value.kind === 'background'
        ? (activeBackground.value ?? undefined)
        : backgroundFor(book.value, activePage.value)
    return resolvePageSize(book.value, bg, breakpoint.value)
  })
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
    if (!sendSync) return
    sendSync({
      type: 'toolback:load',
      book: JSON.parse(JSON.stringify(book.value)),
      breakpoint: breakpoint.value,
      pageIndex: currentPageIndex.value,
      view:
        editing.value.kind === 'background'
          ? { kind: 'background', id: editing.value.id }
          : { kind: 'page', index: currentPageIndex.value },
      design: !isRunning.value,
      selection: selectionIds.value,
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

  /** absolute page-space origin of an object (sum of ancestor group origins) */
  function absOriginOf(id: string): { x: number; y: number } {
    const chain = locateChain(id)
    if (!chain || chain.length < 2) return { x: 0, y: 0 }
    let x = 0
    let y = 0
    for (let i = 0; i < chain.length - 1; i++) {
      const g = chain[i]!
      const r = g.rects[breakpoint.value] ?? g.rects.desktop
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
    book.value.pages.splice(i, 1)
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

  /** null removes the per-breakpoint override (falls back to the book size) */
  function setBackgroundSize(id: string, bp: Breakpoint, size: CanvasSize | null): void {
    const bg = book.value.backgrounds.find((b) => b.id === id)
    if (!bg) return
    record('Background size', `bgsize:${id}:${bp}`)
    if (size === null) {
      if (bg.size) {
        const next = { ...bg.size }
        delete next[bp]
        bg.size = Object.keys(next).length ? next : undefined
      }
    } else {
      bg.size = { ...bg.size, [bp]: size }
    }
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

  function setBreakpoint(bp: Breakpoint): void {
    if (isRunning.value) return
    // upgrade pre-M4 books that only have a desktop canvas size
    if (!book.value.canvas[bp]) {
      record('Breakpoint size')
      book.value.canvas[bp] =
        bp === 'mobile'
          ? { width: 390, height: 844 }
          : bp === 'tablet'
            ? { width: 768, height: 1024 }
            : { width: 1280, height: 800 }
    }
    breakpoint.value = bp
    sync()
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
    currentPageIndex.value = 0
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
    currentPageIndex.value = 0
    selectionIds.value = []
    editing.value = { kind: 'page' }
    isRunning.value = false
    popupsOpen.value = []
    savedAt.value = null
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
    currentPageIndex.value = 0
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
        breakpoint: breakpoint.value,
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
    const existing = new Set(flattenObjects(targetObjects.value).map((o) => o.name))
    if (editing.value.kind === 'background') {
      for (const p of book.value.pages) {
        if (p.backgroundId === editing.value.id) {
          for (const o of flattenObjects(p.objects)) existing.add(o.name)
        }
      }
    } else {
      const bg = backgroundFor(book.value, activePage.value)
      if (bg) for (const o of flattenObjects(bg.objects)) existing.add(o.name)
    }
    let n = 1
    while (existing.has(`${control}${n}`)) n++
    return `${control}${n}`
  }

  function addObject(control: ControlKind, rect: Rect): void {
    record('Add ' + control)
    const obj = createObject(control, uniqueName(control), { desktop: rect }, { ...DEFAULT_PROPS[control] })
    targetObjects.value.push(obj)
    selectionIds.value = [obj.id]
    sync()
  }

  function applyRects(list: Array<{ id: string; rect: Rect }>): void {
    if (!list.some(({ id }) => locateObj(id))) return
    const key = 'rect:' + [...new Set(list.map((l) => l.id))].sort().join(',')
    record('Move/Resize', key)
    const affectedParents = new Set<PageObject>()
    for (const { id, rect } of list) {
      const found = locateObj(id)
      if (!found) continue
      const origin = absOriginOf(id)
      const local = found.parent ? rebaseRect(rect, origin) : rect
      found.obj.rects = { ...found.obj.rects, [breakpoint.value]: local }
      if (found.parent) affectedParents.add(found.parent)
    }
    for (const parent of affectedParents) expandGroup(parent)
    sync()
  }

  /**
   * Recompute a group's rect as the tight bounds of its members — the box
   * always hugs the content: it grows when a member moves out AND shrinks
   * when members move in. If the origin moves, all members shift by the
   * origin delta so nothing jumps on screen. Recurses up for nested groups.
   */
  function expandGroup(parent: PageObject): void {
    const bp = breakpoint.value
    const before = parent.rects[bp] ?? parent.rects.desktop
    const kids = parent.children ?? []
    if (!kids.length) return
    const childAbs = kids.map((c) =>
      unrebaseRect(c.rects[bp] ?? c.rects.desktop, { x: before.x, y: before.y }),
    )
    const grown = unionRects(childAbs)
    if (
      grown.x === before.x &&
      grown.y === before.y &&
      grown.w === before.w &&
      grown.h === before.h
    ) {
      return
    }
    const dx = before.x - grown.x
    const dy = before.y - grown.y
    parent.rects = { ...parent.rects, [bp]: grown }
    const shift = (objs: PageObject[]): void => {
      for (const c of objs) {
        const r = c.rects[bp] ?? c.rects.desktop
        c.rects = { ...c.rects, [bp]: { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h } }
      }
    }
    shift(kids)
    // the group's own abs rect may now exceed (or no longer fill) ITS parent
    const grand = locateObj(parent.id)?.parent
    if (grand) expandGroup(grand)
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

  /**
   * Duplicate the selection: deep copies (groups copy their whole `children`
   * subtree), every object re-ided and re-named, inserted directly after its
   * original, duplicates selected. Undoable in one step.
   */
  function duplicateSelected(): void {
    if (selectionIds.value.length === 0) return
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
    if (!originals.length) return

    record('Duplicate')
    // fresh names computed once so nested group levels never collide (the
    // clones aren't on the page until the recursion is done)
    const usedNames = (() => {
      // same namespace rule as uniqueName: page + its background (either
      // editing direction) share script handles
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
    })()
    const freshName = (control: ControlKind): string => {
      let n = 1
      while (usedNames.has(`${control}${n}`)) n++
      usedNames.add(`${control}${n}`)
      return `${control}${n}`
    }
    // nudge the copy down-right so it visibly separates from the original
    const DUP_OFFSET = 24
    const copies: PageObject[] = []
    const cloneObject = (src: PageObject): PageObject => {
      const copy = JSON.parse(JSON.stringify(src)) as PageObject
      copy.id = newId('obj')
      copy.name = freshName(src.control)
      if (copy.children?.length) {
        const kids: PageObject[] = []
        for (const k of src.children!) kids.push(cloneObject(k))
        copy.children = kids
      }
      return copy
    }
    const offsetCopy = (copy: PageObject): void => {
      for (const bp of BREAKPOINTS) {
        const r = copy.rects[bp]
        if (!r) continue
        copy.rects[bp] = { ...r, x: r.x + DUP_OFFSET, y: r.y + DUP_OFFSET }
      }
    }
    for (const o of originals) {
      const found = locateObj(o.id)!
      const at = found.siblings.findIndex((x) => x.id === o.id)
      const copy = cloneObject(o)
      // only nudge the top-level copy's own rects — members stay relative to
      // their group, which moves as a whole
      offsetCopy(copy)
      found.siblings.splice(at + 1, 0, copy)
      copies.push(copy)
    }
    selectionIds.value = copies.map((c) => c.id)
    sync()
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
    const groupRects: Record<string, Rect> = {}
    for (const bp of BREAKPOINTS) {
      const rectsForBp = members.map((m) => m.rects[bp] ?? m.rects.desktop)
      groupRects[bp] = unionRects(rectsForBp)
    }
    const rebased = members.map((m) => {
      const next: PageObject = JSON.parse(JSON.stringify(m))
      for (const bp of BREAKPOINTS) {
        next.rects[bp] = rebaseRect(next.rects[bp] ?? next.rects.desktop, groupRects[bp]!)
      }
      return next
    })
    const group = createGroup(uniqueName('group'), groupRects as never, rebased)

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
    for (const child of children) {
      const nextRects: Record<string, Rect> = {}
      for (const bp of BREAKPOINTS) {
        const groupR = group.rects[bp] ?? group.rects.desktop
        nextRects[bp] = unrebaseRect(child.rects[bp] ?? child.rects.desktop, {
          x: groupR.x,
          y: groupR.y,
        })
      }
      child.rects = nextRects as never
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
    breakpoint,
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
    setBreakpoint,
    setPropsWidth,
    savePropsWidth,
    resetPropsWidth,
    setPaletteWidth,
    savePaletteWidth,
    resetPaletteWidth,
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
    setBackgroundSize,
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
    removeSelected,
    duplicateSelected,
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
