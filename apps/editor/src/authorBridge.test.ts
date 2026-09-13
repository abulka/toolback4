import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Book } from '@toolback/format'
import { useBookStore } from './stores/book'
import { executeAuthorOp } from './authorBridge'

function twoObjectBook(): Book {
  return {
    id: 'b1',
    title: 'T',
    canvas: { desktop: { width: 800, height: 600 } },
    backgrounds: [{ id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }],
    pages: [
      {
        id: 'p1',
        name: 'P',
        script: '',
        backgroundId: 'bg1',
        objects: [
          { id: 'a', name: 'labelA', control: 'label', rect: { x: 0, y: 0, w: 100, h: 50 }, props: { text: 'A' }, on: {} },
          { id: 'b', name: 'labelB', control: 'label', rect: { x: 120, y: 40, w: 80, h: 60 }, props: { text: 'B' }, on: {} },
        ],
      },
    ],
  }
}

describe('author bridge ops', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
    setActivePinia(createPinia())
  })

  it('getSelection / getSelectionJson reflect the live selection', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    const sel = executeAuthorOp(store, 'getSelection', {}) as { names: string[]; ids: string[]; target: string }
    expect(sel.names).toEqual(['labelA', 'labelB'])
    expect(sel.target).toBe('page')
    const json = executeAuthorOp(store, 'getSelectionJson', {}) as Array<{ name: string }>
    expect(json).toHaveLength(2)
    expect(json[0]).toMatchObject({ name: 'labelA', control: 'label' })
  })

  it('insertControl returns an authorRef; updateProps patches it; getObject snapshots it', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const made = executeAuthorOp(store, 'insertControl', [
      'card',
      { x: 213, y: 97, props: { title: 'Stamped' } },
    ]) as { __authorRef: true; id: string; name: string; control: string }
    // wire-format ref: the runtime materialises this into a live handle
    expect(made.__authorRef).toBe(true)
    expect(made.control).toBe('card')
    const page = store.activePage
    expect(page.objects).toHaveLength(3)
    const card = page.objects[2]!
    // 8px-snapped from (213, 97)
    expect(card.rect).toEqual({ x: 216, y: 96, w: 176, h: 48 })
    expect(card.props['title']).toBe('Stamped')
    // plugin can patch it afterwards (geometry through props too)
    executeAuthorOp(store, 'updateProps', [made.id, { title: 'Renamed', x: 33 }])
    expect((store.activePage.objects[2] as { props: Record<string, unknown> }).props['title']).toBe('Renamed')
    expect(store.activePage.objects[2]!.rect.x).toBe(33)
    // getObject: flat snapshot for handle.get()
    const snap = executeAuthorOp(store, 'getObject', [made.id]) as Record<string, unknown>
    expect(snap).toMatchObject({ name: 'card1', control: 'card', x: 33, title: 'Renamed' })
    expect(typeof snap['width']).toBe('number')
  })

  it('updateProps without an id patches EVERY selected object', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    executeAuthorOp(store, 'updateProps', [{ color: 'navy', x: 5 }])
    const [a, b] = store.activePage.objects
    expect(a!.props['color']).toBe('navy')
    expect(b!.props['color']).toBe('navy')
    expect(a!.rect.x).toBe(5)
    expect(b!.rect.x).toBe(5)
    // nothing selected → clear error
    store.setSelection([])
    expect(() => executeAuthorOp(store, 'updateProps', [{ color: 'red' }])).toThrow('nothing selected')
  })

  it('commands map onto the selection: duplicate + delete', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a'])
    executeAuthorOp(store, 'command', ['duplicate'])
    expect(store.activePage.objects).toHaveLength(3)
    executeAuthorOp(store, 'command', ['delete'])
    expect(store.activePage.objects).toHaveLength(2)
    // the whole flow is undoable as book history steps
    store.undo()
    expect(store.activePage.objects).toHaveLength(3)
    store.undo()
    expect(store.activePage.objects).toHaveLength(2)
  })

  it('command("group") returns the new group ref; moveObject moves it (members ride along)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    store.setSelection(['a', 'b'])
    const made = executeAuthorOp(store, 'command', ['group']) as {
      ok: boolean
      __authorRef: true
      id: string
      name: string
    }
    expect(made.ok).toBe(true)
    // the handle IS the group the store selected after grouping
    expect(made.id).toBe(store.selectionIds[0])
    expect(made.name).toBe('group1')

    // moveObject: the whole group in one undoable step
    executeAuthorOp(store, 'moveObject', [made.id, 20, 0])
    const g = store.activePage.objects[0]!
    expect(g.control).toBe('group')
    expect(g.rect).toEqual({ x: 20, y: 0, w: 200, h: 100 })
    // children keep their relative offsets (they ride with the group)
    expect(g.children![0]!.rect).toEqual({ x: 0, y: 0, w: 100, h: 50 })
    // one undo reverts the move (grouping itself is a second step)
    store.undo()
    expect(store.activePage.objects[0]!.rect).toEqual({ x: 0, y: 0, w: 200, h: 100 })
    store.undo()
    expect(store.activePage.objects).toHaveLength(2)
  })

  it('updateProps geometry patches a plain object too; pageInfo carries the breakpoint', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    executeAuthorOp(store, 'updateProps', ['a', { x: 33, y: 8, text: 'Moved' }])
    const a = store.activePage.objects[0]!
    expect(a.rect).toEqual({ x: 33, y: 8, w: 100, h: 50 })
    expect(a.props['text']).toBe('Moved')
    const info = executeAuthorOp(store, 'pageInfo', []) as { breakpoint: string }
    expect(info.breakpoint).toBe('desktop')
  })

  it('pageInfo + message', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    const info = executeAuthorOp(store, 'pageInfo', {}) as { pageNames: string[]; editing: string; objectCount: number }
    expect(info.pageNames).toEqual(['P'])
    expect(info.editing).toBe('page')
    expect(info.objectCount).toBe(2)
    executeAuthorOp(store, 'message', ['hello from plugin'])
    expect(store.canvasNote).toBe('hello from plugin')
  })

  it('unknown ops throw (posted back as failed replies)', () => {
    const store = useBookStore()
    store.hydrate(twoObjectBook())
    expect(() => executeAuthorOp(store, 'deleteEverything', [])).toThrow('unknown op')
  })
})
