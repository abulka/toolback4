import { describe, expect, it } from 'vitest'
import { detectIntent } from './aiIntent'

describe('detectIntent', () => {
  it('treats adding an element to the page as a strict page edit', () => {
    expect(detectIntent('add one more even bigger button to the page which does the same thing')).toEqual({
      mode: 'modify',
      keepExisting: true,
    })
    expect(detectIntent('insert another label')).toEqual({ mode: 'modify', keepExisting: true })
    expect(detectIntent('duplicate the All button')).toEqual({ mode: 'modify', keepExisting: true })
  })

  it('treats adding a page as append', () => {
    expect(detectIntent('add a new page for settings')).toEqual({ mode: 'append', keepExisting: false })
    expect(detectIntent('create another screen')).toEqual({ mode: 'append', keepExisting: false })
  })

  it('treats modifications as a free page edit', () => {
    expect(detectIntent('change all the buttons to red')).toEqual({
      mode: 'modify',
      keepExisting: false,
    })
    expect(detectIntent('make the title bigger')).toBeNull()
  })

  it('has no opinion on plain build requests', () => {
    expect(detectIntent('build a working calculator')).toBeNull()
    expect(detectIntent('')).toBeNull()
  })
})
