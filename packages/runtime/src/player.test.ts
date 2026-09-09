import { describe, expect, it } from 'vitest'
import { createObject, type Book } from '@toolback/format'
import { extractFunctionNames, runBook, stopRun } from './player'

function makeBook(opts: {
  pageScript?: string
  objects?: Array<{ name: string; control: 'button' | 'label'; text?: string; on?: Record<string, string> }>
}): Book {
  return {
    id: 'book1',
    title: 'Test',
    canvas: { desktop: { width: 1280, height: 800 } },
    pages: [
      {
        id: 'p1',
        name: 'Page 1',
        script: opts.pageScript ?? '',
        background: '#ffffff',
        objects: (opts.objects ?? []).map((o) => {
          const obj = createObject(
            o.control,
            o.name,
            { desktop: { x: 0, y: 0, w: 100, h: 40 } },
            o.text !== undefined ? { text: o.text } : {},
          )
          return { ...obj, on: o.on ?? {} }
        }),
      },
    ],
  }
}

describe('player', () => {
  it('extracts top-level function names', () => {
    expect(extractFunctionNames('function a() {}\nconst x = 1\nfunction   b ( y ) { function nested() {} }')).toEqual([
      'a',
      'b',
    ])
  })

  it('wires click scripts to the store and updates dynamic labels', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [
        { name: 'btn', control: 'button', text: 'Add', on: { click: `store.set('n', (store.get('n') ?? 0) + 1)` } },
        { name: 'out', control: 'label', text: 'Count: {{n}}' },
      ],
    })

    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const btn = root.querySelector('button.tb-button')!
    btn.dispatchEvent(new MouseEvent('click'))
    btn.dispatchEvent(new MouseEvent('click'))

    expect(handle.store.get('n')).toBe(2)
    expect(errors).toEqual([])
    expect(root.querySelector('.tb-label')?.textContent).toBe('Count: 2')

    handle.stop()
    root.remove()
  })

  it('shares page-level functions with object scripts (function-name sugar)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = makeBook({
      pageScript: `function bump(by) { store.set('n', (store.get('n') ?? 0) + by) }`,
      objects: [{ name: 'btn', control: 'button', on: { click: 'bump(3)' } }],
    })

    const handle = runBook(book, root, 'desktop')
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(handle.store.get('n')).toBe(3)

    handle.stop()
    root.remove()
  })

  it('calls pageEnter on run', () => {
    const root = document.createElement('div')
    const book = makeBook({
      pageScript: `function pageEnter() { store.set('greeting', 'hello') }`,
    })
    const handle = runBook(book, root, 'desktop')
    expect(handle.store.get('greeting')).toBe('hello')
    handle.stop()
  })

  it('gives object scripts access to controls by name', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = makeBook({
      objects: [
        { name: 'source', control: 'label', text: 'hello' },
        { name: 'mirror', control: 'label', on: { click: 'controls.mirror.text = controls.source.text' } },
      ],
    })
    const handle = runBook(book, root, 'desktop')
    root.querySelector('[data-tb-name="mirror"] div')!.dispatchEvent(new MouseEvent('click'))
    expect(handle.controls['mirror']!.text).toBe('hello')
    handle.stop()
    root.remove()
  })

  it('reports script errors through onError and keeps running', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [{ name: 'btn', control: 'button', on: { click: `throw new Error('boom')` } }],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(errors[0]).toContain('boom')

    handle.stop()
    root.remove()
  })

  it('stop unwires listeners', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = makeBook({
      objects: [{ name: 'btn', control: 'button', on: { click: `store.set('n', 1)` } }],
    })
    const handle = runBook(book, root, 'desktop')
    handle.stop()
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(handle.store.get('n')).toBeUndefined()
    root.remove()
  })

  it('a second runBook replaces the first', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = makeBook({
      objects: [{ name: 'btn', control: 'button', on: { click: `store.set('n', 1)` } }],
    })
    runBook(book, root, 'desktop')
    const second = runBook(book, root, 'desktop')
    root.querySelectorAll('button.tb-button').forEach((b) => b.dispatchEvent(new MouseEvent('click')))
    expect(second.store.get('n')).toBe(1)
    stopRun()
    root.remove()
  })
})
