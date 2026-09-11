import type * as Monaco from 'monaco-editor'
import type { EditorIntellisenseContext } from './monacoApiLib'

let registered = false
let libDisposable: Monaco.IDisposable | null = null
let ctx: EditorIntellisenseContext = { objectNames: [], bareNames: [], storeKeys: [] }

export interface SnippetSpec {
  label: string
  detail: string
  body: string
}

export const SNIPPETS: SnippetSpec[] = [
  {
    label: 'pageEnter',
    detail: 'runs when this page becomes active (Run or page.go)',
    body: 'function pageEnter() {\n\t$0\n}',
  },
  {
    label: 'pageLeave',
    detail: 'runs before leaving this page',
    body: 'function pageLeave() {\n\t$0\n}',
  },
  {
    label: 'store.set',
    detail: 'store a value (refreshes {{key}} labels)',
    body: "store.set('${1:key}', ${2:value})$0",
  },
  {
    label: 'store.get',
    detail: 'read a value from the shared store',
    body: "store.get('${1:key}')$0",
  },
  {
    label: 'page.go',
    detail: 'navigate to another page',
    body: "page.go('${1:Page name}')$0",
  },
  {
    label: 'onEvent',
    detail: 'attach an extra handler to an object',
    body: "controls.${1:objectName}.on('${2:click}', (e) => {\n\t$0\n})",
  },
  {
    label: 'log-clicked-member',
    detail: "group scripts: log which member got the click (target.name)",
    body: "console.log('you clicked', target.name)$0",
  },
  {
    label: 'input-to-store',
    detail: 'remember an input value (input/change script)',
    body: "store.set('${1:key}', event.target.value)$0",
  },
  {
    label: 'fetch-to-store',
    detail: 'async fetch data into the store',
    body:
      "const res = await fetch('${1:https://…}')\nconst data = await res.json()\nstore.set('${2:key}', data)$0",
  },
  {
    label: 'console.log',
    detail: 'debug output (devtools console)',
    body: 'console.log($0)',
  },
]

const CONTROL_MEMBERS: Array<{
  label: string
  detail: string
  body: string
  kind: 'prop' | 'method'
  snippet?: boolean
}> = [
  { label: 'text', detail: 'text of a button/label (an input: its value)', body: 'text', kind: 'prop' },
  { label: 'value', detail: "input's current value", body: 'value', kind: 'prop' },
  { label: 'visible', detail: 'show/hide the object', body: 'visible', kind: 'prop' },
  { label: 'enabled', detail: 'enable/disable the object', body: 'enabled', kind: 'prop' },
  { label: 'x', detail: 'left position (px) — moves the object', body: 'x', kind: 'prop' },
  { label: 'y', detail: 'top position (px) — moves the object', body: 'y', kind: 'prop' },
  { label: 'width', detail: 'width (px) — resizes the object', body: 'width', kind: 'prop' },
  { label: 'height', detail: 'height (px) — resizes the object', body: 'height', kind: 'prop' },
  { label: 'color', detail: "colour: 'red', 'navy', '#3b82f6', rgb(…); '' = default", body: "color", kind: 'prop' },
  { label: 'fontFamily', detail: "font: 'system' | 'sans' | 'serif' | 'mono' | 'rounded'", body: "fontFamily", kind: 'prop' },
  { label: 'name', detail: "this object's name", body: 'name', kind: 'prop' },
  {
    label: 'on',
    detail: "attach a handler, e.g. on('click', (e) => { … })",
    body: "on('${1:click}', (e) => {\n\t$0\n})",
    kind: 'method',
    snippet: true,
  },
  { label: 'el', detail: 'the raw DOM element', body: 'el', kind: 'prop' },
]

type AnyMonaco = typeof Monaco

interface SimpleRange {
  startLineNumber: number
  endLineNumber: number
  startColumn: number
  endColumn: number
}

function wordRange(model: Monaco.editor.ITextModel, position: Monaco.Position): SimpleRange {
  const word = model.getWordUntilPosition(position)
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  }
}

