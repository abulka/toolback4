import type * as Monaco from 'monaco-editor'
import { backgroundFor, flattenObjects, type Book } from '@toolback/format'
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
  /** Current value of an input; a switch's checked state (true/false) */
  value: any
  /** Show or hide the object */
  visible: boolean
  /** Enable or disable the object (buttons and inputs) */
  enabled: boolean
  /** Left edge position (px) — moves the object */
  x: number
  /** Top edge position (px) — moves the object */
  y: number
  /** Width (px) — resizes the object */
  width: number
  /** Height (px) — resizes the object */
  height: number
  /** Colour: a name (red, green, navy…) or any CSS colour; '' = default */
  color: string
  /** Font family: 'system' | 'sans' | 'serif' | 'mono' | 'rounded' */
  fontFamily: string
  /** Bold text */
  bold: boolean
  /** Italic text */
  italic: boolean
  /** Horizontal text alignment: 'left' | 'center' | 'right' */
  textAlign: string
  /** Vertical text alignment: 'top' | 'middle' | 'bottom' */
  vAlign: string
  /** Explicit text colour (overrides color on text controls); '' = default */
  textColor: string
  /** Explicit background/fill colour; '' = default */
  background: string
  /** Switch toggle-track colour */
  trackColor: string
  /** Border width in px (0 = none) */
  borderWidth: number
  /** Border style: 'solid' | 'dashed' */
  borderStyle: string
  /** Border colour */
  borderColor: string
  /** Corner radius in px */
  radius: number
  /** Opacity, 0–1 */
  opacity: number
  /** Canvas objects only: the raw <canvas> element */
  readonly canvas?: HTMLCanvasElement
  /** Canvas objects only: the 2D drawing context (use inside the draw script) */
  readonly ctx?: CanvasRenderingContext2D | null
  /** Canvas objects only: clear and re-run the draw script */
  redraw?(): void
  /** Canvas objects only: start (default) or stop a per-frame repaint loop */
  animate?(on?: boolean): void
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
  /**
   * Open a page as a popup dialog. Options: { modal = true, chrome = 'auto' | 'none', x?, y? }.
   * The popup's size comes from its background. Returns a handle with close().
   */
  popupOpen(name: string, options?: { modal?: boolean; chrome?: 'auto' | 'none'; x?: number; y?: number }): { readonly name: string; close(): void } | null
  /** Close a popup by page name (topmost when omitted) */
  popupClose(name?: string): void
  /** Close every open popup */
  popupCloseAll(): void
  /** Names of the currently open popups (bottom → top) */
  readonly popups: string[]
}

declare const store: TBStore
declare const page: TBPage
/** The DOM event that fired (available in object event scripts) */
declare const event: Event & { target: any }
/**
 * The object that received the event. In a group script: the member that was
 * clicked (events bubble up from members). In an object's own script: the
 * object itself. Only available in object event scripts.
 */
declare const target: TBControl

/**
 * A live reference to an object in the book being edited. Returned by
 * author.selected(), author.insertControl() and author.command('group').
 * Every method is a fresh async round-trip (no stale snapshots).
 */
declare interface TBAuthorObject {
  /** stable id — usable with author.updateProps */
  readonly id: string
  readonly name: string
  readonly control: string
  /** read one property (x, y, width, height, text, color, …) or all (no key) */
  get(key?: string): Promise<any>
  /** write props AND geometry (x/y/width/height resolved editor-side) */
  set(patch: Record<string, any>): Promise<{ id: string }>
  /** offset this object by (dx, dy) — one undoable step */
  move(dx: number, dy: number): Promise<{ id: string }>
}

/**
 * Author-mode bridge (plugin pages only, at authoring time): async calls to
 * the editor. Prefer handles (author.selected(), the return of insertControl
 * and command('group')); updateProps/selectionJson are the id-based tools.
 */
