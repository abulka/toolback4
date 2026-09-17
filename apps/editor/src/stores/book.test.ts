import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  createGroup,
  createObject,
  DEFAULT_FIT_HINTS,
  flattenObjects,
  parseBook,
  type Book,
} from '@toolback/format'
import { useBookStore } from './book'
import type { RecentEntry } from '../persist'

// persist talks to IndexedDB, which this node test env lacks — back it with
// an in-memory map obeying the same key conventions.
vi.mock('../persist', () => {
  const map = new Map<string, unknown>()
  return {
    saveAutosave: vi.fn(async (book: Book) => {
      map.set('autosave', { book, at: Date.now() })
    }),
    loadAutosave: vi.fn(async () => map.get('autosave') as { book: Book; at: number } | undefined),
    getRecents: vi.fn(async () => (map.get('recents') as RecentEntry[] | undefined) ?? []),
    putRecentBook: vi.fn(async (book: Book) => {
      map.set(`book:${book.id}`, book)
      const recents = (map.get('recents') as RecentEntry[] | undefined) ?? []
      const next = [
        { id: book.id, title: book.title, at: Date.now() },
        ...recents.filter((r) => r.id !== book.id),
      ].slice(0, 8)
      map.set('recents', next)
      return next
    }),
    removeBook: vi.fn(async (id: string) => {
      map.delete(`book:${id}`)
      const recents = (map.get('recents') as RecentEntry[] | undefined) ?? []
      map.set('recents', recents.filter((r) => r.id !== id))
    }),
    getRecentBook: vi.fn(async (id: string) => map.get(`book:${id}`) as Book | undefined),
  }
})

function twoObjectBook(): Book {
  return parseBook({
    id: 'b1',
    title: 'T',
    design: { width: 800, height: 600 },
    pages: [
      {
        id: 'p1',
        name: 'P',
        objects: [
          { id: 'a', name: 'labelA', control: 'label', rect: { x: 0, y: 0, w: 100, h: 50 } },
          {
            id: 'b',
            name: 'labelB',
            control: 'label',
            rect: { x: 120, y: 40, w: 80, h: 60 },
          },
        ],
      },
    ],
  })
}

