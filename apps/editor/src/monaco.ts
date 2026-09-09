import type * as Monaco from 'monaco-editor'

let cached: Promise<typeof Monaco> | null = null

export function getMonaco(): Promise<typeof Monaco> {
  if (!cached) {
    cached = Promise.all([
      import('monaco-editor'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
    ]).then(([monaco, editorWorker, tsWorker]) => {
      ;(self as unknown as { MonacoEnvironment: Monaco.Environment }).MonacoEnvironment = {
        getWorker(_workerId, label) {
          return label === 'typescript' || label === 'javascript'
            ? new tsWorker.default()
            : new editorWorker.default()
        },
      }
      monaco.editor.defineTheme('toolback-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0f1115',
          'editorLineNumber.foreground': '#3a4150',
          'editor.lineHighlightBackground': '#161a21',
        },
      })
      return monaco
    })
  }
  return cached
}
