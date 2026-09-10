import type { Book } from '@toolback/format'

const DB_NAME = 'toolback'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      if (db.objectStoreNames.contains(STORE)) {
        resolve(db)
        return
      }
      // DB exists at the same version but without our store (e.g. created
      // externally): bump the version to create it.
      db.close()
      const bumped = indexedDB.open(DB_NAME, db.version + 1)
      bumped.onupgradeneeded = () => {
        const db2 = bumped.result
        if (!db2.objectStoreNames.contains(STORE)) db2.createObjectStore(STORE)
      }
      bumped.onsuccess = () => resolve(bumped.result)
      bumped.onerror = () => reject(bumped.error)
    }
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(value, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export interface Autosave {
  book: Book
  at: number
}

export async function loadAutosave(): Promise<Autosave | undefined> {
  return idbGet<Autosave>('autosave')
}

export async function saveAutosave(book: Book): Promise<void> {
  await idbSet('autosave', { book, at: Date.now() } satisfies Autosave)
}

export interface RecentEntry {
  id: string
  title: string
  at: number
}

export async function getRecents(): Promise<RecentEntry[]> {
  return (await idbGet<RecentEntry[]>('recents')) ?? []
}

export async function putRecentBook(book: Book): Promise<RecentEntry[]> {
  await idbSet(`book:${book.id}`, book)
  const recents = await getRecents()
  const next = [
    { id: book.id, title: book.title, at: Date.now() },
    ...recents.filter((r) => r.id !== book.id),
  ].slice(0, 8)
  await idbSet('recents', next)
  return next
}

export async function getRecentBook(id: string): Promise<Book | undefined> {
  return idbGet<Book>(`book:${id}`)
}
