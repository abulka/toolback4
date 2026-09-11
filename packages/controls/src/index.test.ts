import { describe, expect, it } from 'vitest'
import { createObject } from '@toolback/format'
import {
  registerControls,
  renderButton,
  renderCard,
  renderContainer,
  renderImage,
  renderInput,
  renderLabel,
  renderObject,
  renderSwitch,
} from './index'

registerControls()

describe('controls', () => {
  it('renders a button with its text prop', () => {
    const obj = createObject('button', 'b1', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'Go' })
    expect(renderButton(obj).textContent).toBe('Go')
  })

  it('renders an input with a placeholder', () => {
    const obj = createObject('input', 'i1', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { placeholder: 'Email…' })
    const el = renderInput(obj) as HTMLInputElement
    expect(el.tagName).toBe('INPUT')
    expect(el.placeholder).toBe('Email…')
  })

  it('renders an image placeholder when no src, an img when src set', () => {
    const empty = createObject('image', 'img1', { desktop: { x: 0, y: 0, w: 100, h: 100 } })
    expect(renderImage(empty).className).toBe('tb-image-empty')

    const withSrc = createObject('image', 'img2', { desktop: { x: 0, y: 0, w: 100, h: 100 } }, { src: 'https://example.com/x.png', alt: 'X' })
    const img = renderImage(withSrc) as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.src).toBe('https://example.com/x.png')
  })

  it('renders a card with title and body', () => {
    const obj = createObject('card', 'c1', { desktop: { x: 0, y: 0, w: 100, h: 100 } }, { title: 'Hi', text: 'Body text' })
    const el = renderCard(obj)
    expect(el.querySelector('.tb-card-title')?.textContent).toBe('Hi')
    expect(el.querySelector('.tb-card-body')?.textContent).toBe('Body text')
  })

  it('renders a container', () => {
    const obj = createObject('container', 'ct1', { desktop: { x: 0, y: 0, w: 100, h: 100 } })
    expect(renderContainer(obj).className).toBe('tb-container')
  })

  it('renders a switch with a checkbox, label text and checked state', () => {
    const off = createObject('switch', 's1', { desktop: { x: 0, y: 0, w: 160, h: 40 } }, { text: 'Dark mode' })
    const offEl = renderSwitch(off)
    expect(offEl.className).toBe('tb-switch')
    expect(offEl.querySelector('.tb-switch-text')?.textContent).toBe('Dark mode')
    expect((offEl.querySelector('input') as HTMLInputElement).checked).toBe(false)

    const on = createObject('switch', 's2', { desktop: { x: 0, y: 0, w: 160, h: 40 } }, { checked: true })
    const onEl = renderSwitch(on)
    expect(onEl.classList.contains('tb-switch-on')).toBe(true)
  })

  it('applies colour (names and hex) and font props', () => {
    const red = createObject('label', 'l1', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'A', color: 'red' })
    expect((renderLabel(red) as HTMLElement).style.color).toBe('#ef4444')

    const hex = createObject('button', 'b1', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'B', color: '#123ABC' })
    const btn = renderButton(hex) as HTMLElement
    expect(['#123abc', 'rgb(18, 58, 172)']).toContain(btn.style.background)
    expect(btn.className).toContain('tb-colored')

    const serif = createObject('label', 'l2', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { text: 'C', fontFamily: 'serif' })
    expect(renderLabel(serif).style.fontFamily).toContain('Georgia')

    const unknown = createObject('label', 'l3', { desktop: { x: 0, y: 0, w: 100, h: 40 } }, { color: 'mauve' })
    expect(renderLabel(unknown).style.color).toBe('') // unknown names keep the default
  })

  it('applies fontSize/fontFamily to card title+body and switch text', () => {
    const c = createObject('card', 'c1', { desktop: { x: 0, y: 0, w: 200, h: 120 } }, { title: 'T', fontSize: 14 })
    const cardEl = renderCard(c)
    expect(cardEl.querySelector<HTMLElement>('.tb-card-body')!.style.fontSize).toBe('14px')
    expect(cardEl.querySelector<HTMLElement>('.tb-card-title')!.style.fontSize).toBe('16px')

    const sw = createObject('switch', 's1', { desktop: { x: 0, y: 0, w: 160, h: 40 } }, { text: 'M', fontFamily: 'mono', fontSize: 18 })
    const swEl = renderSwitch(sw)
    const span = swEl.querySelector<HTMLElement>('.tb-switch-text')!
    expect(span.style.fontFamily).toContain('monospace')
    expect(span.style.fontSize).toBe('18px')
  })

  it('registry covers all seven kinds', () => {
    for (const kind of ['button', 'label', 'input', 'image', 'card', 'container', 'switch'] as const) {
      const obj = createObject(kind, 'x', { desktop: { x: 0, y: 0, w: 100, h: 100 } })
      expect(() => renderObject(obj)).not.toThrow()
      expect(renderObject(obj).className).not.toBe('tb-missing')
    }
  })
})
