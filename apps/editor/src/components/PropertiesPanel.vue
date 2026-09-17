<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AlignMode, MatchDim, Rect } from '@toolback/format'
import {
  describeFit,
  EDGES_H,
  EDGES_V,
  fitBadge,
} from '../fitModes'
import { useBookStore } from '../stores/book'
import { collectStoreKeys } from '../storeKeys'
import { FONT_FAMILIES, IMAGE_PROVIDERS, randomImageUrl, type ImageProvider } from '@toolback/format'
import { copyText, objectsToJson } from '../copyJson'
import ScriptEditor from './ScriptEditor.vue'
import HelpButton from './HelpButton.vue'
import DynamicTextEditor from './DynamicTextEditor.vue'
import ContentEditor from './ContentEditor.vue'

const store = useBookStore()
// store keys plus the built-in self binding — {{self.name}} makes every copy
// of an object show its own name (duplicates included)
const storeKeyList = computed(() => [...collectStoreKeys(store.book), 'self.name'])
const sel = computed(() => store.selectedObject)
const multi = computed(() => store.selectionIds.length > 1)
// the rect the canvas actually renders from the object's edge distances, so
// the X/Y/W/H fields always match what's on screen
const rect = computed<Rect | null>(() =>
  sel.value ? store.effectiveRectOf(sel.value.id) : null,
)

// ---- responsive edge constraints ----
// One question per axis: which page (or group) edges does the object follow?
const edgeX = computed(() => sel.value?.x.mode ?? 'left')
const edgeY = computed(() => sel.value?.y.mode ?? 'top')
const fitLabel = computed(() => fitBadge(edgeX.value, edgeY.value))
const isGlued = computed(() => fitLabel.value !== '')
const fitHint = computed(() => describeFit(edgeX.value, edgeY.value))
function onFitH(e: Event): void {
  if (!sel.value) return
  store.setObjectEdge(sel.value.id, 'x', (e.target as HTMLSelectElement).value as never)
}
function onFitV(e: Event): void {
  if (!sel.value) return
  store.setObjectEdge(sel.value.id, 'y', (e.target as HTMLSelectElement).value as never)
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

interface TextField {
  key: string
  label: string
  /** uses the {{key}}-aware editor instead of a plain input */
  dynamic?: boolean
  /** dynamic fields only: render a resizable textarea */
  multiline?: boolean
  /** viewer fields: the rich editor with popout + VS Code file link */
  viewer?: 'markdown' | 'html'
}

const textFields = computed<TextField[]>(() => {
  if (!sel.value || isGroupSel()) return []
  switch (sel.value.control) {
    case 'button':
    case 'label':
    case 'switch':
      return [{ key: 'text', label: 'Text', dynamic: true }]
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
        { key: 'text', label: 'Body', dynamic: true },
      ]
    case 'markdown':
      return [{ key: 'text', label: 'Markdown', dynamic: true, multiline: true, viewer: 'markdown' }]
    case 'html':
      return [{ key: 'html', label: 'HTML', dynamic: true, multiline: true, viewer: 'html' }]
    default:
      return []
  }
})

