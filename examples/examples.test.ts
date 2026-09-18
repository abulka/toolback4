import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseBook, type Book } from '../packages/format/src/index'
import { runBook } from '../packages/runtime/src/player'

const HERE = dirname(fileURLToPath(import.meta.url))
const BOOKS = readdirSync(HERE)
  .filter((f) => f.endsWith('.toolback.json'))
  .sort()

function load(name: string): Book {
  return parseBook(JSON.parse(readFileSync(join(HERE, name), 'utf8')))
}

describe('example books', () => {
  it('ships at least the three showcase books', () => {
    expect(BOOKS).toEqual(
      expect.arrayContaining([
        'hello-counter.toolback.json',
        'quiz.toolback.json',
        'kitchen-sink.toolback.json',
      ]),
    )
  })

  for (const file of BOOKS) {
    describe(file, () => {
      const book = load(file)

      it('parses against the book schema', () => {
        expect(book.title.length).toBeGreaterThan(0)
        expect(book.pages.length).toBeGreaterThan(0)
      })

      it('object names are unique per page and valid identifiers', () => {
        for (const page of book.pages) {
          const names = page.objects.map((o) => o.name)
          expect(new Set(names).size).toBe(names.length)
          for (const n of names) expect(n).toMatch(/^[A-Za-z_$][\w$]*$/)
        }
      })

      it('every page runs without script errors', async () => {
        const errors: string[] = []
        const root = document.createElement('div')
        for (let i = 0; i < book.pages.length; i++) {
          const handle = runBook(book, root, (m) => errors.push(m), i)
          await new Promise((r) => setTimeout(r, 400))
          handle.stop()
        }
        expect(errors).toEqual([])
      })
    })
  }
})
