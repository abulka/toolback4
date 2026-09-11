<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Rect } from '@toolback/format'
import { useBookStore } from '../stores/book'
import { collectStoreKeys } from '../storeKeys'
import { copyText, objectsToJson } from '../copyJson'
import ScriptEditor from './ScriptEditor.vue'
import HelpButton from './HelpButton.vue'
import DynamicTextEditor from './DynamicTextEditor.vue'

const store = useBookStore()
// store keys plus the built-in self binding — {{self.name}} makes every copy
// of an object show its own name (duplicates included)
const storeKeyList = computed(() => [...collectStoreKeys(store.book), 'self.name'])
const sel = computed(() => store.selectedObject)
const multi = computed(() => store.selectionIds.length > 1)
const rect = computed<Rect | null>(() =>
  sel.value ? (sel.value.rects[store.breakpoint] ?? sel.value.rects.desktop) : null,
)

const EVENTS = ['click', 'dblclick', 'change', 'input', 'mouseenter', 'mouseleave'] as const
const currentEvent = ref<(typeof EVENTS)[number]>('click')
const eventScript = computed(() => sel.value?.on[currentEvent.value] ?? '')

function hasScript(e: (typeof EVENTS)[number]): boolean {
  return Boolean(sel.value?.on[e]?.trim())
}

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

function onPropValue(key: string, v: string): void {
  if (!sel.value) return
  store.updateProps(sel.value.id, { [key]: v })
}

function setGeo(field: 'x' | 'y' | 'w' | 'h', e: Event): void {
  if (!sel.value || !rect.value) return
  const n = Math.max(8, Math.round(Number((e.target as HTMLInputElement).value)) || 0)
  store.applyRect(sel.value.id, { ...rect.value, [field]: n })
}

function isGroupSel(): boolean {
  return sel.value?.control === 'group'
}

/** ungrouping discards the group's own scripts — ask before destroying them */
function onUngroup(): void {
  const g = sel.value
  if (g?.control === 'group') {
    const events = Object.keys(g.on ?? {}).filter((k) => g.on[k]?.trim())
    if (events.length) {
      const ok = window.confirm(
        `Ungroup "${g.name}"? Its script${events.length > 1 ? 's' : ''} (${events.join(', ')}) will be lost.`,
      )
      if (!ok) return
    }
  }
  store.ungroupSelected()
}

// copy the selection's JSON (debugging aid — also the seed of copy/paste)
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyJson(): Promise<void> {
  const objs = store.selectedObjects
  if (!objs.length) return
  const ok = await copyText(objectsToJson(objs))
  copied.value = ok
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div v-if="!sel && !multi" class="empty">
    Nothing selected. Click an object on the canvas, or drag one in from the palette.
  </div>
  <div v-else-if="multi" class="panel">
    <div class="head">
      <span class="obj-kind">{{ store.selectionIds.length }} objects</span>
    </div>
    <p class="hint">
      Shift-click adds or removes · drag any of them to move together · drag on
      empty canvas draws a selection box.
    </p>
    <div class="actions">
      <button class="action" :disabled="!store.groupEligible" @click="store.groupSelected()">Group</button>
      <button class="action" :disabled="!store.ungroupEligible" @click="onUngroup">Ungroup</button>
      <button class="action" @click="copyJson">{{ copied ? '✓ Copied' : 'Copy JSON' }}</button>
      <button class="action danger" @click="store.removeSelected()">Delete</button>
    </div>
    <p v-if="store.selectionIds.length >= 2 && !store.groupEligible" class="hint warn">
      Grouping needs all selected objects under the same parent.
    </p>
  </div>
  <div v-else class="panel">
    <div class="head">
      <span class="obj-kind">{{ sel!.control }}</span>
      <span class="obj-name">{{ sel!.name }}</span>
      <button
        class="copy-json"
        :class="{ ok: copied }"
        title="Copy this object's JSON (including sub-objects) to the clipboard"
        @click="copyJson"
      >{{ copied ? '✓ Copied' : '{ } JSON' }}</button>
    </div>

    <h2>Content</h2>
    <div v-for="f in textFields" :key="f.key" class="field">
      <label>{{ f.label }}</label>
      <DynamicTextEditor
        v-if="f.key === 'text' && !isGroupSel()"
        :model-value="propValue(f.key)"
        :store-keys="storeKeyList"
        @update:model-value="onPropValue(f.key, $event)"
      />
      <input v-else-if="f.key !== 'text' && !isGroupSel()" :value="propValue(f.key)" @input="onProp(f.key, $event)" />
    </div>
    <p v-if="textFields.length === 0 || isGroupSel()" class="hint">
      {{ isGroupSel() ? 'Groups have no content — members do. Use Script for shared behaviour.' : 'No content properties.' }}
    </p>

    <div class="row">
      <h2>Script</h2>
      <HelpButton anchor="object-scripts" />
    </div>
    <div class="event-row">
      <label>Event</label>
      <select v-model="currentEvent">
        <option v-for="e in EVENTS" :key="e" :value="e" :class="{ scripted: hasScript(e) }">{{ hasScript(e) ? e + ' •' : e }}</option>
      </select>
    </div>
    <ScriptEditor
      editor-class="obj-script"
      :model-value="eventScript"
      height="150px"
      @update:model-value="onScript"
    />
    <p v-if="isGroupSel()" class="hint">
      A group handler runs when a member without its own handler is clicked, or
      when a member's script ends with <code>forward()</code>. Here
      <code>target</code> is the member, <code>self</code> the group.
    </p>

    <h2>Arrange</h2>
    <div class="actions">
      <button class="action" title="Bring to front (⌘⇧])" @click="store.reorderSelection('front')">⤒ Front</button>
      <button class="action" title="Forward (⌘])" @click="store.reorderSelection('forward')">↑</button>
      <button class="action" title="Backward (⌘[)" @click="store.reorderSelection('backward')">↓</button>
      <button class="action" title="Send to back (⌘⇧[)" @click="store.reorderSelection('back')">⤓ Back</button>
    </div>
    <div v-if="isGroupSel()" class="actions">
      <button class="action" @click="onUngroup">Ungroup</button>
    </div>

    <h2>Geometry · {{ store.breakpoint }}</h2>
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

    <button class="delete" @click="store.removeSelected()">Delete object</button>
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

.copy-json {
  margin-left: auto;
  font: 500 10px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 4px;
  padding: 3px 7px;
  cursor: pointer;
  white-space: nowrap;
}

.copy-json:hover {
  color: var(--ed-text);
  border-color: var(--ed-accent);
}

.copy-json.ok {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.5);
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

.hint code {
  color: var(--ed-accent);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}

.hint.warn {
  color: #fbbf24;
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

/* events that carry a script: bold where the browser styles option popups
   (Firefox, Windows); macOS native popups ignore it — the • marker always shows */
.event-row select option.scripted {
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 6px;
  margin: 10px 0 4px;
}

.action {
  flex: 1;
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 7px 0;
  cursor: pointer;
}

.action:hover:not(:disabled) {
  border-color: var(--ed-accent);
  color: #fff;
}

.action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action.danger {
  color: #fca5a5;
  border-color: rgba(220, 38, 38, 0.35);
}

.action.danger:hover:not(:disabled) {
  border-color: #dc2626;
  color: #fff;
  background: rgba(220, 38, 38, 0.2);
}
</style>