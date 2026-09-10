import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createBook,
  createGroup,
  createObject,
  createPage,
  DEFAULT_PROPS,
  flattenObjects,
  newId,
  parseBook,
  rebaseRect,
  unionRects,
  unrebaseRect,
  BREAKPOINTS,
  type Book,
  type Breakpoint,
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
  saveAutosave,
  type RecentEntry,
} from '../persist'

let sendSync: ((msg: EditorToCanvasMessage) => void) | null = null

export function setSyncSender(fn: (msg: EditorToCanvasMessage) => void): void {
  sendSync = fn
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
  const storeEntries = ref<Array<[string, string]>>([])
  const currentPageIndex = ref(0)
  const recents = ref<RecentEntry[]>([])
  const autosaveAt = ref<number | null>(null)
  const fileNote = ref('')
  const propsWidth = ref<number>(
    Number(localStorage.getItem('toolback.propsWidth')) || 330,
  )

  const activePage = computed(
    () => book.value.pages[currentPageIndex.value] ?? book.value.pages[0]!,
  )
  const objectCount = computed(() => flattenObjects(activePage.value.objects).length)
  const allObjects = computed(() => flattenObjects(activePage.value.objects))
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

  // ---- undo/redo: whole-book snapshots. The store is the single source of
  // truth for every content mutation, so a pre-mutation deep clone of the
  // book (plus selection/page so undone deletes re-select) covers objects,
  // scripts, pages, groups, z-order and breakpoints with one mechanism.

  interface HistorySnapshot {
    book: Book
    selectionIds: string[]
    currentPageIndex: number
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
    const page = book.value.pages[currentPageIndex.value]
    const valid = new Set((page ? flattenObjects(page.objects) : []).map((o) => o.id))
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
    return walk(activePage.value.objects, null)
  }

  function parentIdOf(id: string): string | null {
    return locateObj(id)?.parent?.id ?? null
  }

  /** chain from the page root to the object (for accumulated group origins) */
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
    return walk(activePage.value.objects, [])
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
    currentPageIndex.value = Math.max(0, Math.min(i, book.value.pages.length - 1))
    selectionIds.value = []
    sync()
  }

  function addPage(): void {
    record('Add page')
    book.value.pages.push(createPage(uniquePageName()))
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

  function newBook(): void {
    clearHistory()
    book.value = createBook('Untitled book')
    currentPageIndex.value = 0
    selectionIds.value = []
    isRunning.value = false
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
    isRunning.value = false
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
    autosaveAt.value = saved.at
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

  async function openRecent(id: string): Promise<void> {
    const recent = await getRecentBook(id)
    if (recent) hydrate(recent)
  }

  function toggleRun(): void {
    isRunning.value = !isRunning.value
    if (isRunning.value) scriptError.value = ''
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

  function setPageScript(code: string): void {
    record('Edit page script', `script:page:${activePage.value.id}`)
    activePage.value.script = code
    sync()
  }

  function uniqueName(control: ControlKind): string {
    const existing = new Set(flattenObjects(activePage.value.objects).map((o) => o.name))
    let n = 1
    while (existing.has(`${control}${n}`)) n++
    return `${control}${n}`
  }

  function addObject(control: ControlKind, rect: Rect): void {
    record('Add ' + control)
    const obj = createObject(control, uniqueName(control), { desktop: rect }, { ...DEFAULT_PROPS[control] })
    activePage.value.objects.push(obj)
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
    obj.props = { ...obj.props, ...patch }
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
    const usedNames = new Set(flattenObjects(activePage.value.objects).map((o) => o.name))
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
    currentPageIndex,
    recents,
    autosaveAt,
    fileNote,
    propsWidth,
    activePage,
    allObjects,
    objectCount,
    selectedObjects,
    selectedObject,
    selectionParentId,
    groupEligible,
    ungroupEligible,
    sync,
    toggleRun,
    setBreakpoint,
    setPropsWidth,
    savePropsWidth,
    resetPropsWidth,
    setEventScript,
    setPageScript,
    selectPage,
    addPage,
    duplicatePage,
    removePage,
    renamePage,
    newBook,
    hydrate,
    restoreAutosave,
    refreshRecents,
    rememberCurrent,
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
    undo,
    redo,
    canUndo,
    canRedo,
  }
})
