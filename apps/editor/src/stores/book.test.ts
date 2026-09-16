import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createGroup, createObject, flattenObjects, parseBook, type Book } from '@toolback/format'
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
    canvas: { desktop: { width: 800, height: 600 } },
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
    expect(group.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 })
    const kids = group.children!
    expect(kids[0]!.rect).toEqual({ x: 0, y: 0, w: 100, h: 50 })
    expect(kids[1]!.rect).toEqual({ x: 120, y: 40, w: 80, h: 60 })
    // group is selected after grouping
    expect(store.selectionIds).toEqual([group.id])
  })

  it('a top-level group defaults to left/top glue; a nested group stays free', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.groupSelected()
    const outer = store.activePage.objects[0]!
    expect(outer.fit).toEqual({ x: 'left', y: 'top' })

    // grouping members inside the group makes a nested group with no glue
    store.setSelection(outer.children!.map((c) => c.id))
    store.groupSelected()
    const inner = outer.children!.find((c) => c.control === 'group')!
    expect(inner.fit).toBeUndefined()
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
    expect(b!.rect).toEqual({ x: 120, y: 40, w: 80, h: 60 })
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
    expect(kidInBook.rect).toEqual({ x: 0, y: 0, w: 60, h: 30 })
    // single-member group hugs its member
    expect(store.book.pages[0]!.objects[2]!.rect).toEqual({ x: 350, y: 120, w: 60, h: 30 })

    // top-level objects keep page coordinates
    store.applyRect('a', { x: 16, y: 16, w: 40, h: 40 })
    expect(store.book.pages[0]!.objects[0]!.rect).toEqual({ x: 16, y: 16, w: 40, h: 40 })
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
    expect(g.rect).toEqual({ x: 300, y: 120, w: 190, h: 110 })
    expect(kidInBook.rect).toEqual({ x: 150, y: 0, w: 40, h: 20 })
    expect(kid2InBook.rect).toEqual({ x: 0, y: 80, w: 50, h: 30 })

    // kid2 dragged up-left: origin moves, siblings shift to stay put
    store.applyRect(kid2Id ?? kid2InBook.id, { x: 60, y: 80, w: 50, h: 30 })
    expect(g.rect).toEqual({ x: 60, y: 80, w: 430, h: 60 })
    expect(kidInBook.rect).toEqual({ x: 390, y: 40, w: 40, h: 20 })
    expect(kid2InBook.rect).toEqual({ x: 0, y: 0, w: 50, h: 30 })
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
    expect(g.rect).toEqual({ x: 300, y: 200, w: 50, h: 30 })
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
    expect(leafInBook.rect).toEqual({ x: 0, y: 0, w: 40, h: 20 })
    expect(innerInBook.rect).toEqual({ x: 0, y: 0, w: 40, h: 20 })
    expect(outerInBook.rect).toEqual({ x: 580, y: 210, w: 40, h: 20 })
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
    expect(dup.rect).toEqual({ x: 224, y: 224, w: 300, h: 300 })
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
    expect(dupKid.rect).toEqual(kid.rect)
  })

  it('duplicateSelected duplicates plain multi-selections next to their originals', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.duplicateSelected()

    const page = store.book.pages[0]!.objects
    expect(page.map((o) => o.name)).toEqual(['labelA', 'label1', 'labelB', 'label2'])
    // duplicates are offset down-right, members relative to group untouched
    expect(page[1]!.rect).toEqual({ x: 24, y: 24, w: 100, h: 50 })
    expect(page[3]!.rect).toEqual({ x: 144, y: 64, w: 80, h: 60 })
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
    expect(p1.rect).toEqual({ x: 24, y: 24, w: 100, h: 50 })
    expect(p2.rect).toEqual({ x: 144, y: 64, w: 80, h: 60 })
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
    expect(group.children![2]!.rect).toEqual({ x: 24, y: 24, w: 100, h: 50 })
    expect(group.children![3]!.rect).toEqual({ x: 144, y: 64, w: 80, h: 60 })
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
    expect(page[2]!.rect).toEqual({ x: 24, y: 24, w: 100, h: 50 })
    expect(page[3]!.rect).toEqual({ x: 48, y: 48, w: 100, h: 50 })
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

  it('addObject folds a non-desktop drop rect onto the shared layout', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setBreakpoint('mobile') // book canvas upgrades to 390×844
    store.addObject('button', { x: 100, y: 100, w: 120, h: 40 })
    const obj = store.activePage.objects.at(-1)!
    // desktop ref 800×600: Left/Top fold the margin ratio (800/390, 600/844)
    expect(obj.rect).toEqual({ x: 205, y: 71, w: 120, h: 40 })
  })

  it('fillObjectToPage stretches the object to the page minus the margin', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.fillObjectToPage(id, 8)
    const obj = store.book.pages[0]!.objects[0]!
    // desktop base 800×600 is the reference → identity fold
    expect(obj.fit).toEqual({ x: 'stretch', y: 'stretch' })
    expect(obj.rect).toEqual({ x: 8, y: 8, w: 784, h: 584 })

    // on mobile the target folds back to reference coordinates
    store.setBreakpoint('mobile') // base 390×844
    const id2 = store.book.pages[0]!.objects[1]!.id
    store.fillObjectToPage(id2, 0)
    const obj2 = store.book.pages[0]!.objects[1]!
    expect(obj2.rect).toEqual({ x: 0, y: 0, w: 800, h: 600 })
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

  it('setBackgroundSize sets per-breakpoint overrides and clears them', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const bgId = store.book.backgrounds[0]!.id
    store.setBackgroundSize(bgId, 'desktop', { width: 320, height: 240 })
    expect(store.book.backgrounds[0]!.size).toEqual({ desktop: { width: 320, height: 240 } })
    // activeCanvasSize reflects the override at desktop, book size at tablet
    expect(store.activeCanvasSize).toEqual({ width: 320, height: 240 })
    store.setBreakpoint('tablet')
    // twoObjectBook has no tablet canvas — setBreakpoint upgrades it to the default
    expect(store.activeCanvasSize).toEqual({ width: 768, height: 1024 })
    store.setBackgroundSize(bgId, 'desktop', null)
    expect(store.book.backgrounds[0]!.size).toBeUndefined()
  })

  it('setBackgroundAutoHeight derives the canvas height at every breakpoint', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const bgId = store.book.backgrounds[0]!.id
    store.setBackgroundAutoHeight(bgId, true)
    expect(store.book.backgrounds[0]!.autoHeight).toBe(true)
    // existing content sits inside the 600px base → no growth
    expect(store.activeCanvasSize).toEqual({ width: 800, height: 600 })
    store.addObject('card', { x: 0, y: 1000, w: 100, h: 50 })
    expect(store.activeCanvasSize).toEqual({ width: 800, height: 1050 + 24 })
    // global: the mode applies at mobile too (no per-breakpoint opt-in)
    store.setBreakpoint('mobile')
    expect(store.book.backgrounds[0]!.autoHeight).toBe(true)
    expect(store.activeCanvasSize.height).toBeGreaterThan(store.book.canvas.mobile!.height)
    store.setBackgroundAutoHeight(bgId, false)
    expect(store.book.backgrounds[0]!.autoHeight).toBeUndefined()
  })

  it('undo covers the auto-height flag', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const bgId = store.book.backgrounds[0]!.id
    store.setBackgroundAutoHeight(bgId, true)
    expect(store.book.backgrounds[0]!.autoHeight).toBe(true)
    store.undo()
    expect(store.book.backgrounds[0]!.autoHeight).toBeUndefined()
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
describe('book store — responsive glue (lens)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setObjectFit stores the glue without touching the rect', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const before = JSON.parse(JSON.stringify(store.book.pages[0]!.objects[0]!.rect))
    store.setObjectFit(id, 'x', 'right')
    expect(store.book.pages[0]!.objects[0]!.fit).toEqual({ x: 'right' })
    expect(store.book.pages[0]!.objects[0]!.rect).toEqual(before)
  })

  it('setObjectFit replaces only the changed axis', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectFit(id, 'x', 'right')
    store.setObjectFit(id, 'y', 'bottom')
    expect(store.book.pages[0]!.objects[0]!.fit).toEqual({ x: 'right', y: 'bottom' })
    store.setObjectFit(id, 'x', 'center')
    expect(store.book.pages[0]!.objects[0]!.fit).toEqual({ x: 'center', y: 'bottom' })
  })

  it('setObjectFit with null removes the axis, then the whole fit', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectFit(id, 'x', 'right')
    store.setObjectFit(id, 'y', 'bottom')
    store.setObjectFit(id, 'x', null)
    expect(store.book.pages[0]!.objects[0]!.fit).toEqual({ y: 'bottom' })
    store.setObjectFit(id, 'y', null)
    expect(store.book.pages[0]!.objects[0]!.fit).toBeUndefined()
  })

  it('effectiveRectOf lenses the constrained axis at desktop too', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop canvas 800x600
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 100, y: 100, w: 100, h: 50 }
    o.fit = { x: 'center' }
    // the stored rect keeps the authored x=100; the lens renders x=(800-100)/2
    expect(o.rect!.x).toBe(100)
    expect(store.effectiveRectOf(id)!.x).toBe(350)
  })

  it('switching back to Free restores the authored position exactly', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 100, y: 100, w: 100, h: 50 }
    store.setObjectFit(id, 'x', 'center')
    expect(store.effectiveRectOf(id)!.x).toBe(350)
    store.setObjectFit(id, 'x', null)
    expect(store.effectiveRectOf(id)!.x).toBe(100) // authored spot restored
  })

  it('undo reverts a glue change', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    store.setObjectFit(id, 'x', 'right')
    store.undo()
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    expect(o.fit).toBeUndefined()
  })
})

