<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Monaco from 'monaco-editor'
import { getMonaco } from '../monaco'
import { registerToolbackIntellisense, updateApiLib } from '../monacoApi'
import { buildApiLib, buildBackgroundApiLib, buildBackgroundEditorContext, buildEditorContext } from '../monacoApiLib'
import { collectStoreKeys } from '../storeKeys'
import { useBookStore } from '../stores/book'

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: string
    editorClass?: string
    /** which editor pane this is — selects the right API lib + completions */
    kind?: 'page' | 'background' | 'object'
  }>(),
  { height: '150px', editorClass: '', kind: 'page' },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLDivElement | null>(null)
let editor: Monaco.editor.IStandaloneCodeEditor | null = null

const store = useBookStore()

// fingerprint of everything the generated API lib + completion context depend on
const libFingerprint = computed(() => {
  if (props.kind === 'background') {
    const bg = store.activeBackground
    return JSON.stringify({
      kind: 'background',
      bg: bg?.id ?? '',
      names: bg?.objects.map((o) => o.name) ?? [],
      script: bg?.script ?? '',
      keys: collectStoreKeys(store.book),
    })
  }
  const page = store.activePage
  return JSON.stringify({
    pi: store.currentPageIndex,
    names: page.objects.map((o) => o.name),
    script: page.script,
    keys: collectStoreKeys(store.book),
  })
})

async function refreshLib(): Promise<void> {
  const monaco = await getMonaco()
  if (props.kind === 'background') {
    const bg = store.activeBackground
    updateApiLib(
      monaco,
      buildBackgroundApiLib(bg),
      buildBackgroundEditorContext(collectStoreKeys(store.book)),
    )
    return
  }
  updateApiLib(
    monaco,
    buildApiLib(store.book, store.currentPageIndex),
    buildEditorContext(store.book, store.currentPageIndex, collectStoreKeys(store.book)),
  )
}

onMounted(async () => {
  if (!host.value) return
  const monaco = await getMonaco()
  registerToolbackIntellisense(monaco)
  await refreshLib()
  editor = monaco.editor.create(host.value, {
    value: props.modelValue,
    language: 'javascript',
    theme: 'toolback-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
    renderLineHighlight: 'line',
    padding: { top: 6, bottom: 6 },
    autoClosingBrackets: 'never',
    autoIndent: 'keep',
    formatOnType: false,
    fixedOverflowWidgets: true,
    suggestSelection: 'first',
    wordBasedSuggestions: 'off',
  })
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue())
  })
})

// refresh the generated API lib (debounced) as the book changes
let refreshTimer: ReturnType<typeof setTimeout> | undefined
watch(libFingerprint, () => {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    void refreshLib()
  }, 300)
})

watch(
  () => props.modelValue,
  (v) => {
    if (editor && editor.getValue() !== v) editor.setValue(v)
  },
)

onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div ref="host" class="tb-script-editor" :class="editorClass" :style="{ height }"></div>
</template>

<style scoped>
.tb-script-editor {
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  overflow: hidden;
}
</style>

<style>
/* suggest widget readability fallbacks (fixed layer escapes editor overflow) */
.tb-suggest-host .suggest-widget,
.monaco-editor .suggest-widget {
  background: #14171d !important;
  border: 1px solid #262c37 !important;
}

.monaco-editor .suggest-widget .monaco-list-row {
  color: #d3d8e0 !important;
}

.monaco-editor .suggest-widget .monaco-list-row.focused,
.monaco-editor .suggest-widget .monaco-list-row.selected {
  background: rgba(99, 102, 241, 0.3) !important;
  color: #ffffff !important;
}

.monaco-editor .suggest-widget .details,
.monaco-editor .suggest-widget .monaco-list-row .label-description {
  color: #8b93a1 !important;
}

.monaco-editor .suggest-widget:not(.frozen) .monaco-list-row.focused .label-description,
.monaco-editor .suggest-widget .monaco-list-row.focused .label-description {
  color: #ffffff !important;
}
</style>
