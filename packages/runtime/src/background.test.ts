import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { renderBackgroundView, renderBookPage } from './index'
import { runBook, stopRun } from './player'
import { listenForEditor } from './editorLink'

function bgBook(opts?: { bgObjects?: ReturnType<typeof createObject>[] }): Book {
  return {
    id: 'b',
    title: 'T',
    backgrounds: [
      {
        id: 'bg1',
        name: 'Background 1',
        color: '#ffeedd',
        script: '',
        objects: opts?.bgObjects ?? [],
      },
    ],
    pages: [
      {
        id: 'p1',
        name: 'P1',
        script: '',
        backgroundId: 'bg1',
        objects: [createObject('label', 'pageLabel', { x: 0, y: 0, w: 80, h: 30 })],
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
  it('fills its container and paints the background colour', () => {
    const root = document.createElement('div')
    renderBookPage(bgBook(), 0, root, { width: 320, height: 240 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('100%')
    expect(pageRoot.style.height).toBe('100%')
    expect(pageRoot.style.background).toBe('#ffeedd')
  })

  it('a fixed page keeps its own size instead of filling the container', () => {
    const root = document.createElement('div')
    const book = bgBook()
    book.pages[0]!.size = { width: 320, height: 240 }
    renderBookPage(book, 0, root, { width: 1280, height: 800 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('320px')
    expect(pageRoot.style.height).toBe('240px')
  })

  it('renders background objects below page objects, tagged data-tb-bg', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { x: 0, y: 0, w: 100, h: 40 }, { text: 'Home' })
    const book = bgBook({ bgObjects: [navBtn] })
    renderBookPage(book, 0, root)
    const wrappers = root.querySelectorAll<HTMLElement>('.tb-object')
    expect(wrappers).toHaveLength(2)
    const first = wrappers[0]!
    expect(first.dataset.tbName).toBe('navBtn')
    expect(first.dataset.tbBg).toBe('1')
    // background object renders on the second page too
    renderBookPage(book, 1, root)
    expect(root.querySelector('[data-tb-name="navBtn"]')).not.toBeNull()
  })

  it('background objects run: ControlApis, event scripts and controls[name] work', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { x: 0, y: 0, w: 100, h: 40 })
    navBtn.on = { click: `store.set('nav', 1)` }
    const book = bgBook({ bgObjects: [navBtn] })
    const handle = runBook(book, root, (m) => {
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
    const bgLabel = createObject('label', 'dup', { x: 0, y: 0, w: 50, h: 20 }, { text: 'from bg' })
    const pageLabel = createObject('label', 'dup', { x: 100, y: 0, w: 50, h: 20 }, { text: 'from page' })
    const book = bgBook({ bgObjects: [bgLabel] })
    book.pages[0]!.objects.push(pageLabel)
    const handle = runBook(book, root)
    expect(handle.controls['dup']!.el.textContent).toBe('from bg')
    stopRun()
  })

  it('renderBackgroundView shows only the background objects, editable (no data-tb-bg)', () => {
    const root = document.createElement('div')
    const navBtn = createObject('button', 'navBtn', { x: 0, y: 0, w: 100, h: 40 }, { text: 'Home' })
    const book = bgBook({ bgObjects: [navBtn] })
    renderBackgroundView(book, 'bg1', root)
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('100%')
    const wrappers = root.querySelectorAll<HTMLElement>('.tb-object')
    expect(wrappers).toHaveLength(1)
    expect(wrappers[0]!.dataset.tbName).toBe('navBtn')
    expect(wrappers[0]!.dataset.tbBg).toBeUndefined()
    expect(root.querySelector('[data-tb-name="pageLabel"]')).toBeNull()
    expect(pageRoot.querySelector('.tb-bg-badge')?.textContent).toContain('Background 1')
  })

  it('a fluid page grows to exactly the lowest near-edge object', () => {
    const root = document.createElement('div')
    const tall = createObject('card', 'tall', { x: 0, y: 1000, w: 200, h: 100 })
    const book = bgBook({ bgObjects: [tall] })
    renderBookPage(book, 0, root, { width: 900, height: 700 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('100%')
    expect(pageRoot.style.minHeight).toBe('1100px')
    const wrapper = root.querySelector<HTMLElement>('[data-tb-name="tall"]')!
    expect(wrapper.style.top).toBe('1000px')
  })

  it('follows bottom is measured from the grown page box edge, not the viewport', () => {
    const root = document.createElement('div')
    // a near-edge object grows the page; the bottom-following object sits
    // inside it, a fixed distance from the page's (grown) bottom edge
    const tall = createObject('card', 'tall', { x: 0, y: 1000, w: 200, h: 100 })
    const pinned = createObject('card', 'pinned', { x: 0, y: 600, w: 100, h: 50 })
    pinned.y = { mode: 'bottom', bottom: 40, height: 50 }
    const book = bgBook({ bgObjects: [tall, pinned] })
    renderBookPage(book, 0, root, { width: 1280, height: 800 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.minHeight).toBe('1100px')
    const pinnedEl = root.querySelector<HTMLElement>('[data-tb-name="pinned"]')!
    expect(pinnedEl.style.bottom).toBe('40px')
  })

  it('a fluid page fills the container when content is short', () => {
    const root = document.createElement('div')
    renderBookPage(bgBook(), 0, root, { width: 1280, height: 800 })
    expect(root.querySelector<HTMLElement>('.tb-page')!.style.height).toBe('100%')
  })

  it('a top-following object below the fold grows the page by its extent', () => {
    const root = document.createElement('div')
    const btn = createObject('button', 'button1', { x: 8, y: 696, w: 176, h: 208 })
    const book = bgBook({ bgObjects: [btn] })
    renderBookPage(book, 0, root, { width: 390, height: 844 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    // top distance is fixed at 696, so the rendered bottom is 904
    expect(pageRoot.style.minWidth).toBe('184px')
    expect(pageRoot.style.minHeight).toBe('904px')
    const el = root.querySelector<HTMLElement>('[data-tb-name="button1"]')!
    expect(el.style.top).toBe('696px')
  })

  it('grows the page width (and the window scrolls) for a left object past the right edge', () => {
    const root = document.createElement('div')
    const wide = createObject('card', 'wide', { x: 0, y: 0, w: 1200, h: 100 })
    const book = bgBook({ bgObjects: [wide] })
    renderBookPage(book, 0, root, { width: 800, height: 600 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.height).toBe('100%')
    expect(pageRoot.style.minWidth).toBe('1200px')
    const el = root.querySelector<HTMLElement>('[data-tb-name="wide"]')!
    expect(el.style.left).toBe('0px')
  })

  it('keeps the page at container size when content fits inside on both axes', () => {
    const root = document.createElement('div')
    const small = createObject('card', 'small', { x: 10, y: 10, w: 100, h: 50 })
    const book = bgBook({ bgObjects: [small] })
    renderBookPage(book, 0, root, { width: 800, height: 600 })
    const pageRoot = root.querySelector<HTMLElement>('.tb-page')!
    expect(pageRoot.style.width).toBe('100%')
    expect(pageRoot.style.height).toBe('100%')
    expect(pageRoot.style.minWidth).toBe('110px')
    expect(pageRoot.style.minHeight).toBe('60px')
  })

  it('renderBackgroundView grows from its own objects', () => {
    const root = document.createElement('div')
    const tall = createObject('card', 'tall', { x: 0, y: 1400, w: 200, h: 100 })
    const book = bgBook({ bgObjects: [tall] })
    renderBackgroundView(book, 'bg1', root)
    expect(root.querySelector<HTMLElement>('.tb-page')!.style.minHeight).toBe('1500px')
  })

  it('design load of a background view renders only bg objects; run resolves to its first page', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m))
    try {
      const navBtn = createObject('button', 'navBtn', { x: 0, y: 0, w: 100, h: 40 }, { text: 'Home' })
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
