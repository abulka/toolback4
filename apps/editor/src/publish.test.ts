import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { basePackageName, buildStandaloneHtml, libUrlMapFor, scanLibImports, standaloneFileName } from './publish'
const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

const book: Book = {
  id: 'b',
  title: 'My Quiz',
  canvas: { desktop: { width: 100, height: 100 } },
  backgrounds: [BG],
  pages: [
    {
      id: 'p1',
      name: 'One',
      script: '',
      backgroundId: 'bg1',
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

describe('scanLibImports', () => {
  function bookWithScripts(scripts: {
    background?: string
    page?: string
    object?: string
    groupChild?: string
  }): Book {
    const bg = { ...BG, script: scripts.background ?? '' }
    return {
      ...book,
      backgrounds: [bg],
      pages: [
        {
          ...book.pages[0]!,
          script: scripts.page ?? '',
          backgroundId: bg.id,
          objects: [
            {
              id: 'o1',
              name: 'btn',
              control: 'button',
              rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } },
              props: {},
              on: scripts.object ? { click: scripts.object } : {},
            },
            {
              id: 'g1',
              name: 'grp',
              control: 'group',
              rects: { desktop: { x: 0, y: 0, w: 20, h: 20 } },
              props: {},
              on: {},
              children: [
                {
                  id: 'o2',
                  name: 'inner',
                  control: 'label',
                  rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } },
                  props: {},
                  on: scripts.groupChild ? { click: scripts.groupChild } : {},
                },
              ],
            },
          ],
        },
      ],
    }
  }

  it('collects imports from background, page and object scripts', () => {
    const specifiers = scanLibImports(
      bookWithScripts({
        background: 'async function backgroundEnter() { await import("@tonejs/midi") }',
        page: 'function onLoad() { const x = await import("lodash") }',
        object: 'await import("chart.js")',
        groupChild: 'await import("dayjs")',
      }),
    )
    expect(specifiers).toEqual(['@tonejs/midi', 'lodash', 'chart.js', 'dayjs'])
  })

  it('dedupes and keeps only bare specifiers', () => {
    const specifiers = scanLibImports(
      bookWithScripts({
        page: [
          "await import('@tonejs/midi')",
          'await import("@tonejs/midi")',
          "await import('./local.js')",
          'await import("https://esm.sh/three")',
          'await import("data:text/javascript,1")',
          'await import("node:fs")',
          'await import("/abs/path.js")',
        ].join('\n'),
      }),
    )
    expect(specifiers).toEqual(['@tonejs/midi'])
  })

  it('ignores non-import lookalikes', () => {
    const specifiers = scanLibImports(
      bookWithScripts({ page: `const s = 'important(x)'; store.set('await import', s)` }),
    )
    expect(specifiers).toEqual([])
  })
})

describe('basePackageName', () => {
  it('reduces specifiers to their base package', () => {
    expect(basePackageName('@tonejs/midi')).toBe('@tonejs/midi')
    expect(basePackageName('@tonejs/midi/track')).toBe('@tonejs/midi')
    expect(basePackageName('lodash')).toBe('lodash')
    expect(basePackageName('lodash/fp')).toBe('lodash')
  })
})

describe('libUrlMapFor', () => {
  it('maps shelf packages to their bundled URLs and unknown ones to esm.sh with a warning', () => {
    const { libs, warnings } = libUrlMapFor(['@tonejs/midi', 'left-pad'], new Map([['@tonejs/midi', 'data:text/javascript;base64,QUJD']]))
    expect(libs['@tonejs/midi']).toBe('data:text/javascript;base64,QUJD')
    expect(libs['left-pad']).toBe('https://esm.sh/left-pad')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('left-pad')
  })
})

describe('library imports in the export', () => {
  it('embeds the lib map as a script tag before the player', () => {
    const html = buildStandaloneHtml(book, 'PLAYER()', {
      '@tonejs/midi': 'data:text/javascript;base64,QUJD',
    })
    const tagIndex = html.indexOf('<script>window.__TOOLBACK_LIBS__=')
    expect(tagIndex).toBeGreaterThan(-1)
    expect(tagIndex).toBeGreaterThan(html.indexOf('window.__TOOLBACK_BOOK__='))
    expect(tagIndex).toBeLessThan(html.indexOf('<script>PLAYER()'))
    expect(html).toContain('{"@tonejs/midi":"data:text/javascript;base64,QUJD"}')
  })

  it('omits the lib tag when no libraries are used', () => {
    const html = buildStandaloneHtml(book, 'PLAYER()')
    expect(html).not.toContain('__TOOLBACK_LIBS__')
  })

  it('a "<" inside a lib URL cannot break out of the script tag', () => {
    const html = buildStandaloneHtml(book, 'PLAYER()', { lib: 'data:text/javascript,x</script><b>bad' })
    const tag = html.split('window.__TOOLBACK_LIBS__=')[1]?.split('</script>')[0] ?? ''
    expect(tag).not.toContain('</script')
    expect(html).toContain('\\u003c/script>')
  })
})
