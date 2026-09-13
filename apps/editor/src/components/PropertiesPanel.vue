<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Rect } from '@toolback/format'
import { useBookStore } from '../stores/book'
import { collectStoreKeys } from '../storeKeys'
import { FONT_FAMILIES } from '@toolback/format'
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
// the rect the canvas actually renders (glue-derived) so the
// X/Y/W/H fields always match what's on screen
const rect = computed<Rect | null>(() =>
  sel.value ? store.effectiveRectOf(sel.value.id) : null,
)

// ---- responsive glue ----
// 'free' = no constraint (the authored coordinate applies everywhere)
const FIT_H: Array<{ id: string; label: string }> = [
  { id: 'free', label: 'Free' },
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
  { id: 'stretch', label: 'Stretch' },
]
const FIT_V: Array<{ id: string; label: string }> = [
  { id: 'free', label: 'Free' },
  { id: 'top', label: 'Top' },
  { id: 'center', label: 'Center' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'stretch', label: 'Stretch' },
]
/** one-line "what does this do" for the active pair of modes */
const FIT_DESC: Record<string, string> = {
  free: 'position fixed at its authored spot',
  left: 'left margin keeps its share of the page',
  top: 'top margin keeps its share of the page',
  right: 'right margin keeps its share of the page',
  bottom: 'bottom margin keeps its share of the page',
  center: 'always centered on the page',
  stretch: 'size and margins scale with the page',
}
const fitH = computed(() => sel.value?.fit?.x ?? 'free')
const fitV = computed(() => sel.value?.fit?.y ?? 'free')
/** only real constraints show in the badge — Free axes are omitted */
const fitLabel = computed<string>(() => {
  const parts: string[] = []
  if (fitH.value !== 'free') parts.push(FIT_H.find((f) => f.id === fitH.value)?.label ?? fitH.value)
  if (fitV.value !== 'free') parts.push(FIT_V.find((f) => f.id === fitV.value)?.label ?? fitV.value)
  return parts.join(' · ')
})
const fitHint = computed<string>(() => {
  if (!isGlued.value) return 'Free — the layout stays exactly where you put it.'
  const h = fitH.value !== 'free' ? `H: ${FIT_DESC[fitH.value] ?? fitH.value}` : ''
  const v = fitV.value !== 'free' ? `V: ${FIT_DESC[fitV.value] ?? fitV.value}` : ''
  return [h, v].filter(Boolean).join(' · ')
})
const isGlued = computed(() => fitLabel.value !== '')
function onFitH(e: Event): void {
  if (sel.value) store.setObjectFit(sel.value.id, 'x', (e.target as HTMLSelectElement).value)
}
function onFitV(e: Event): void {
  if (sel.value) store.setObjectFit(sel.value.id, 'y', (e.target as HTMLSelectElement).value)
}

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
  if (!sel.value || isGroupSel()) return []
  switch (sel.value.control) {
    case 'button':
    case 'label':
    case 'switch':
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

// font + colour live on a compact shared row, not full-width fields
const hasStyleRow = computed(() =>
  ['button', 'label', 'switch', 'card', 'input'].includes(sel.value?.control ?? ''),
)
const hasColor = computed(() =>
  ['button', 'label', 'switch', 'card', 'container', 'input'].includes(sel.value?.control ?? ''),
)
const isButtonSel = computed(() => sel.value?.control === 'button')

function propValue(key: string): string {
  const v = sel.value?.props[key]
  return typeof v === 'string' ? v : ''
}

function numPropValue(key: string): string {
  if (key === 'fontSize') return effectiveFontSize()
  const v = sel.value?.props[key]
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
}

/** the rendered font size: the stored fontSize, else the CSS baseline (15px) */
function effectiveFontSize(): string {
  const v = sel.value?.props['fontSize']
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return String(Math.round(Number(v)))
  }
  return '15'
}

/** value for the <input type=color> swatch: the stored colour, else the
 *  colour the object actually renders with (never a made-up grey) */
