<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type * as Monaco from 'monaco-editor'
import { getMonaco } from '../monaco'
import { registerToolbackIntellisense } from '../monacoApi'

/**
 * A plain Monaco editor for a markdown/HTML viewer source. Unlike the script
 * editor it carries no toolback API lib or squiggles — just the language's
 * own highlighting and the shared `{{storeKey}}` completion.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: 'markdown' | 'html'
    height?: string
    readonly?: boolean
  }>(),
  { language: 'markdown', height: '100%', readonly: false },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLDivElement | null>(null)
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
const model = shallowRef<Monaco.editor.ITextModel | null>(null)
const uid = `content-${Math.random().toString(36).slice(2, 10)}`

onMounted(async () => {
  if (!host.value) return
  const monaco = await getMonaco()
  registerToolbackIntellisense(monaco)
  const ext = props.language === 'html' ? 'html' : 'md'
  const m = monaco.editor.createModel(
    props.modelValue,
    props.language,
    monaco.Uri.parse(`inmemory://toolback/${uid}.${ext}`),
  )
  model.value = m
  editor = monaco.editor.create(host.value, {
    model: m,
    theme: 'toolback-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 13,
    lineNumbers: 'off',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    renderLineHighlight: 'line',
    padding: { top: 8, bottom: 8 },
    fixedOverflowWidgets: true,
    autoClosingBrackets: 'never',
    autoClosingQuotes: 'never',
    readOnly: props.readonly,
  })
  editor.onDidChangeModelContent(() => {
    if (editor) emit('update:modelValue', editor.getValue())
  })
})

watch(
  () => props.modelValue,
  (v) => {
    const m = model.value
    if (editor && m && m.getValue() !== v) m.setValue(v)
  },
)

onBeforeUnmount(() => {
  editor?.dispose()
  editor = null
  model.value?.dispose()
  model.value = null
})
</script>

<template>
  <div ref="host" class="tb-monaco-content" :style="{ height }"></div>
</template>

<style scoped>
.tb-monaco-content {
  width: 100%;
  min-height: 0;
  border: 1px solid var(--ed-border, #262c37);
  border-radius: 6px;
  overflow: hidden;
}
</style>