describe('book store — groups and arrange', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('groups a multi-selection into a group with rebased children', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    expect(store.groupEligible).toBe(true)
    store.groupSelected()

    const page = store.activePage
    expect(page.objects).toHaveLength(1)
    const group = page.objects[0]!
    expect(group.control).toBe('group')
    expect(group.name).toBe('group1')
    expect(group.x).toEqual({ mode: 'left', left: 0, width: 200 })
    expect(group.y).toEqual({ mode: 'top', top: 0, height: 100 })
    const kids = group.children!
    expect(kids[0]!.x).toEqual({ mode: 'left', left: 0, width: 100 })
    expect(kids[0]!.y).toEqual({ mode: 'top', top: 0, height: 50 })
    expect(kids[1]!.x).toEqual({ mode: 'left', left: 120, width: 80 })
    expect(kids[1]!.y).toEqual({ mode: 'top', top: 40, height: 60 })
    // group is selected after grouping
    expect(store.selectionIds).toEqual([group.id])
  })

  it('moving a top-level group below the fold grows the page', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const group = store.activePage.objects[0]!
    store.applyRects([{ id: group.id, rect: { x: 0, y: 900, w: 200, h: 100 } }])
    expect(store.activeCanvasSize.height).toBe(1000)
  })

  it('every group box carries left/top edges by default', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const outer = store.activePage.objects[0]!
    expect(outer.x).toEqual({ mode: 'left', left: 0, width: 200 })
    expect(outer.y).toEqual({ mode: 'top', top: 0, height: 100 })

    // a nested group carries its own edges relative to the outer box
    store.setSelection(outer.children!.map((c) => c.id))
    store.groupSelected()
    const inner = outer.children!.find((c) => c.control === 'group')!
    expect(inner.x.mode).toBe('left')
    expect(inner.y.mode).toBe('top')
  })

  it('ungroup promotes children with unrebased rects', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    store.ungroupSelected()

    const page = store.activePage
    expect(page.objects).toHaveLength(2)
    const [a, b] = page.objects
    expect(a!.name).toBe('labelA')
    expect(b!.name).toBe('labelB')
    expect(b!.x).toEqual({ mode: 'left', left: 120, width: 80 })
    expect(b!.y).toEqual({ mode: 'top', top: 40, height: 60 })
    // children are selected after ungrouping
    expect(store.selectionIds).toEqual([a!.id, b!.id])
  })

  it('refuses to group objects with different parents', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 10, h: 10 })
    const group = createGroup('group1', { x: 300, y: 300, w: 100, h: 100 }, [kid])
    store.book.pages[0]!.objects.push(group)
    store.setSelection(['a', kid.id]) // top-level + member of group1
    expect(store.groupEligible).toBe(false)
    store.groupSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(3)
  })

  it('reorder moves objects within their sibling array', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.reorderSelection('front')
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['b', 'a'])
    // forward from the last slot stays last
    store.reorderSelection('forward')
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['b', 'a'])
    store.reorderSelection('backward')
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['a', 'b'])
    store.reorderSelection('back')
    expect(store.book.pages[0]!.objects.map((o) => o.id)).toEqual(['a', 'b'])
  })

  it('applyRects converts page-absolute rects to parent-relative for group members', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 10, y: 10, w: 40, h: 20 })
    const kidId = kid.id
    const group = createGroup('group1', { x: 100, y: 100, w: 300, h: 200 }, [kid])
    store.book.pages[0]!.objects.push(group)
    const kidInBook = store.book.pages[0]!.objects[2]!.children![0]!
    expect(kidInBook.id).toBe(kidId)

    // child commit arrives in page coordinates (design canvas space)
    store.applyRects([{ id: kidId, rect: { x: 350, y: 120, w: 60, h: 30 } }])
    expect(kidInBook.x).toEqual({ mode: 'left', left: 0, width: 60 })
    expect(kidInBook.y).toEqual({ mode: 'top', top: 0, height: 30 })
    // single-member group hugs its member
    expect(store.book.pages[0]!.objects[2]!.x).toEqual({ mode: 'left', left: 350, width: 60 })
    expect(store.book.pages[0]!.objects[2]!.y).toEqual({ mode: 'top', top: 120, height: 30 })

    // top-level objects keep page coordinates
    store.applyRect('a', { x: 16, y: 16, w: 40, h: 40 })
    expect(store.book.pages[0]!.objects[0]!.x).toEqual({ mode: 'left', left: 16, width: 40 })
    expect(store.book.pages[0]!.objects[0]!.y).toEqual({ mode: 'top', top: 16, height: 40 })
  })

  it('member moves snap the group to the tight union of its members', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 40, h: 20 })
    const kid2 = createObject('label', 'kid2', { x: 200, y: 100, w: 50, h: 30 })
    const kidId = kid.id
    const kid2Id = kid2.id
    const group = createGroup('group1', { x: 100, y: 100, w: 300, h: 200 }, [kid, kid2])
    store.book.pages[0]!.objects.push(group)
    const g = store.book.pages[0]!.objects[2]!
    const kidInBook = g.children![0]!
    const kid2InBook = g.children![1]!

    // kid dragged right, past the manual (oversized) group rect — bounds snap
    // tight around both members
    store.applyRect(kidId, { x: 450, y: 120, w: 40, h: 20 })
    expect(g.x).toEqual({ mode: 'left', left: 300, width: 190 })
    expect(g.y).toEqual({ mode: 'top', top: 120, height: 110 })
    expect(kidInBook.x).toEqual({ mode: 'left', left: 150, width: 40 })
    expect(kidInBook.y).toEqual({ mode: 'top', top: 0, height: 20 })
    expect(kid2InBook.x).toEqual({ mode: 'left', left: 0, width: 50 })
    expect(kid2InBook.y).toEqual({ mode: 'top', top: 80, height: 30 })

    // kid2 dragged up-left: origin moves, siblings shift to stay put
    store.applyRect(kid2Id ?? kid2InBook.id, { x: 60, y: 80, w: 50, h: 30 })
    expect(g.x).toEqual({ mode: 'left', left: 60, width: 430 })
    expect(g.y).toEqual({ mode: 'top', top: 80, height: 60 })
    expect(kidInBook.x).toEqual({ mode: 'left', left: 390, width: 40 })
    expect(kidInBook.y).toEqual({ mode: 'top', top: 40, height: 20 })
    expect(kid2InBook.x).toEqual({ mode: 'left', left: 0, width: 50 })
    expect(kid2InBook.y).toEqual({ mode: 'top', top: 0, height: 30 })
  })

  it('deleting a member snaps the remaining bounds tight', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 40, h: 20 })
    const kid2 = createObject('label', 'kid2', { x: 200, y: 100, w: 50, h: 30 })
    const kidId = kid.id
    const group = createGroup('group1', { x: 100, y: 100, w: 300, h: 200 }, [kid, kid2])
    store.book.pages[0]!.objects.push(group)
    const g = store.book.pages[0]!.objects[2]!

    store.setSelection([kid.id])
    store.removeSelected()
    expect(g.children).toHaveLength(1)
    expect(g.x).toEqual({ mode: 'left', left: 300, width: 50 })
    expect(g.y).toEqual({ mode: 'top', top: 200, height: 30 })
  })

  it('nested groups expand their ancestors too', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const leaf = createObject('label', 'leaf', { x: 0, y: 0, w: 40, h: 20 })
    const leafId = leaf.id
    const inner = createGroup('inner', { x: 10, y: 10, w: 60, h: 40 }, [leaf])
    const innerId = inner.id
    const outer = createGroup('outer', { x: 200, y: 200, w: 300, h: 300 }, [inner])
    store.book.pages[0]!.objects.push(outer)
    const outerInBook = store.book.pages[0]!.objects[2]!
    const innerInBook = outerInBook.children![0]!
    const leafInBook = innerInBook.children![0]!
    expect(leafInBook.id).toBe(leafId)

    // move the leaf far right: inner hugs it, outer hugs inner
    // (leaf abs position = outer origin + inner rel + leaf rel)
    store.applyRect(leafId, { x: 580, y: 210, w: 40, h: 20 })
    expect(leafInBook.x).toEqual({ mode: 'left', left: 0, width: 40 })
    expect(leafInBook.y).toEqual({ mode: 'top', top: 0, height: 20 })
    expect(innerInBook.x).toEqual({ mode: 'left', left: 0, width: 40 })
    expect(innerInBook.y).toEqual({ mode: 'top', top: 0, height: 20 })
    expect(outerInBook.x).toEqual({ mode: 'left', left: 580, width: 40 })
    expect(outerInBook.y).toEqual({ mode: 'top', top: 210, height: 20 })
    void innerId
  })

  it('deletes the whole selection including group subtrees', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 10, h: 10 })
    const group = createGroup('group1', { x: 300, y: 300, w: 100, h: 100 }, [kid])
    store.book.pages[0]!.objects.push(group)

    store.setSelection([group.id])
    store.removeSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    expect(store.selectionIds).toEqual([])

    store.setSelection(['a', 'b'])
    store.removeSelected()
    expect(store.book.pages[0]!.objects).toHaveLength(0)
  })

  it('duplicatePage re-ids group children too', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    store.duplicatePage(0)
    expect(store.book.pages).toHaveLength(2)
    const copy = store.book.pages[1]!
    const origGroup = store.book.pages[0]!.objects[0]!
    const copyGroup = copy.objects[0]!
    expect(copyGroup.id).not.toBe(origGroup.id)
    expect(copyGroup.children![0]!.id).not.toBe(origGroup.children![0]!.id)
  })

  it('duplicateSelected deep-copies a group with its whole subtree re-ided and re-named', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 40, h: 20 })
    const kidId = kid.id
    const inner = createGroup('inner', { x: 10, y: 10, w: 60, h: 40 }, [kid])
    const innerId = inner.id
    const outer = createGroup('outer', { x: 200, y: 200, w: 300, h: 300 }, [inner])
    store.book.pages[0]!.objects.push(outer)
    const origIds = new Set(flattenObjects(store.book.pages[0]!.objects).map((o) => o.id))
    expect(origIds).toContain(kidId)

    store.setSelection([outer.id])
    store.duplicateSelected()

    const page = store.book.pages[0]!.objects
    // two labels + original group + its copy
    expect(page).toHaveLength(4)
    const dup = page[3]!
    expect(dup.control).toBe('group')
    expect(dup.name).toBe('group1')
    expect(dup).not.toBe(outer)
    expect(dup.id).not.toBe(outer.id)
    // nudged down-right so it visibly separates from the original
    expect(dup.x).toEqual({ mode: 'left', left: 224, width: 300 })
    expect(dup.y).toEqual({ mode: 'top', top: 224, height: 300 })
    const dupInner = dup.children![0]!
    expect(dupInner.name).toBe('group2')
    expect(dupInner.id).not.toBe(innerId)
    const dupKid = dupInner.children![0]!
    expect(dupKid.name).toBe('label1')
    expect(dupKid.id).not.toBe(kidId)
    // whole copied subtree has fresh ids
    const dupIds = flattenObjects([dup]).map((o) => o.id)
    expect(dupIds.filter((id) => origIds.has(id))).toEqual([])
    // duplicates are selected
    expect(store.selectionIds).toEqual([dup.id])
    // scripts copy over
    expect(dupKid.x).toEqual(kid.x)
    expect(dupKid.y).toEqual(kid.y)
  })

  it('duplicateSelected duplicates plain multi-selections next to their originals', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.duplicateSelected()

    const page = store.book.pages[0]!.objects
    expect(page.map((o) => o.name)).toEqual(['labelA', 'label1', 'labelB', 'label2'])
    // duplicates are offset down-right, members relative to group untouched
    expect(page[1]!.x).toEqual({ mode: 'left', left: 24, width: 100 })
    expect(page[1]!.y).toEqual({ mode: 'top', top: 24, height: 50 })
    expect(page[3]!.x).toEqual({ mode: 'left', left: 144, width: 80 })
    expect(page[3]!.y).toEqual({ mode: 'top', top: 64, height: 60 })
    expect(store.selectionIds).toEqual([page[1]!.id, page[3]!.id])
  })

  it('duplicateSelected skips members whose group is already selected', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const group = store.book.pages[0]!.objects[0]!
    // select the whole group AND one member (shift-click scenario)
    store.setSelection([group.id, group.children![0]!.id])
    store.duplicateSelected()
    // only one new top-level object: the member copy rides inside the group copy
    expect(store.book.pages[0]!.objects).toHaveLength(2)
    expect(store.selectionIds).toHaveLength(1)
  })

  it('duplicateSelected is repeatable: each press duplicates the current selection', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.duplicateSelected()
    store.duplicateSelected()
    expect(store.book.pages[0]!.objects.map((o) => o.name)).toEqual([
      'labelA', 'label1', 'label2', 'labelB',
    ])
  })
})

