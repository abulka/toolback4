<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AlignMode, MatchDim, PageObject, Rect } from '@toolback/format'
import {
  describeFit,
  EDGES_H,
  EDGES_V,
  fitBadge,
} from '../fitModes'
import { useBookStore } from '../stores/book'
import { collectStoreKeys } from '../storeKeys'
import {
  APPEARANCE_KINDS,
  BORDER_DEFAULTS,
  BOX_KINDS,
  IMAGE_PROVIDERS,
  randomImageUrl,
  styleKindsForProp,
  type BorderDefault,
  type ImageProvider,
} from '@toolback/format'
import { copyText, objectsToJson } from '../copyJson'
import ScriptEditor from './ScriptEditor.vue'
import HelpButton from './HelpButton.vue'
import DynamicTextEditor from './DynamicTextEditor.vue'
import ContentEditor from './ContentEditor.vue'
import TextStyleFields from './TextStyleFields.vue'
import BoxStyleFields from './BoxStyleFields.vue'
import ShapeFields from './ShapeFields.vue'

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
// `draw` is a canvas lifecycle hook (invoked by the runtime), not a DOM event
const CANVAS_EVENT = 'draw'
const currentEvent = ref<string>('click')
const eventNames = computed<string[]>(() =>
  sel.value?.control === 'canvas' ? [CANVAS_EVENT, ...EVENTS] : [...EVENTS],
)
const eventScript = computed(() => sel.value?.on[currentEvent.value] ?? '')

function hasScript(e: string): boolean {
  return Boolean(sel.value?.on[e]?.trim())
}

watch(
  () => sel.value?.id,
  () => {
    if (!eventNames.value.includes(currentEvent.value)) {
      currentEvent.value = sel.value?.control === 'canvas' ? CANVAS_EVENT : 'click'
    }
  },
)

// ---- Selection sub-tabs ----
const subTab = ref<'general' | 'script'>('general')
// any event handler carries code — marks the Script tab when true
const hasAnyScript = computed(() =>
  Object.values(sel.value?.on ?? {}).some((v) => typeof v === 'string' && v.trim() !== ''),
)

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
  /** wide panel: span both columns instead of pairing with the next field */
  full?: boolean
}

const textFields = computed<TextField[]>(() => {
  if (!sel.value || isGroupSel()) return []
  switch (sel.value.control) {
    case 'button':
    case 'label':
    case 'switch':
      return [{ key: 'text', label: 'Text', dynamic: true, full: true }]
    case 'input':
      return [{ key: 'placeholder', label: 'Placeholder', full: true }]
    case 'image':
      return [
        { key: 'src', label: 'Image URL', full: true },
        { key: 'alt', label: 'Alt text', full: true },
      ]
    case 'card':
      return [
        { key: 'title', label: 'Title' },
        { key: 'text', label: 'Body', dynamic: true },
      ]
    case 'markdown':
      return [{ key: 'text', label: 'Markdown', dynamic: true, multiline: true, viewer: 'markdown', full: true }]
    case 'html':
      return [{ key: 'html', label: 'HTML', dynamic: true, multiline: true, viewer: 'html', full: true }]
    default:
      return []
  }
})

