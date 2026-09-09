<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Rect } from '@toolback/format'
import { useBookStore } from '../stores/book'
import ScriptEditor from './ScriptEditor.vue'
import HelpButton from './HelpButton.vue'

const store = useBookStore()
const sel = computed(() => store.selectedObject)
const rect = computed<Rect | null>(() =>
  sel.value ? (sel.value.rects[store.breakpoint] ?? sel.value.rects.desktop) : null,
)

const EVENTS = ['click', 'dblclick', 'change', 'input', 'mouseenter', 'mouseleave'] as const
const currentEvent = ref<(typeof EVENTS)[number]>('click')
const eventScript = computed(() => sel.value?.on[currentEvent.value] ?? '')

function onScript(code: string): void {
  if (sel.value) store.setEventScript(sel.value.id, currentEvent.value, code)
}

const textFields = computed(() => {
  if (!sel.value) return []
  switch (sel.value.control) {
    case 'button':
    case 'label':
      return [{ key: 'text', label: 'Text' }]
    case 'input':
      return [{ key: 'placeholder', label: 'Placeholder' }]
    case 'image':
      return [
        { key: 'src', label: 'Image URL' },
        { key: 'alt', label: 'Alt text' },
      ]
    case 'card':
      return [
        { key: 'title', label: 'Title' },
        { key: 'text', label: 'Body' },
      ]
    default:
      return []
  }
})

function propValue(key: string): string {
  const v = sel.value?.props[key]
  return typeof v === 'string' ? v : ''
}

function onProp(key: string, e: Event): void {
  if (!sel.value) return
  store.updateProps(sel.value.id, { [key]: (e.target as HTMLInputElement).value })
}

function setGeo(field: 'x' | 'y' | 'w' | 'h', e: Event): void {
  if (!sel.value || !rect.value) return
  const n = Math.max(8, Math.round(Number((e.target as HTMLInputElement).value)) || 0)
  store.applyRect(sel.value.id, { ...rect.value, [field]: n })
}
</script>

<template>
  <div v-if="!sel" class="empty">
    Nothing selected. Click an object on the canvas, or drag one in from the palette.
  </div>
  <div v-else class="panel">
    <div class="head">
      <span class="obj-kind">{{ sel.control }}</span>
      <span class="obj-name">{{ sel.name }}</span>
    </div>

    <h2>Content</h2>
    <div v-for="f in textFields" :key="f.key" class="field">
      <label>{{ f.label }}</label>
      <input :value="propValue(f.key)" @input="onProp(f.key, $event)" />
    </div>
    <p v-if="textFields.length === 0" class="hint">No content properties.</p>

    <div class="row">
      <h2>Script</h2>
      <HelpButton anchor="object-scripts" />
    </div>
    <div class="event-row">
      <label>Event</label>
      <select v-model="currentEvent">
        <option v-for="e in EVENTS" :key="e" :value="e">{{ e }}</option>
      </select>
    </div>
    <ScriptEditor
      editor-class="obj-script"
      :model-value="eventScript"
      height="150px"
      @update:model-value="onScript"
    />

    <h2>Geometry · desktop</h2>
    <div class="geo">
      <div class="field">
        <label>X</label>
        <input type="number" :value="rect?.x" step="8" @change="setGeo('x', $event)" />
      </div>
      <div class="field">
        <label>Y</label>
        <input type="number" :value="rect?.y" step="8" @change="setGeo('y', $event)" />
      </div>
      <div class="field">
        <label>W</label>
        <input type="number" :value="rect?.w" step="8" min="8" @change="setGeo('w', $event)" />
      </div>
      <div class="field">
        <label>H</label>
        <input type="number" :value="rect?.h" step="8" min="8" @change="setGeo('h', $event)" />
      </div>
    </div>

    <button class="delete" @click="store.removeObject(sel.id)">Delete object</button>
  </div>
</template>

<style scoped>
.empty {
  font-size: 12px;
  color: var(--ed-text-dim);
  background: var(--ed-bg);
  border: 1px dashed var(--ed-border);
  border-radius: 8px;
  padding: 12px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.obj-kind {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ed-accent);
  background: rgba(99, 102, 241, 0.12);
  border-radius: 4px;
  padding: 2px 6px;
}

.obj-name {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 13px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.field label {
  font-size: 11px;
  color: var(--ed-text-dim);
}

.field input {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 7px 9px;
  font: inherit;
  width: 100%;
}

.field input:focus {
  outline: 1px solid var(--ed-accent);
}

.geo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 8px;
}

.delete {
  margin-top: 8px;
  width: 100%;
  font: 600 12px/1 system-ui, sans-serif;
  color: #fca5a5;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  border-radius: 8px;
  padding: 8px 0;
  cursor: pointer;
}

.delete:hover {
  background: rgba(220, 38, 38, 0.22);
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 4px 0 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row h2 {
  margin-bottom: 4px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.event-row label {
  font-size: 11px;
  color: var(--ed-text-dim);
}

.event-row select {
  flex: 1;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 5px 8px;
  font: inherit;
}
</style>
