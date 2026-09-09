import { describe, expect, it } from 'vitest'
import { createObject } from '@toolback/format'
import {
  registerControls,
  renderButton,
  renderCard,
  renderContainer,
  renderImage,
  renderInput,
  renderObject,
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

  it('registry covers all six kinds', () => {
    for (const kind of ['button', 'label', 'input', 'image', 'card', 'container'] as const) {
      const obj = createObject(kind, 'x', { desktop: { x: 0, y: 0, w: 100, h: 100 } })
      expect(() => renderObject(obj)).not.toThrow()
      expect(renderObject(obj).className).not.toBe('tb-missing')
    }
  })
})
