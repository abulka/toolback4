import type * as Monaco from 'monaco-editor'
import type { Book } from '@toolback/format'
import { extractFunctionNames, shortNamesFor } from '@toolback/runtime'

export const TOOLBACK_BASE_LIB = `
type TBListener = (e: Event) => void

interface TBControl {
  /** The raw DOM element of this object */
  readonly el: HTMLElement
  /** This object's name */
  readonly name: string
  /** Text of a button or label (an input's current value) */
  text: string
  /** Current value of an input */
  value: string
  /** Show or hide the object */
  visible: boolean
  /** Enable or disable the object (buttons and inputs) */
  enabled: boolean
  /** Attach an extra event handler, e.g. on('click', (e) => { ... }) */
  on(event: string, fn: TBListener): void
}

interface TBStore {
  /** Read a value from the shared store (undefined if never set) */
  get(key: string): any
  /** Write a value; refreshes any {{key}} labels */
  set(key: string, value: any): void
}

interface TBPage {
  /** Name of the current page */
  readonly name: string
  /** Names of all pages in the book */
  readonly names: string[]
  /** Navigate to another page; fires pageLeave then the target's pageEnter */
  go(name: string): void
}

declare const store: TBStore
declare const page: TBPage
/** The DOM event that fired (available in object event scripts) */
declare const event: Event & { target: any }
`

function controlsInterface(names: string[]): string {
  const members = names.map((n) => `${n}: TBControl`).join('\n  ')
  return `declare const controls: {\n  ${members}\n}`
}

/**
 * Build the Monaco extra-lib for the script editors of `pageIndex`:
 * - TBControl/store/page/event API
 * - controls.<name> typed for every object on the page
 * - bare `declare const <name>` for names the runtime actually binds
 *   (valid identifiers, not API-reserved, not colliding with the page's
 *   own function declarations) — single source of truth: shortNamesFor.
 */
export function buildApiLib(book: Book, pageIndex: number): string {
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const objectNames = page.objects.map((o) => o.name)
  const fns = extractFunctionNames(page.script)
  const bare = shortNamesFor(objectNames, fns)

  const controls = `declare const controls: {\n  ${objectNames
    .map((n) => `${n}: TBControl`)
    .join('\n  ')}\n}`

  const bareDecl = bare.map((n) => `declare const ${n}: TBControl`).join('\n')

  return `${TOOLBACK_BASE_LIB}${controls}\n${bareDecl}\n`
}

export interface EditorIntellisenseContext {
  /** every object name on the page (controls.<name> members) */
  objectNames: string[]
  /** names usable as bare identifiers (runtime-bound) */
  bareNames: string[]
  /** store keys found across the book, for {{ }} and store.get help */
  storeKeys: string[]
}

export function buildEditorContext(
  book: Book,
  pageIndex: number,
  storeKeys: string[],
): EditorIntellisenseContext {
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const objectNames = page.objects.map((o) => o.name)
  const fns = extractFunctionNames(page.script)
  return {
    objectNames,
    bareNames: shortNamesFor(objectNames, fns),
    storeKeys,
  }
}