describe('book store — copy / cut / paste', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('copySelected deep-copies the selection into the clipboard and is mutation-safe', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    expect(store.canPaste).toBe(false)
    expect(store.copySelected()).toBe(2)
    expect(store.canPaste).toBe(true)
    expect(store.clipboard).toHaveLength(2)
    // the clipboard is a plain mirror — mutating the source leaves it alone
    store.book.pages[0]!.objects[0]!.name = 'changed'
    expect(store.clipboard![0]!.name).toBe('labelA')
    // copy alone is not undoable
    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
  })

  it('cutSelected removes the selection in one undoable step and leaves the clipboard', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    expect(store.cutSelected()).toBe(2)
    expect(store.book.pages[0]!.objects).toHaveLength(0)
    expect(store.selectionIds).toEqual([])
    expect(store.clipboard).toHaveLength(2)
    store.undo()
    expect(store.book.pages[0]!.objects.map((o) => o.name)).toEqual(['labelA', 'labelB'])
  })

  it('pasteClipboard re-ids, re-names, offsets down-right, selects, and is undoable', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.copySelected()
    expect(store.pasteClipboard()).toBe(2)
    const page = store.book.pages[0]!.objects
    expect(page).toHaveLength(4)
    const [p1, p2] = [page[2]!, page[3]!]
    expect(p1.name).toBe('label1')
    expect(p2.name).toBe('label2')
    expect(p1.id).not.toBe('a')
    expect(p2.id).not.toBe('b')
    expect(store.selectionIds.map((id) => page.find((o) => o.id === id))).toHaveLength(2)
    // nudged +24 down-right of the copied positions
    expect(p1.x).toEqual({ mode: 'left', left: 24, width: 100 })
    expect(p1.y).toEqual({ mode: 'top', top: 24, height: 50 })
    expect(p2.x).toEqual({ mode: 'left', left: 144, width: 80 })
    expect(p2.y).toEqual({ mode: 'top', top: 64, height: 60 })
    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(2)
  })

  it('paste without a clipboard is a no-op', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    expect(store.canPaste).toBe(false)
    expect(store.pasteClipboard()).toBe(0)
    expect(store.book.pages[0]!.objects).toHaveLength(2)
  })

  it('copy skips members whose group is already selected', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const group = store.book.pages[0]!.objects[0]!
    store.setSelection([group.id, group.children![0]!.id])
    expect(store.copySelected()).toBe(1)
    expect(store.clipboard).toHaveLength(1)
    expect(store.clipboard![0]!.control).toBe('group')
    expect(store.clipboard![0]!.children).toHaveLength(2)
  })

  it('cutting a group removes the whole subtree; undo restores it', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const group = store.book.pages[0]!.objects[0]!
    store.setSelection([group.id])
    expect(store.cutSelected()).toBe(1)
    expect(store.book.pages[0]!.objects).toHaveLength(0)
    store.undo()
    expect(store.book.pages[0]!.objects[0]!.children).toHaveLength(2)
  })

  it('paste lands inside a group when the selection shares a group parent', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const group = store.book.pages[0]!.objects[0]!
    // copied from the group's own members (rebased rects preserved)
    store.setSelection(group.children!.map((c) => c.id))
    store.copySelected()
    expect(store.pasteClipboard()).toBe(2)
    expect(group.children).toHaveLength(4)
    expect(group.children![2]!.x).toEqual({ mode: 'left', left: 24, width: 100 })
    expect(group.children![2]!.y).toEqual({ mode: 'top', top: 24, height: 50 })
    expect(group.children![3]!.x).toEqual({ mode: 'left', left: 144, width: 80 })
    expect(group.children![3]!.y).toEqual({ mode: 'top', top: 64, height: 60 })
  })

  it('paste without a shared group parent lands at the top level', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.copySelected()
    store.setSelection(['b'])
    expect(store.pasteClipboard()).toBe(1)
    expect(store.book.pages[0]!.objects).toHaveLength(3)
    // pasted copies go to the end (top of z-order)
    expect(store.book.pages[0]!.objects[2]!.name).toBe('label1')
  })

  it('repeat paste cascades 24px each time from the copied positions', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.copySelected()
    store.pasteClipboard()
    store.pasteClipboard()
    const page = store.book.pages[0]!.objects
    expect(page.map((o) => o.name)).toEqual(['labelA', 'labelB', 'label1', 'label2'])
    expect(page[2]!.x).toEqual({ mode: 'left', left: 24, width: 100 })
    expect(page[2]!.y).toEqual({ mode: 'top', top: 24, height: 50 })
    expect(page[3]!.x).toEqual({ mode: 'left', left: 48, width: 100 })
    expect(page[3]!.y).toEqual({ mode: 'top', top: 48, height: 50 })
  })

  it('cut then paste inserts a separate copy; a single undo reverts the paste', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    store.cutSelected()
    store.pasteClipboard()
    const page = store.book.pages[0]!.objects
    expect(page.map((o) => o.name)).toEqual(['labelB', 'label1'])
    store.undo()
    expect(store.book.pages[0]!.objects).toHaveLength(1)
  })
})