function swatchFor(key: string): string {
  const v = sel.value?.props[key]
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v
  const control = sel.value?.control ?? ''
  if (control === 'button' || control === 'switch') return '#4f46e5' // --tb-accent
  if (control === 'label') return '#111827' // --tb-text
  if (control === 'card') return '#ffffff'
  if (control === 'container') return '#f9fafb'
  return '#9ca3af'
}

function onProp(key: string, e: Event): void {
  if (!sel.value) return
  const raw = (e.target as HTMLInputElement).value
  let value: unknown = raw
  if (key === 'fontSize') {
    // store a real number (or remove the prop when cleared) so the field
    // keeps showing what was typed
    if (raw.trim() === '') value = undefined
    else {
      const n = Math.round(Number(raw))
      value = Number.isFinite(n) && n >= 8 ? n : undefined
    }
  }
  store.updateProps(sel.value.id, { [key]: value })
}

function onPropValue(key: string, v: string): void {
  if (!sel.value) return
  store.updateProps(sel.value.id, { [key]: v })
}

function setGeo(field: 'x' | 'y' | 'w' | 'h', e: Event): void {
  if (!sel.value) return
  const n = Math.max(8, Math.round(Number((e.target as HTMLInputElement).value)) || 0)
  // deliberate typed writes release the glued axis they touch
  store.setGeometry(sel.value.id, { [field]: n })
}

function isGroupSel(): boolean {
  return sel.value?.control === 'group'
}

/** the selection is a single group member (fit is top-level only) */
function isMember(): boolean {
  return store.selectionIds.length === 1 && store.selectionParentId !== null
}

/** responsive UI for any top-level object — groups included (a group's box
 *  carries the glue; members ride it and stretch scales them). Members and
 *  nested objects have no fit of their own, so they're excluded. */
