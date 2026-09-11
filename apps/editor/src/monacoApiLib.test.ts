import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { buildApiLib, buildEditorContext } from './monacoApiLib'
const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

function book(pages: Array<{ script: string; objects: string[] }>): Book {
  return {
    id: 'b',
    title: 't',
    canvas: { desktop: { width: 100, height: 100 } },
    backgrounds: [BG],
    pages: pages.map((p, i) => ({
      id: `p${i}`,
      name: `Page ${i + 1}`,
      script: p.script,
      backgroundId: 'bg1',
      objects: p.objects.map((n, j) => ({
        id: `o${i}_${j}`,
        name: n,
        control: 'label' as const,
        rects: { desktop: { x: 0, y: 0, w: 10, h: 10 } },
        props: {},
        on: {},
      })),
    })),
  }
}

describe('buildApiLib', () => {
  it('declares controls members and bare names for the page', () => {
    const lib = buildApiLib(
      book([{ script: '', objects: ['goBtn', 'countLabel'] }]),
      0,
    )
    expect(lib).toContain('goBtn: TBControl')
    expect(lib).toContain('declare const goBtn: TBControl')
    expect(lib).toContain('declare const countLabel: TBControl')
    expect(lib).toContain('declare const store: TBStore')
    expect(lib).toContain('declare const page: TBPage')
    expect(lib).toContain('declare const event:')
  })

  it('excludes names colliding with page functions and API names', () => {
    const lib = buildApiLib(
      book([
        {
          script: 'function pageEnter() {}\nfunction go() {}',
          objects: ['go', 'page', 'store', 'event', 'ok'],
        },
      ]),
      0,
    )
    // no bare declarations for collisions
    expect(lib).not.toContain('declare const go: TBControl')
    expect(lib).not.toContain('declare const page: TBControl')
    expect(lib).not.toContain('declare const store: TBControl')
    expect(lib).not.toContain('declare const event: TBControl')
    expect(lib).toContain('declare const ok: TBControl')
    // but controls members keep every object
    expect(lib).toContain('go: TBControl')
    expect(lib).toContain('page: TBControl')
    expect(lib).toContain('store: TBControl')
  })

  it('scopes bare names to the requested page', () => {
    const lib = buildApiLib(
      book([
        { script: '', objects: ['pageOneThing'] },
        { script: '', objects: ['pageTwoThing'] },
      ]),
      1,
    )
    expect(lib).toContain('declare const pageTwoThing: TBControl')
    expect(lib).not.toContain('declare const pageOneThing')
  })

  it('buildEditorContext mirrors the runtime binding rules', () => {
    const b = book([
      {
        script: 'function pageEnter() {}\nfunction go() {}',
        objects: ['go', 'ok', 'page'],
      },
      { script: '', objects: ['otherPageObj'] },
    ])
    const ctx = buildEditorContext(b, 0, ['score', 'max'])
    expect(ctx.objectNames).toEqual(['go', 'ok', 'page'])
    expect(ctx.bareNames).toEqual(['ok'])
    expect(ctx.storeKeys).toEqual(['score', 'max'])
  })
})
