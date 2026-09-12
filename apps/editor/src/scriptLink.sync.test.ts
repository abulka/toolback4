import { afterEach, describe, expect, it, vi } from 'vitest'
import { internalize, makeScriptLink } from './scriptLink'

/**
 * A fake File System Access handle: the file is a plain string we control,
 * so we can simulate an external editor (VS Code) rewriting the file.
 */
function fakeHandle(initialText: string) {
  let text = initialText
  let gone = false
  return {
    fileContents: () => text,
    // simulate deleting the file from disk (or moving it away)
    removeFromDisk: () => {
      gone = true
    },
    // simulate VS Code saving new content to disk
    writeExternally: (next: string) => {
      text = next
    },
    getFile: () =>
      gone
        ? Promise.reject(createDomException('A requested file or directory could not be found', 'NotFoundError'))
        : Promise.resolve({ text: () => Promise.resolve(text) }) as unknown as Promise<File>,
    createWritable: () =>
      gone
        ? Promise.reject(createDomException('nope', 'NotFoundError'))
        : Promise.resolve({
            write: async (data: unknown) => {
              text = String(data)
            },
            close: async () => undefined,
          }) as unknown as Promise<
            { write(data: unknown): Promise<void>; close(): Promise<void> }
          >,
  }
}

function createDomException(message: string, name: string): DOMException {
  // happy-dom exposes DOMException? Prefer it; else fabricate a compatible one.
  try {
    // some environments define DOMException but reject `new DOMException(msg, name)`
    if (typeof DOMException === 'function') return new DOMException(message, name)
  } catch {
    /* fall through */
  }
  return { name, message } as DOMException
}

/** a handle whose write can be stalled, so we can test in-flight races */
function gatedHandle(initialText: string) {
  let text = initialText
  let gate: (() => void) | null = null
  return {
    fileContents: () => text,
    releaseWrite: () => gate?.(),
    getFile: () =>
      Promise.resolve({ text: () => Promise.resolve(text) }) as unknown as Promise<File>,
    createWritable: () =>
      Promise.resolve({
        write: (data: unknown) =>
          new Promise<void>((resolve) => {
            gate = () => {
              text = String(data)
              resolve()
            }
          }),
        close: async () => undefined,
      }) as unknown as Promise<
        { write(data: unknown): Promise<void>; close(): Promise<void> }
      >,
  }
}

