import { describe, expect, it } from 'vitest'
import { createBook, createObject, createPage } from '@toolback/format'
import { applyModifiedPage, mergeGeneratedBook } from './mergeBook'

function incomingWithPage(name: string, goTarget?: string) {
  const book = createBook('Incoming')
  book.pages[0]!.name = name
  const btn = createObject('button', 'goBtn', { x: 10, y: 10, w: 100, h: 40 }, { text: 'Go' })
  if (goTarget) btn.on = { click: `page.go('${goTarget}')` }
  book.pages[0]!.objects.push(btn)
  return book
}

describe('mergeGeneratedBook', () => {
  it('appends pages and backgrounds with fresh ids', () => {
    const current = createBook('Current')
    current.pages[0]!.name = 'Main'
    const incoming = incomingWithPage('Game')
    const { book, report } = mergeGeneratedBook(current, incoming)

    expect(book.pages).toHaveLength(2)
    expect(book.pages[1]!.name).toBe('Game')
    expect(book.pages[1]!.id).not.toBe(incoming.pages[0]!.id)
    expect(book.pages[1]!.objects[0]!.id).not.toBe(incoming.pages[0]!.objects[0]!.id)
    expect(book.backgrounds.length).toBe(current.backgrounds.length + incoming.backgrounds.length)
    expect(report).toEqual({ pagesAdded: 1, backgroundsAdded: 1, renamedPages: [] })
    expect(current.pages).toHaveLength(1)
  })

  it('de-duplicates page names and rewrites references to them', () => {
    const current = createBook('Current')
    current.pages[0]!.name = 'Main'
    const incoming = incomingWithPage('Main', 'Main')
    const { book, report } = mergeGeneratedBook(current, incoming)

    expect(book.pages).toHaveLength(2)
    expect(book.pages[1]!.name).toBe('Main 2')
    expect(book.pages[1]!.objects[0]!.on['click']).toContain("page.go('Main 2')")
    expect(report.renamedPages).toEqual(['Main → Main 2'])
  })
})

describe('applyModifiedPage', () => {
  it('replaces the page content and keeps its identity', () => {
    const target = createPage('P', 'bg1')
    target.objects = [createObject('label', 'old', { x: 0, y: 0, w: 10, h: 10 }, { text: 'old' })]
    const source = createPage('P', 'bgx')
    source.script = "store.set('n', 1)"
    source.objects = [
      createObject('button', 'btn', { x: 0, y: 0, w: 10, h: 10 }, { text: 'Go' }),
    ]
    applyModifiedPage(target, source, [])
    expect(target.name).toBe('P')
    expect(target.backgroundId).toBe('bg1')
    expect(target.script).toBe("store.set('n', 1)")
    expect(target.objects.map((o) => o.name)).toEqual(['btn'])
    expect(target.objects[0]!.id).not.toBe(source.objects[0]!.id)
  })

  it('renames names that collide with the background and rewrites references', () => {
    const target = createPage('P', 'bg1')
    const source = createPage('P', 'bgx')
    source.script = "controls.shared.text = 'x'"
    const colliding = createObject(
      'label',
      'shared',
      { x: 0, y: 0, w: 10, h: 10 },
      { text: 's' },
    )
    colliding.on = { click: "controls.shared.text = 'y'" }
    source.objects = [colliding]
    const { renamedObjects } = applyModifiedPage(target, source, ['shared'])
    expect(renamedObjects).toEqual(['shared → shared2'])
    expect(target.objects[0]!.name).toBe('shared2')
    expect(target.script).toContain('controls.shared2')
    expect(target.objects[0]!.on['click']).toContain('controls.shared2')
  })
})

describe('applyModifiedPage — keepExisting (strict add-only)', () => {
  it('keeps existing objects verbatim and only adds new ones', () => {
    const target = createPage('P', 'bg1')
    const existing = createObject(
      'button',
      'btnRed',
      { x: 0, y: 0, w: 10, h: 10 },
      { text: 'Red', background: '#ff0000' },
    )
    const existingId = existing.id
    target.objects = [existing]

    const source = createPage('P', 'bgx')
    const recoloured = createObject(
      'button',
      'btnRed',
      { x: 0, y: 0, w: 10, h: 10 },
      { text: 'Red', background: '#1e293b' },
    )
    const fresh = createObject('button', 'btnBig', { x: 0, y: 0, w: 10, h: 10 }, { text: 'Big' })
    source.objects = [recoloured, fresh]

    const report = applyModifiedPage(target, source, [], { keepExisting: true })
    expect(target.objects.map((o) => o.name)).toEqual(['btnRed', 'btnBig'])
    expect(target.objects[0]!.id).toBe(existingId)
    expect(target.objects[0]!.props['background']).toBe('#ff0000')
    expect(report.keptObjects).toBe(1)
    expect(report.addedObjects).toBe(1)
  })

  it('renames a new object that collides with an existing one', () => {
    const target = createPage('P', 'bg1')
    target.objects = [createObject('button', 'a', { x: 0, y: 0, w: 10, h: 10 })]
    const source = createPage('P', 'bgx')
    source.objects = [createObject('button', 'a', { x: 0, y: 0, w: 10, h: 10 })]
    const report = applyModifiedPage(target, source, [], { keepExisting: true })
    expect(report.addedObjects).toBe(0)
    expect(target.objects.map((o) => o.name)).toEqual(['a'])
  })
})
