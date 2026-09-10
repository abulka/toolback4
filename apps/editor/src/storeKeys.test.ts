import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { collectStoreKeys } from './storeKeys'

describe('collectStoreKeys', () => {
  it('collects keys from scripts and templates across all pages', () => {
    const book: Book = {
      id: 'b',
      title: 't',
      canvas: { desktop: { width: 10, height: 10 } },
      pages: [
        {
          id: 'p1',
          name: 'One',
          script: "store.set('score', 0)",
          background: '#fff',
          objects: [
            {
              id: 'o1',
              name: 'a',
              control: 'label',
              rects: { desktop: { x: 0, y: 0, w: 1, h: 1 } },
              props: { text: 'Score: {{score}} of {{max}}' },
              on: { click: "store.set('clicked', true); store.set('score', 1)" },
            },
          ],
        },
        {
          id: 'p2',
          name: 'Two',
          script: "store.set('max', 5)",
          background: '#fff',
          objects: [],
        },
      ],
    }
    expect(collectStoreKeys(book)).toEqual(['clicked', 'max', 'score'])
  })

  it('returns empty for a book without keys', () => {
    const book: Book = {
      id: 'b',
      title: 't',
      canvas: { desktop: { width: 10, height: 10 } },
      pages: [
        {
          id: 'p1',
          name: 'One',
          script: '',
          background: '#fff',
          objects: [],
        },
      ],
    }
    expect(collectStoreKeys(book)).toEqual([])
  })
})