describe('makeScriptLink', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pulls an external save back into the book (VS Code → toolback)', async () => {
    vi.useFakeTimers()
    // stub the OS picker so `link()` adopts our fake handle
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    const onChange = vi.fn()
    const link = makeScriptLink('test', onChange)
    await link.link()

    // external editor writes to the file
    fh.writeExternally('// header\n// ============= toolback script =============\nfunction fresh() {}')
    // poll ticks → pull detects the change and calls onChange
    await vi.advanceTimersByTimeAsync(1300)
    expect(onChange).toHaveBeenCalledWith('function fresh() {}')
    link.dispose()
  })

  it('writes toolback edits out to the file (toolback → VS Code)', async () => {
    vi.useFakeTimers()
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    const onChange = vi.fn()
    const link = makeScriptLink('test2', onChange)
    await link.link()

    link.push("function a() {}")
    await vi.advanceTimersByTimeAsync(500)
    const out = fh.fileContents()
    expect(out).toContain('function a() {}')
    expect(out).toContain('toolback script')
    // the export is the author's script — no generated API dump on top
    expect(out).not.toContain('declare const store')
    expect(out).not.toContain('interface TBControl')
    link.dispose()
  })

  it('does not echo toolback edits back as external changes', async () => {
    vi.useFakeTimers()
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    const onChange = vi.fn()
    const link = makeScriptLink('test3', onChange)
    await link.link()

    link.push('const SAME = 1')
    await vi.advanceTimersByTimeAsync(500)
    await vi.advanceTimersByTimeAsync(1300) // a couple of polls
    // our write matches lastWritten, so no external-change callback fires
    expect(onChange).not.toHaveBeenCalled()
    link.dispose()
  })

  it('seeds a freshly-created file with the editor content (the empty-file fix)', async () => {
    vi.useFakeTimers()
    // exactly what a new showSaveFilePicker returns: an empty file on disk
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    const onChange = vi.fn()
    const link = makeScriptLink('seed-test', onChange)
    await link.link()

    // the component pushes the current script right after linking
    link.push("function pageEnter() { store.set('x', 1) }")
    await vi.advanceTimersByTimeAsync(500)

    const out = fh.fileContents()
    expect(out).toContain('function pageEnter()')
    expect(out).not.toHaveLength(0)
    link.dispose()
  })

  it('linking to an empty file never blanks out the editor content', async () => {
    vi.useFakeTimers()
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    // the editor already has a script — linking to an empty on-disk file must
    // NOT call onChange('') (which would wipe the editor)
    const onChange = vi.fn()
    const link = makeScriptLink('no-blank', onChange)
    await link.link()

    // no callback expected: the empty file has nothing to import
    expect(onChange).not.toHaveBeenCalled()
    link.dispose()
  })

  it('never yanks the editor back while our own write is still landing (the edit-vs-poll race)', async () => {
    vi.useFakeTimers()
    // file starts with OLD content; our edit is in flight
    const fh = gatedHandle(internalize('const OLD = 1'))
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never

    const onChange = vi.fn()
    const link = makeScriptLink('race-test', onChange)
    await link.link()
    // link adopts the existing file (non-empty) → onChange fired once on adopt
    expect(onChange).toHaveBeenCalledWith('const OLD = 1')
    onChange.mockClear()

    // editor changes to NEW content → a write is scheduled and starts
    link.push('const NEW = 2')
    // debounce fires at 350ms; write begins but is gated (never lands yet)
    await vi.advanceTimersByTimeAsync(400)
    expect(internalize(fh.fileContents())).toBe('const OLD = 1') // write still stalled

    // a poll fires DURING the in-flight write — it must NOT pull OLD back in
    await vi.advanceTimersByTimeAsync(1300)
    expect(onChange).not.toHaveBeenCalled()

    // allow the write to land, then a poll sees the file now matches
    fh.releaseWrite()
    await vi.advanceTimersByTimeAsync(1300)
    expect(fh.fileContents()).toContain('const NEW = 2')
    // no echo: the landed content equals what we wrote, so no onChange
    expect(onChange).not.toHaveBeenCalled()
    link.dispose()
  })

  it('expires a pending write that is superseded before it flushes', async () => {
    vi.useFakeTimers()
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never
    const onChange = vi.fn()
    const link = makeScriptLink('coalesce-test', onChange)
    await link.link()

    // rapid typing: many pushes collapse into one write of the final text
    link.push('const A = 1')
    await vi.advanceTimersByTimeAsync(100)
    link.push('const AB = 2')
    await vi.advanceTimersByTimeAsync(100)
    link.push('const ABC = 3')
    await vi.advanceTimersByTimeAsync(600)

    expect(fh.fileContents()).toContain('const ABC = 3')
    expect(fh.fileContents()).not.toContain('const A = 1')
    link.dispose()
  })

  it('auto-unlinks with a notice when the file vanishes from disk', async () => {
    vi.useFakeTimers()
    const fh = fakeHandle('')
    window.showSaveFilePicker = vi.fn().mockResolvedValue(fh) as never
    const notice = vi.fn()
    const link = makeScriptLink('vanish-test', vi.fn(), notice)
    await link.link()
    // link is live
    expect(link.phase.value).toBe('linked')

    // simulate the file being deleted by an external editor
    fh.removeFromDisk()
    await vi.advanceTimersByTimeAsync(1300)

    // auto-unlinked + a user-facing notice
    expect(link.phase.value).toBe('unlinked')
    expect(notice).toHaveBeenCalledWith(
      expect.stringMatching(/disappeared from disk[\s\S]*unlinked/i),
    )
    // polling has stopped — no further notices
    notice.mockClear()
    await vi.advanceTimersByTimeAsync(4000)
    expect(notice).not.toHaveBeenCalled()
    link.dispose()
  })
})