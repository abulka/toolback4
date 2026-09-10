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
          'editorSuggestWidget.background': '#14171d',
          'editorSuggestWidget.foreground': '#d3d8e0',
          'editorSuggestWidget.selectedBackground': '#2a3040',
          'editorSuggestWidget.border': '#262c37',
          'editorSuggestWidget.highlightForeground': '#a5b4fc',
          'editorWidget.background': '#14171d',
          'editorWidget.foreground': '#d3d8e0',
          'editorWidget.border': '#262c37',
          'editorHoverWidget.background': '#14171d',
          'editorHoverWidget.foreground': '#d3d8e0',
        },
      })
      return monaco
    })
  }
  return cached
}
