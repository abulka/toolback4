import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createObject,
  type Breakpoint,
  type ControlKind,
  type Rect,
} from '@toolback/format'
import { sampleBook } from '@toolback/format/src/sample'
import type { EditorToCanvasMessage, ObjectRects } from '@toolback/runtime'

let sendSync: ((msg: EditorToCanvasMessage) => void) | null = null

export function setSyncSender(fn: (msg: EditorToCanvasMessage) => void): void {
  sendSync = fn
}

const DEFAULT_PROPS: Record<ControlKind, Record<string, unknown>> = {
  button: { text: 'Button' },
  label: { text: 'Label' },
  input: { placeholder: 'Type here' },
  image: {},
  card: { title: 'Card', text: 'Card body' },
  container: {},
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

  const activePage = computed(() => book.value.pages[0]!)
  const objectCount = computed(() => Object.keys(rects.value).length)
  const selectedObject = computed(
    () => activePage.value.objects.find((o) => o.id === selectionId.value) ?? null,
  )

  function sync(): void {
    if (!sendSync) return
    sendSync({
      type: 'toolback:load',
      book: JSON.parse(JSON.stringify(book.value)),
      breakpoint: breakpoint.value,
      design: !isRunning.value,
      selection: selectionId.value,
    })
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
    activePage,
    objectCount,
    selectedObject,
    sync,
    toggleRun,
    setEventScript,
    setPageScript,
    addObject,
    applyRect,
    updateProps,
    removeObject,
    setSelection,
    applySelection,
  }
})
