import { describe, expect, it } from 'vitest'
import { createGroup, createObject, type Book, type PageObject } from '@toolback/format'
import { createStore, extractFunctionNames, runBook, stopRun } from './player'

const BG = { id: 'bg1', name: 'Background 1', color: '#ffffff', script: '', objects: [] }

describe('store', () => {
  it('snapshots key/value pairs in insertion order', () => {
    const store = createStore()
    expect(store.snapshot()).toEqual([])
    store.set('a', 1)
    store.set('b', 'two')
    store.set('a', true)
    expect(store.snapshot()).toEqual([
      ['a', true],
      ['b', 'two'],
    ])
  })
})

describe('groups', () => {
  function groupBook(opts?: { groupOn?: Record<string, string>; childOn?: Record<string, string> }): Book {
    const child = createObject(
      'button',
      'kidBtn',
      { desktop: { x: 10, y: 10, w: 100, h: 40 } },
      { text: 'kid' },
    )
    child.on = opts?.childOn ?? {}
    const group = createGroup('myGroup', { desktop: { x: 40, y: 40, w: 200, h: 100 } }, [child])
    group.on = opts?.groupOn ?? {}
    const book: Book = {
      id: 'bg',
      title: 'Groups',
      canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [group] }],
    }
    return book
  }

  it('renders members nested inside the group wrapper', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = groupBook()
    runBook(book, root, 'desktop')
    const groupWrap = root.querySelector('[data-tb-name="myGroup"]')!
    expect(groupWrap.querySelector('.tb-group')).not.toBeNull()
    const kid = groupWrap.querySelector('[data-tb-name="kidBtn"]') as HTMLElement
    expect(kid).not.toBeNull()
    expect(kid.style.left).toBe('10px')
    expect(kid.style.top).toBe('10px')
    stopRun()
    root.remove()
  })

  it('a member handler without forward() stops the message at the member', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('groupSaw', 1)` },
      childOn: { click: `store.set('childSaw', 1)` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('childSaw')).toBe(1)
    // the member caught the event and did not forward — the group never runs
    expect(handle.store.get('groupSaw')).toBeUndefined()
    stopRun()
    root.remove()
  })

  it('forward() continues to the group: target = member, self = group', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('groupSaw', 1)\nstore.set('who', target.name)\nstore.set('owner', self.name)` },
      childOn: { click: `store.set('childSaw', 1)\nforward()` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('childSaw')).toBe(1)
    expect(handle.store.get('groupSaw')).toBe(1)
    expect(handle.store.get('who')).toBe('kidBtn')
    expect(handle.store.get('owner')).toBe('myGroup')
    stopRun()
    root.remove()
  })

  it('forward() still works after an await', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('groupSaw', 1)` },
      childOn: { click: `await Promise.resolve()\nforward()` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 20))
    expect(errors).toEqual([])
    expect(handle.store.get('groupSaw')).toBe(1)
    stopRun()
    root.remove()
  })

  it('self is the script owner: the object itself, the group for group scripts', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('groupSelf', self.name)` },
      childOn: { click: `store.set('childSelf', self.name)` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('childSelf')).toBe('kidBtn')
    // the member handler did not forward, so the group script never ran;
    // self === the group is checked via the auto-continue case below
    expect(handle.store.get('groupSelf')).toBeUndefined()

    const book2 = groupBook({
      groupOn: { click: `store.set('groupSelf', self.name)` },
    })
    const handle2 = runBook(book2, root, 'desktop', (m) => errors.push(m))
    // the re-render rebuilt the DOM — re-query the button
    const kid2 = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid2.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    // no member handler: the message auto-continues, self = the group itself
    expect(handle2.store.get('groupSelf')).toBe('myGroup')
    stopRun()
    root.remove()
  })

  it('this inside a script is the script owner (strict-mode call binding)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      childOn: { click: `store.set('who', this.name)` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('who')).toBe('kidBtn')
    stopRun()
    root.remove()
  })

  it('group x/y moves members; text writes are inert', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `myGroup.x += 24\nmyGroup.text = 'oops'` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const groupWrap = root.querySelector('[data-tb-name="myGroup"]') as HTMLElement
    expect(groupWrap.style.left).toBe('40px')
    const kid = groupWrap.querySelector('button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(groupWrap.style.left).toBe('64px')
    // child DOM moved along with the group
    expect((kid.closest('.tb-object') as HTMLElement)!.style.left).toBe('10px')
    expect(kid.textContent).toBe('kid')
    expect(handle.controls['myGroup']!.x).toBe(64)
    stopRun()
    root.remove()
  })

  it('group visible hides members; bare names include group children', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = groupBook({
      groupOn: { click: `myGroup.visible = false` },
    })
    const handle = runBook(book, root, 'desktop')
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const groupInner = root.querySelector('[data-tb-name="myGroup"] .tb-group') as HTMLElement
    expect(groupInner.style.display).toBe('none')
    expect(handle.controls['kidBtn']).toBeDefined()
    handle.controls['kidBtn']!.text = 'changed'
    expect(kid.textContent).toBe('changed')
    stopRun()
    root.remove()
  })

  it('group scripts receive target = the member that got the event', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('who', target.name)` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('who')).toBe('kidBtn')
    stopRun()
    root.remove()
  })

  it("a member's own script receives target = itself", () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      childOn: { click: `store.set('who', target.name)\nconsole.log('you clicked', target.name)` },
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('who')).toBe('kidBtn')
    stopRun()
    root.remove()
  })

  it('a page function named event or target does not break script compilation', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = groupBook({
      groupOn: { click: `store.set('who', target.name)` },
    })
    book.pages[0]!.script = `function event() { store.set('ev', true) }\nfunction target() { store.set('tfn', true) }`
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const kid = root.querySelector('[data-tb-name="kidBtn"] button') as HTMLElement
    kid.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(errors).toEqual([])
    expect(handle.store.get('who')).toBe('kidBtn')
    expect(handle.store.get('ev')).toBeUndefined() // page fn `event` shadows, not called here
    stopRun()
    root.remove()
  })

  it('nested groups render and script through the tree', () => {
    const root = document.createElement('div')
    const leaf = createObject('label', 'leaf', { desktop: { x: 4, y: 4, w: 50, h: 20 } }, { text: 'leaf' })
    const inner = createGroup('inner', { desktop: { x: 8, y: 8, w: 60, h: 40 } }, [leaf])
    const outer = createGroup('outer', { desktop: { x: 20, y: 20, w: 100, h: 80 } }, [inner])
    const book: Book = {
      id: 'bn',
      title: 'N',
      canvas: { desktop: { width: 400, height: 300 } },
      backgrounds: [BG],
      pages: [{ id: 'p', name: 'P', script: '', backgroundId: 'bg1', objects: [outer] }],
    }
    runBook(book, root, 'desktop')
    const leafEl = root.querySelector('[data-tb-name="leaf"]') as HTMLElement
    expect(leafEl).not.toBeNull()
    // leaf sits inside the inner group wrapper, which sits inside the outer
    expect(leafEl.closest('[data-tb-name="inner"]')).not.toBeNull()
    expect(leafEl.closest('[data-tb-name="outer"]')).not.toBeNull()
    stopRun()
  })
})

function makeBook(opts: {
  pageScript?: string
  objects?: Array<{ name: string; control: 'button' | 'label' | 'switch' | 'card'; text?: string; props?: Record<string, unknown>; on?: Record<string, string> }>
}): Book {
  return {
    id: 'book1',
    title: 'Test',
    canvas: { desktop: { width: 1280, height: 800 } },
    backgrounds: [BG],
    pages: [
      {
        id: 'p1',
        name: 'Page 1',
        script: opts.pageScript ?? '',
        backgroundId: 'bg1',
        objects: (opts.objects ?? []).map((o) => {
          const obj = createObject(
            o.control,
            o.name,
            { desktop: { x: 0, y: 0, w: 100, h: 40 } },
            o.text !== undefined ? { text: o.text, ...(o.props ?? {}) } : (o.props ?? {}),
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

  it('dynamic text: unset keys render empty, non-word keys render literally', () => {
    const root = document.createElement('div')
    const book = makeBook({
      objects: [{ name: 'out', control: 'label', text: 'A {{missing}} B {{...}} C {{ok}}' }],
    })
    const handle = runBook(book, root, 'desktop')
    handle.store.set('ok', 7)
    expect(root.querySelector('.tb-label')?.textContent).toBe('A  B {{...}} C 7')
    handle.stop()
  })

  it('{{self.name}} labels show each object its own name (and survive duplication)', () => {
    const root = document.createElement('div')
    const book = makeBook({
      objects: [
        { name: 'button1', control: 'button', text: 'I am {{self.name}}' },
        { name: 'button2', control: 'button', text: 'I am {{self.name}}' },
        { name: 'tag', control: 'label', text: '{{this.name}}' },
      ],
    })
    const handle = runBook(book, root, 'desktop')
    const buttons = root.querySelectorAll('button.tb-button')
    expect(buttons[0]!.textContent).toBe('I am button1')
    expect(buttons[1]!.textContent).toBe('I am button2')
    // the {{this.name}} alias works in templates too
    expect(root.querySelector('.tb-label')?.textContent).toBe('tag')
    // unknown members render empty, like unset store keys
    handle.stop()
  })

  it('{{self.<unknown>}} renders empty while plain {{key}} stays store-bound', () => {
    const root = document.createElement('div')
    const book = makeBook({
      objects: [{ name: 'out', control: 'label', text: 'A {{self.nme}} B {{who}}' }],
    })
    const handle = runBook(book, root, 'desktop')
    handle.store.set('who', 'sam')
    expect(root.querySelector('.tb-label')?.textContent).toBe('A  B sam')
    handle.stop()
  })

  it('self in a page script is the page API', () => {
    const root = document.createElement('div')
    const book = makeBook({
      pageScript: `function pageEnter() { store.set('pg', self.name) }`,
    })
    const handle = runBook(book, root, 'desktop')
    expect(handle.store.get('pg')).toBe('Page 1')
    handle.stop()
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

  it('switches read/write checked via value and fire change events', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [
        { name: 'mode', control: 'switch', props: { text: 'Dark', checked: true }, on: {} },
        {
          name: 'btn',
          control: 'button',
          on: {
            click: "controls.mode.value = !controls.mode.value\nstore.set('isOn', controls.mode.value)",
          },
        },
      ],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    expect(handle.controls['mode']!.value).toBe(true)
    const box = root.querySelector('[data-tb-name="mode"] input') as HTMLInputElement
    expect(box.checked).toBe(true)
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(errors).toEqual([])
    expect(handle.store.get('isOn')).toBe(false)
    expect(box.checked).toBe(false)
    handle.stop()
    root.remove()
  })

  it('colours and fonts are scriptable (self.color assignments)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [
        { name: 'chip', control: 'card', props: { title: 'chip' }, on: {} },
        { name: 'btn', control: 'button', on: { click: "chip.color = 'green'\nchip.fontFamily = 'mono'" } },
      ],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    const cardEl = root.querySelector('[data-tb-name="chip"] .tb-card') as HTMLElement
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(errors).toEqual([])
    expect(cardEl.style.background).toBe('#22c55e')
    expect(cardEl.style.fontFamily).toContain('monospace')
    handle.stop()
    root.remove()
  })

  it('reports script errors through onError and keeps running', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [{ name: 'btn', control: 'button', on: { click: `throw new Error('boom')` } }],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    await new Promise((r) => setTimeout(r, 40))
    expect(errors[0]).toContain('boom')

    handle.stop()
    root.remove()
  })

  it('supports await in object event scripts', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = makeBook({
      objects: [
        {
          name: 'btn',
          control: 'button',
          on: { click: `await new Promise((r) => setTimeout(r, 20)); store.set('done', true)` },
        },
      ],
    })
    const handle = runBook(book, root, 'desktop')
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(handle.store.get('done')).toBeUndefined()
    await new Promise((r) => setTimeout(r, 80))
    expect(handle.store.get('done')).toBe(true)
    handle.stop()
    root.remove()
  })

  it('reports async errors from event scripts', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [
        {
          name: 'btn',
          control: 'button',
          on: { click: `await Promise.resolve(); throw new Error('async boom')` },
        },
      ],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    await new Promise((r) => setTimeout(r, 40))
    expect(errors[0]).toContain('async boom')
    handle.stop()
    root.remove()
  })

  it('reports async pageEnter errors', async () => {
    const root = document.createElement('div')
    const errors: string[] = []
    const book = makeBook({
      pageScript: `async function pageEnter() { throw new Error('enter failed') }`,
    })
    runBook(book, root, 'desktop', (m) => errors.push(m))
    await new Promise((r) => setTimeout(r, 40))
    expect(errors[0]).toContain('enter failed')
  })

  it('exposes bare object names in page and object scripts', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      pageScript: `function stamp() { btn.text = 'fred' }`,
      objects: [
        { name: 'btn', control: 'button', text: 'original', on: { click: `go.text = 'from object script'` } },
        { name: 'go', control: 'label', on: { click: `void 0` } },
      ],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))

    const btn = root.querySelector('button.tb-button')!
    btn.dispatchEvent(new MouseEvent('click'))
    expect(errors).toEqual([])
    expect(btn.textContent).toBe('original')
    expect(handle.controls['go']!.text).toBe('from object script')

    handle.stop()
    root.remove()
  })

  it('bare names work inside pageEnter and do not clobber page functions', () => {
    const root = document.createElement('div')
    const errors: string[] = []
    const book = makeBook({
      pageScript: `function pageEnter() { lbl.text = 'set by pageEnter' }`,
      objects: [{ name: 'lbl', control: 'label' }],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    expect(errors).toEqual([])
    expect(handle.controls['lbl']!.text).toBe('set by pageEnter')
    handle.stop()
  })

  it('reserved words and page-function names are not shadowed by short names', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      pageScript: `function pageEnter() { bump() }\nfunction bump() { store.set('bumped', true) }`,
      objects: [{ name: 'bump', control: 'label', text: 'collision test' }],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    expect(errors).toEqual([])
    expect(handle.store.get('bumped')).toBe(true)
    handle.stop()
    root.remove()
  })

  it("object scripts can use their own bare name", () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const book = makeBook({
      objects: [{ name: 'btn', control: 'button', text: 'orig', on: { click: `btn.text = 'self'` } }],
    })
    const handle = runBook(book, root, 'desktop', (m) => errors.push(m))
    root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
    expect(errors).toEqual([])
    expect(handle.controls['btn']!.text).toBe('self')
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

  describe('multi-page', () => {
    function makeTwoPageBook(): Book {
      return {
        id: 'book2',
        title: 'Quiz',
        canvas: { desktop: { width: 1280, height: 800 } },
        backgrounds: [BG],
        pages: [
          {
            id: 'p1',
            name: 'Quiz',
            script: `function pageLeave() { store.set('left1', true) }`,
            backgroundId: 'bg1',
            objects: [
              {
                ...createObject('button', 'answer', { desktop: { x: 0, y: 0, w: 100, h: 40 } }),
                on: { click: `store.set('from', 'quiz'); page.go('Results')` },
              },
            ],
          },
          {
            id: 'p2',
            name: 'Results',
            script: `function pageEnter() { store.set('entered2', true) }`,
            backgroundId: 'bg1',
            objects: [
              {
                ...createObject('label', 'scoreLabel', { desktop: { x: 0, y: 0, w: 200, h: 40 } }),
                props: { text: 'Score: {{score}}' },
              },
            ],
          },
        ],
      }
    }

    const tick = () => new Promise((r) => setTimeout(r, 20))

    it('page.go navigates: fires pageLeave/pageEnter, rebuilds controls and DOM, keeps store', async () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const errors: string[] = []
      const handle = runBook(makeTwoPageBook(), root, 'desktop', (m) => errors.push(m))

      expect(root.querySelector('button.tb-button')).not.toBeNull()
      expect(root.querySelector('.tb-label')).toBeNull()
      expect(handle.controls['answer']).toBeDefined()
      expect(handle.controls['scoreLabel']).toBeUndefined()

      root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
      await tick()

      expect(errors).toEqual([])
      expect(handle.store.get('from')).toBe('quiz')
      expect(handle.store.get('left1')).toBe(true)
      expect(handle.store.get('entered2')).toBe(true)
      expect(root.querySelector('button.tb-button')).toBeNull()
      expect(root.querySelector('.tb-label')?.textContent).toBe('Score: ')
      expect(handle.controls['answer']).toBeUndefined()
      expect(handle.controls['scoreLabel']).toBeDefined()

      handle.stop()
      root.remove()
    })

    it('page.go to an unknown name reports an error and stays put', async () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const errors: string[] = []
      const book = makeTwoPageBook()
      book.pages[0]!.objects[0]!.on['click'] = `page.go('Nope')`
      const handle = runBook(book, root, 'desktop', (m) => errors.push(m))

      root.querySelector('button.tb-button')!.dispatchEvent(new MouseEvent('click'))
      await tick()

      expect(errors[0]).toContain('no page named')
      expect(handle.store.get('entered2')).toBeUndefined()
      expect(root.querySelector('button.tb-button')).not.toBeNull()

      handle.stop()
      root.remove()
    })

    it('starts on the requested page', () => {
      const root = document.createElement('div')
      document.body.appendChild(root)
      const handle = runBook(makeTwoPageBook(), root, 'desktop', undefined, 1)
      expect(root.querySelector('.tb-label')).not.toBeNull()
      expect(root.querySelector('button.tb-button')).toBeNull()
      expect(handle.store.get('entered2')).toBe(true)
      handle.stop()
      root.remove()
    })
  })

  describe('rect properties', () => {
    function rectBook(on?: Record<string, string>): Book {
      const obj = createObject('label', 'box', { desktop: { x: 40, y: 60, w: 120, h: 80 } }, { text: 'box' })
      const book = makeBook({ objects: [] })
      book.pages[0]!.objects = [{ ...obj, on: on ?? {} }]
      return book
    }

    function wrapperOf(root: HTMLElement, name: string): HTMLElement {
      return root.querySelector(`[data-tb-name="${name}"]`) as HTMLElement
    }

    it('reads x/y/width/height from the object rect', () => {
      const book = rectBook()
      const root = document.createElement('div')
      const handle = runBook(book, root, 'desktop')
      const box = handle.controls['box']!
      expect(box.x).toBe(40)
      expect(box.y).toBe(60)
      expect(box.width).toBe(120)
      expect(box.height).toBe(80)
      handle.stop()
    })

    it('writes move/resize the object on screen and in the book data', () => {
      const book = rectBook()
      const root = document.createElement('div')
      const handle = runBook(book, root, 'desktop')
      const box = handle.controls['box']!
      box.x = 200
      box.y = 90
      box.width = 300
      box.height = 40

      const wrapper = wrapperOf(root, 'box')
      expect(wrapper.style.left).toBe('200px')
      expect(wrapper.style.top).toBe('90px')
      expect(wrapper.style.width).toBe('300px')
      expect(wrapper.style.height).toBe('40px')

      const stored = book.pages[0]!.objects[0]!.rects.desktop
      expect(stored).toEqual({ x: 200, y: 90, w: 300, h: 40 })
      handle.stop()
    })

    it('supports += and clamps size to a minimum of 1px', () => {
      const book = rectBook()
      const root = document.createElement('div')
      const handle = runBook(book, root, 'desktop')
      const box = handle.controls['box']!
      box.x += 10
      expect(box.x).toBe(50)
      box.width = 0
      expect(box.width).toBe(1)
      expect(wrapperOf(root, 'box').style.width).toBe('1px')
      handle.stop()
    })

    it('ignores non-finite values', () => {
      const book = rectBook()
      const root = document.createElement('div')
      const handle = runBook(book, root, 'desktop')
      const box = handle.controls['box']!
      box.x = Number.NaN
      box.y = 'abc' as unknown as number
      box.width = Number.POSITIVE_INFINITY
      expect(box.x).toBe(40)
      expect(box.y).toBe(60)
      expect(box.width).toBe(120)
      expect(wrapperOf(root, 'box').style.left).toBe('40px')
      handle.stop()
    })

    it('rect changes survive page navigation (re-render from book data)', async () => {
      const book = rectBook({ click: `box.x = 222; page.go('Page 1')` })
      const root = document.createElement('div')
      document.body.appendChild(root)
      const errors: string[] = []
      const handle = runBook(book, root, 'desktop', (m) => errors.push(m))

      ;(wrapperOf(root, 'box').firstElementChild as HTMLElement).dispatchEvent(new MouseEvent('click'))
      await new Promise((r) => setTimeout(r, 20))

      expect(errors).toEqual([])
      expect(handle.controls['box']!.x).toBe(222)
      expect(wrapperOf(root, 'box').style.left).toBe('222px')
      handle.stop()
      root.remove()
    })

    it('writing on a breakpoint without its own rect creates it, desktop stays untouched', () => {
      const book = rectBook()
      const root = document.createElement('div')
      const handle = runBook(book, root, 'tablet')
      handle.controls['box']!.x = 500

      const obj = book.pages[0]!.objects[0]!
      expect(obj.rects.desktop.x).toBe(40)
      expect(obj.rects.tablet).toEqual({ x: 500, y: 60, w: 120, h: 80 })
      handle.stop()
    })

    it('reads x/y on tablet from the tablet rect when present', () => {
      const obj = createObject('label', 'box', {
        desktop: { x: 40, y: 60, w: 120, h: 80 },
        tablet: { x: 10, y: 20, w: 90, h: 30 },
      })
      const book = makeBook({ objects: [] })
      book.pages[0]!.objects = [{ ...obj, on: {} }]
      const root = document.createElement('div')
      const handle = runBook(book, root, 'tablet')
      const box = handle.controls['box']!
      expect(box.x).toBe(10)
      expect(box.y).toBe(20)
      expect(box.width).toBe(90)
      box.x = 99
      expect(book.pages[0]!.objects[0]!.rects.tablet!.x).toBe(99)
      expect(book.pages[0]!.objects[0]!.rects.desktop.x).toBe(40)
      handle.stop()
    })
  })
})
