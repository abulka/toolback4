import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createGroup, createObject, flattenObjects, parseBook, type Book } from '@toolback/format'
import { useBookStore } from './book'

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
          { id: 'a', name: 'labelA', control: 'label', rects: { desktop: { x: 0, y: 0, w: 100, h: 50 } } },
          {
            id: 'b',
            name: 'labelB',
            control: 'label',
            rects: { desktop: { x: 120, y: 40, w: 80, h: 60 }, tablet: { x: 10, y: 10, w: 80, h: 60 } },
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
    expect(group.rects.desktop).toEqual({ x: 0, y: 0, w: 200, h: 100 })
    // tablet union: a falls back to its desktop rect, b uses its tablet rect
    expect(group.rects.tablet).toEqual({ x: 0, y: 0, w: 100, h: 70 })
    const kids = group.children!
    expect(kids[0]!.rects.desktop).toEqual({ x: 0, y: 0, w: 100, h: 50 })
    expect(kids[1]!.rects.desktop).toEqual({ x: 120, y: 40, w: 80, h: 60 })
    // group is selected after grouping
    expect(store.selectionIds).toEqual([group.id])
  })

  it('ungroup promotes children with unrebased rects on every breakpoint', () => {
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
    expect(b!.rects.desktop).toEqual({ x: 120, y: 40, w: 80, h: 60 })
    expect(b!.rects.tablet).toEqual({ x: 10, y: 10, w: 80, h: 60 })
    // children are selected after ungrouping
    expect(store.selectionIds).toEqual([a!.id, b!.id])
  })

  it('refuses to group objects with different parents', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    const group = createGroup('group1', { desktop: { x: 300, y: 300, w: 100, h: 100 } }, [kid])
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
    const kid = createObject('label', 'kid', { desktop: { x: 10, y: 10, w: 40, h: 20 } })
    const kidId = kid.id
    const group = createGroup('group1', { desktop: { x: 100, y: 100, w: 300, h: 200 } }, [kid])
    store.book.pages[0]!.objects.push(group)
    const kidInBook = store.book.pages[0]!.objects[2]!.children![0]!
    expect(kidInBook.id).toBe(kidId)

    // child commit arrives in page coordinates (design canvas space)
    store.applyRects([{ id: kidId, rect: { x: 350, y: 120, w: 60, h: 30 } }])
    expect(kidInBook.rects.desktop).toEqual({ x: 0, y: 0, w: 60, h: 30 })
    // single-member group hugs its member
    expect(store.book.pages[0]!.objects[2]!.rects.desktop).toEqual({ x: 350, y: 120, w: 60, h: 30 })

    // top-level objects keep page coordinates
    store.applyRect('a', { x: 16, y: 16, w: 40, h: 40 })
    expect(store.book.pages[0]!.objects[0]!.rects.desktop).toEqual({ x: 16, y: 16, w: 40, h: 40 })
  })

  it('member moves snap the group to the tight union of its members', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const kid2 = createObject('label', 'kid2', { desktop: { x: 200, y: 100, w: 50, h: 30 } })
    const kidId = kid.id
    const kid2Id = kid2.id
    const group = createGroup('group1', { desktop: { x: 100, y: 100, w: 300, h: 200 } }, [kid, kid2])
    store.book.pages[0]!.objects.push(group)
    const g = store.book.pages[0]!.objects[2]!
    const kidInBook = g.children![0]!
    const kid2InBook = g.children![1]!

    // kid dragged right, past the manual (oversized) group rect — bounds snap
    // tight around both members
    store.applyRect(kidId, { x: 450, y: 120, w: 40, h: 20 })
    expect(g.rects.desktop).toEqual({ x: 300, y: 120, w: 190, h: 110 })
    expect(kidInBook.rects.desktop).toEqual({ x: 150, y: 0, w: 40, h: 20 })
    expect(kid2InBook.rects.desktop).toEqual({ x: 0, y: 80, w: 50, h: 30 })

    // kid2 dragged up-left: origin moves, siblings shift to stay put
    store.applyRect(kid2Id ?? kid2InBook.id, { x: 60, y: 80, w: 50, h: 30 })
    expect(g.rects.desktop).toEqual({ x: 60, y: 80, w: 430, h: 60 })
    expect(kidInBook.rects.desktop).toEqual({ x: 390, y: 40, w: 40, h: 20 })
    expect(kid2InBook.rects.desktop).toEqual({ x: 0, y: 0, w: 50, h: 30 })
  })

  it('deleting a member snaps the remaining bounds tight', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const kid2 = createObject('label', 'kid2', { desktop: { x: 200, y: 100, w: 50, h: 30 } })
    const kidId = kid.id
    const group = createGroup('group1', { desktop: { x: 100, y: 100, w: 300, h: 200 } }, [kid, kid2])
    store.book.pages[0]!.objects.push(group)
    const g = store.book.pages[0]!.objects[2]!

    store.setSelection([kid.id])
    store.removeSelected()
    expect(g.children).toHaveLength(1)
    expect(g.rects.desktop).toEqual({ x: 300, y: 200, w: 50, h: 30 })
  })

  it('nested groups expand their ancestors too', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const leaf = createObject('label', 'leaf', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const leafId = leaf.id
    const inner = createGroup('inner', { desktop: { x: 10, y: 10, w: 60, h: 40 } }, [leaf])
    const innerId = inner.id
    const outer = createGroup('outer', { desktop: { x: 200, y: 200, w: 300, h: 300 } }, [inner])
    store.book.pages[0]!.objects.push(outer)
    const outerInBook = store.book.pages[0]!.objects[2]!
    const innerInBook = outerInBook.children![0]!
    const leafInBook = innerInBook.children![0]!
    expect(leafInBook.id).toBe(leafId)

    // move the leaf far right: inner hugs it, outer hugs inner
    // (leaf abs position = outer origin + inner rel + leaf rel)
    store.applyRect(leafId, { x: 580, y: 210, w: 40, h: 20 })
    expect(leafInBook.rects.desktop).toEqual({ x: 0, y: 0, w: 40, h: 20 })
    expect(innerInBook.rects.desktop).toEqual({ x: 0, y: 0, w: 40, h: 20 })
    expect(outerInBook.rects.desktop).toEqual({ x: 580, y: 210, w: 40, h: 20 })
    void innerId
  })

  it('deletes the whole selection including group subtrees', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const kid = createObject('label', 'kid', { desktop: { x: 0, y: 0, w: 10, h: 10 } })
    const group = createGroup('group1', { desktop: { x: 300, y: 300, w: 100, h: 100 } }, [kid])
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
    const kid = createObject('label', 'kid', { desktop: { x: 0, y: 0, w: 40, h: 20 } })
    const kidId = kid.id
    const inner = createGroup('inner', { desktop: { x: 10, y: 10, w: 60, h: 40 } }, [kid])
    const innerId = inner.id
    const outer = createGroup('outer', { desktop: { x: 200, y: 200, w: 300, h: 300 } }, [inner])
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
    expect(dup.rects.desktop).toEqual({ x: 224, y: 224, w: 300, h: 300 })
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
    expect(dupKid.rects.desktop).toEqual(kid.rects.desktop)
  })

  it('duplicateSelected duplicates plain multi-selections next to their originals', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    store.duplicateSelected()

    const page = store.book.pages[0]!.objects
    expect(page.map((o) => o.name)).toEqual(['labelA', 'label1', 'labelB', 'label2'])
    // duplicates are offset down-right, members relative to group untouched
    expect(page[1]!.rects.desktop).toEqual({ x: 24, y: 24, w: 100, h: 50 })
    expect(page[3]!.rects.desktop).toEqual({ x: 144, y: 64, w: 80, h: 60 })
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
    bg1.objects.push(createObject('button', 'button1', { desktop: { x: 0, y: 0, w: 90, h: 30 } }))
    store.editPage(0)
    store.addObject('button', { x: 0, y: 0, w: 100, h: 40 })
    const names = store.activePage.objects.map((o) => o.name)
    expect(names).not.toContain('button1')
    expect(names).toContain('button2')
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
    bg1.objects.push(createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }))
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