describe('book store — backgrounds', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('addBackground creates, selects it for editing and is undoable', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    expect(store.book.backgrounds).toHaveLength(1)
    store.addBackground()
    expect(store.book.backgrounds).toHaveLength(2)
    expect(store.editing).toEqual({ kind: 'background', id: store.book.backgrounds[1]!.id })
    expect(store.selectionIds).toEqual([])
    store.undo()
    expect(store.book.backgrounds).toHaveLength(1)
    expect(store.editing).toEqual({ kind: 'page' })
  })

  it('addObject in a background view lands in background.objects; page adds avoid bg names', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    // page already owns labelA / labelB
    store.addBackground()
    store.addObject('button', { x: 0, y: 0, w: 100, h: 40 })
    const bg = store.book.backgrounds[1]!
    expect(bg.objects).toHaveLength(1)
    expect(bg.objects[0]!.name).toBe('button1')

    // page-level adds avoid names owned by the page's background too
    const bg1 = store.book.backgrounds[0]!
    bg1.objects.push(createObject('button', 'button1', { x: 0, y: 0, w: 90, h: 30 }))
    store.editPage(0)
    store.addObject('button', { x: 0, y: 0, w: 100, h: 40 })
    const names = store.activePage.objects.map((o) => o.name)
    expect(names).not.toContain('button1')
    expect(names).toContain('button2')
  })

  it('addObject places the drop rect as fixed left/top distances', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 390, height: 844 })
    store.addObject('button', { x: 100, y: 100, w: 120, h: 40 })
    const obj = store.activePage.objects.at(-1)!
    expect(obj.x).toEqual({ mode: 'left', left: 100, width: 120 })
    expect(obj.y).toEqual({ mode: 'top', top: 100, height: 40 })
  })

  it('fillObjectToPage pins both margins to the page edges', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.fillObjectToPage(id, 8)
    const obj = store.book.pages[0]!.objects[0]!
    expect(obj.x).toEqual({ mode: 'both', left: 8, right: 8 })
    expect(obj.y).toEqual({ mode: 'both', top: 8, bottom: 8 })
  })

  it('removeBackground refuses while pages reference it; deletePages removes both', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addBackground()
    const bgId = store.book.backgrounds[1]!.id
    store.movePageToBackground(0, bgId)
    // referenced → plain remove is a no-op
    store.removeBackground(bgId)
    expect(store.book.backgrounds).toHaveLength(2)
    store.removeBackground(bgId, true)
    expect(store.book.backgrounds).toHaveLength(1)
    // the deleted background's pages go with it, but a book always keeps at
    // least one page — parked on the surviving background
    expect(store.book.pages).toHaveLength(1)
    expect(store.book.pages[0]!.backgroundId).toBe(store.book.backgrounds[0]!.id)
  })

  it('setPageSize fixes a page; activeCanvasSize uses the fixed size', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 1024, height: 700 })
    // fluid by default: fills the measured viewport
    expect(store.activePage.size).toBeUndefined()
    expect(store.activeCanvasSize).toEqual({ width: 1024, height: 700 })
    store.setPageSize(0, { width: 320, height: 240 })
    expect(store.activePage.size).toEqual({ width: 320, height: 240 })
    expect(store.activeCanvasSize).toEqual({ width: 320, height: 240 })
    store.setPageSize(0, null)
    expect(store.activePage.size).toBeUndefined()
    expect(store.activeCanvasSize).toEqual({ width: 1024, height: 700 })
  })

  it('a fluid page grows to fit content placed low down', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 800, height: 600 })
    expect(store.activeCanvasSize).toEqual({ width: 800, height: 600 })
    store.addObject('card', { x: 0, y: 1000, w: 100, h: 50 })
    expect(store.activeCanvasSize).toEqual({ width: 800, height: 1050 })
  })

  it('undo covers a page-size change', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setPageSize(0, { width: 320, height: 240 })
    expect(store.activePage.size).toEqual({ width: 320, height: 240 })
    store.undo()
    expect(store.activePage.size).toBeUndefined()
  })

  it('undo restores the editing target along with the book', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addBackground() // history: editing was {kind:'page'} at record time
    const bgId = store.book.backgrounds[1]!.id
    store.editPage(0) // no history — editing switches are free
    store.editBackground(bgId)
    store.undo() // restores the pre-add book AND the page editing target
    expect(store.book.backgrounds).toHaveLength(1)
    expect(store.editing).toEqual({ kind: 'page' })
    // the stale background id no longer resolves — editBackground no-ops
    store.editBackground(bgId)
    expect(store.editing).toEqual({ kind: 'page' })
  })

  it('movePageToBackground re-homes a page', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addBackground()
    const bgId = store.book.backgrounds[1]!.id
    store.editPage(0)
    store.movePageToBackground(0, bgId)
    expect(store.activePage.backgroundId).toBe(bgId)
    // undo restores the original background
    store.undo()
    expect(store.activePage.backgroundId).toBe(store.book.backgrounds[0]!.id)
  })

  it('duplicateBackground deep-copies objects with fresh ids and edits the copy', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const bg1 = store.book.backgrounds[0]!
    bg1.objects.push(createObject('button', 'navBtn', { x: 0, y: 0, w: 100, h: 40 }))
    store.duplicateBackground(bg1.id)
    expect(store.book.backgrounds).toHaveLength(2)
    const copy = store.book.backgrounds[1]!
    expect(copy.objects).toHaveLength(1)
    expect(copy.objects[0]!.id).not.toBe(bg1.objects[0]!.id)
    expect(copy.name).toBe('Background 2')
    expect(store.editing).toEqual({ kind: 'background', id: copy.id })
  })

  it('addPage joins the background being edited', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addBackground()
    store.addPage()
    expect(store.activePage.backgroundId).toBe(store.book.backgrounds[1]!.id)
  })

  it('reorderPage repositions pages and follows the edited page', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addPage() // Page 2 (bg1)
    store.addPage() // Page 3 (bg1)
    store.editPage(2) // editing Page 3
    store.reorderPage(2, 0)
    expect(store.book.pages.map((p) => p.name)).toEqual(['Page 3', 'P', 'Page 2'])
    // the edited page followed its content
    expect(store.activePage.name).toBe('Page 3')
    expect(store.currentPageIndex).toBe(0)
    store.undo()
    expect(store.book.pages.map((p) => p.name)).toEqual(['P', 'Page 2', 'Page 3'])
    expect(store.activePage.name).toBe('Page 3')
  })

  it('reorderPage re-homes a page across backgrounds in one step', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.addBackground()
    store.addPage() // Page 2 on bg1
    const bg2 = store.book.backgrounds[1]!.id
    // move page 0 (P) after page 1, onto bg2
    store.reorderPage(0, 2, bg2)
    expect(store.book.pages.map((p) => p.name)).toEqual(['Page 2', 'P'])
    expect(store.book.pages[1]!.backgroundId).toBe(bg2)
    expect(store.activePage.name).toBe('P')
    store.undo()
    expect(store.book.pages.map((p) => p.name)).toEqual(['P', 'Page 2'])
    expect(store.book.pages[0]!.backgroundId).toBe(store.book.backgrounds[0]!.id)
  })
})

