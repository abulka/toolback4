import { describe, expect, it } from 'vitest'
import { createObject } from '@toolback/format'
import {
  applyContent,
  contentKeyFor,
  registerControls,
  renderButton,
  renderCard,
  renderContainer,
  renderHtml,
  renderImage,
  renderInput,
  renderLabel,
  renderMarkdown,
  renderObject,
  renderSwitch,
} from './index'

registerControls()

describe('controls', () => {
  it('renders a button with its text prop', () => {
    const obj = createObject('button', 'b1', { x: 0, y: 0, w: 100, h: 40 }, { text: 'Go' })
    expect(renderButton(obj).textContent).toBe('Go')
  })

  it('renders an input with a placeholder', () => {
    const obj = createObject('input', 'i1', { x: 0, y: 0, w: 100, h: 40 }, { placeholder: 'Email…' })
    const el = renderInput(obj) as HTMLInputElement
    expect(el.tagName).toBe('INPUT')
    expect(el.placeholder).toBe('Email…')
  })

  it('renders an image placeholder when no src, an img when src set', () => {
    const empty = createObject('image', 'img1', { x: 0, y: 0, w: 100, h: 100 })
    expect(renderImage(empty).className).toBe('tb-image-empty')

    const withSrc = createObject('image', 'img2', { x: 0, y: 0, w: 100, h: 100 }, { src: 'https://example.com/x.png', alt: 'X' })
    const img = renderImage(withSrc) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.src).toBe('https://example.com/x.png')
  })

  it('renders a card with title and body', () => {
    const obj = createObject('card', 'c1', { x: 0, y: 0, w: 100, h: 100 }, { title: 'Hi', text: 'Body text' })
    const el = renderCard(obj)
    expect(el.querySelector('.tb-card-title')?.textContent).toBe('Hi')
    expect(el.querySelector('.tb-card-body')?.textContent).toBe('Body text')
  })

  it('renders a container', () => {
    const obj = createObject('container', 'ct1', { x: 0, y: 0, w: 100, h: 100 })
    expect(renderContainer(obj).className).toBe('tb-container')
  })

  it('renders a switch with a checkbox, label text and checked state', () => {
    const off = createObject('switch', 's1', { x: 0, y: 0, w: 160, h: 40 }, { text: 'Dark mode' })
    const offEl = renderSwitch(off)
    expect(offEl.className).toBe('tb-switch')
    expect(offEl.querySelector('.tb-switch-text')?.textContent).toBe('Dark mode')
    expect((offEl.querySelector('input') as HTMLInputElement).checked).toBe(false)

    const on = createObject('switch', 's2', { x: 0, y: 0, w: 160, h: 40 }, { checked: true })
    const onEl = renderSwitch(on)
    expect(onEl.classList.contains('tb-switch-on')).toBe(true)
  })

  it('applies colour (names and hex) and font props', () => {
    const red = createObject('label', 'l1', { x: 0, y: 0, w: 100, h: 40 }, { text: 'A', color: 'red' })
    expect((renderLabel(red) as HTMLElement).style.color).toBe('#ef4444')

    const hex = createObject('button', 'b1', { x: 0, y: 0, w: 100, h: 40 }, { text: 'B', color: '#123ABC' })
    const btn = renderButton(hex) as HTMLElement
    expect(['#123abc', 'rgb(18, 58, 172)']).toContain(btn.style.background)
    expect(btn.className).toContain('tb-colored')

    const serif = createObject('label', 'l2', { x: 0, y: 0, w: 100, h: 40 }, { text: 'C', fontFamily: 'serif' })
    expect(renderLabel(serif).style.fontFamily).toContain('Georgia')

    const unknown = createObject('label', 'l3', { x: 0, y: 0, w: 100, h: 40 }, { color: 'mauve' })
    expect(renderLabel(unknown).style.color).toBe('') // unknown names keep the default
  })

  it('applies fontSize/fontFamily to card title+body and switch text', () => {
    const c = createObject('card', 'c1', { x: 0, y: 0, w: 200, h: 120 }, { title: 'T', fontSize: 14 })
    const cardEl = renderCard(c)
    expect(cardEl.querySelector<HTMLElement>('.tb-card-body')!.style.fontSize).toBe('14px')
    expect(cardEl.querySelector<HTMLElement>('.tb-card-title')!.style.fontSize).toBe('16px')

    const sw = createObject('switch', 's1', { x: 0, y: 0, w: 160, h: 40 }, { text: 'M', fontFamily: 'mono', fontSize: 18 })
    const swEl = renderSwitch(sw)
    const span = swEl.querySelector<HTMLElement>('.tb-switch-text')!
    expect(span.style.fontFamily).toContain('monospace')
    expect(span.style.fontSize).toBe('18px')
  })

  it('registry covers every control kind', () => {
    for (const kind of [
      'button',
      'label',
      'input',
      'image',
      'card',
      'container',
      'switch',
      'markdown',
      'html',
    ] as const) {
      const obj = createObject(kind, 'x', { x: 0, y: 0, w: 100, h: 100 })
      expect(() => renderObject(obj)).not.toThrow()
      expect(renderObject(obj).className).not.toBe('tb-missing')
    }
  })

  it('renders markdown to styled HTML and an empty state', () => {
    const obj = createObject('markdown', 'md1', { x: 0, y: 0, w: 300, h: 200 }, {
      text: '# Title\n\n- one\n- two\n\n`code`',
    })
    const el = renderMarkdown(obj)
    expect(el.className).toBe('tb-markdown')
    expect(el.querySelector('h1')?.textContent).toBe('Title')
    expect(el.querySelectorAll('li')).toHaveLength(2)
    expect(el.querySelector('code')?.textContent).toBe('code')

    const empty = renderMarkdown(createObject('markdown', 'md2', { x: 0, y: 0, w: 100, h: 100 }))
    expect(empty.classList.contains('tb-viewer-empty')).toBe(true)
  })

  it('renders HTML as innerHTML and an empty state', () => {
    const obj = createObject('html', 'h1', { x: 0, y: 0, w: 300, h: 200 }, {
      html: '<p class="hi">Hello <strong>there</strong></p>',
    })
    const el = renderHtml(obj)
    expect(el.className).toBe('tb-html')
    expect(el.querySelector('strong')?.textContent).toBe('there')

    const empty = renderHtml(createObject('html', 'h2', { x: 0, y: 0, w: 100, h: 100 }))
    expect(empty.classList.contains('tb-viewer-empty')).toBe(true)
  })

  it('contentKeyFor maps templatable controls, applyContent targets the right node', () => {
    expect(contentKeyFor('button')).toBe('text')
    expect(contentKeyFor('card')).toBe('text')
    expect(contentKeyFor('markdown')).toBe('text')
    expect(contentKeyFor('html')).toBe('html')
    expect(contentKeyFor('image')).toBeNull()

    // card body updates without touching the title
    const card = renderCard(createObject('card', 'c1', { x: 0, y: 0, w: 100, h: 100 }, { title: 'T', text: 'B' }))
    applyContent(card, 'card', 'new body')
    expect(card.querySelector('.tb-card-title')?.textContent).toBe('T')
    expect(card.querySelector('.tb-card-body')?.textContent).toBe('new body')

    // switch label updates without wiping its checkbox/track
    const sw = renderSwitch(createObject('switch', 's1', { x: 0, y: 0, w: 160, h: 40 }, { text: 'Old' }))
    applyContent(sw, 'switch', 'New')
    expect(sw.querySelector('.tb-switch-text')?.textContent).toBe('New')
    expect(sw.querySelector('input')).toBeTruthy()
    expect(sw.querySelector('.tb-switch-track')).toBeTruthy()
  })
})
