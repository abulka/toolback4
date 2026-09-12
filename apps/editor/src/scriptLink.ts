import { ref, type Ref } from 'vue'
import { kvGet, kvSet } from './persist'
import type { PickerHandle } from './files'

/**
 * Link a toolback script to a real `.ts` file on disk, so an external editor
 * (VS Code) can edit it and saves flow back into the book — and toolback
 * edits flow out to the file. Two-way, on a per-script handle.
 *
 * The linked file holds the **script itself** (plus a short comment header so
 * the round-trip marker stays obvious). We deliberately do NOT dump the whole
 * generated toolback API into it — that made a tiny script look like a
 * library export. Autocomplete is a built-in-editor feature; the linked file
 * is meant to be *your* code.
 *
 * Sync mechanics:
 * - editor change → debounced write to the file; `lastWritten` only becomes
 *   the new text AFTER the write has actually landed (never before)
 * - a short poll re-reads the file; content that differs from `lastWritten`
 *   means an external editor saved → pull it back through `onChange`
 * - echo-loop-safe: after a pull we take the pulled text as lastWritten too
 * - never pull while we have unsynced edits (`dirty`) or a write in flight:
 *   the on-disk file is legitimately behind during that window, so the poll
 *   must not mistake our own stale write for an external edit (that caused
 *   edits to be yanked out of the editor and reappear a second later)
 */

const SCRIPT_MARKER = '// ============= toolback script ============='
const HEADER_NOTE = `// toolback-linked script — edit me in VS Code (or in toolback) and save.
// Changes sync both ways. Plain JavaScript: no type annotations.
`

/** grace period after our own write: the OS may still serve stale bytes */
const POST_WRITE_GRACE_MS = 800

export type LinkPhase = 'unlinked' | 'linking' | 'linked' | 'error'

export interface ScriptLinkHandle {
  readonly phase: Ref<LinkPhase>
  readonly fileName: Ref<string>
  link(): Promise<void>
  unlink(): Promise<void>
  /** re-adopt a previously linked handle (survives reloads) */
  restore(): Promise<void>
  /** editor content changed — schedule the sync out */
  push(text: string): void
  dispose(): void
}

interface LinkState {
  handle: PickerHandle | null
  /** text we believe is CURRENTLY in the file — only bumped after a write lands */
  lastWritten: string
  /** an edit is waiting to be written out (debounce pending, write in flight) */
  dirty: boolean
  /** timestamp of the last completed write, for the grace window */
  lastWriteAt: number
  /** debounced write of the current editor text */
  timer: ReturnType<typeof setTimeout> | undefined
  poll: ReturnType<typeof setInterval> | undefined
}

function externalize(script: string): string {
  return `${HEADER_NOTE}${SCRIPT_MARKER}\n${script}\n`
}

/** strip the generated header and trailing newlines — the script body is
 *  everything after the marker, normalized the same way on write and read so
 *  toolback edits are never mistaken for external ones */
export function internalize(text: string): string {
  const i = text.indexOf(SCRIPT_MARKER)
  const body = i === -1 ? text : text.slice(i + SCRIPT_MARKER.length)
  return body.replace(/^\s*\n?/, '').replace(/\s+$/, '')
}

const TS_TYPES = {
  description: 'TypeScript / JavaScript',
  accept: { 'text/typescript': ['.ts', '.js', '.tsx', '.jsx', '.mjs'] },
} as const