describe('book store — save / rename / delete (IndexedDB)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('save writes a named snapshot, refreshes recents and stamps savedAt', async () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.renameBook('Hello')
    await new Promise((r) => setTimeout(r, 0))
    expect(store.recents).toHaveLength(1)
    expect(store.recents[0]!.title).toBe('Hello')

    const before = store.savedAt
    await store.save()
    expect(store.savedAt).toBeGreaterThan(0)
    expect(store.recents[0]!.title).toBe('Hello')
    // autosave slot is refreshed by save too
    expect(store.autosaveAt).not.toBeNull()
    expect(store.savedAt).not.toBeNull()
    expect(before).toBeNull()
  })

  it('renameBook keeps the export filename in step (dashes kept, fallback untitled)', async () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.renameBook('Hello-Toolbook-Andy')
    await new Promise((r) => setTimeout(r, 0))
    expect(store.book.title).toBe('Hello-Toolbook-Andy')
    const { bookFileName } = await import('../files')
    expect(bookFileName(store.book)).toBe('Hello-Toolbook-Andy.toolbook.json')
    store.newBook()
    expect(store.book.title).toBe('Untitled')
    expect(bookFileName(store.book)).toBe('Untitled.toolbook.json')
  })

  it('deleteRecent removes the snapshot and the recents entry', async () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    await store.save()
    // second project
    store.newBook()
    store.renameBook('Other')
    await new Promise((r) => setTimeout(r, 0))
    await store.save()
    expect(store.recents).toHaveLength(2)

    await store.deleteRecent(store.recents[1]!.id)
    expect(store.recents).toHaveLength(1)
    expect(store.recents[0]!.title).toBe('Other')
  })

  it('renameRecent renames a stored project without opening it', async () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // 'T'
    await store.save()
    store.newBook()
    store.renameBook('Other')
    await new Promise((r) => setTimeout(r, 0))
    await store.save()
    const stored = store.recents.find((r) => r.title === 'T')!
    await store.renameRecent(stored.id, 'Renamed')
    expect(store.recents.find((r) => r.id === stored.id)!.title).toBe('Renamed')
    // the open book is untouched
    expect(store.book.title).toBe('Other')
  })

  it('renameRecent on the open book renames it live and updates the entry', async () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    await store.save()
    await store.renameRecent(store.book.id, 'Live rename')
    expect(store.book.title).toBe('Live rename')
    expect(store.recents[0]!.title).toBe('Live rename')
  })
})
describe('book store — responsive edges', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setObjectEdge derives the distances from the current rendered rect', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // page box 1280x800
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectEdge(id, 'x', 'right')
    const o = store.book.pages[0]!.objects[0]!
    expect(o.x).toEqual({ mode: 'right', right: 1180, width: 100 })
    // stays put at the moment of switching
    expect(store.effectiveRectOf(id)!.x).toBe(0)
  })

  it('setObjectEdge replaces only the changed axis', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectEdge(id, 'x', 'right')
    store.setObjectEdge(id, 'y', 'bottom')
    const o = store.book.pages[0]!.objects[0]!
    expect(o.x.mode).toBe('right')
    expect(o.y.mode).toBe('bottom')
  })

  it('choosing centre centres the object, follows-both pins both margins', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectEdge(id, 'x', 'center')
    expect(store.effectiveRectOf(id)!.x).toBe((1280 - 100) / 2)
    store.setObjectEdge(id, 'x', 'both')
    const o = store.book.pages[0]!.objects[0]!
    expect(o.x).toEqual({ mode: 'both', left: (1280 - 100) / 2, right: (1280 - 100) / 2 })
  })

  it('undo reverts an edge change', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectEdge(id, 'x', 'right')
    store.undo()
    expect(store.book.pages[0]!.objects[0]!.x).toEqual({ mode: 'left', left: 0, width: 100 })
  })
})

describe('book store — outer margin', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setObjectMargin stores the far-side margins and offsets a far-edge control', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 0, width: 100 }
    o.y = { mode: 'bottom', bottom: 0, height: 50 }
    store.setObjectMargin(o.id, { right: 10, bottom: 24 })
    expect(o.margin).toEqual({ right: 10, bottom: 24 })
    // 1280 - 100 - 10 = 1170; 800 - 50 - 24 = 726
    expect(store.effectiveRectOf(o.id)).toMatchObject({ x: 1170, y: 726 })
  })

  it('a bottom margin grows the page past a near-edge control', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectMargin(id, { bottom: 900 })
    // object top 0 + height 50 + margin 900, past the 800 viewport
    expect(store.activeCanvasSize.height).toBe(950)
  })

  it('a zero side is dropped and an all-zero margin is removed', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectMargin(id, { right: 5 })
    expect(store.book.pages[0]!.objects[0]!.margin).toEqual({ right: 5 })
    store.setObjectMargin(id, { right: 0 })
    expect(store.book.pages[0]!.objects[0]!.margin).toBeUndefined()
  })

  it('fill clears the margin on the axes it sets', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectMargin(id, { right: 10, bottom: 24 })
    store.fillObjectToPage(id, 8)
    const o = store.book.pages[0]!.objects[0]!
    expect(o.margin).toBeUndefined()
    expect(o.x).toEqual({ mode: 'both', left: 8, right: 8 })
  })

  it('dragging a margined object keeps the margin without double-counting', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 0, width: 100 }
    o.y = { mode: 'bottom', bottom: 0, height: 50 }
    o.margin = { right: 10, bottom: 24 }
    // rendered border box at 1170,726; drag it -40,-10
    store.applyRects([{ id: o.id, rect: { x: 1130, y: 716, w: 100, h: 50 } }])
    // 1280 - 1230 - 10 = 40; 800 - 766 - 24 = 10
    expect(o.x).toEqual({ mode: 'right', right: 40, width: 100 })
    expect(o.y).toEqual({ mode: 'bottom', bottom: 10, height: 50 })
    expect(o.margin).toEqual({ right: 10, bottom: 24 })
  })

  it('setObjectMarginEnabled toggles the margin without touching its values', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 0, width: 100 }
    o.y = { mode: 'bottom', bottom: 0, height: 50 }
    store.setObjectMargin(o.id, { right: 10, bottom: 24 })
    expect(store.effectiveRectOf(o.id)).toMatchObject({ x: 1170, y: 726 })
    store.setObjectMarginEnabled(o.id, false)
    expect(o.marginEnabled).toBe(false)
    expect(o.margin).toEqual({ right: 10, bottom: 24 })
    expect(store.effectiveRectOf(o.id)).toMatchObject({ x: 1180, y: 750 })
    store.setObjectMarginEnabled(o.id, true)
    expect(o.marginEnabled).toBeUndefined()
    expect(store.effectiveRectOf(o.id)).toMatchObject({ x: 1170, y: 726 })
  })

  it('a geometry write while the margin is off does not double-count', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 0, width: 100 }
    o.y = { mode: 'bottom', bottom: 0, height: 50 }
    o.margin = { right: 10, bottom: 24 }
    o.marginEnabled = false
    // the rendered box is now at 1180,750; a drag to 1140,730 must not subtract
    // the switched-off margin
    store.applyRects([{ id: o.id, rect: { x: 1140, y: 730, w: 100, h: 50 } }])
    expect(o.x).toEqual({ mode: 'right', right: 40, width: 100 })
    expect(o.y).toEqual({ mode: 'bottom', bottom: 20, height: 50 })
  })

  it('margin enable/disable is undoable and keeps the values', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectMargin(id, { right: 5 })
    store.setObjectMarginEnabled(id, false)
    expect(store.book.pages[0]!.objects[0]!.marginEnabled).toBe(false)
    store.undo()
    expect(store.book.pages[0]!.objects[0]!.marginEnabled).toBeUndefined()
    expect(store.book.pages[0]!.objects[0]!.margin).toEqual({ right: 5 })
  })
})