function canFit(): boolean {
  return !isMember()
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

function flash(n: number, word: string): void {
  if (n) store.flashCanvasNote(`${word} ${n} object${n === 1 ? '' : 's'}`)
}

function onCopy(): void {
  flash(store.copySelected(), 'Copied')
}

function onCut(): void {
  flash(store.cutSelected(), 'Cut')
}

function onPaste(): void {
  flash(store.pasteClipboard(), 'Pasted')
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
      <button class="action danger" @click="store.removeSelected()">Delete</button>
    </div>
    <div class="actions">
      <button class="action" @click="onCopy">Copy</button>
      <button class="action" @click="onCut">Cut</button>
      <button class="action" :disabled="!store.canPaste" @click="onPaste">Paste</button>
      <button class="action" @click="copyJson">{{ copied ? '✓ Copied' : 'Copy JSON' }}</button>
    </div>
    <p v-if="store.selectionIds.length >= 2 && !store.groupEligible" class="hint warn">
      Grouping needs all selected objects under the same parent.
    </p>
  </div>
  <div v-else class="panel">
    <div class="head">
      <span class="obj-kind">{{ sel!.control }}</span>
      <span class="obj-name">{{ sel!.name }}</span>
      <span v-if="canFit() && isGlued" class="fit-badge" :title="`Responsive glue: ${fitLabel}. The canvas derives the constrained axis from the shared layout at every page size.`">{{ fitLabel }}</span>
      <button
        class="copy-json"
        :class="{ ok: copied }"
        title="Copy this object's JSON (including sub-objects) to the clipboard"
        @click="copyJson"
      >{{ copied ? '✓ Copied' : '{ } JSON' }}</button>
    </div>

    <div class="actions">
      <button class="action" @click="onCopy">Copy</button>
      <button class="action" @click="onCut">Cut</button>
      <button class="action" :disabled="!store.canPaste" @click="onPaste">Paste</button>
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
      <input v-else :value="propValue(f.key)" @input="onProp(f.key, $event)" />
    </div>
    <div v-if="hasStyleRow" class="field">
      <label>Font size · Font</label>
      <div class="pair-row">
        <input
          type="number"
          min="8"
          placeholder="size"
          :value="numPropValue('fontSize')"
          @input="onProp('fontSize', $event)"
        />
        <select :value="propValue('fontFamily')" @change="onProp('fontFamily', $event)">
          <option value="">default</option>
          <option v-for="fam in FONT_FAMILIES" :key="fam" :value="fam">{{ fam }}</option>
        </select>
      </div>
    </div>
    <div v-if="hasColor" class="field">
      <label>{{ isButtonSel ? 'Colour' : 'Text colour' }}</label>
      <div class="color-row">
        <input
          class="color-input"
          :value="propValue('color')"
          placeholder="red, #3b82f6…"
          @input="onProp('color', $event)"
        />
        <input
          type="color"
          class="color-swatch"
          :value="swatchFor('color')"
          @input="onProp('color', $event)"
        />
      </div>
    </div>
    <div v-if="sel!.control === 'switch'" class="field">
      <label>Checked</label>
      <input
        type="checkbox"
        class="switch-checked"
        :checked="sel!.props['checked'] === true"
        @change="store.updateProps(sel!.id, { checked: ($event.target as HTMLInputElement).checked })"
      />
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
      :key="sel ? `${sel.id}:${currentEvent}` : 'none'"
      editor-class="obj-script"
      kind="object"
      :title="sel ? `Script · ${sel.name} · ${currentEvent}` : 'Object script'"
      :link-key="sel ? `obj:${sel.id}:${currentEvent}` : ''"
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

    <h2 v-if="canFit()">Responsive · {{ store.breakpoint }}</h2>
    <div v-if="canFit()" class="fit-row">
      <div class="fit-axis">
        <label>Horizontal</label>
        <select :value="fitH" @change="onFitH">
          <option v-for="f in FIT_H" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
      <div class="fit-axis">
        <label>Vertical</label>
        <select :value="fitV" @change="onFitV">
          <option v-for="f in FIT_V" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
    </div>
    <p v-if="canFit()" class="hint fit-desc">{{ fitHint }}</p>
    <p v-if="canFit() && isGlued" class="hint responsive-hint">
      Edits here adjust the shared layout at every breakpoint.
    </p>

    <h2>Geometry</h2>
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

.fit-badge {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #fff;
  background: var(--ed-accent);
  border-radius: 999px;
  padding: 2px 8px;
  white-space: nowrap;
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
  color-scheme: dark;
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

/* compact rows: nothing stretches to the panel width (selectors are
   higher-specificity than `.field input`, whose width: 100% would win) */
.pair-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.field .pair-row input[type='number'] {
  width: 72px;
  flex: 0 0 auto;
  font: inherit;
}

.field .pair-row select {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 130px;
  width: auto;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px;
  font: inherit;
}

.color-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.field .color-row .color-input {
  flex: 0 1 auto;
  width: 120px;
  min-width: 0;
}

.field .color-row .color-swatch {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  padding: 0;
  background: none;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}

.color-swatch::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

/* beats `.field input`'s width: 100% */
.field input.switch-checked {
  width: 18px;
  height: 18px;
  padding: 0;
  accent-color: var(--ed-accent);
}

.geo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 8px;
}

.responsive-hint {
  font-size: 10.5px;
  color: var(--ed-accent);
}

.fit-desc {
  margin: -6px 0 10px;
}

.fit-row {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.fit-axis {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.fit-axis label {
  font-size: 11px;
  color: var(--ed-text-dim);
}

.fit-axis select {
  width: 100%;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px;
  font: inherit;
}

.bp-dots {
  font-size: 9.5px;
  color: var(--ed-accent);
  margin-left: 6px;
}

.reset-inherit {
  margin-top: 6px;
  width: 100%;
  font: 500 11.5px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px dashed var(--ed-accent);
  border-radius: 8px;
  padding: 7px 0;
  cursor: pointer;
}

.reset-inherit:hover {
  color: #fff;
  border-color: var(--ed-accent);
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