function buildProvider(monaco: typeof Monaco): Monaco.languages.CompletionItemProvider {
  const K = monaco.languages.CompletionItemKind
  const SNIPPET_RULES = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet

  function provideCompletions(
    model: Monaco.editor.ITextModel,
    position: Monaco.Position,
  ): Monaco.languages.CompletionList {
    const before = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    })

    // --- member access after a dot: <name>. | controls. | store. | page. | event.
    const dot = /([A-Za-z_$][\w$]*)\.([\w$]*)$/.exec(before)
    if (dot) {
      const recv = dot[1]!
      const wordEnd = position.column
      const wordStart = wordEnd - dot[2]!.length
      const range: SimpleRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordStart,
        endColumn: wordEnd,
      }
      const item = (
        label: string,
        detail: string,
        body: string,
        kind: Monaco.languages.CompletionItemKind,
        snippet = false,
      ): Monaco.languages.CompletionItem => ({
        label,
        kind,
        detail,
        insertText: body,
        insertTextRules: snippet ? SNIPPET_RULES : undefined,
        sortText: `0${label}`,
        range,
      })

      let list: Monaco.languages.CompletionItem[] = []
      if (recv === 'controls') {
        list = ctx.objectNames.map((n) => item(n, 'object on this page', n, K.Variable, false))
      } else if (recv === 'store') {
        list = [
          item('get', "read a value: store.get('key')", "get('${1:key}')", K.Method, true),
          item('set', "store a value: store.set('key', value)", "set('${1:key}', ${2:value})", K.Method, true),
        ]
      } else if (recv === 'page') {
        list = [
          item('name', 'current page name', 'name', K.Property, false),
          item('names', 'all page names', 'names', K.Property, false),
          item('go', "navigate: page.go('Page name')", "go('${1:Page name}')", K.Method, true),
        ]
      } else if (recv === 'event') {
        list = [
          item('target', 'the element that fired the event', 'target', K.Property, false),
          item('preventDefault', 'prevent the default behaviour', 'preventDefault()', K.Method, false),
          item('stopPropagation', 'stop the event bubbling up', 'stopPropagation()', K.Method, false),
        ]
      } else if (recv === 'target' || recv === 'self' || recv === 'this') {
        // self/this are the script owner (a group script: the group itself) —
        // same control API as target
        list = CONTROL_MEMBERS.map((m) =>
          item(m.label, m.detail, m.body, m.kind === 'method' ? K.Method : K.Property, m.kind === 'method'),
        )
      } else if (ctx.objectNames.includes(recv)) {
        list = CONTROL_MEMBERS.map((m) =>
          item(m.label, m.detail, m.body, m.kind === 'method' ? K.Method : K.Property, m.kind === 'method'),
        )
      }
      return { suggestions: list }
    }

    // --- after "{{" in a script: the script-side equivalent is store.get
    const braces = /\{\{([\w$]*)$/.exec(before)
    if (braces) {
      // Monaco rejects items whose replacement range covers non-word
      // characters ("{{"), so anchor the range at the caret and delete the
      // "{{" prefix via additionalTextEdits.
      const caretRange = wordRange(model, position)
      const prefixRange: SimpleRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - 2,
        endColumn: position.column,
      }
      const items: Monaco.languages.CompletionItem[] = ctx.storeKeys.map((key) => ({
        label: key,
        kind: K.Constant,
        detail: `store.get('${key}') — {{key}} bindings belong in Text properties`,
        insertText: `store.get('${key}')`,
        insertTextRules: undefined,
        sortText: `0${key}`,
        range: caretRange,
        additionalTextEdits: [{ range: prefixRange, text: '' }],
      }))
      items.push({
        label: 'storeKeySnippet',
        kind: K.Snippet,
        detail: 'tip: {{key}} bindings go in Text properties; in scripts use store.get',
        insertText: "store.get('${1:key}')",
        insertTextRules: SNIPPET_RULES,
        sortText: '1tip',
        range: caretRange,
        additionalTextEdits: [{ range: prefixRange, text: '' }],
      })
      return { suggestions: items }
    }

    // --- top level: bare object names (pinned first), API, snippets
    const range = wordRange(model, position)
    const suggestions: Monaco.languages.CompletionItem[] = []

    for (const n of ctx.bareNames) {
      suggestions.push({
        label: n,
        kind: K.Variable,
        detail: `object on this page — shorthand for controls.${n}`,
        insertText: n,
        insertTextRules: undefined,
        sortText: `0${n}`,
        range,
      })
    }
    for (const [api, detail] of [
      ['store', 'shared key/value store (get/set)'],
      ['page', 'page API (name, names, go)'],
      ['controls', 'all objects on this page, by name'],
      ['event', 'the DOM event (in object scripts)'],
      ['target', 'the object that received the event (group scripts: the member)'],
      ['self', 'the object that owns this script (group scripts: the group) — {{self.name}} in Text shows its own name'],
    ] as const) {
      suggestions.push({
        label: api,
        kind: K.Variable,
        detail: `toolback: ${detail}`,
        insertText: api,
        insertTextRules: undefined,
        sortText: `1${api}`,
        range,
      })
    }
    for (const s of SNIPPETS) {
      suggestions.push({
        label: s.label,
        kind: K.Snippet,
        detail: `toolback: ${s.detail}`,
        insertText: s.body,
        insertTextRules: SNIPPET_RULES,
        sortText: `2${s.label}`,
        range,
      })
    }
    return { suggestions }
  }

  return {
    triggerCharacters: ['.', '{'],
    provideCompletionItems(model, position) {
      try {
        return provideCompletions(model, position)
      } catch (err) {
        console.error('[tb-completion] provider error', err)
        return { suggestions: [] }
      }
    },
  }
}

/**
 * One-time setup for the shared Monaco instance:
 * - TypeScript-worker completions are DISABLED (they flood the list with
 *   thousands of DOM globals). All suggestions come from the curated
 *   toolback provider.
 * - Diagnostics (red squiggles) stay on and run against the generated
 *   per-page API lib (added via updateApiLib).
 */
export function registerToolbackIntellisense(monaco: typeof Monaco): void {
  if (registered) return
  registered = true

  const ts = monaco.languages.typescript
  ts.javascriptDefaults.setEagerModelSync(true)
  // keep diagnostics + hover, drop the noisy built-in completion source
  ;(ts.javascriptDefaults as any).setModeConfiguration({
    completionItems: false,
    hovers: true,
    documentSymbols: true,
    tokens: false,
    links: false,
    comments: false,
    definitions: true,
    references: false,
    documentHighlights: true,
    rename: false,
    diagnostics: true,
    documentRangeFormattingEdits: false,
    signatureHelp: false,
    codeActions: false,
  })
  ts.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [80001, 7044, 7043],
  })

  monaco.languages.registerCompletionItemProvider('javascript', buildProvider(monaco))
}

/**
 * Replace the generated toolback API lib + completion context
 * (stable URI → clean swap). Call whenever the book changes.
 */
export function updateApiLib(
  monaco: typeof Monaco,
  lib: string,
  context: EditorIntellisenseContext,
): void {
  ctx = context
  libDisposable?.dispose()
  libDisposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(
    lib,
    'inmemory://toolback/api.d.ts',
  )
}