describe('book store — edge writes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('dragging a right-following object changes its right distance', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 180, width: 100 }
    store.applyRects([{ id: o.id, rect: { x: 900, y: 24, w: 100, h: 48 } }])
    expect(o.x).toEqual({ mode: 'right', right: 280, width: 100 })
  })

  it('a left/top object takes the dragged position directly', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    store.applyRects([{ id: o.id, rect: { x: 5, y: 7, w: 100, h: 48 } }])
    expect(o.x).toEqual({ mode: 'left', left: 5, width: 100 })
    expect(o.y).toEqual({ mode: 'top', top: 7, height: 48 })
  })

  it('a follows-both object re-derives both margins from the resize', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'both', left: 0, right: 0 }
    store.applyRects([{ id: o.id, rect: { x: 10, y: 0, w: 300, h: 40 } }])
    expect(o.x).toEqual({ mode: 'both', left: 10, right: 1280 - 310 })
  })

  it('a centred object stays centred horizontally; the free axis commits', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'center', width: 100 }
    o.y = { mode: 'top', top: 24, height: 48 }
    store.applyRects([{ id: o.id, rect: { x: 260, y: 160, w: 100, h: 48 } }])
    expect(store.effectiveRectOf(o.id)!.x).toBe((1280 - 100) / 2)
    expect(o.y).toEqual({ mode: 'top', top: 160, height: 48 })
  })

  it('a resized group re-hugs its members (tight bounds, no scaling)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const member = page.objects[0]!
    const group = createGroup('g1', { x: 600, y: 0, w: 200, h: 100 }, [member])
    group.x = { mode: 'right', right: 480, width: 200 }
    page.objects = [group]
    store.applyRects([{ id: group.id, rect: { x: 500, y: 0, w: 200, h: 100 } }])
    const g = store.activePage.objects[0]!
    // the box snaps to the member's tight bounds (100×50), staying right-anchored
    expect(g.x).toEqual({ mode: 'right', right: 680, width: 100 })
    expect(g.y).toEqual({ mode: 'top', top: 0, height: 50 })
    // the member keeps its own edge + size (not scaled)
    const child = g.children![0]!
    expect(child.x).toEqual({ mode: 'left', left: 0, width: 100 })
    expect(child.y).toEqual({ mode: 'top', top: 0, height: 50 })
  })

  it('a group whose members hug far/centre edges re-hugs to their union after resize', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    // far/centre members: neither is left-anchored, so the box must shrink to them
    const right = createObject('button', 'rightBtn', { x: 0, y: 92, w: 176, h: 48 })
    right.x = { mode: 'right', right: 0, width: 176 }
    const centred = createObject('button', 'centreBtn', { x: 0, y: 0, w: 112, h: 48 })
    centred.x = { mode: 'center', width: 112 }
    const group = createGroup('g1', { x: 207, y: 180, w: 377, h: 140 }, [right, centred])
    page.objects = [group]
    // a resize gesture commits the (over-wide) group box; the store re-hugs it
    store.applyRects([{ id: group.id, rect: { x: 207, y: 180, w: 377, h: 140 } }])
    const g = store.activePage.objects[0]!
    // iterates to the tight union: the flush-right button spans the box (176)
    expect(g.x).toMatchObject({ mode: 'left', left: 408, width: 176 })
    expect(g.y).toMatchObject({ mode: 'top', top: 180, height: 140 })
    expect(g.children![0]!.x).toEqual({ mode: 'right', right: 0, width: 176 })
    expect(g.children![1]!.x).toEqual({ mode: 'center', width: 112 })
  })

  it('a handle resize scales group members (sizes and edge distances)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const a = createObject('button', 'a', { x: 0, y: 0, w: 100, h: 50 })
    const b = createObject('button', 'b', { x: 120, y: 40, w: 80, h: 60 })
    const group = createGroup('g1', { x: 0, y: 0, w: 200, h: 100 }, [a, b])
    page.objects = [group]
    store.applyRects([{ id: group.id, rect: { x: 0, y: 0, w: 400, h: 200 } }], { dir: 'se' })
    const g = store.activePage.objects[0]!
    const [ka, kb] = g.children!
    expect(ka!.x).toEqual({ mode: 'left', left: 0, width: 200 })
    expect(ka!.y).toEqual({ mode: 'top', top: 0, height: 100 })
    expect(kb!.x).toEqual({ mode: 'left', left: 240, width: 160 })
    expect(kb!.y).toEqual({ mode: 'top', top: 80, height: 120 })
    // the box is the scaled union
    expect(g.x).toMatchObject({ mode: 'left', left: 0, width: 400 })
    expect(g.y).toMatchObject({ mode: 'top', top: 0, height: 200 })
  })

  it('a handle resize scales and re-centres a centred member', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const left = createObject('button', 'left', { x: 0, y: 0, w: 100, h: 50 })
    const centre = createObject('button', 'centre', { x: 20, y: 0, w: 60, h: 50 })
    centre.x = { mode: 'center', width: 60 }
    const group = createGroup('g1', { x: 0, y: 0, w: 100, h: 50 }, [left, centre])
    page.objects = [group]
    store.applyRects([{ id: group.id, rect: { x: 0, y: 0, w: 200, h: 100 } }], { dir: 'se' })
    const g = store.activePage.objects[0]!
    const kid = g.children!.find((c) => c.name === 'centre')!
    expect(kid.x).toEqual({ mode: 'center', width: 120 })
    // centred in the 200-wide box: (200 − 120) / 2
    expect(store.effectiveRectOf(kid.id)!.x).toBe(40)
  })

  it('a handle resize scales nested groups recursively', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const leaf = createObject('button', 'leaf', { x: 0, y: 0, w: 100, h: 50 })
    const inner = createGroup('inner', { x: 0, y: 0, w: 200, h: 100 }, [leaf])
    const outer = createGroup('outer', { x: 0, y: 0, w: 200, h: 100 }, [inner])
    page.objects = [outer]
    store.applyRects([{ id: outer.id, rect: { x: 0, y: 0, w: 400, h: 200 } }], { dir: 'se' })
    const g = store.activePage.objects[0]!
    const nested = g.children![0]!
    expect(nested.x).toMatchObject({ mode: 'left', left: 0, width: 400 })
    expect(nested.children![0]!.x).toMatchObject({ mode: 'left', left: 0, width: 200 })
  })

  it('a resized stretch (both) group becomes a fixed near-edge box', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 1280, height: 800 })
    const page = store.book.pages[0]!
    const kid = createObject('button', 'kid', { x: 0, y: 0, w: 200, h: 100 })
    const group = createGroup('g1', { x: 0, y: 0, w: 200, h: 100 }, [kid])
    group.x = { mode: 'both', left: 0, right: 1080 }
    group.y = { mode: 'both', top: 0, bottom: 700 }
    page.objects = [group]
    store.applyRects([{ id: group.id, rect: { x: 0, y: 0, w: 400, h: 200 } }], { dir: 'se' })
    const g = store.activePage.objects[0]!
    expect(g.x).toMatchObject({ mode: 'left', left: 0, width: 400 })
    expect(g.y).toMatchObject({ mode: 'top', top: 0, height: 200 })
    expect(g.children![0]!.x).toMatchObject({ mode: 'left', left: 0, width: 400 })
    expect(g.children![0]!.y).toMatchObject({ mode: 'top', top: 0, height: 200 })
  })

  it('a panel width write scales group members around the top-left', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const a = createObject('button', 'a', { x: 0, y: 0, w: 100, h: 50 })
    const b = createObject('button', 'b', { x: 120, y: 40, w: 80, h: 60 })
    const group = createGroup('g1', { x: 0, y: 0, w: 200, h: 100 }, [a, b])
    page.objects = [group]
    store.setGeometry(group.id, { w: 400 })
    const g = store.activePage.objects[0]!
    const [ka, kb] = g.children!
    expect(ka!.x).toEqual({ mode: 'left', left: 0, width: 200 })
    expect(kb!.x).toEqual({ mode: 'left', left: 240, width: 160 })
    // height unchanged on a width-only write
    expect(ka!.y).toEqual({ mode: 'top', top: 0, height: 50 })
  })

  it('changing the viewport re-resolves members without scaling them', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const a = createObject('button', 'a', { x: 0, y: 0, w: 100, h: 50 })
    a.x = { mode: 'right', right: 20, width: 100 }
    const group = createGroup('g1', { x: 0, y: 0, w: 100, h: 50 }, [a])
    group.x = { mode: 'both', left: 0, right: 1180 }
    page.objects = [group]
    const before = JSON.stringify(store.activePage.objects[0])
    store.setViewport({ width: 500, height: 600 })
    expect(JSON.stringify(store.activePage.objects[0])).toBe(before)
  })

  it('a page box change re-hugs a stretch group without moving it', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 800, height: 600 })
    const page = store.book.pages[0]!
    const kid = createObject('button', 'kid', { x: 0, y: 0, w: 100, h: 50 })
    const group = createGroup('g1', { x: 100, y: 100, w: 100, h: 50 }, [kid])
    // both margins make the box hug at the 800-wide page
    group.x = { mode: 'both', left: 100, right: 600 }
    const sibling = createObject('label', 'sib', { x: 0, y: 0, w: 100, h: 50 })
    page.objects = [group, sibling]
    // move the sibling past the fold: it grows the page to 1000 wide. Before
    // the fix the both-group stretched to 300 wide and only a group move
    // re-hugged it; now the sync that follows the sibling move re-hugs it.
    store.applyRects([{ id: sibling.id, rect: { x: 900, y: 0, w: 100, h: 50 } }])
    const g = store.activePage.objects[0]!
    expect(g.x.mode).toBe('both')
    expect(g.x).toEqual({ mode: 'both', left: 100, right: 800 })
    expect(store.effectiveRectOf(g.id)!.w).toBe(100)
    expect(store.effectiveRectOf(g.children![0]!.id)!.w).toBe(100)
  })

  it('a member can carry its own edges, relative to the group box', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const member = createObject('button', 'ok', { x: 10, y: 10, w: 80, h: 40 })
    const group = createGroup('g1', { x: 600, y: 100, w: 200, h: 100 }, [member])
    page.objects = [group]
    const kid = store.activePage.objects[0]!.children![0]!
    store.setObjectEdge(kid.id, 'x', 'right')
    // the member now follows the group's right edge, and the group re-hugs to
    // its tight bounds (the member keeps its on-screen position)
    expect(kid.x).toEqual({ mode: 'right', right: 0, width: 80 })
    const g = store.activePage.objects[0]!
    expect(g.x).toMatchObject({ mode: 'left', left: 610, width: 80 })
    expect(g.y).toMatchObject({ mode: 'top', top: 110, height: 40 })
  })

  it('ungrouping a centred group places members at their rendered spots', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 800, height: 600 })
    const page = store.book.pages[0]!
    const ok = createObject('button', 'ok', { x: 0, y: 0, w: 100, h: 40 })
    const cancel = createObject('button', 'cancel', { x: 120, y: 0, w: 100, h: 40 })
    const group = createGroup('g1', { x: 300, y: 200, w: 220, h: 40 }, [ok, cancel])
    page.objects = [group]
    store.setObjectEdge(group.id, 'x', 'center')
    const rendered = store.effectiveRectOf(group.id)!
    store.applySelection([group.id])
    store.ungroupSelected()
    const [a, b] = page.objects
    // the authored group x was 300; centred it renders at (800−220)/2 = 290
    expect(rendered.x).toBe(290)
    expect(store.effectiveRectOf(a!.id)!.x).toBe(rendered.x + 0)
    expect(store.effectiveRectOf(b!.id)!.x).toBe(rendered.x + 120)
  })

  it('setGeometry on a right-following object edits its right distance', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'right', right: 180, width: 100 }
    store.setGeometry(o.id, { x: 500 })
    expect(store.effectiveRectOf(o.id)!.x).toBe(500)
    expect(o.x).toEqual({ mode: 'right', right: 680, width: 100 })
  })

  it('setGeometry on a centred x switches it to a fixed left edge', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'center', width: 100 }
    store.setGeometry(o.id, { x: 200 })
    expect(o.x).toEqual({ mode: 'left', left: 200, width: 100 })
  })

  it('a size write on a centred axis keeps the centring and re-centres', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const o = store.book.pages[0]!.objects[0]!
    o.x = { mode: 'center', width: 100 }
    store.setGeometry(o.id, { w: 200 })
    expect(o.x).toEqual({ mode: 'center', width: 200 })
    expect(store.effectiveRectOf(o.id)!.x).toBe((1280 - 200) / 2)
  })

  it('several objects in one commit each keep their own edges', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const [glued, free] = store.book.pages[0]!.objects
    glued!.x = { mode: 'right', right: 180, width: 100 }
    store.applyRects([
      { id: glued!.id, rect: { x: 900, y: 10, w: 100, h: 48 } },
      { id: free!.id, rect: { x: 50, y: 50, w: 100, h: 48 } },
    ])
    expect(glued!.x).toEqual({ mode: 'right', right: 280, width: 100 })
    expect(free!.x).toEqual({ mode: 'left', left: 50, width: 100 })
  })

  it('a member drag moves the member and re-tightens the group box', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const member = page.objects[0]!
    const group = createGroup('g1', { x: 0, y: 0, w: 200, h: 100 }, [member])
    page.objects = [group]
    store.applyRects([{ id: member.id, rect: { x: 40, y: 40, w: 100, h: 48 } }])
    // member rel x = 0 after the group origin snaps to it
    expect(group.x).toMatchObject({ left: 40 })
    expect(member.x).toMatchObject({ left: 0 })
  })
})

