<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    storeKeys?: string[]
    placeholder?: string
    disabled?: boolean
    multiline?: boolean
  }>(),
  { storeKeys: () => [], disabled: false, multiline: false },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const open = ref(false)
const query = ref('')
const insertStart = ref(0)
const active = ref(0)

const filtered = computed(() =>
  props.storeKeys.filter((k) => k.startsWith(query.value)),
)

function refreshState(): void {
  const el = inputEl.value
  if (!el || props.storeKeys.length === 0 || props.disabled) {
    open.value = false
    return
  }
  const caret = el.selectionStart ?? el.value.length
  const m = /\{\{([\w$]*)$/.exec(el.value.slice(0, caret))
  if (m) {
    open.value = true
    query.value = m[1]!
    insertStart.value = caret - m[1]!.length // just after "{{"
    active.value = 0
  } else {
    open.value = false
  }
}

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  refreshState()
}

function choose(key: string): void {
  const el = inputEl.value
  if (!el) return
  const caret = el.selectionStart ?? el.value.length
  // the "{{" opener is already in the text at insertStart-2
  const hasSuffix = el.value.slice(caret, caret + 2) === '}}'
  const inserted = hasSuffix ? key : `${key}}}`
  const next = el.value.slice(0, insertStart.value) + inserted + el.value.slice(caret)
  const pos = insertStart.value + inserted.length
  emit('update:modelValue', next)
  open.value = false
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function onKeydown(e: KeyboardEvent): void {
  if (!open.value) return
  const count = filtered.value.length
  if (e.key === 'Escape') {
    open.value = false
    e.stopPropagation()
  } else if (e.key === 'ArrowDown' && count > 0) {
    active.value = (active.value + 1) % count
    e.preventDefault()
  } else if (e.key === 'ArrowUp' && count > 0) {
    active.value = (active.value - 1 + count) % count
    e.preventDefault()
  } else if (e.key === 'Enter' && count > 0) {
    choose(filtered.value[active.value]!)
    e.preventDefault()
  }
}

function onMousedownInsert(key: string, e: Event): void {
  e.preventDefault()
  choose(key)
}

function keyTemplate(key: string): string {
  return '{{' + key + '}}'
}
</script>

<template>
  <div class="dyn-wrap" @keyup="refreshState" @click="refreshState">
    <textarea
      v-if="multiline"
      ref="inputEl"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="6"
      @input="onInput"
      @keydown="onKeydown"
      @blur="open = false"
    />
    <input
      v-else
      ref="inputEl"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @keydown="onKeydown"
      @blur="open = false"
    />
    <div v-if="open" class="dyn-pop">
      <button
        v-for="(k, i) in filtered"
        :key="k"
        :class="{ sel: i === active }"
        @mouseenter="active = i"
        @mousedown.prevent="choose(k)"
      >
        <span class="k">{{ k }}</span>
        <span class="hint">{{ keyTemplate(k) }}</span>
      </button>
      <div v-if="filtered.length === 0" class="none">
        no store keys yet — use store.set('key', …) in a script
      </div>
    </div>
  </div>
</template>

<style scoped>
.dyn-wrap {
  position: relative;
}

input,
textarea {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 7px 9px;
  font: inherit;
  width: 100%;
}

textarea {
  resize: vertical;
  min-height: 96px;
  font: 12px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
  white-space: pre;
}

input:focus,
textarea:focus {
  outline: 1px solid var(--ed-accent);
}

.dyn-pop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 60;
  min-width: 240px;
  max-width: 280px;
  max-height: 180px;
  overflow-y: auto;
  background: #14171d;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  padding: 4px;
}

.dyn-pop button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--ed-text);
  font: 12px/1.4 ui-monospace, 'SF Mono', Menlo, monospace;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  text-align: left;
}

.dyn-pop button.sel {
  background: rgba(99, 102, 241, 0.25);
}

.dyn-pop .k {
  color: #fff;
}

.dyn-pop .hint {
  color: var(--ed-text-dim);
  font-size: 10px;
}

.none {
  font-size: 11px;
  color: var(--ed-text-dim);
  padding: 8px;
}
</style>
