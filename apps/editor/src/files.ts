import { parseBook, type Book } from '@toolback/format'

interface Writable {
  write(data: unknown): Promise<void>
  close(): Promise<void>
}

interface PickerHandle {
  getFile(): Promise<File>
  createWritable(): Promise<Writable>
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<PickerHandle>
    showOpenFilePicker?: (options?: {
      types?: Array<{ description: string; accept: Record<string, string[]> }>
    }) => Promise<PickerHandle[]>
  }
}

const FILE_TYPE = {
  description: 'toolback book',
  accept: { 'application/json': ['.toolbook.json', '.json'] },
}

export function bookFileName(book: Book): string {
  const base = book.title.trim().replace(/[^\w-]+/g, '-') || 'book'
  return `${base}.toolbook.json`
}

function downloadJson(name: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function saveTextFile(
  name: string,
  text: string,
  mime = 'text/plain',
): Promise<'saved' | 'downloaded'> {
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({ suggestedName: name })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return 'saved'
  }
  downloadText(name, text, mime)
  return 'downloaded'
}

function downloadText(name: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function saveBookFile(book: Book): Promise<'saved' | 'downloaded'> {
  const json = JSON.stringify(book, null, 2)
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
      suggestedName: bookFileName(book),
      types: [FILE_TYPE],
    })
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    return 'saved'
  }
  downloadJson(bookFileName(book), json)
  return 'downloaded'
}

export async function openBookFile(): Promise<Book | undefined> {
  if (typeof window.showOpenFilePicker === 'function') {
    let handle: PickerHandle | undefined
    try {
      ;[handle] = await window.showOpenFilePicker({ types: [FILE_TYPE] })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return undefined
      throw err
    }
    const file = await handle.getFile()
    return parseBook(JSON.parse(await file.text()))
  }
  // fallback: classic file input
  return new Promise<Book | undefined>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(undefined)
      try {
        resolve(parseBook(JSON.parse(await file.text())))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }
    input.click()
  })
}