describe('book store — glue-spring hints', () => {
  it('persists the selected mode and updates the ref', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    setActivePinia(createPinia())
    const store = useBookStore()
    expect(store.fitHintMode).toBe('all')
    store.setFitHintMode('selected')
    expect(store.fitHintMode).toBe('selected')
    expect(setItem).toHaveBeenCalledWith(
      'toolback.fitHints',
      JSON.stringify({ ...DEFAULT_FIT_HINTS, mode: 'selected' }),
    )
  })

  it('merges a partial options patch and persists the whole object', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    setActivePinia(createPinia())
    const store = useBookStore()
    store.setFitHints({ labels: false, skipZeroLabels: false })
    expect(store.fitHints).toMatchObject({
      mode: 'all',
      labels: false,
      lengths: true,
      skipZeroLabels: false,
    })
    expect(setItem).toHaveBeenCalledWith('toolback.fitHints', JSON.stringify(store.fitHints))
  })

  it.each([
    [null, 'all'],
    ['all', 'all'],
    ['selected', 'selected'],
    ['off', 'off'],
    ['1', 'all'],
    ['0', 'off'],
    ['bogus', 'all'],
    [JSON.stringify({ mode: 'selected', labels: false }), 'selected'],
  ] as const)('reads stored %s as mode %s', (raw, expected) => {
    vi.stubGlobal('localStorage', { getItem: () => raw, setItem: () => {} })
    setActivePinia(createPinia())
    expect(useBookStore().fitHintMode).toBe(expected)
  })
})

