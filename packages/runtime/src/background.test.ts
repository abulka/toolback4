import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { renderBackgroundView, renderBookPage } from './index'
import { runBook, stopRun } from './player'
import { listenForEditor } from './editorLink'

function bgBook(opts?: { bgObjects?: ReturnType<typeof createObject>[]; bgSize?: Book['backgrounds'][number]['size'] }): Book {
  return {
    id: 'b',
    title: 'T',
    canvas: { desktop: { width: 1280, height: 800 } },
    backgrounds: [
      {
        id: 'bg1',
        name: 'Background 1',
        color: '#ffeedd',
        script: '',
        ...(opts?.bgSize ? { size: opts.bgSize } : {}),
        objects: opts?.bgObjects ?? [],
      },
    ],
    pages: [
      {
        id: 'p1',
        name: 'P1',
        script: '',
        backgroundId: 'bg1',
        objects: [createObject('label', 'pageLabel', { desktop: { x: 0, y: 0, w: 80, h: 30 } })],
      },
      {
        id: 'p2',
        name: 'P2',
        script: '',
        backgroundId: 'bg1',
        objects: [],
      },
    ],
  }
}

describe('backgrounds (runtime)', () => {
  it('sizes the page from the background override and paints the background colour', () => {
    const root = document.createElement('div')
    const book = bgBook({ bgSize: { desktop: { width: 320, height: 240 } } })
    renderBookPage(book, 0, root, 'desktop')
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('320px')
    expect(pageRoot.style.height).toBe('240px')
    expect(pageRoot.style.background).toBe('#ffeedd')
  })

  it('falls back to the book canvas size when the background has no override', () => {
    const root = document.createElement('div')
    renderBookPage(bgBook(), 0, root, 'desktop')
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('1280px')
  })

  it('renders background objects below page objects, tagged data-tb-bg', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'Home' })
    const book = bgBook({ bgObjects: [navBtn] })
    renderBookPage(book, 0, root, 'desktop')
    const wrappers = root.querySelectorAll<HTMLElement>('.tb-object')
    expect(wrappers).toHaveLength(2)
    const first = wrappers[0]!
    expect(first.dataset.tbName).toBe('navBtn')
    expect(first.dataset.tbBg).toBe('1')
    // background object renders on the second page too
    renderBookPage(book, 1, root, 'desktop')
    expect(root.querySelector('[data-tb-name="navBtn"]')).not.toBeNull()
  })

  it('background objects run: ControlApis, event scripts and controls[name] work', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } })
    navBtn.on = { click: `store.set('nav', 1)` }
    const book = bgBook({ bgObjects: [navBtn] })
    const handle = runBook(book, root, 'desktop', (m) => {
      throw new Error(`script error: ${m}`)
    })
    expect(handle.controls['navBtn']).toBeDefined()
    const btn = root.querySelector('[data-tb-name="navBtn"] button, button.tb-button') as HTMLElement
    btn.dispatchEvent(new MouseEvent('click'))
    expect(handle.store.get('nav')).toBe(1)
    stopRun()
  })

  it('page object names collide-checked against background names: bg element wins the lookup', () => {
    // documents current behaviour: querySelector finds the bg wrapper first
    const root = document.createElement('div')
    const bgLabel = createObject('label', 'dup', { desktop: { x: 0, y: 0, w: 50, h: 20 } }, { text: 'from bg' })
    const pageLabel = createObject('label', 'dup', { desktop: { x: 100, y: 0, w: 50, h: 20 } }, { text: 'from page' })
    const book = bgBook({ bgObjects: [bgLabel] })
    book.pages[0]!.objects.push(pageLabel)
    const handle = runBook(book, root, 'desktop')
    expect(handle.controls['dup']!.el.textContent).toBe('from bg')
    stopRun()
  })

  it('renderBackgroundView shows only the background objects, editable (no data-tb-bg)', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'Home' })
    const book = bgBook({ bgObjects: [navBtn], bgSize: { desktop: { width: 320, height: 240 } } })
    renderBackgroundView(book, 'bg1', root, 'desktop')
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('320px')
    const wrappers = root.querySelectorAll<HTMLElement>('.tb-object')
    expect(wrappers).toHaveLength(1)
    expect(wrappers[0]!.dataset.tbName).toBe('navBtn')
    expect(wrappers[0]!.dataset.tbBg).toBeUndefined()
    expect(root.querySelector('[data-tb-name="pageLabel"]')).toBeNull()
    expect(pageRoot.querySelector('.tb-bg-badge')?.textContent).toContain('Background 1')
  })

  it('design load of a background view renders only bg objects; run resolves to its first page', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m))
    try {
      const navBtn = createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'Home' })
      const book = bgBook({ bgObjects: [navBtn] })
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, view: { kind: 'background', id: 'bg1' }, design: true },
        }),
      )
      expect(root.querySelector('[data-tb-name="navBtn"]')).not.toBeNull()
      expect(root.querySelector('[data-tb-name="pageLabel"]')).toBeNull()

      // run mode: the background view plays the first page using it
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book, view: { kind: 'background', id: 'bg1' }, design: false },
        }),
      )
      expect(root.querySelector('.tb-label')).not.toBeNull() // pageLabel from p1
      stopRun()
    } finally {
      cleanup()
      root.remove()
    }
  })
})