// ---- style (text / fill / box) ----
// Applied through the selection: a group's style flows to its text members, and
// a multi-selection patches every capable object. Box decoration stays
// per-object (a group has no box of its own), so box targets do not recurse.
type StyleCaps = {
  font: boolean
  bold: boolean
  italic: boolean
  textAlign: boolean
  vAlign: boolean
  textColor: boolean
  background: boolean
  trackColor: boolean
  border: boolean
  radius: boolean
  opacity: boolean
}
const NO_CAPS: StyleCaps = {
  font: false, bold: false, italic: false, textAlign: false, vAlign: false,
  textColor: false, background: false, trackColor: false,
  border: false, radius: false, opacity: false,
}
const CAPS: Record<string, StyleCaps> = {
  button: { font: true, bold: true, italic: true, textAlign: true, vAlign: true, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  label: { font: true, bold: true, italic: true, textAlign: true, vAlign: true, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  input: { font: true, bold: true, italic: true, textAlign: true, vAlign: false, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  switch: { font: true, bold: true, italic: true, textAlign: false, vAlign: false, textColor: true, background: false, trackColor: true, border: false, radius: false, opacity: false },
  card: { font: true, bold: true, italic: true, textAlign: true, vAlign: false, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  container: { font: false, bold: false, italic: false, textAlign: false, vAlign: false, textColor: false, background: true, trackColor: false, border: true, radius: true, opacity: true },
  markdown: { font: true, bold: true, italic: true, textAlign: true, vAlign: false, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  html: { font: true, bold: true, italic: true, textAlign: true, vAlign: false, textColor: true, background: true, trackColor: false, border: true, radius: true, opacity: true },
  image: { font: false, bold: false, italic: false, textAlign: false, vAlign: false, textColor: false, background: false, trackColor: false, border: true, radius: true, opacity: true },
  shape: { font: false, bold: false, italic: false, textAlign: false, vAlign: false, textColor: false, background: true, trackColor: false, border: true, radius: false, opacity: true },
  canvas: { font: false, bold: false, italic: false, textAlign: false, vAlign: false, textColor: false, background: true, trackColor: false, border: true, radius: true, opacity: true },
}
const APPEARANCE = new Set<string>(APPEARANCE_KINDS)
const BOX = new Set<string>(BOX_KINDS)
const BOX_PROPS = new Set(['borderWidth', 'borderStyle', 'borderColor', 'radius', 'opacity'])
const STYLE_KEYS = ['fontSize', 'fontFamily', 'bold', 'italic', 'textAlign', 'vAlign', 'textColor', 'background', 'trackColor', 'borderWidth', 'borderStyle', 'borderColor', 'radius', 'opacity']

function rootsFor(): PageObject[] {
  return multi.value ? store.selectedObjects : sel.value ? [sel.value] : []
}

/** the objects a text/fill edit touches: the selection, expanding groups */
const styleTargets = computed<PageObject[]>(() => {
  const out: PageObject[] = []
  const add = (o: PageObject): void => {
    if (APPEARANCE.has(o.control)) out.push(o)
    for (const child of o.children ?? []) add(child)
  }
  rootsFor().forEach(add)
  return out
})

/** box decoration stays per-object — groups do not recurse here */
const boxTargets = computed<PageObject[]>(() => rootsFor().filter((o) => BOX.has(o.control)))

const styleCaps = computed<StyleCaps>(() => {
  const caps = { ...NO_CAPS }
  for (const o of [...styleTargets.value, ...boxTargets.value]) {
    const c = CAPS[o.control]
    if (!c) continue
    for (const key of Object.keys(caps) as Array<keyof StyleCaps>) caps[key] = caps[key] || c[key]
  }
  return caps
})

const showStyle = computed(() => styleTargets.value.length > 0 || boxTargets.value.length > 0)

function targetsFor(key: string): PageObject[] {
  return BOX_PROPS.has(key) ? boxTargets.value : styleTargets.value
}

/** common prop across the relevant targets; undefined when absent or mixed */
function styleProp(key: string): unknown {
  const objs = targetsFor(key)
  if (!objs.length) return undefined
  const first = objs[0]!.props[key]
  return objs.every((o) => o.props[key] === first) ? first : undefined
}
function styleStr(key: string): string {
  const v = styleProp(key)
  return typeof v === 'string' ? v : ''
}
function styleBool(key: string): boolean {
  return styleProp(key) === true
}
function styleNum(key: string): string {
  const v = styleProp(key)
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return String(Number(v))
  return ''
}
const styleMixed = computed<Record<string, boolean>>(() => {
  const out: Record<string, boolean> = {}
  for (const key of STYLE_KEYS) {
    const objs = targetsFor(key)
    if (objs.length < 2) {
      out[key] = false
      continue
    }
    const first = objs[0]!.props[key]
    out[key] = objs.some((o) => o.props[key] !== first)
  }
  return out
})
function styleFontSize(): string {
  const v = styleProp('fontSize')
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return String(Math.round(Number(v)))
  }
  // a lone object with no stored size shows the CSS baseline (15px)
  return styleTargets.value.length === 1 && !multi.value ? '15' : ''
}
function styleSwatch(key: 'textColor' | 'background' | 'trackColor' | 'borderColor'): string {
  const v = styleProp(key)
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v
  const control = [...styleTargets.value, ...boxTargets.value][0]?.control ?? ''
  if (key === 'textColor') return control === 'button' ? '#ffffff' : '#111827'
  if (key === 'trackColor') return '#4f46e5'
  if (key === 'borderColor') return borderDef().color
  if (control === 'button') return '#4f46e5'
  if (control === 'container') return '#f9fafb'
  return '#ffffff'
}

/** the control whose CSS border baseline the panel shows when props are unset */
function borderControl(): string {
  return boxTargets.value[0]?.control ?? ''
}
function borderDef(): BorderDefault {
  return BORDER_DEFAULTS[borderControl() as keyof typeof BORDER_DEFAULTS] ?? BORDER_DEFAULTS.button
}
/** effective border values: the stored prop, else the control's default (blank
 *  only when a multi-selection holds different values) */
function borderWidthValue(): string {
  if (styleMixed.value['borderWidth']) return ''
  const v = styleProp('borderWidth')
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(borderDef().width)
}
function borderStyleValue(): string {
  if (styleMixed.value['borderStyle']) return ''
  const v = styleProp('borderStyle')
  return typeof v === 'string' && v !== '' ? v : borderDef().style
}
function borderColorValue(): string {
  if (styleMixed.value['borderColor']) return ''
  const v = styleProp('borderColor')
  return typeof v === 'string' && v !== '' ? v : borderDef().color
}
function setStyleProp(key: string, value: unknown): void {
  store.updateSelectedProps({ [key]: value }, styleKindsForProp(key))
}

function propValue(key: string): string {
  const v = sel.value?.props[key]
  return typeof v === 'string' ? v : ''
}

function onProp(key: string, e: Event): void {
  if (!sel.value) return
  const raw = (e.target as HTMLInputElement).value
  store.updateProps(sel.value.id, { [key]: raw })
}

function onPropValue(key: string, v: string): void {
  if (!sel.value) return
  store.updateProps(sel.value.id, { [key]: v })
}

/** numeric property value as a field string (shape geometry props) */
function shapeNum(key: string): string {
  const v = sel.value?.props[key]
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return String(Number(v))
  return ''
}

function onShapeProp(key: string, value: unknown): void {
  if (!sel.value) return
  store.updateProps(sel.value.id, { [key]: value })
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
    <template v-if="showStyle">
      <h2>Style</h2>
      <div class="fields">
        <TextStyleFields
          :caps="styleCaps"
          :font-size="styleFontSize()"
          :font-family="styleStr('fontFamily')"
          :bold="styleBool('bold')"
          :italic="styleBool('italic')"
          :text-align="styleStr('textAlign')"
          :v-align="styleStr('vAlign')"
          :text-color="styleStr('textColor')"
          :text-color-swatch="styleSwatch('textColor')"
          :track-color="styleStr('trackColor')"
          :track-color-swatch="styleSwatch('trackColor')"
          :background="styleStr('background')"
          :background-swatch="styleSwatch('background')"
          :mixed="styleMixed"
          @set="setStyleProp"
        />
        <BoxStyleFields
          :caps="styleCaps"
          :border-width="borderWidthValue()"
          :border-style="borderStyleValue()"
          :border-color="borderColorValue()"
          :border-color-swatch="styleSwatch('borderColor')"
          :radius="styleNum('radius')"
          :opacity="styleNum('opacity')"
          :mixed="styleMixed"
          @set="setStyleProp"
        />
      </div>
    </template>
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

    <div class="subtabs">
      <button :class="{ on: subTab === 'general' }" @click="subTab = 'general'">General</button>
      <button :class="{ on: subTab === 'script' }" @click="subTab = 'script'">
        Script<span v-if="hasAnyScript" class="tab-mark" title="This object has scripts">•</span>
      </button>
    </div>

    <div v-show="subTab === 'general'">
    <div class="actions">
      <button class="action" @click="onCopy">Copy</button>
      <button class="action" @click="onCut">Cut</button>
      <button class="action" :disabled="!store.canPaste" @click="onPaste">Paste</button>
    </div>

    <h2>Content</h2>
    <div class="fields">
    <div
      v-for="f in textFields"
      :key="`${sel?.id ?? 'none'}:${f.key}`"
      class="field"
      :class="{ 'field-full': f.full }"
    >
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
    <ShapeFields
      v-if="sel && sel.control === 'shape'"
      :shape="propValue('shape')"
      :sides="shapeNum('sides')"
      :points="shapeNum('points')"
      :inner-ratio="shapeNum('innerRatio')"
      :path="propValue('path')"
      :radius="shapeNum('radius')"
      @set="onShapeProp"
    />
    </div>
    <p v-if="textFields.length === 0 && !isGroupSel() && sel?.control !== 'shape' && sel?.control !== 'canvas'" class="hint">No content properties.</p>
    <p v-if="sel?.control === 'canvas'" class="hint">
      Painted by the <strong>draw</strong> event script in the Script tab — use
      <code>self.ctx</code> and call <code>self.animate()</code> for animation.
    </p>
    <template v-if="showStyle">
    <h2>Style</h2>
    <div class="fields">
    <TextStyleFields
      v-if="styleTargets.length"
      :caps="styleCaps"
      :font-size="styleFontSize()"
      :font-family="styleStr('fontFamily')"
      :bold="styleBool('bold')"
      :italic="styleBool('italic')"
      :text-align="styleStr('textAlign')"
      :v-align="styleStr('vAlign')"
      :text-color="styleStr('textColor')"
      :text-color-swatch="styleSwatch('textColor')"
      :track-color="styleStr('trackColor')"
      :track-color-swatch="styleSwatch('trackColor')"
      :background="styleStr('background')"
      :background-swatch="styleSwatch('background')"
      :mixed="styleMixed"
      @set="setStyleProp"
    />
    <BoxStyleFields
      v-if="boxTargets.length"
      :caps="styleCaps"
      :border-width="borderWidthValue()"
      :border-style="borderStyleValue()"
      :border-color="borderColorValue()"
      :border-color-swatch="styleSwatch('borderColor')"
      :radius="styleNum('radius')"
      :opacity="styleNum('opacity')"
      :mixed="styleMixed"
      @set="setStyleProp"
    />
    <div v-if="sel!.control === 'switch'" class="field">
      <label>Checked</label>
      <input
        type="checkbox"
        class="switch-checked"
        :checked="sel!.props['checked'] === true"
        @change="store.updateProps(sel!.id, { checked: ($event.target as HTMLInputElement).checked })"
      />
    </div>
    </div>
    </template>
    <p v-if="isGroupSel()" class="hint">
      Groups have no content of their own — edit members for content. The Style
      section above applies to the group's text members; borders are per-object.
    </p>
    </div>

    <div v-show="subTab === 'script'">
    <div class="row">
      <h2>Script</h2>
      <HelpButton anchor="object-scripts" />
    </div>
    <div class="event-row">
      <label>Event</label>
      <select v-model="currentEvent">
        <option v-for="e in eventNames" :key="e" :value="e" :class="{ scripted: hasScript(e) }">{{ hasScript(e) ? e + ' •' : e }}</option>
      </select>
    </div>
    <div class="script-fill">
      <ScriptEditor
        :key="sel ? `${sel.id}:${currentEvent}` : 'none'"
        editor-class="obj-script"
        kind="object"
        :title="sel ? `Script · ${sel.name} · ${currentEvent}` : 'Object script'"
        :link-key="sel ? `obj:${sel.id}:${currentEvent}` : ''"
        :model-value="eventScript"
        height="100%"
        @update:model-value="onScript"
      />
    </div>
    <p v-if="isGroupSel()" class="hint">
      A group handler runs when a member without its own handler is clicked, or
      when a member's script ends with <code>forward()</code>. Here
      <code>target</code> is the member, <code>self</code> the group.
    </p>
    </div>

    <div v-show="subTab === 'general'">
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

    <div class="row">
      <h2>Geometry</h2>
      <HelpButton anchor="responsive-edges" />
    </div>
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

    <div v-if="canFit()" class="fill-group">
      <div class="fill-group-title" title="Stretch the object to the page edges. The Fill margin gap is left on each side; it is not the control's outer Margin.">
        Fill to page
      </div>
      <div class="fill-actions">
        <button class="fill" title="Stretch to all four page edges, leaving the Fill margin on each side (Follows both)." @click="onFill">Fill page</button>
        <button class="fill" title="Stretch to the left and right page edges, leaving the Fill margin on each side (Follows both horizontally)." @click="onFillWidth">Fill width</button>
        <button class="fill" title="Stretch to the top and bottom page edges, leaving the Fill margin on each side (Follows both vertically)." @click="onFillHeight">Fill height</button>
        <button class="fill" title="Centre the object on the page (Centred on both axes)." @click="onCenterInPage">Center</button>
      </div>
      <label class="fill-margin-label" title="Gap left to the page edges when you click a Fill button. Remembered between sessions. This is not the control's outer Margin.">
        Fill margin
        <input class="fill-margin" type="number" min="0" step="4" v-model.number="fillMargin" />
      </label>
    </div>

    <button class="delete" @click="store.removeSelected()">Delete object</button>
    </div>
  </div>
</template>

<style scoped>
.panel {
  container-type: inline-size;
}

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

/* Content fields: one column narrow, two once the panel is wide enough.
   Long/rich controls span both columns; short ones pair up. */
.fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px 12px;
  align-items: start;
}

.fields .field {
  margin-bottom: 0;
}

.field-full {
  grid-column: 1 / -1;
}

.field-full .url-row {
  max-width: 560px;
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

.fill-group {
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 8px;
  margin: 10px 0 14px;
  background: rgba(255, 255, 255, 0.015);
}

.fill-group-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ed-text-dim);
  margin-bottom: 6px;
}

.fill-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.fill {
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
  margin-top: 8px;
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
  max-width: 640px;
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

.subtabs {
  display: flex;
  gap: 2px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 2px;
  margin: 8px 0 12px;
}

.subtabs button {
  flex: 1;
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 8px 6px;
  cursor: pointer;
}

.subtabs button:hover {
  color: var(--ed-text);
}

.subtabs button.on {
  color: #fff;
  background: var(--ed-accent);
}

.subtabs button.on .tab-mark {
  color: #fff;
}

.tab-mark {
  color: var(--ed-accent);
  font-weight: 700;
  margin-left: 2px;
}

.script-fill {
  height: calc(100vh - 260px);
  min-height: 260px;
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

/* wide panel: paired fields, four-up fill actions. Kept last so it wins over
   the narrow defaults above (equal specificity — source order decides). The
   400px threshold is the panel's content box (aside width minus its padding). */
@container (min-width: 400px) {
  .fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .fill-actions {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .geo {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>