describe('book store — glued objects re-anchor on drag', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('dragging a right-glued object edits its reference (desktop)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 600, y: 24, w: 100, h: 48 }
    o.fit = { x: 'right' }
    store.applyRects([{ id, rect: { x: 500, y: 24, w: 100, h: 48 } }])
    // the authored reference moved so the right gap follows the drag
    expect(o.rect!.x).toBe(500)
    expect(o.fit).toEqual({ x: 'right' })
  })

  it('a mobile drag re-anchors the shared base rect', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 600, y: 24, w: 100, h: 48 }
    o.fit = { x: 'right' }
    store.setBreakpoint('mobile')
    const before = store.effectiveRectOf(id)!
    store.applyRects([{ id, rect: { x: before.x - 20, y: before.y, w: 100, h: 48 } }])
    expect(o.fit).toEqual({ x: 'right' }) // glue preserved
    expect(store.effectiveRectOf(id)!.x).toBe(before.x - 20) // follows exactly
  })

  it('center is rigid: a horizontal drag does not move it, the free axis commits', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 100, y: 24, w: 100, h: 48 }
    o.fit = { x: 'center' }
    store.applyRects([{ id, rect: { x: 260, y: 160, w: 100, h: 48 } }])
    expect(o.rect!.x).toBe(100) // center has no offset to edit
    expect(o.rect!.y).toBe(160) // free axis accepted
    expect(store.effectiveRectOf(id)!.x).toBe(350) // still centered
    expect(store.effectiveRectOf(id)!.y).toBe(160)
  })

  it('resizing a stretched object edits its reference width', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 0, y: 0, w: 200, h: 40 }
    o.fit = { x: 'stretch' }
    store.applyRects([{ id, rect: { x: 0, y: 0, w: 300, h: 40 } }])
    expect(o.rect!.w).toBe(300)
    expect(o.fit).toEqual({ x: 'stretch' })
  })

  it('an unglued drag edits the one shared rect (any breakpoint)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setBreakpoint('mobile')
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 600, y: 24, w: 100, h: 48 }
    store.applyRects([{ id, rect: { x: 5, y: 5, w: 100, h: 48 } }])
    expect(o.rect.x).toBe(5)
  })

  it('a glued group re-anchors too (no wholesale rejection)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const member = page.objects[0]!
    const group = createGroup('g1', { x: 600, y: 0, w: 200, h: 100 }, [member])
    group.fit = { x: 'right' }
    page.objects = [group]
    store.applyRects([{ id: group.id, rect: { x: 500, y: 0, w: 200, h: 100 } }])
    expect(group.rect!.x).toBe(500)
    expect(group.fit).toEqual({ x: 'right' })
  })

  it('a top-level group can be constrained and lenses; a member cannot', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const page = store.book.pages[0]!
    const member = createObject('button', 'ok', { x: 10, y: 10, w: 80, h: 40 })
    const group = createGroup('g1', { x: 600, y: 100, w: 200, h: 100 }, [member])
    page.objects = [group]
    store.setObjectFit(group.id, 'x', 'right')
    expect(group.fit).toEqual({ x: 'right' })
    // the group box lenses (right, proportional): 800·390/800 − 200 = 190
    store.setBreakpoint('mobile')
    expect(store.effectiveRectOf(group.id)!.x).toBe(190)
    // members carry no fit of their own
    store.setObjectFit(group.children![0]!.id, 'x', 'right')
    expect(group.children![0]!.fit).toBeUndefined()
  })

  it('resizing a glued group edits its base rect and scales members', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const page = store.book.pages[0]!
    const member = createObject('button', 'ok', { x: 10, y: 10, w: 80, h: 40 })
    const group = createGroup('g1', { x: 600, y: 100, w: 200, h: 100 }, [member])
    page.objects = [group]
    group.fit = { x: 'right' }
    store.setBreakpoint('mobile') // group renders at x=190
    const child = group.children![0]!
    // shrink from the WEST handle: rendered group {230,100,160,100}; the batch
    // also carries the pre-scaled member entry (which must be ignored)
    store.applyRects(
      [
        { id: group.id, rect: { x: 230, y: 100, w: 160, h: 100 } },
        { id: child.id, rect: { x: 238, y: 110, w: 64, h: 40 } },
      ],
      { dir: 'w' },
    )
    // base edit: right edge stays flush (800), width authored to 160
    expect(group.rect).toEqual({ x: 640, y: 100, w: 160, h: 100 })
    expect(group.fit).toEqual({ x: 'right' })
    // member scaled in the base frame around the fixed (east) corner
    expect(child.rect).toEqual({ x: 8, y: 10, w: 64, h: 40 })
  })

  it('ungrouping a centered group places members at their rendered spots', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const page = store.book.pages[0]!
    const ok = createObject('button', 'ok', { x: 0, y: 0, w: 100, h: 40 })
    const cancel = createObject('button', 'cancel', { x: 120, y: 0, w: 100, h: 40 })
    const group = createGroup('g1', { x: 300, y: 200, w: 220, h: 40 }, [ok, cancel])
    page.objects = [group]
    store.setObjectFit(group.id, 'x', 'center')
    const rendered = store.effectiveRectOf(group.id)!
    store.applySelection([group.id])
    store.ungroupSelected()
    const [a, b] = page.objects
    // the authored group x was 300; centered it renders at (800−220)/2 = 290
    expect(rendered.x).toBe(290)
    expect(a!.rect!.x).toBe(rendered.x + 0)
    expect(b!.rect!.x).toBe(rendered.x + 120)
  })

  it('setGeometry edits a base reference instead of releasing the glue', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook()) // desktop 800x600
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 600, y: 24, w: 100, h: 48 }
    o.fit = { x: 'right' }
    store.setGeometry(id, { x: 500 })
    expect(o.rect!.x).toBe(500)
    expect(o.fit).toEqual({ x: 'right' })
  })

  it('setGeometry on a centered x releases that axis (no offset to edit)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 100, y: 24, w: 100, h: 48 }
    o.fit = { x: 'center' }
    store.setGeometry(id, { x: 200 })
    expect(o.rect!.x).toBe(200)
    expect(o.fit).toBeUndefined()
  })

  it('a size write on a centered axis keeps the glue and re-centers', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const id = store.book.pages[0]!.objects[0]!.id
    const o = store.book.pages[0]!.objects.find((x) => x.id === id)!
    o.rect = { x: 100, y: 24, w: 100, h: 48 }
    o.fit = { x: 'center' }
    store.setGeometry(id, { w: 200 })
    expect(o.fit).toEqual({ x: 'center' })
    expect(o.rect!.w).toBe(200)
    expect(store.effectiveRectOf(id)!.x).toBe((800 - 200) / 2)
  })

  it('free and glued objects in the same commit both commit', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const [glued, free] = store.book.pages[0]!.objects
    glued!.fit = { x: 'right' }
    glued!.rect = { x: 600, y: 24, w: 100, h: 48 }
    store.applyRects([
      { id: glued!.id, rect: { x: 500, y: 10, w: 100, h: 48 } },
      { id: free!.id, rect: { x: 50, y: 50, w: 100, h: 48 } },
    ])
    expect(glued!.rect!.x).toBe(500)
    expect(glued!.fit).toEqual({ x: 'right' })
    expect(free!.rect!.x).toBe(50)
  })

  it('a group member dragged (no fit) always moves', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.book.pages[0]!
    const member = page.objects[0]!
    const group = createGroup('g1', { x: 0, y: 0, w: 200, h: 100 }, [member])
    page.objects = [group]
    store.applyRects([{ id: member.id, rect: { x: 40, y: 40, w: 100, h: 48 } }])
    // the tight-bounds rule moves the group origin so the member keeps its
    // visual position: member rel x = 40 - group.x(40) = 0
    expect(group.rect!.x).toBe(40)
    expect(member.rect!.x).toBe(0)
  })
})

