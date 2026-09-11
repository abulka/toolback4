import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { renderBookPage } from './index'
import { startAuthorMode, stopAuthor, authorActive } from './author'

describe('author smoke', () => {
  it('opens the box, renders the plugin page, click handler fires', async () => {
    document.body.innerHTML = ''
    const holder = document.createElement('div')
    document.body.appendChild(holder)
    const book: Book = {
      id: 'b', title: 'T', canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [{ id: 'bg1', name: 'Main', color: '#fff', script: '', objects: [] }],
      pages: [
        { id: 'p1', name: 'Stage', script: '', backgroundId: 'bg1', objects: [] },
        {
          id: 'p2', name: 'MyPlugin', script: 'let booted = false', backgroundId: 'bg1',
          objects: [
            { ...createObject('button', 'pluginBtn', { desktop: { x: 8, y: 8, w: 120, h: 36 } }),
              on: { click: 'window.__clicked = true' } },
          ],
        },
      ],
    }
    const handle = startAuthorMode(book, 1, holder, 'desktop')
    expect(authorActive()).toBe(true)
    // the layer mounts next to the holder (holder.parentElement), not inside it
    const btn = document.body.querySelector('.tb-author [data-tb-name="pluginBtn"] button') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()
    expect((window as unknown as { __clicked?: boolean }).__clicked).toBe(true)
    handle.stop()
    expect(authorActive()).toBe(false)
  })
})
