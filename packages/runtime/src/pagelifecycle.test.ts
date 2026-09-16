import { describe, expect, it } from 'vitest'
import { createObject, type Book } from '@toolback/format'
import { runBook } from './player'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

function twoPageBook(page2Script: string): Book {
  return {
    id: 'b',
    title: 't',
    backgrounds: [BG],
    pages: [
      {
        id: 'p1',
        name: 'One',
        script: '',
        backgroundId: 'bg1',
        objects: [
          { ...createObject('button', 'nav', { x: 0, y: 0, w: 80, h: 30 }), on: { click: `page.go('Two')` } },
        ],
      },
      {
        id: 'p2',
        name: 'Two',
        script: page2Script,
        backgroundId: 'bg1',
        objects: [
          { ...createObject('label', 'lbl', { x: 0, y: 0, w: 80, h: 30 }), props: { text: 'x' } },
        ],
      },
    ],
  }
}

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('pageEnter double-fire regression', () => {
  it('pageEnter fires exactly once per navigation', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = twoPageBook(`function pageEnter() { store.set('n', (store.get('n') ?? 0) + 1) }`)
    const handle = runBook(book, root)

    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    await tick()
    await tick()

    expect(handle.store.get('n')).toBe(1)
    handle.stop()
    root.remove()
  })

  it('initial pageEnter fires exactly once', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = twoPageBook(`function pageEnter() { store.set('n', (store.get('n') ?? 0) + 1) }`)
    const handle = runBook(book, root, undefined, 1)
    expect(handle.store.get('n')).toBe(1)
    handle.stop()
    root.remove()
  })
})