describe('book store — glue-spring hint mode', () => {
  it('persists the selected mode and updates the ref', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    setActivePinia(createPinia())
    const store = useBookStore()
    expect(store.fitHintMode).toBe('all')
    store.setFitHintMode('selected')
    expect(store.fitHintMode).toBe('selected')
    expect(setItem).toHaveBeenCalledWith('toolback.fitHints', 'selected')
  })

  it.each([
    [null, 'all'],
    ['all', 'all'],
    ['selected', 'selected'],
    ['off', 'off'],
    ['1', 'all'],
    ['0', 'off'],
    ['bogus', 'all'],
  ] as const)('reads stored %s as %s', (raw, expected) => {
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

  it('alignSelection left aligns top-level objects and keeps glue', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    page.objects[1]!.fit = { x: 'right', y: 'top' }
    store.setSelection(['a', 'b'])
    store.alignSelection('left')
    expect(page.objects[0]!.rect.x).toBe(0)
    expect(page.objects[1]!.rect.x).toBe(0)
    // the responsive glue survives the write
    expect(page.objects[1]!.fit).toEqual({ x: 'right', y: 'top' })
  })

  it('centerSelectionOnPage centers the block, not each object independently', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.centerSelectionOnPage()
    // union was (0..200, 0..100) on an 800x600 page → shift +300,+250
    expect(page.objects[0]!.rect).toEqual({ x: 300, y: 250, w: 100, h: 50 })
    expect(page.objects[1]!.rect).toEqual({ x: 420, y: 290, w: 80, h: 60 })
    // the two are still side by side (not stacked)
    expect(page.objects[0]!.rect.x).not.toBe(page.objects[1]!.rect.x)
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
    // order by position: a(center 50), b(center 160), c(center 720)
    store.setSelection(['a', 'b', cId])
    store.distributeSelection('x')
    const centers = page.objects.map((o) => o.rect.x + o.rect.w / 2)
    expect(centers[1]! - centers[0]!).toBeCloseTo(centers[2]! - centers[1]!, 5)
    expect(page.objects[0]!.rect.x).toBe(0) // a fixed
    expect(page.objects[2]!.rect.x).toBe(700) // c fixed
  })

  it('distribute needs three objects', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.distributeSelection('x')
    expect(page.objects[0]!.rect.x).toBe(0)
    expect(page.objects[1]!.rect.x).toBe(120)
  })

  it('matchSizeSelection matches the largest width', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.matchSizeSelection('w')
    expect(page.objects[0]!.rect.w).toBe(100)
    expect(page.objects[1]!.rect.w).toBe(100)
    expect(page.objects[1]!.rect.h).toBe(60) // height untouched for 'w'
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
    expect(groupInBook.children![0]!.rect.x).toBe(0)
    expect(groupInBook.children![1]!.rect.x).toBe(0)
    // the group box still hugs its members
    expect(groupInBook.rect).toEqual({ x: 100, y: 100, w: 40, h: 50 })
  })

  it('align is a single undoable step', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.setSelection(['a', 'b'])
    store.alignSelection('left')
    expect(page.objects[1]!.rect.x).toBe(0)
    store.undo()
    expect(useBookStore().activePage.objects[1]!.rect.x).toBe(120)
  })

  it('fillObjectWidth sets Stretch on x and folds the margin onto the layout', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.fillObjectWidth('a', 8)
    expect(page.objects[0]!.fit).toEqual({ x: 'stretch' })
    expect(page.objects[0]!.rect).toEqual({ x: 8, y: 0, w: 784, h: 50 })
  })

  it('fillObjectHeight sets Stretch on y and centerObjectInPage sets Center · Center', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const page = store.activePage
    store.fillObjectHeight('a', 10)
    expect(page.objects[0]!.fit).toEqual({ y: 'stretch' })
    store.centerObjectInPage('b')
    expect(page.objects[1]!.fit).toEqual({ x: 'center', y: 'center' })
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