declare const author: {
  /** live handles for the current selection */
  selected(): Promise<TBAuthorObject[]>
  /** ids/names/kinds of the current selection + where the plugin is running */
  getSelection(): Promise<{ ids: string[]; names: string[]; kinds: string[]; pageName?: string; target: 'page' | 'background' }>
  /** deep JSON of the selected objects (Copy JSON equivalent) */
  selectionJson(): Promise<any[]>
  /** add a control to the page being edited; returns its live handle */
  insertControl(kind: 'button' | 'label' | 'input' | 'image' | 'card' | 'container' | 'switch' | 'group' | 'markdown' | 'html' | 'shape' | 'canvas', options?: { x?: number; y?: number; w?: number; h?: number; props?: Record<string, any> }): Promise<TBAuthorObject>
  /**
   * Patch any object: props (text, color, title, …) AND geometry (x/y/width/
   * height resolved editor-side, group-aware). Omit the id (null) to patch
   * EVERY selected object.
   */
  updateProps(id: string | null, patch: Record<string, any>): Promise<{ id: string } | { ids: string[] }>
  /** 'delete' | 'duplicate' | 'group' | 'ungroup' | 'front' | 'back' | 'forward' | 'backward'.
   * 'group' returns the new group as a live handle (it also becomes the selection). */
  command(action: string): Promise<{ ok: boolean; id?: string; name?: string; control?: string; ids?: string[] }>
  /** editing context: page/background names, plugin pages, object count, canvas size */
  pageInfo(): Promise<{ editing: string; pageName?: string; pageIndex?: number; backgroundName?: string; pageNames: string[]; backgroundNames: string[]; pluginPages: string[]; objectCount: number; canvas: { width: number; height: number } }>
  /** flash a note in the editor status bar */
  message(text: string): Promise<{ ok: boolean }>
}
`

function controlsInterface(names: string[]): string {
  const members = names.map((n) => `${n}: TBControl`).join('\n  ')
  return `declare const controls: {\n  ${members}\n}`
}

/**
 * Every object name addressable from a page's scripts: the page's own objects
 * plus its background's (background objects get ControlApis at run time).
 */
function pageScopeNames(book: Book, pageIndex: number): string[] {
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const bg = backgroundFor(book, page)
  return flattenObjects([...(bg?.objects ?? []), ...page.objects]).map((o) => o.name)
}

/**
 * Build the Monaco extra-lib for the script editors of `pageIndex`:
 * - TBControl/store/page/event API
 * - controls.<name> typed for every object on the page (and its background)
 * - bare `declare const <name>` for names the runtime actually binds
 *   (valid identifiers, not API-reserved, not colliding with the page's
 *   own function declarations) — single source of truth: shortNamesFor.
 */
export function buildApiLib(book: Book, pageIndex: number): string {
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const objectNames = pageScopeNames(book, pageIndex)
  const fns = extractFunctionNames(page.script)
  const bgFns = extractFunctionNames(backgroundFor(book, page)?.script ?? '')
  const bare = shortNamesFor(objectNames, [...fns, ...bgFns])

  const controls = `declare const controls: {\n  ${objectNames
    .map((n) => `${n}: TBControl`)
    .join('\n  ')}\n}`

  const bareDecl = bare.map((n) => `declare const ${n}: TBControl`).join('\n')

  // background functions are callable from page scripts (runtime-injected)
  const bgDecl = bgFns
    .filter((n) => NAME_RE.test(n))
    .map((n) => `declare function ${n}(...args: any[]): any`)
    .join('\n')

  return `${TOOLBACK_BASE_LIB}${controls}\n${bareDecl}\n${bgDecl}\n`
}

export interface EditorIntellisenseContext {
  /** every object name on the page (controls.<name> members) */
  objectNames: string[]
  /** names usable as bare identifiers (runtime-bound) */
  bareNames: string[]
  /** store keys found across the book, for {{ }} and store.get help */
  storeKeys: string[]
  /** user function names callable from this script: the page's own shared
   *  functions + its background's (both are injected into the runtime scope) */
  functionNames: string[]
  /** which script kind the completions are for (drives lifecycle snippets) */
  scriptKind?: 'page' | 'background' | 'object'
}

const NAME_RE = /^[A-Za-z_$][\w$]*$/

/** reserved names that can never be offered as callable user functions */
const FUNCTION_RESERVED = new Set([
  'page',
  'controls',
  'store',
  'event',
  'target',
  'self',
  'this',
  'forward',
  '__tbImport',
  'undefined',
  'window',
  'document',
  'console',
  'fetch',
])

/** valid identifiers that don't collide with the runtime API */
function callableFunctionNames(names: Iterable<string>): string[] {
  return [...new Set(names)].filter((n) => NAME_RE.test(n) && !FUNCTION_RESERVED.has(n))
}

/**
 * API lib for a background script: the base API (store/page/controls) plus
 * the background's own functions (mutual references). Objects are addressable
 * at run time via the page that hosts them; the background script itself
 * compiles before page controls exist, so nothing else is pre-declared.
 */
export function buildBackgroundApiLib(bg: { script?: string } | null): string {
  const bgFns = extractFunctionNames(bg?.script ?? '')
  const bgDecl = bgFns
    .filter((n) => NAME_RE.test(n))
    .map((n) => `declare function ${n}(...args: any[]): any`)
    .join('\n')
  return `${TOOLBACK_BASE_LIB}${bgDecl}\n`
}

export function buildBackgroundEditorContext(
  bg: { script?: string } | null,
  storeKeys: string[],
): EditorIntellisenseContext {
  return {
    objectNames: [],
    bareNames: [],
    storeKeys,
    functionNames: callableFunctionNames(extractFunctionNames(bg?.script ?? '')),
    scriptKind: 'background',
  }
}
export function buildEditorContext(
  book: Book,
  pageIndex: number,
  storeKeys: string[],
): EditorIntellisenseContext {
  const page = book.pages[pageIndex] ?? book.pages[0]!
  const objectNames = pageScopeNames(book, pageIndex)
  const fns = extractFunctionNames(page.script)
  const bgFns = extractFunctionNames(backgroundFor(book, page)?.script ?? '')
  return {
    objectNames,
    bareNames: shortNamesFor(objectNames, [...fns, ...bgFns]),
    storeKeys,
    // a page script can call its own helpers AND its background's shared
    // functions — both are offered as callable-name completions
    functionNames: callableFunctionNames([...fns, ...bgFns]),
    scriptKind: 'page',
  }
}
