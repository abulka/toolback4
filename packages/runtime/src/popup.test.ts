import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { popupEscape, runBook, stopRun } from './player'
import { listenForEditor } from './editorLink'

function popupBook(opts?: {
  dialogBg?: { size?: { width: number; height: number }; script?: string }
  modal?: boolean
  chrome?: 'auto' | 'none'
  openScript?: string
}): Book {
  const popupOpts: Record<string, unknown> = {}
  if (opts?.modal === false) popupOpts['modal'] = false
  if (opts?.chrome) popupOpts['chrome'] = opts.chrome
  const optsArg = Object.keys(popupOpts).length ? `, ${JSON.stringify(popupOpts)}` : ''
  return {
    id: 'b',
    title: 'T',
    canvas: { desktop: { width: 800, height: 600 } },
    backgrounds: [
      {
        id: 'bg1',
        name: 'Main',
        color: '#ffffff',
        script: '',
        objects: [],
      },
      {
        id: 'bgDialog',
        name: 'Dialog',
        color: '#f0f0ff',
        script: opts?.dialogBg?.script ?? '',
        ...(opts?.dialogBg?.size ? { size: { desktop: opts.dialogBg.size } } : {}),
        objects: [],
      },
    ],
    pages: [
      {
        id: 'p1',
        name: 'Main',
        script: '',
        backgroundId: 'bg1',
        objects: [
          {
            ...createObject('button', 'openBtn', { desktop: { x: 0, y: 0, w: 100, h: 40 } }),
            on: { click: opts?.openScript ?? `page.popupOpen('Dialog'${optsArg})` },
          },
        ],
      },
      {
        id: 'p2',
        name: 'Dialog',
        script: '',
        backgroundId: 'bgDialog',
        objects: [
          {
            ...createObject('button', 'okBtn', { desktop: { x: 8, y: 8, w: 80, h: 30 } }, { text: 'OK' }),
            on: { click: `store.set('ok', true); page.popupClose('Dialog')` },
          },
          {
            ...createObject('label', 'dialogLabel', { desktop: { x: 8, y: 100, w: 200, h: 30 } }, { text: 'in dialog' }),
          },
        ],
      },
    ],
  }
}

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('popups', () => {
  it('popupOpen renders the page in a chrome box sized by its background; close removes it', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook({ dialogBg: { size: { width: 320, height: 240 } } })
    const handle = runBook(book, root, 'desktop', (m) => {
      throw new Error(`script error: ${m}`)
    })
    const btn = root.querySelector('button.tb-button') as HTMLButtonElement
    btn.click()
    await tick()

    const box = document.querySelector<HTMLElement>('.tb-popup')!
    expect(box).not.toBeNull()
    expect(document.querySelector('.tb-popup-chrome')?.textContent).toContain('Dialog')
    // size comes from the dialog background's override
    expect(box.style.left).not.toBe('')
    const page = box.querySelector<HTMLElement>('.tb-page')!
    expect(page.style.width).toBe('320px')
    expect(page.style.height).toBe('240px')
    // popup page objects are live and in the merged controls
    expect(handle.controls['okBtn']).toBeDefined()

    // close via the popup's own OK button
    ;(box.querySelector('[data-tb-name="okBtn"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup')).toBeNull()
    expect(handle.controls['okBtn']).toBeUndefined()
    expect(handle.store.get('ok')).toBe(true)
    stopRun()
    root.remove()
  })

  it('chrome: none renders the bare page; x/y position the box', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    root.style.position = 'relative'
    const book = popupBook({ chrome: 'none', openScript: `page.popupOpen('Dialog', { chrome: 'none', x: 40, y: 30 })` })
    runBook(book, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    const box = document.querySelector<HTMLElement>('.tb-popup')!
    expect(document.querySelector('.tb-popup-chrome')).toBeNull()
    // positioned relative to the holder's origin
    expect(box.style.left).toBe('40px')
    expect(box.style.top).toBe('30px')
    stopRun()
    root.remove()
  })

  it('the title bar drags the popup to a new position', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook()
    runBook(book, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    const box = document.querySelector<HTMLElement>('.tb-popup')!
    const bar = box.querySelector<HTMLElement>('.tb-popup-chrome')!
    const left0 = box.style.left
    const top0 = box.style.top
    // synthetic pointer sequence on the title bar
    bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 70, clientY: 46 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 70, clientY: 46 }))
    await tick()
    expect(box.style.left).toBe(`${parseInt(left0, 10) + 60}px`)
    expect(box.style.top).toBe(`${parseInt(top0, 10) + 36}px`)
    // popup still open and functional
    expect(document.querySelector('.tb-popup-chrome')).not.toBeNull()
    stopRun()
    root.remove()
  })

  it('modal backdrop blocks the page; non-modal does not; Esc closes topmost modal', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook()
    runBook(book, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup-backdrop')).not.toBeNull()
    // backdrop click closes
    ;(document.querySelector('.tb-popup-backdrop') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup')).toBeNull()

    // non-modal: no backdrop
    const book2 = popupBook({ modal: false })
    runBook(book2, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup')).not.toBeNull()
    expect(document.querySelector('.tb-popup-backdrop')).toBeNull()
    stopRun()

    // Esc closes a modal popup (player-level Esc contract)
    runBook(book, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    expect(popupEscape()).toBe(true)
    await tick()
    expect(document.querySelector('.tb-popup')).toBeNull()
    // nothing left to close
    expect(popupEscape()).toBe(false)
    stopRun()
    root.remove()
  })

  it('popups stack; page.go inside a popup navigates that popup; base page survives', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook({ openScript: `page.popupOpen('Dialog', { chrome: 'none' })` })
    // Dialog2 exists as a separate page; a second base-page button opens it
    book.pages.push({
      id: 'p3',
      name: 'Dialog2',
      script: '',
      backgroundId: 'bgDialog',
      objects: [
        createObject('label', 'd2', { desktop: { x: 0, y: 0, w: 100, h: 30 } }, { text: 'two' }),
        { ...createObject('button', 'navBtn', { desktop: { x: 8, y: 160, w: 80, h: 30 } }), on: { click: `page.go('Dialog')` } },
      ],
    })
    book.pages[0]!.objects.push({
      ...createObject('button', 'openBtn2', { desktop: { x: 150, y: 0, w: 100, h: 40 } }),
      on: { click: `page.popupOpen('Dialog2', { chrome: 'none' })` },
    })
    // open two DIFFERENT popups — they stack
    const handle = runBook(book, root, 'desktop')
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    ;(root.querySelector('[data-tb-name="openBtn2"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelectorAll('.tb-popup')).toHaveLength(2)
    // base page objects still present
    expect(root.querySelector('[data-tb-name="openBtn"]')).not.toBeNull()

    // page.go inside the TOP popup navigates THAT popup
    const top = document.querySelectorAll<HTMLElement>('.tb-popup')[1]!
    ;(top.querySelector('[data-tb-name="navBtn"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelectorAll('.tb-popup .tb-page')).toHaveLength(2)
    // popup2 navigated itself to Dialog (navBtn went back to Dialog)
    expect(document.querySelectorAll('.tb-popup')[1]!.querySelector('[data-tb-name="okBtn"]')).not.toBeNull()
    // still two popups — Dialog2 replaced its own content, no popup was closed
    expect(document.querySelectorAll('.tb-popup')).toHaveLength(2)
    stopRun()
    root.remove()
  })

  it('base page.go closes open popups (pageLeave fires)', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook({ openScript: `page.popupOpen('Dialog', { chrome: 'none' })` })
    book.pages[1]!.script = `function pageLeave() { store.set('dialogLeft', true) }`
    book.pages.push({
      id: 'p4',
      name: 'Other',
      script: '',
      backgroundId: 'bg1',
      objects: [],
    })
    book.pages[0]!.objects.push({
      ...createObject('button', 'navAway', { desktop: { x: 200, y: 0, w: 100, h: 30 } }),
      on: { click: `page.go('Other')` },
    })
    const handle = runBook(book, root, 'desktop', (m) => {
      throw new Error(`script error: ${m}`)
    })
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup')).not.toBeNull()
    ;(root.querySelector('[data-tb-name="navAway"] button') as HTMLElement).click()
    await tick()
    expect(document.querySelector('.tb-popup')).toBeNull()
    expect(handle.store.get('dialogLeft')).toBe(true)
    stopRun()
    root.remove()
  })

  it('onPopups reports open popup names', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = popupBook({ openScript: `page.popupOpen('Dialog', { chrome: 'none' })` })
    const seenOpen: string[][] = []
    runBook(book, root, 'desktop', undefined, 0, (open) => seenOpen.push([...open]))
    ;(root.querySelector('[data-tb-name="openBtn"] button') as HTMLElement).click()
    await tick()
    expect(seenOpen.at(-1)).toEqual(['Dialog'])
    ;(document.querySelector('[data-tb-name="okBtn"] button') as HTMLElement).click()
    await tick()
    expect(seenOpen.at(-1)).toEqual([])
    stopRun()
    root.remove()
  })
})

describe('background scripts', () => {
  it('backgroundEnter fires once per run; shared fns callable from page scripts', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book: Book = {
      id: 'b',
      title: 'T',
      canvas: { desktop: { width: 400, height: 300 } },
      backgrounds: [
        {
          id: 'bg1',
          name: 'Main',
          color: '#fff',
          script: [
            'function helper() { return 41 }',
            'function backgroundEnter() { store.set("bg", (store.get("bg") ?? 0) + 1) }',
          ].join('\n'),
          objects: [],
        },
      ],
      pages: [
        {
          id: 'p1',
          name: 'One',
          script: `function pageEnter() { store.set('n', helper() + 1) }`,
          backgroundId: 'bg1',
          objects: [createObject('label', 'l', { desktop: { x: 0, y: 0, w: 50, h: 20 } })],
        },
        {
          id: 'p2',
          name: 'Two',
          script: '',
          backgroundId: 'bg1',
          objects: [],
        },
      ],
    }
    const errors: string[] = []
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    await tick()
    expect(errors).toEqual([])
    expect(handle.store.get('bg')).toBe(1)
    expect(handle.store.get('n')).toBe(42)
    stopRun()
    root.remove()
  })

  it('background event scripts run: a button on the background works from every page', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const nav = createObject('button', 'navBtn', { desktop: { x: 0, y: 0, w: 80, h: 30 } }, { text: 'Go' })
    nav.on = { click: `store.set('clicked', (store.get('clicked') ?? 0) + 1); page.go('Two')` }
    const book: Book = {
      id: 'b',
      title: 'T',
      canvas: { desktop: { width: 400, height: 300 } },
      backgrounds: [
        { id: 'bg1', name: 'B', color: '#fff', script: '', objects: [nav] },
      ],
      pages: [
        { id: 'p1', name: 'One', script: '', backgroundId: 'bg1', objects: [] },
        { id: 'p2', name: 'Two', script: '', backgroundId: 'bg1', objects: [] },
      ],
    }
    const handle = runBook(book, root, 'desktop', (m) => {
      throw new Error(`script error: ${m}`)
    })
    ;(root.querySelector('[data-tb-name="navBtn"] button') as HTMLElement).click()
    await tick()
    expect(handle.store.get('clicked')).toBe(1)
    expect(root.querySelector('.tb-page')!.getAttribute('data-tb-page-id')).toBe(book.pages[1]!.id)
    stopRun()
    root.remove()
  })

  it('design mode Esc is untouched by the popup Esc path', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string }> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m))
    try {
      // design load (no popups exist in design mode)
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book: popupBook(), design: true },
        }),
      )
      // Esc in design mode must NOT toggle anything popup-related
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(sent.some((m) => (m as { type: string }).type === 'toolback:runToggle')).toBe(false)
      expect(document.querySelector('.tb-popup')).toBeNull()
    } finally {
      cleanup()
      root.remove()
    }
  })
})