// font + colour live on a compact shared row, not full-width fields
const hasStyleRow = computed(() =>
  ['button', 'label', 'switch', 'card', 'input', 'markdown'].includes(sel.value?.control ?? ''),
)
const hasColor = computed(() =>
  ['button', 'label', 'switch', 'card', 'container', 'input', 'markdown'].includes(
    sel.value?.control ?? '',
  ),
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

// image "generate": fill the selected image object's `src` with a random URL
// from a free host, sized to the object's own box so it fills the frame 1:1.
const imageProvider = ref<ImageProvider>('picsum')
function onProviderChange(e: Event): void {
  imageProvider.value = (e.target as HTMLSelectElement).value as ImageProvider
}
function onGenerateImage(): void {
  if (!sel.value) return
  const r = store.effectiveRectOf(sel.value.id)
  store.updateProps(sel.value.id, {
     src: randomImageUrl(r?.w ?? 600, r?.h ?? 400, imageProvider.value),
  })
}

function setGeo(field: 'x' | 'y' | 'w' | 'h', e: Event): void {
  if (!sel.value) return
  const n = Math.max(8, Math.round(Number((e.target as HTMLInputElement).value)) || 0)
  // typed writes keep the edges the object follows, moving it now
  store.setGeometry(sel.value.id, { [field]: n })
}

// ---- outer margin: space reserved around the control ----
const margin = computed(() => sel.value?.margin ?? {})
const marginLinked = ref(false)
const MARGIN_SIDES = ['top', 'right', 'bottom', 'left'] as const
type MarginSide = (typeof MARGIN_SIDES)[number]
function setMargin(side: MarginSide, e: Event): void {
  if (!sel.value) return
  const n = Math.max(0, Math.round(Number((e.target as HTMLInputElement).value)) || 0)
  if (marginLinked.value) {
    store.setObjectMargin(sel.value.id, { top: n, right: n, bottom: n, left: n })
  } else {
    store.setObjectMargin(sel.value.id, { [side]: n })
  }
}

// ---- Fill page: size a top-level object to the page (minus a margin) ----
function readFillMargin(): number {
  try {
    const raw = localStorage.getItem('toolback.fillMargin')
    if (raw === null) return 8
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 8
  } catch {
    return 8
  }
}
const fillMargin = ref<number>(readFillMargin())
/** clamp + remember the margin field, returning the value to apply */
function commitFillMargin(): number {
  const m = Math.max(0, Math.round(fillMargin.value) || 0)
  fillMargin.value = m
  try {
    localStorage.setItem('toolback.fillMargin', String(m))
  } catch {
    /* no localStorage — fine, the margin just isn't remembered */
  }
  return m
}
function onFill(): void {
  if (!sel.value) return
  store.fillObjectToPage(sel.value.id, commitFillMargin())
}
function onFillWidth(): void {
  if (!sel.value) return
  store.fillObjectWidth(sel.value.id, commitFillMargin())
}
function onFillHeight(): void {
  if (!sel.value) return
  store.fillObjectHeight(sel.value.id, commitFillMargin())
}
function onCenterInPage(): void {
  if (sel.value) store.centerObjectInPage(sel.value.id)
}

// ---- multi-selection align / distribute / match ----
function onAlign(mode: AlignMode): void {
  store.alignSelection(mode)
}
function onCenterBlock(): void {
  store.centerSelectionOnPage()
}
function onDistribute(axis: 'x' | 'y'): void {
  store.distributeSelection(axis)
}
function onMatch(dim: MatchDim): void {
  store.matchSizeSelection(dim)
}

function isGroupSel(): boolean {
  return sel.value?.control === 'group'
}

/** the selection is a single group member */
function isMember(): boolean {
  return store.selectionIds.length === 1 && store.selectionParentId !== null
}

/** every object carries its own edge choices (members constrain to their
 *  group box rather than the page) */
function canFit(): boolean {
  return true
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
    <template v-if="store.groupEligible">
      <h2>Align</h2>
      <div class="align-grid">
        <button class="align-btn" title="Align left edges" @click="onAlign('left')">⇤</button>
        <button class="align-btn" title="Align horizontal centers" @click="onAlign('centerX')">↔</button>
        <button class="align-btn" title="Align right edges" @click="onAlign('right')">⇥</button>
        <button class="align-btn" title="Align top edges" @click="onAlign('top')">⤒</button>
        <button class="align-btn" title="Align vertical centers" @click="onAlign('centerY')">↕</button>
        <button class="align-btn" title="Align bottom edges" @click="onAlign('bottom')">⤓</button>
      </div>
      <p class="hint">Aligns to the selection's bounding box · Center on page moves them as a block.</p>
      <div class="actions">
        <button class="action" :disabled="store.selectionIds.length < 3" @click="onDistribute('x')">Distribute H</button>
        <button class="action" :disabled="store.selectionIds.length < 3" @click="onDistribute('y')">Distribute V</button>
        <button class="action" @click="onCenterBlock">Center on page</button>
      </div>
      <div class="actions">
        <button class="action" @click="onMatch('w')">Match W</button>
        <button class="action" @click="onMatch('h')">Match H</button>
        <button class="action" @click="onMatch('both')">Match both</button>
      </div>
    </template>
  </div>
  <div v-else class="panel">
    <div class="head">
      <span class="obj-kind">{{ sel!.control }}</span>
      <span class="obj-name">{{ sel!.name }}</span>
      <span v-if="canFit() && isGlued" class="fit-badge" :title="`Responsive edges: ${fitLabel}. The browser keeps these distances as the page resizes.`">{{ fitLabel }}</span>
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
    <div v-for="f in textFields" :key="`${sel?.id ?? 'none'}:${f.key}`" class="field">
      <label>{{ f.label }}</label>
      <ContentEditor
        v-if="f.viewer && !isGroupSel()"
        :model-value="propValue(f.key)"
        :flavor="f.viewer"
        :store-keys="storeKeyList"
        :title="sel ? `${f.label} · ${sel.name}` : f.label"
        :link-key="sel ? `obj:${sel.id}:${f.key}` : ''"
        @update:model-value="onPropValue(f.key, $event)"
      />
      <DynamicTextEditor
        v-else-if="f.dynamic && !isGroupSel()"
        :model-value="propValue(f.key)"
        :store-keys="storeKeyList"
        :multiline="f.multiline"
        @update:model-value="onPropValue(f.key, $event)"
      />
      <input
        v-else-if="f.key !== 'src'"
         :value="propValue(f.key)"
          @input="onProp(f.key, $event)"
        />
         <div v-else class="url-row">
          <input
           class="url-input"
            :value="propValue('src')"
            placeholder="https://…"
            @input="onProp('src', $event)"
          />
          <select
           class="url-provider"
            :value="imageProvider"
            title="Random image source"
            @change="onProviderChange"
          >
           <option v-for="p in IMAGE_PROVIDERS" :key="p" :value="p">{{ p }}</option>
          </select>
          <button
          type="button"
          class="url-dice"
          title="Generate a random image URL"
           @click="onGenerateImage"
          >🎲</button>
          </div>
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

    <h2 v-if="canFit()">Responsive</h2>
    <div v-if="canFit()" class="fit-row">
      <div class="fit-axis">
        <label>Horizontal</label>
        <select :value="edgeX" @change="onFitH">
          <option v-for="f in EDGES_H" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
      <div class="fit-axis">
        <label>Vertical</label>
        <select :value="edgeY" @change="onFitV">
          <option v-for="f in EDGES_V" :key="f.id" :value="f.id">{{ f.label }}</option>
        </select>
      </div>
    </div>
    <p v-if="canFit()" class="hint fit-desc">{{ fitHint }}</p>
    <p v-if="canFit() && isGlued" class="hint responsive-hint">
      Edits here change the distances the object keeps from the edges it follows.
    </p>
    <p v-if="isMember()" class="hint responsive-hint">
      This member constrains to its group box — resizing the group scales its
      contents with it; resizing the page re-resolves this member's own edges.
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

    <div class="margin-row">
      <label class="margin-title" title="Space reserved around the control. On a fluid page a Follows-top/left control's bottom/right margin keeps that much empty page below/right of it.">
        Margin
        <input type="checkbox" v-model="marginLinked" title="Set all four sides together" />
      </label>
      <div class="margin-grid">
        <label class="margin-field">
          T
          <input type="number" min="0" step="4" :value="margin.top ?? 0" @change="setMargin('top', $event)" />
        </label>
        <label class="margin-field">
          R
          <input type="number" min="0" step="4" :value="margin.right ?? 0" @change="setMargin('right', $event)" />
        </label>
        <label class="margin-field">
          B
          <input type="number" min="0" step="4" :value="margin.bottom ?? 0" @change="setMargin('bottom', $event)" />
        </label>
        <label class="margin-field">
          L
          <input type="number" min="0" step="4" :value="margin.left ?? 0" @change="setMargin('left', $event)" />
        </label>
      </div>
    </div>

    <div v-if="canFit()" class="fill-row">
      <button class="fill" @click="onFill">Fill page</button>
      <button class="fill" @click="onFillWidth">Fill width</button>
      <button class="fill" @click="onFillHeight">Fill height</button>
      <button class="fill" @click="onCenterInPage">Center</button>
      <label class="fill-margin-label">
        margin
        <input class="fill-margin" type="number" min="0" step="4" v-model.number="fillMargin" />
      </label>
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

/* image URL field: the input shares its row with the source picker + 🎲 */
.url-row {
  display: flex;
  gap: 6px;
}

/* beat `.field input { width: 100% }` so the input flexes inside the row */
.field .url-input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
}

.url-provider {
  flex: 0 0 auto;
  max-width: 120px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px 8px;
  font: inherit;
  cursor: pointer;
}

.url-dice {
  flex: 0 0 auto;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  background: var(--ed-bg);
  color: var(--ed-text);
  cursor: pointer;
  padding: 0 10px;
  font-size: 15px;
  line-height: 1;
  transition: border-color 0.12s, color 0.12s;
}

.url-dice:hover {
  border-color: var(--ed-accent);
  color: var(--ed-accent);
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

.fill-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 10px 0 14px;
}

.margin-row {
  margin: 8px 0 4px;
}

.margin-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ed-text-dim);
  margin-bottom: 4px;
}

