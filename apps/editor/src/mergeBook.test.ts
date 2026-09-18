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
  it('appends pages with fresh ids, reusing a same-named background', () => {
    const current = createBook('Current')
    current.pages[0]!.name = 'Main'
    const incoming = incomingWithPage('Game')
    const { book, report } = mergeGeneratedBook(current, incoming)

    expect(book.pages).toHaveLength(2)
    expect(book.pages[1]!.name).toBe('Game')
    expect(book.pages[1]!.id).not.toBe(incoming.pages[0]!.id)
    expect(book.pages[1]!.objects[0]!.id).not.toBe(incoming.pages[0]!.objects[0]!.id)
    expect(book.backgrounds).toHaveLength(current.backgrounds.length)
    expect(book.pages[1]!.backgroundId).toBe(current.backgrounds[0]!.id)
    expect(report.backgroundsAdded).toBe(0)
    expect(report.reusedBackgrounds).toEqual(['Background 1'])
    expect(report.renamedPages).toEqual([])
    expect(current.pages).toHaveLength(1)
  })

  it('appends a genuinely new background when the name differs', () => {
    const current = createBook('Current')
    const incoming = incomingWithPage('Game')
    incoming.backgrounds[0]!.name = 'Board'
    const { book, report } = mergeGeneratedBook(current, incoming)

    expect(book.backgrounds).toHaveLength(2)
    const added = book.backgrounds[1]!
    expect(added.name).toBe('Board')
    expect(added.id).not.toBe(incoming.backgrounds[0]!.id)
    expect(book.pages[1]!.backgroundId).toBe(added.id)
    expect(report.backgroundsAdded).toBe(1)
    expect(report.reusedBackgrounds).toEqual([])
  })

  it('renames page objects that collide with the reused background', () => {
    const current = createBook('Current')
    current.backgrounds[0]!.objects.push(
      createObject('label', 'nav', { x: 0, y: 0, w: 10, h: 10 }, { text: 'nav' }),
    )
    const incoming = incomingWithPage('Game')
    const page = incoming.pages[0]!
    page.script = "controls.nav.text = 'x'"
    const colliding = createObject('button', 'nav', { x: 0, y: 0, w: 10, h: 10 }, { text: 'Go' })
    colliding.on = { click: "controls.nav.text = 'y'" }
    page.objects.push(colliding)
    const { book, report } = mergeGeneratedBook(current, incoming)

    const added = book.pages[1]!
    expect(added.backgroundId).toBe(current.backgrounds[0]!.id)
    expect(added.script).toContain('controls.nav2')
    const renamed = added.objects.find((o) => o.name === 'nav2')!
    expect(renamed).toBeTruthy()
    expect(renamed.on['click']).toContain('controls.nav2')
    expect(report.renamedObjects).toEqual(['nav → nav2'])
  })

  it('drops objects the model put on a reused background', () => {
    const current = createBook('Current')
    const incoming = incomingWithPage('Game')
    incoming.backgrounds[0]!.objects.push(
      createObject('label', 'shared', { x: 0, y: 0, w: 10, h: 10 }, { text: 's' }),
    )
    const { book, report } = mergeGeneratedBook(current, incoming)
    expect(book.backgrounds).toHaveLength(1)
    expect(book.backgrounds[0]!.objects).toHaveLength(0)
    expect(report.droppedBackgroundObjects).toBe(1)
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