describe('book store — align / distribute / match / fill helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('alignSelection left aligns top-level objects and keeps their edges', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    page.objects[1]!.x = { mode: 'right', right: 1080, width: 80 }
    store.setSelection(['a', 'b'])
    store.alignSelection('left')
    expect(store.effectiveRectOf(page.objects[0]!.id)!.x).toBe(0)
    expect(store.effectiveRectOf(page.objects[1]!.id)!.x).toBe(0)
    // b keeps following the right edge
    expect(page.objects[1]!.x.mode).toBe('right')
  })

  it('centerSelectionOnPage centers the block, not each object independently', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setViewport({ width: 800, height: 600 })
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.centerSelectionOnPage()
    // union was (0..200, 0..100) on an 800x600 page → shift +300,+250
    expect(page.objects[0]!.x).toEqual({ mode: 'left', left: 300, width: 100 })
    expect(page.objects[0]!.y).toEqual({ mode: 'top', top: 250, height: 50 })
    expect(page.objects[1]!.x).toEqual({ mode: 'left', left: 420, width: 80 })
    expect(page.objects[1]!.y).toEqual({ mode: 'top', top: 290, height: 60 })
    // the two are still side by side (not stacked)
    expect(store.effectiveRectOf(page.objects[0]!.id)!.x).not.toBe(
      store.effectiveRectOf(page.objects[1]!.id)!.x,
    )
  })

  it('distributeSelection spaces top-level objects evenly', () => {
    const store = useBookStore()
    const book = twoObjectBook()
    book.pages[0]!.objects.push(
      createObject('label', 'labelC', { x: 700, y: 0, w: 40, h: 40 }),
    )
    store.hydrate(book)
    const page = store.activePage
    const cId = page.objects[2]!.id
    const rr = (id: string) => store.effectiveRectOf(id)!
    // order by position: a(center 50), b(center 160), c(center 720)
    store.setSelection(['a', 'b', cId])
    store.distributeSelection('x')
    const centers = page.objects.map((o) => rr(o.id).x + rr(o.id).w / 2)
    expect(centers[1]! - centers[0]!).toBeCloseTo(centers[2]! - centers[1]!, 5)
    expect(rr(page.objects[0]!.id).x).toBe(0) // a fixed
    expect(rr(page.objects[2]!.id).x).toBe(700) // c fixed
  })

  it('distribute needs three objects', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.distributeSelection('x')
    expect(store.effectiveRectOf(page.objects[0]!.id)!.x).toBe(0)
    expect(store.effectiveRectOf(page.objects[1]!.id)!.x).toBe(120)
  })

  it('matchSizeSelection matches the largest width', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.matchSizeSelection('w')
    expect(store.effectiveRectOf(page.objects[0]!.id)!.w).toBe(100)
    expect(store.effectiveRectOf(page.objects[1]!.id)!.w).toBe(100)
    expect(store.effectiveRectOf(page.objects[1]!.id)!.h).toBe(60) // height untouched for 'w'
  })

  it('aligns group members in the group local frame and re-tightens the box', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid1 = createObject('label', 'kid1', { x: 0, y: 0, w: 40, h: 20 })
    const kid2 = createObject('label', 'kid2', { x: 60, y: 30, w: 40, h: 20 })
    const group = createGroup('group1', { x: 100, y: 100, w: 100, h: 60 }, [kid1, kid2])
    store.book.pages[0]!.objects.push(group)
    const groupInBook = store.book.pages[0]!.objects[2]!
    store.setSelection([kid1.id, kid2.id])
    store.alignSelection('left')
    expect(groupInBook.children![0]!.x).toMatchObject({ left: 0 })
    expect(groupInBook.children![1]!.x).toMatchObject({ left: 0 })
    // the group box still hugs its members
    expect(groupInBook.x).toEqual({ mode: 'left', left: 100, width: 40 })
    expect(groupInBook.y).toEqual({ mode: 'top', top: 100, height: 50 })
  })

  it('align is a single undoable step', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.alignSelection('left')
    expect(store.effectiveRectOf(page.objects[1]!.id)!.x).toBe(0)
    store.undo()
    expect(store.effectiveRectOf(useBookStore().activePage.objects[1]!.id)!.x).toBe(120)
  })

  it('fillObjectWidth pins both horizontal margins', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.fillObjectWidth('a', 8)
    expect(page.objects[0]!.x).toEqual({ mode: 'both', left: 8, right: 8 })
    expect(page.objects[0]!.y).toEqual({ mode: 'top', top: 0, height: 50 })
  })

  it('fillObjectHeight pins both vertical margins; centerObjectInPage centres', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.fillObjectHeight('a', 10)
    expect(page.objects[0]!.y).toEqual({ mode: 'both', top: 10, bottom: 10 })
    store.centerObjectInPage('b')
    expect(page.objects[1]!.x).toEqual({ mode: 'center', width: 80 })
    expect(page.objects[1]!.y).toEqual({ mode: 'center', height: 60 })
  })

  it('align on a mixed-parent selection is a no-op', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { x: 0, y: 0, w: 10, h: 10 })
    store.book.pages[0]!.objects.push(
      createGroup('group1', { x: 300, y: 300, w: 100, h: 100 }, [kid]),
    )
    const before = JSON.stringify(store.book.pages[0]!.objects)
    store.setSelection(['a', kid.id])
    store.alignSelection('left')
    expect(JSON.stringify(useBookStore().activePage.objects)).toBe(before)
  })
})
