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
    book.value.pages.push(createPage(uniquePageName()))
    selectPage(book.value.pages.length - 1)
  }

  function duplicatePage(i: number): void {
    const src = book.value.pages[i]
    if (!src) return
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
    book.value.pages.splice(i, 1)
    selectPage(Math.min(currentPageIndex.value, book.value.pages.length - 1))
  }

  function renamePage(i: number, name: string): void {
    const page = book.value.pages[i]
    if (!page) return
    const trimmed = name.trim()
    if (trimmed) page.name = trimmed
    sync()
  }

  function setBreakpoint(bp: Breakpoint): void {
    if (isRunning.value) return
    // upgrade pre-M4 books that only have a desktop canvas size
    if (!book.value.canvas[bp]) {
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
    if (code.trim()) obj.on[event] = code
    else delete obj.on[event]
    sync()
  }

  function setPageScript(code: string): void {
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
    const obj = createObject(control, uniqueName(control), { desktop: rect }, { ...DEFAULT_PROPS[control] })
    activePage.value.objects.push(obj)
    selectionIds.value = [obj.id]
    sync()
  }

  function applyRects(list: Array<{ id: string; rect: Rect }>): void {
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
    obj.props = { ...obj.props, ...patch }
    sync()
  }

  function removeSelected(): void {
    if (selectionIds.value.length === 0) return
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

  function reorderSelection(action: 'front' | 'back' | 'forward' | 'backward'): void {
    const found = selectionIds.value.length === 1 ? locateObj(selectionIds.value[0]!) : null
    if (!found) return
    const idx = found.siblings.findIndex((o) => o.id === found.obj.id)
    if (idx === -1) return
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
    reorderSelection,
    groupSelected,
    ungroupSelected,
    setSelection,
    applySelection,
  }
})