.margin-title input[type='checkbox'] {
  margin: 0;
}

.margin-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.margin-field {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ed-text-dim);
}

.margin-field input {
  width: 100%;
  min-width: 0;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 5px 6px;
  font: 12px ui-monospace, 'SF Mono', Menlo, monospace;
}

.margin-field input:focus {
  outline: none;
  border-color: var(--ed-accent);
}

.fill {
  flex: 1 1 auto;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
}

.fill:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.fill-margin-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--ed-text-dim);
}

.fill-margin {
  width: 52px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 5px 6px;
  font: 12px ui-monospace, 'SF Mono', Menlo, monospace;
}

.fill-margin:focus {
  outline: none;
  border-color: var(--ed-accent);
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
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.fit-axis {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 140px;
  min-width: 0;
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

.fit-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fit-control select {
  flex: 1 1 auto;
  min-width: 0;
}

.fixed-toggle {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  cursor: pointer;
  color: var(--ed-text-dim);
  user-select: none;
  white-space: nowrap;
}

.fixed-toggle input {
  margin: 0;
}

.fixed-toggle:has(input:checked) {
  color: var(--ed-accent);
}

.align-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  margin-bottom: 8px;
}

.align-btn {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 7px 0;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.align-btn:hover {
  border-color: var(--ed-accent);
  color: #fff;
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