export async function pickLinkedFile(suggestedName: string): Promise<PickerHandle | null> {
  if (typeof window.showSaveFilePicker !== 'function') {
    throw new Error(
      'Linking scripts to a file needs the File System Access API (Chrome/Edge). This browser does not support it.',
    )
  }
  try {
    const name = suggestedName.endsWith('.ts') ? suggestedName.replace(/\.ts$/, '.js') : suggestedName
    const handle = await window.showSaveFilePicker({
      suggestedName: name.endsWith('.js') ? name : `${name}.js`,
      types: [TS_TYPES as never],
    })
    return handle as PickerHandle
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
}

function persistKey(linkKey: string): string {
  return `link:${linkKey}`
}

export function makeScriptLink(
  linkKey: string,
  onChange: (text: string) => void,
  onNotice?: (message: string) => void,
): ScriptLinkHandle {
  const phase = ref<LinkPhase>('unlinked')
  const fileName = ref('')
  const st: LinkState = {
    handle: null,
    lastWritten: '',
    dirty: false,
    lastWriteAt: 0,
    timer: undefined,
    poll: undefined,
  }
  /** the latest editor text we've been asked to write (debounced) */
  let draft = ''
  /** serializes writes so a slow write can't interleave with the next one */
  let writeChain: Promise<void> = Promise.resolve()

  async function writeNow(text: string): Promise<void> {
    const h = st.handle
    if (!h) return
    const w = await h.createWritable()
    await w.write(text)
    await w.close()
    // the file really contains `text` now
    st.lastWritten = internalize(text)
    st.dirty = false
    st.lastWriteAt = Date.now()
  }

  async function flush(): Promise<void> {
    st.dirty = true
    writeChain = writeChain.then(
      () => {
        const target = draft
        if (!target || target === st.lastWritten) {
          // nothing to do this round
          st.dirty = false
          return
        }
        return writeNow(externalize(target)).catch((err) => {
          phase.value = 'error'
          console.error('[script-link] write failed', err)
          st.dirty = false
        })
      },
      (err) => {
        phase.value = 'error'
        console.error('[script-link] write chain failed', err)
        st.dirty = false
      },
    )
    await writeChain
  }

  /** the linked file has disappeared from disk (deleted/moved) — warn + unlink */
  function fileVanished(): void {
    const name = fileName.value || 'the linked file'
    if (st.poll) clearInterval(st.poll)
    st.poll = undefined
    if (st.timer) clearTimeout(st.timer)
    st.timer = undefined
    st.handle = null
    st.lastWritten = ''
    st.dirty = false
    fileName.value = ''
    phase.value = 'unlinked'
    void kvSet(persistKey(linkKey), null).catch(() => undefined)
    onNotice?.(`${name} disappeared from disk — unlinked. If it was moved, re-link to the new location.`)
  }

  /** true when a File System Access op fails because the file no longer exists.
 *  Real browsers throw a DOMException whose `name` is "NotFoundError"; some
 *  environments surface it as a plain Error with the name, so accept both. */
  function isGone(err: unknown): boolean {
    const name =
      err instanceof DOMException || (err instanceof Error && typeof err === 'object')
        ? (err as { name?: string }).name
        : undefined
    return name === 'NotFoundError'
  }

  async function pull(): Promise<void> {
    const h = st.handle
    if (!h) return
    // while we have edits queued/in flight, the file is legitimately behind —
    // pulling now would mistake our own stale write for an external edit
    if (st.dirty) return
    // and the OS may still serve the pre-write bytes right after our write
    if (Date.now() - st.lastWriteAt < POST_WRITE_GRACE_MS) return
    try {
      const file = await h.getFile()
      const text = await file.text()
      const body = internalize(text)
      if (body === st.lastWritten) return // no external change
      st.lastWritten = body
      st.dirty = false
      onChange(body)
    } catch (err) {
      if (isGone(err)) {
        fileVanished()
        return
      }
      phase.value = 'error'
      console.error('[script-link] read failed', err)
    }
  }

  return {
    phase,
    fileName,

    async link() {
      if (phase.value === 'linking') return
      phase.value = 'linking'
      try {
        const handle = await pickLinkedFile(linkKey.replace(/[^A-Za-z0-9_-]+/g, '-'))
        if (!handle) {
          phase.value = 'unlinked'
          return
        }
        st.handle = handle
        st.lastWritten = ''
        st.dirty = false
        draft = ''
        const file = await handle.getFile()
        fileName.value = file.name
        void kvSet(persistKey(linkKey), handle).catch(() => undefined)
        // Adopt an existing script already on disk ONLY when it isn't empty —
        // a freshly-picked file is a blank slate, and the editor's own content
        // is the source of truth (`push` seeds the file from it right after).
        // This is what keeps "⇄ file" from ever producing a blank editor or a
        // clobbered script when the target file starts empty.
        const existing = internalize(await file.text())
        if (existing.trim()) {
          st.lastWritten = existing
          onChange(existing)
        }
        if (!st.poll) st.poll = setInterval(() => void pull(), 1200)
        phase.value = 'linked'
      } catch (err) {
        phase.value = 'error'
        console.error('[script-link] link failed', err)
      }
    },

    async unlink() {
      if (st.poll) clearInterval(st.poll)
      st.poll = undefined
      if (st.timer) clearTimeout(st.timer)
      st.timer = undefined
      st.handle = null
      st.lastWritten = ''
      st.dirty = false
      fileName.value = ''
      phase.value = 'unlinked'
      void kvSet(persistKey(linkKey), null).catch(() => undefined)
    },

    async restore() {
      const saved = await kvGet<PickerHandle | null>(persistKey(linkKey))
      if (!saved) return
      try {
        st.handle = saved
        const file = await saved.getFile()
        fileName.value = file.name
        const text = await file.text()
        st.lastWritten = internalize(text)
        st.dirty = false
        draft = st.lastWritten
        // only push an existing file's content into the editor when the file
        // actually has content — an empty linked file must never blank out a
        // script that's already in the editor
        if (st.lastWritten.trim()) onChange(st.lastWritten)
        if (!st.poll) st.poll = setInterval(() => void pull(), 1200)
        phase.value = 'linked'
      } catch (err) {
        if (isGone(err)) {
          // the file was deleted/moved since the link was created — say so
          fileVanished()
          return
        }
        // Expected after a page reload: the browser only re-grants File System
        // Access permission after a fresh user gesture, so a setUp link can't be
        // re-verified programmatically. Drop it quietly — the button falls back
        // to "⇄ file" and one click re-links (and re-prompts for permission).
        if (!(err instanceof DOMException && err.name === 'NotAllowedError')) {
          console.warn('[script-link] restore failed', err)
        }
        st.handle = null
        phase.value = 'unlinked'
      }
    },

    push(text) {
      const h = st.handle
      if (!h || phase.value !== 'linked') return
      // normalize exactly like reads (`internalize`), so a trailing newline or
      // whitespace in the editor can never read back as "different from the file"
      draft = internalize(text)
      if (draft === st.lastWritten && !st.dirty) return
      st.dirty = true
      if (st.timer) clearTimeout(st.timer)
      st.timer = setTimeout(() => {
        st.timer = undefined
        void flush()
      }, 350)
    },

    dispose() {
      if (st.poll) clearInterval(st.poll)
      st.poll = undefined
      if (st.timer) clearTimeout(st.timer)
      st.timer = undefined
      st.handle = null
    },
  }
}