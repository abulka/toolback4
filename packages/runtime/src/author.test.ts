import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { listenForEditor, type AuthorReplyMessage } from './editorLink'
import { stopAuthor } from './author'

/**
 * Author-mode (M6c) integration: a plugin page runs in a floating box while
 * the book stays in design mode; its scripts reach the editor through the
 * author bridge (toolback:authorCall / toolback:authorReply).
 */

function pluginBook(pluginScript = '', buttonScript = ''): Book {
  return {
    id: 'b',
    title: 'T',
    canvas: { desktop: { width: 800, height: 600 } },
    backgrounds: [{ id: 'bg1', name: 'Main', color: '#ffffff', script: '', objects: [] }],
    pages: [
      {
        id: 'p1',
        name: 'Content',
        script: '',
        backgroundId: 'bg1',
        objects: [createObject('label', 'contentLabel', { x: 0, y: 0, w: 100, h: 30 })],
      },
      {
        id: 'p2',
        name: 'MyPlugin',
        author: true,
        script: pluginScript,
        backgroundId: 'bg1',
        objects: [
          {
            ...createObject('button', 'pluginBtn', { x: 8, y: 8, w: 100, h: 32 }, { text: 'Stamp' }),
            on: { click: buttonScript },
          },
          { ...createObject('label', 'pluginLabel', { x: 8, y: 80, w: 200, h: 30 }), props: { text: 'plugin ui' } },
        ],
      },
    ],
  }
}

const tick = () => new Promise((r) => setTimeout(r, 20))

describe('author mode (M6c)', () => {
  it('authorStart renders the plugin box with the page live; load/authorStop tear it down', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const sent: Array<{ type: string } & Record<string, unknown>> = []
    const cleanup = listenForEditor(root, (m) => sent.push(m as never))
    try {
      // design load first (the editor is always in design mode)
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book: pluginBook(), design: true },
        }),
      )
      expect(root.querySelector('.tb-page')).not.toBeNull()

      // start the plugin
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:authorStart', book: pluginBook(), pageIndex: 1, breakpoint: 'desktop' },
        }),
      )
      await tick()
      const layer = root.querySelector('.tb-author-layer')!
      expect(layer).not.toBeNull()
      expect(layer.querySelector('.tb-popup-chrome')?.textContent).toContain('Author · MyPlugin')
      // the plugin page's own objects render inside the box
      expect(layer.querySelector('[data-tb-name="pluginBtn"]')).not.toBeNull()
      // the base page is untouched (still editable underneath)
      expect(root.querySelector('.tb-page-holder .tb-page [data-tb-name="contentLabel"]')).not.toBeNull()
      // editor learns the state
      expect(sent.filter((m) => m.type === 'toolback:authorState').some((m) => m.active === true && m.pageName === 'MyPlugin')).toBe(true)

      // a design re-render (e.g. undo/prop edit) must keep the plugin alive
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:load', book: pluginBook(), design: true },
        }),
      )
      await tick()
      expect(root.querySelector('.tb-author-layer')).not.toBeNull()

      // authorStop tears it down
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'toolback:authorStop' } }))
      await tick()
      expect(root.querySelector('.tb-author-layer')).toBeNull()
      expect(sent.filter((m) => m.type === 'toolback:authorState').some((m) => m.active === false)).toBe(true)
    } finally {
      cleanup()
      stopAuthor()
      root.remove()
    }
  })

  it('plugin scripts reach the editor through the bridge: handles materialise and work', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    // the plugin button does the canonical flow: handles → set → move → get
    const btnScript = [
      'const objs = await author.selected()',
      'store.set("count", objs.length)',
      'store.set("firstName", objs[0]?.name ?? "none")',
      'if (!objs.length) return',
      'await objs[0].set({ color: "navy", x: 88 })',
      'await objs[0].move(20, 0)',
      'const x = await objs[0].get("x")',
      'store.set("finalX", String(x))',
    ].join('\n')
    const book = pluginBook('', btnScript)
    // the plugin label binds the session store: n={{count}} first={{firstName}} x={{finalX}}
    const label = book.pages[1]!.objects[1]!
    label.props = { text: 'n={{count}} first={{firstName}} x={{finalX}}' }
    // a minimal fake editor: owns the "selection" the plugin reads and
    // accepts the insert like the real bridge would
    const snapshots: Record<string, Record<string, unknown>> = {
      x1: { id: 'x1', name: 'labelA', control: 'label', x: 88, y: 10, width: 100, height: 40, color: 'navy' },
    }
    const cleanup = listenForEditor(root, (m) => {
      const msg = m as { type: string; id?: number; op?: string; args?: unknown }
      if (msg.type === 'toolback:authorCall') {
        let reply: AuthorReplyMessage
        if (msg.op === 'getSelection') {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { ids: ['x1'], names: ['labelA'], kinds: ['label'], target: 'page' } }
        } else if (msg.op === 'getObject') {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: snapshots['x1'] }
        } else if (msg.op === 'updateProps') {
          const [id, patch] = msg.args as [string, Record<string, unknown>]
          const snap = snapshots[id]
          if (patch['color'] !== undefined) snap['color'] = patch['color']
          if (patch['x'] !== undefined) snap['x'] = patch['x']
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { id } }
        } else if (msg.op === 'moveObject') {
          const [id, dx] = msg.args as [string, number]
          snapshots[id]['x'] = (snapshots[id]['x'] as number) + dx
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { id } }
        } else {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: false, error: 'unsupported in test' }
        }
        window.dispatchEvent(new MessageEvent('message', { data: reply }))
      }
    })
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:authorStart', book, pageIndex: 1, breakpoint: 'desktop' },
        }),
      )
      await tick()
      // click the plugin button
      const btn = root.querySelector('.tb-author [data-tb-name="pluginBtn"] button') as HTMLElement
      btn.click()
      await tick()
      await tick()
      // the dynamic label reflects the store writes made through the handles
      const rows = [...root.querySelectorAll('.tb-author .tb-label')].map((el) => el.textContent)
      expect(rows.join(' | ')).toContain('n=1 first=labelA x=108')
    } finally {
      cleanup()
      stopAuthor()
      root.remove()
    }
  })

  it('the plugin session store starts from the book design-time store', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const book = pluginBook()
    book.store = [['seed', 'fromDesign']]
    // the plugin label binds the seeded key
    book.pages[1]!.objects[1]!.props = { text: 'seed={{seed}}' }
    const cleanup = listenForEditor(root, () => {})
    try {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'toolback:authorStart', book, pageIndex: 1, breakpoint: 'desktop' },
        }),
      )
      await tick()
      const labels = [...root.querySelectorAll('.tb-author .tb-label')].map((el) => el.textContent)
      expect(labels.join(' | ')).toContain('seed=fromDesign')
    } finally {
      cleanup()
      stopAuthor()
      root.remove()
    }
  })
})
