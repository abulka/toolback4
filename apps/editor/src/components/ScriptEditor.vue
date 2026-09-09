<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as Monaco from 'monaco-editor'
import { getMonaco } from '../monaco'

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: string
    editorClass?: string
  }>(),
  { height: '150px', editorClass: '' },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLDivElement | null>(null)
let editor: Monaco.editor.IStandaloneCodeEditor | null = null

onMounted(async () => {
  if (!host.value) return
  const monaco = await getMonaco()
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
  })
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor!.getValue())
  })
})

watch(
  () => props.modelValue,
  (v) => {
    if (editor && editor.getValue() !== v) editor.setValue(v)
  },
)

onBeforeUnmount(() => {
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
