import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { buildStandaloneHtml, standaloneFileName } from './publish'

const book: Book = {
  id: 'b',
  title: 'My Quiz',
  canvas: { desktop: { width: 100, height: 100 } },
  pages: [
    {
      id: 'p1',
      name: 'One',
      script: '',
      background: '#fff',
      objects: [
        {
          id: 'o1',
          name: 'btn',
          control: 'button',
          rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } },
          props: { text: 'Press' },
          on: {},
        },
      ],
    },
  ],
}

describe('publish', () => {
  it('builds a self-contained html with the book embedded', () => {
    const html = buildStandaloneHtml(book, 'PLAYER_CODE_HERE')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>My Quiz</title>')
    expect(html).toContain('window.__TOOLBACK_BOOK__=')
    expect(html).toContain('PLAYER_CODE_HERE')
    expect(html).toContain('"My Quiz"')
  })

  it('cannot be broken out of with </script> in book strings', () => {
    const sneaky = structuredClone(book)
    ;(book.pages[0]!.objects[0]!.props as Record<string, unknown>)['text'] = '</script><b>bad</b>'
    const html = buildStandaloneHtml(book, 'PLAYER()')
    // every "<" in the embedded JSON is escaped, so the raw sequence can never appear
    const embedded = html.split('window.__TOOLBACK_BOOK__=')[1] ?? ''
    expect(embedded).not.toContain('</script><b>bad')
    expect(html).toContain('"\\u003c/script>\\u003cb>bad\\u003c/b>"')
    void sneaky
  })

  it('sanitizes the file name', () => {
    const b = { ...book, title: 'My  Weird//Title!!' }
    expect(standaloneFileName(b)).toBe('My-Weird-Title.html')
  })
})
