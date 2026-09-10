import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createBook,
  createObject,
  createPage,
  DEFAULT_PROPS,
  newId,
  parseBook,
  type Book,
  type Breakpoint,
  type ControlKind,
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
  const selectionId = ref<string | null>(null)
  const canvasReady = ref(false)
  const rects = ref<ObjectRects>({})
  const error = ref('')
  const dragOverCanvas = ref(false)
  const isRunning = ref(false)
  const scriptError = ref('')
  const currentPageIndex = ref(0)
  const recents = ref<RecentEntry[]>([])
  const autosaveAt = ref<number | null>(null)
  const fileNote = ref('')

  const activePage = computed(
    () => book.value.pages[currentPageIndex.value] ?? book.value.pages[0]!,
  )
  const objectCount = computed(() => Object.keys(rects.value).length)
  const selectedObject = computed(
    () => activePage.value.objects.find((o) => o.id === selectionId.value) ?? null,
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
      selection: selectionId.value,
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

  function selectPage(i: number): void {
    currentPageIndex.value = Math.max(0, Math.min(i, book.value.pages.length - 1))
    selectionId.value = null
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
    for (const o of copy.objects) o.id = newId('obj')
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

  function newBook(): void {
    book.value = createBook('Untitled book')
    currentPageIndex.value = 0
    selectionId.value = null
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
    selectionId.value = null
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
    selectionId.value = null
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
    const obj = activePage.value.objects.find((o) => o.id === id)
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
    const existing = new Set(activePage.value.objects.map((o) => o.name))
    let n = 1
    while (existing.has(`${control}${n}`)) n++
    return `${control}${n}`
  }

  function addObject(control: ControlKind, rect: Rect): void {
    const obj = createObject(control, uniqueName(control), { desktop: rect }, { ...DEFAULT_PROPS[control] })
    activePage.value.objects.push(obj)
    selectionId.value = obj.id
    sync()
  }

  function applyRect(id: string, rect: Rect): void {
    const obj = activePage.value.objects.find((o) => o.id === id)
    if (!obj) return
    obj.rects[breakpoint.value] = rect
    sync()
  }

  function updateProps(id: string, patch: Record<string, unknown>): void {
    const obj = activePage.value.objects.find((o) => o.id === id)
    if (!obj) return
    obj.props = { ...obj.props, ...patch }
    sync()
  }

  function removeObject(id: string): void {
    const page = activePage.value
    const idx = page.objects.findIndex((o) => o.id === id)
    if (idx === -1) return
    page.objects.splice(idx, 1)
    if (selectionId.value === id) selectionId.value = null
    sync()
  }

  function setSelection(id: string | null): void {
    selectionId.value = id
    sync()
  }

  function applySelection(id: string | null): void {
    selectionId.value =
      id && activePage.value.objects.some((o) => o.id === id) ? id : null
  }

  return {
    book,
    breakpoint,
    selectionId,
    canvasReady,
    rects,
    error,
    dragOverCanvas,
    isRunning,
    scriptError,
    currentPageIndex,
    recents,
    autosaveAt,
    fileNote,
    activePage,
    objectCount,
    selectedObject,
    sync,
    toggleRun,
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
    updateProps,
    removeObject,
    setSelection,
    applySelection,
  }
})
