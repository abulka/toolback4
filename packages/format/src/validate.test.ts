import { describe, expect, it } from 'vitest'
import { createBook, createObject, createPage, formatIssues, validateBook } from './index'
import { sampleBook } from './sample'

function bookWith(control: Parameters<typeof createObject>[0], name: string, props = {}, on = {}) {
  const book = createBook('Test')
  const bgId = book.backgrounds[0]!.id
  book.pages[0]!.objects.push(
    createObject(control, name, { x: 10, y: 10, w: 100, h: 40 }, props),
  )
  book.pages[0]!.objects[0]!.on = on
  book.pages.push(createPage('Second', bgId))
  return book
}

describe('validateBook', () => {
  it('accepts a well-formed book', () => {
    const result = validateBook(sampleBook())
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.book).toBeDefined()
  })

  it('reports structural errors with a path', () => {
    const result = validateBook({ title: 'Broken' })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.severity === 'error' && i.path.includes('pages'))).toBe(true)
  })

  it('rejects non-identifier object names', () => {
    const result = validateBook(bookWith('button', 'my button'))
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('valid JavaScript identifier'))).toBe(true)
  })

  it('rejects duplicate object names in one container', () => {
    const book = createBook('Test')
    book.pages[0]!.objects.push(createObject('label', 'dup', { x: 0, y: 0, w: 10, h: 10 }))
    book.pages[0]!.objects.push(createObject('label', 'dup', { x: 0, y: 0, w: 10, h: 10 }))
    const result = validateBook(book)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('duplicate object name'))).toBe(true)
  })

  it('rejects duplicate page names', () => {
    const book = createBook('Test')
    const bgId = book.backgrounds[0]!.id
    book.pages.push(createPage('Page 1', bgId))
    const result = validateBook(book)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('duplicate page name'))).toBe(true)
  })

  it('flags a controls reference to a missing object', () => {
    const result = validateBook(bookWith('button', 'okBtn', {}, { click: 'controls.ghost.text = "x"' }))
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('controls.ghost'))).toBe(true)
  })

  it('flags navigation to a missing page', () => {
    const result = validateBook(bookWith('button', 'goBtn', {}, { click: "page.go('Nope')" }))
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('page.go("Nope")'))).toBe(true)
  })

  it('warns about unknown props but still passes', () => {
    const result = validateBook(bookWith('button', 'btn', { text: 'Hi', wobble: 1 }))
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.severity === 'warning' && i.message.includes('wobble'))).toBe(true)
  })

  it('warns about unresolved template keys', () => {
    const result = validateBook(bookWith('label', 'lbl', { text: 'Hi {{who}}' }))
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.message.includes('{{who}}'))).toBe(true)
  })

  it('warns about deprecated shapes but still parses', () => {
    const raw = JSON.parse(JSON.stringify(sampleBook())) as Record<string, unknown>
    raw['canvas'] = { desktop: { width: 1280, height: 800 } }
    const result = validateBook(raw)
    expect(result.book).toBeDefined()
    expect(result.issues.some((i) => i.message.includes('deprecated'))).toBe(true)
  })

  it('formats issues for a repair turn', () => {
    const text = formatIssues([
      { path: 'pages[0]', message: 'boom', severity: 'error' },
    ])
    expect(text).toBe('- [error] pages[0]: boom')
    expect(formatIssues([])).toBe('')
  })
})

describe('validateBook — appearance props', () => {
  it('accepts border/radius/opacity and switch trackColor without unknown-prop warnings', () => {
    const book = createBook('Test')
    book.pages[0]!.objects.push(
      createObject('button', 'btn', { x: 0, y: 0, w: 10, h: 10 }, {
        text: 'Hi',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#f00',
        radius: 8,
        opacity: 0.5,
      }),
      createObject('switch', 'sw', { x: 0, y: 0, w: 10, h: 10 }, {
        text: 'On',
        trackColor: '#0f0',
      }),
    )
    const result = validateBook(book)
    expect(result.issues.filter((i) => i.message.includes('unknown property'))).toEqual([])
  })
})
