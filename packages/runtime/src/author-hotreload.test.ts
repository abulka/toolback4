import { describe, expect, it } from 'vitest'
import type { Book } from '@toolback/format'
import { createObject } from '@toolback/format'
import { listenForEditor, type AuthorReplyMessage } from './editorLink'
import { stopAuthor } from './author'

const tick = () => new Promise((r) => setTimeout(r, 20))

/** the guide's Random colour recipe, verbatim */
const GUIDE_RECIPE = `const objs = await author.selected()
if (!objs.length) {
  await author.message('Select an object first, then press me')
} else {
  const colors = ['red', 'orange', 'gold', 'green', 'teal', 'navy', 'indigo', 'purple']
  const c = colors[Math.floor(Math.random() * colors.length)]
  for (const o of objs) await o.set({ color: c })
  await author.message('Coloured ' + objs.length + ' object(s) ' + c)
}`

describe('repro: c is not defined', () => {
  it('guide recipe verbatim on button1', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    const calls: string[] = []
    const book: Book = {
      id: 'b', title: 'T', canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [{ id: 'bg1', name: 'M', color: '#fff', script: '', objects: [] }],
      pages: [
        { id: 'p1', name: 'C', script: '', backgroundId: 'bg1', objects: [createObject('label', 'target', { desktop: { x: 0, y: 0, w: 50, h: 20 } })] },
        {
          id: 'p2', name: 'MyPlugin', script: '', backgroundId: 'bg1',
          objects: [
            { ...createObject('button', 'button1', { desktop: { x: 8, y: 8, w: 120, h: 36 } }), on: { click: GUIDE_RECIPE } },
            { ...createObject('label', 'pluginLabel', { desktop: { x: 8, y: 80, w: 220, h: 30 } }), props: { text: 'note={{lastNote}}' } },
          ],
        },
      ],
    }
    const snapshots: Record<string, Record<string, unknown>> = {
      x1: { id: 'x1', name: 'target', control: 'label', x: 0, y: 0, width: 50, height: 20 },
    }
    const cleanup = listenForEditor(root, (m) => {
      const msg = m as { type: string; id?: number; op?: string; args?: unknown }
      if (msg.type === 'toolback:authorCall') {
        calls.push(msg.op!)
        let reply: AuthorReplyMessage
        if (msg.op === 'getSelection') {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { ids: ['x1'], names: ['target'], kinds: ['label'], target: 'page' } }
        } else if (msg.op === 'updateProps') {
          const [id, patch] = msg.args as [string, Record<string, unknown>]
          Object.assign(snapshots[id], patch)
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { id } }
        } else if (msg.op === 'message') {
          ;(window as unknown as { __note?: string }).__note = String((msg.args as unknown[])[0])
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { ok: true } }
        } else {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: {} }
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
      const btn = root.querySelector('.tb-author [data-tb-name="button1"] button') as HTMLElement
      btn.click()
      await tick()
      await tick()
      console.log('CALLS:', JSON.stringify(calls))
      console.log('ERRORS:', JSON.stringify(errors))
      console.log('SNAPSHOT:', JSON.stringify(snapshots['x1']))
      expect(errors).toEqual([])
      expect(snapshots['x1']['color']).toBeTruthy()
    } finally {
      cleanup()
      stopAuthor()
      root.remove()
    }
  })

  it('recovery: the broken snippet handed to the user in chat errors, then hot-reload picks up the corrected recipe', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const errors: string[] = []
    // NOT a user draft: this is the exact two-line "Random colour" snippet the
    // previous session's closing summary gave the user — it dropped the
    // colors/const c lines, so `c` is undefined and the ReferenceError is the
    // correct evaluation of it
    const draftScript = `const objs = await author.selected()
for (const o of objs) await o.set({ color: c })`
    const book: Book = {
      id: 'b', title: 'T', canvas: { desktop: { width: 800, height: 600 } },
      backgrounds: [{ id: 'bg1', name: 'M', color: '#fff', script: '', objects: [] }],
      pages: [
        { id: 'p1', name: 'C', script: '', backgroundId: 'bg1', objects: [createObject('label', 'target', { desktop: { x: 0, y: 0, w: 50, h: 20 } })] },
        {
          id: 'p2', name: 'MyPlugin', script: '', backgroundId: 'bg1',
          objects: [
            { ...createObject('button', 'button1', { desktop: { x: 8, y: 8, w: 120, h: 36 } }), on: { click: draftScript } },
          ],
        },
      ],
    }
    const snapshots: Record<string, Record<string, unknown>> = {
      x1: { id: 'x1', name: 'target', control: 'label', x: 0, y: 0, width: 50, height: 20 },
    }
    const cleanup = listenForEditor(root, (m) => {
      const msg = m as { type: string; id?: number; op?: string; args?: unknown }
      if (msg.type === 'toolback:scriptError') {
        errors.push(String((msg as unknown as { message: string }).message))
        return
      }
      if (msg.type === 'toolback:authorCall') {
        let reply: AuthorReplyMessage
        if (msg.op === 'getSelection') {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { ids: ['x1'], names: ['target'], kinds: ['label'], target: 'page' } }
        } else if (msg.op === 'updateProps') {
          const [id, patch] = msg.args as [string, Record<string, unknown>]
          Object.assign(snapshots[id], patch)
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: { id } }
        } else {
          reply = { type: 'toolback:authorReply', id: msg.id!, ok: true, result: {} }
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
      const btn = () => root.querySelector('.tb-author [data-tb-name="button1"] button') as HTMLElement

      // click with the broken draft → the reported error
      btn().click()
      await tick()
      expect(errors.some((e) => e.includes('c is not defined'))).toBe(true)

      // the user fixes the script in the editor; the editor syncs the book…
      const fixedBook: Book = JSON.parse(JSON.stringify(book))
      fixedBook.pages[1]!.objects[0]!.on = { click: GUIDE_RECIPE }
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'toolback:load', book: fixedBook, design: true } }),
      )
      await tick()

      // …and after the fix the click runs the NEW script: colour applied
      btn().click()
      await tick()
      await tick()
      expect(snapshots['x1']['color']).toBeTruthy()
      // the box was restarted, so pageEnter re-ran and the store reset —
      // but no stale error on this click
      const staleAfterFix = errors.filter(
        (e, i) => i > 0 && e.includes('c is not defined'),
      )
      expect(staleAfterFix).toEqual([])
    } finally {
      cleanup()
      stopAuthor()
      root.remove()
    }
  })
})
