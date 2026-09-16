import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseBook, type Book } from '@toolback/format'
import { useBookStore } from './book'

function twoObjectBook(): Book {
  return parseBook({
    id: 'b1',
    title: 'T',
    pages: [
      {
        id: 'p1',
        name: 'P',
        objects: [
          { id: 'a', name: 'labelA', control: 'label', x: { mode: 'left', left: 0, width: 100 }, y: { mode: 'top', top: 0, height: 50 } },
          { id: 'b', name: 'labelB', control: 'label', x: { mode: 'left', left: 120, width: 80 }, y: { mode: 'top', top: 40, height: 60 } },
        ],
      },
    ],
  })
}

function objById(store: ReturnType<typeof useBookStore>, id: string) {
  return store.book.pages[store.currentPageIndex]!.objects.find((o) => o.id === id)!
}

describe('book store — undo/redo history', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    vi.setSystemTime(new Date('2026-09-11T00:00:00Z'))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('undoes adding an object and re-applies it on redo', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    expect(store.canUndo).toBe(false)

    store.addObject('button', { x: 10, y: 10, w: 120, h: 40 })
    expect(store.book.pages[0]!.objects).toHaveLength(3)
    expect(store.canUndo).toBe(true)

    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.book.pages[0]!.objects).toHaveLength(3)
    expect(store.canRedo).toBe(false)
  })

  it('restores the selection that existed before a delete', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.removeSelected()

    expect(store.book.pages[0]!.objects).toHaveLength(0)
    expect(store.selectionIds).toEqual([])

    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    // the deleted objects come back selected
    expect(store.selectionIds).toEqual(['a', 'b'])

    store.redo()
    expect(store.book.pages[0]!.objects).toHaveLength(0)
    expect(store.selectionIds).toEqual([])
  })

  it('undoes and redoes a group/ungroup round trip', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    expect(store.book.pages[0]!.objects[0]!.control).toBe('group')

    store.ungroupSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    // members re-selected after ungroup
    expect(store.selectionIds).toEqual(['a', 'b'])

    store.undo()
    expect(store.book.pages[0]!.objects[0]!.control).toBe('group')
    expect(store.selectionIds).toHaveLength(1)

    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
  })

  it('undoes a z-order change', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.reorderSelection('front')
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['b', 'a'])

    store.undo()
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('restores the active page after undoing a page delete', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addPage()
    expect(store.book.pages).toHaveLength(2)
    store.removePage(1)
    expect(store.book.pages).toHaveLength(1)

    store.undo()
    expect(store.book.pages).toHaveLength(2)
    expect(store.currentPageIndex).toBe(1)
  })

  it('coalesces rapid edits to the same script target into one step', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setEventScript('a', 'click', 'n = 1;')
    vi.setSystemTime(new Date('2026-09-11T00:00:00.200Z'))
    store.setEventScript('a', 'click', 'n = 2;')
    vi.setSystemTime(new Date('2026-09-11T00:00:00.400Z'))
    store.setEventScript('a', 'click', 'n = 3;')

    // one coalesced entry: undoing once drops the whole burst
    store.undo()
    expect(objById(store, 'a').on.click).toBeUndefined()

    store.redo()
    expect(objById(store, 'a').on.click).toBe('n = 3;')
  })

  it('a pause between edits to the same target makes separate steps', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setEventScript('a', 'click', 'n = 1;')
    vi.setSystemTime(new Date('2026-09-11T00:00:10Z')) // +10s > 800ms window
    store.setEventScript('a', 'click', 'n = 2;')

    store.undo()
    expect(objById(store, 'a').on.click).toBe('n = 1;')
    store.undo()
    expect(objById(store, 'a').on.click).toBeUndefined()

    store.redo()
    expect(objById(store, 'a').on.click).toBe('n = 1;')
    store.redo()
    expect(objById(store, 'a').on.click).toBe('n = 2;')
  })

  it('a different edit target never coalesces', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setEventScript('a', 'click', 'n = 1;')
    vi.setSystemTime(new Date('2026-09-11T00:00:00.200Z'))
    store.setEventScript('b', 'click', 'm = 2;')

    store.undo()
    expect(objById(store, 'b').on.click).toBeUndefined()
    expect(objById(store, 'a').on.click).toBe('n = 1;')

    store.undo()
    expect(objById(store, 'a').on.click).toBeUndefined()
  })

  it('coalesces rapid geometry edits like a single drag', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.applyRect('a', { x: 8, y: 8, w: 40, h: 40 })
    vi.setSystemTime(new Date('2026-09-11T00:00:00.300Z'))
    store.applyRect('a', { x: 16, y: 16, w: 40, h: 40 })

    store.undo()
    expect(store.book.pages[0]!.objects[0]!.x).toEqual({ mode: 'left', left: 0, width: 100 })
    expect(store.book.pages[0]!.objects[0]!.y).toEqual({ mode: 'top', top: 0, height: 50 })
  })

  it('a new edit after an undo clears the redo stack', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addObject('button', { x: 10, y: 10, w: 120, h: 40 })
    store.undo()
    expect(store.canRedo).toBe(true)

    store.addObject('label', { x: 20, y: 20, w: 60, h: 20 })
    expect(store.canRedo).toBe(false)
  })

  it('undoing after a redo returns to the pre-redo state', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.applyRect('a', { x: 16, y: 16, w: 40, h: 40 }) // original {0,0,100,50}
    store.undo() // → original
    store.redo() // → {16,16,40,40}
    expect(store.book.pages[0]!.objects[0]!.x).toEqual({ mode: 'left', left: 16, width: 40 })
    expect(store.book.pages[0]!.objects[0]!.y).toEqual({ mode: 'top', top: 16, height: 40 })

    store.undo()
    expect(store.book.pages[0]!.objects[0]!.x).toEqual({ mode: 'left', left: 0, width: 100 })
    expect(store.book.pages[0]!.objects[0]!.y).toEqual({ mode: 'top', top: 0, height: 50 })
  })

  it('does not record anything while running', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.toggleRun()
    store.addObject('button', { x: 10, y: 10, w: 120, h: 40 })
    store.toggleRun()

    expect(store.canUndo).toBe(false)
    store.undo() // no-op, nothing to undo
    expect(store.book.pages[0]!.objects).toHaveLength(3)
  })

  it('hydrating a fresh book clears the previous history', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addObject('button', { x: 10, y: 10, w: 120, h: 40 })
    expect(store.canUndo).toBe(true)

    store.hydrate(twoObjectBook())
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('newBook clears history too', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addObject('button', { x: 10, y: 10, w: 120, h: 40 })
    store.newBook()
    expect(store.canUndo).toBe(false)
  })

  it('caps the undo stack at 100 entries', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    for (let i = 0; i < 105; i++) store.addPage()

    for (let i = 0; i < 100; i++) store.undo()
    expect(store.canUndo).toBe(false)
    // the earliest 5 addPage entries were dropped by the cap
    expect(store.book.pages.length).toBeGreaterThan(1)
  })

  it('undo restores a script edited for the page', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setPageScript('pageEnter() {}')
    vi.setSystemTime(new Date('2026-09-11T00:00:01Z'))
    store.setPageScript('pageEnter() { store.set("x", 1) }')

    store.undo()
    expect(store.book.pages[0]!.script).toBe('pageEnter() {}')
    store.undo()
    expect(store.book.pages[0]!.script).toBe('')
  })

  it('undoes a duplicate (single step) and restores the pre-dup selection', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.duplicateSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(3)
    // duplicates are selected, not the originals
    expect(store.selectionIds).toHaveLength(1)
    expect(store.selectionIds[0]).not.toBe('a')

    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    // back to the originals selected
    expect(store.selectionIds).toEqual(['a'])

    store.redo()
    expect(store.book.pages[0]!.objects).toHaveLength(3)
  })

  it('undoes a group duplicate as one step', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const groupId = store.selectionIds[0]!

    store.duplicateSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(2)

    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(1)
    expect(store.selectionIds).toEqual([groupId])
  })
})