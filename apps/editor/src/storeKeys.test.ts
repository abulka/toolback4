import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { collectStoreKeys } from './storeKeys'
const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

describe('collectStoreKeys', () => {
  it('collects keys from scripts and templates across all pages', () => {
    const book: Book = {
      id: 'b',
      title: 't',
      canvas: { desktop: { width: 10, height: 10 } },
      backgrounds: [BG],
      pages: [
        {
          id: 'p1',
          name: 'One',
          script: "store.set('score', 0)",
          backgroundId: 'bg1',
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
          backgroundId: 'bg1',
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
      backgrounds: [BG],
      pages: [
        {
          id: 'p1',
          name: 'One',
          script: '',
          backgroundId: 'bg1',
          objects: [],
        },
      ],
    }
    expect(collectStoreKeys(book)).toEqual([])
  })
})
