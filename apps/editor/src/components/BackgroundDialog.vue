<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CanvasSize } from '@toolback/format'
import { resolvePageSize } from '@toolback/format'
import { useBookStore } from '../stores/book'

const store = useBookStore()

const bg = computed(() =>
  store.book.backgrounds.find((b) => b.id === store.backgroundDialogId) ?? null,
)
const bp = computed(() => store.breakpoint)
const BP_LABEL: Record<string, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

const bookDefault = computed<CanvasSize>(
  () => store.book.canvas[bp.value] ?? store.book.canvas.desktop!,
)

/** the size in effect right now (override or book default) */
const effective = computed<CanvasSize>(() =>
  bg.value ? resolvePageSize(store.book, bg.value ?? undefined, bp.value) : { width: 0, height: 0 },
)

const usesDefault = computed<boolean>(() => !bg.value?.size?.[bp.value])

const PRESETS: CanvasSize[] = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 800, height: 600 },
  { width: 320, height: 240 },
]

const which = computed<string>(() => {
  if (usesDefault.value) return 'default'
  const size = bg.value!.size![bp.value]!
  const preset = PRESETS.find((p) => p.width === size.width && p.height === size.height)
  return preset ? `${preset.width}x${preset.height}` : 'other'
})

function setUseDefault(use: boolean): void {
  if (!bg.value) return
  if (use) {
    store.setBackgroundSize(bg.value.id, bp.value, null)
  } else {
    // start the override from the size currently in effect
    store.setBackgroundSize(bg.value.id, bp.value, { ...effective.value })
  }
}

function pickPreset(p: CanvasSize): void {
  if (!bg.value) return
  store.setBackgroundSize(bg.value.id, bp.value, { ...p })
}

function pickOther(): void {
  if (!bg.value || !usesDefault.value) return
  setUseDefault(false)
}

const MIN_W = 160
const MIN_H = 120
const MAX = 4096

function clampW(w: number): number {
  return Math.max(MIN_W, Math.min(MAX, Math.round(w)))
}
function clampH(h: number): number {
  return Math.max(MIN_H, Math.min(MAX, Math.round(h)))
}

function setW(w: number): void {
  if (!bg.value) return
  const size = bg.value.size?.[bp.value] ?? { ...effective.value }
  store.setBackgroundSize(bg.value.id, bp.value, { ...size, width: clampW(w) })
}
function setH(h: number): void {
  if (!bg.value) return
  const size = bg.value.size?.[bp.value] ?? { ...effective.value }
  store.setBackgroundSize(bg.value.id, bp.value, { ...size, height: clampH(h) })
}

function close(): void {
  store.backgroundDialogId = null
}

// ---- draggable size widget (the ToolBook preview: drag the page's corner) ----

const BOX_W = 244
const BOX_H = 164
const PAD = 12
/** the rect is drawn at 80% of the fit scale, leaving visible room to grow */
const HEADROOM = 0.8

function fitScale(w: number, h: number): number {
  if (!w || !h) return 1
  return Math.min((BOX_W - PAD * 2) / w, (BOX_H - PAD * 2) / h)
}

/**
 * Display scale — refits (with headroom) between drags so there is always
 * room to drag in any direction, and freezes during a drag so the rect
 * tracks the pointer 1:1 instead of re-scaling under it.
 */
const dragging = ref(false)
const viewScale = ref(1)
watch(
  [effective, dragging],
  ([size, active]) => {
    if (!active) viewScale.value = fitScale(size.width, size.height) * HEADROOM
  },
  { immediate: true },
)
const previewW = computed(() => Math.max(8, Math.round(effective.value.width * viewScale.value)))
const previewH = computed(() => Math.max(8, Math.round(effective.value.height * viewScale.value)))

function onHandleDown(e: PointerEvent): void {
  if (!bg.value || dragging.value) return
  const scaleRef = viewScale.value || 1
  const startW = effective.value.width
  const startH = effective.value.height
  const startX = e.clientX
  const startY = e.clientY
  dragging.value = true
  const target = e.currentTarget as HTMLElement
  try {
    target.setPointerCapture(e.pointerId)
  } catch {
    // synthetic events / pointer already released — window listeners track fine
  }
  if (usesDefault.value) setUseDefault(false)
  const move = (ev: PointerEvent): void => {
    const w = clampW(startW + (ev.clientX - startX) / scaleRef)
    const h = clampH(startH + (ev.clientY - startY) / scaleRef)
    setW(w)
    setH(h)
  }
  const done = (): void => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', done)
    window.removeEventListener('pointercancel', done)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', done)
  window.addEventListener('pointercancel', done)
}

const wBuf = ref('')
const hBuf = ref('')

// keep the number inputs in step with the store (undo, breakpoint switch…)
watch(
  effective,
  (size) => {
    wBuf.value = String(size.width)
    hBuf.value = String(size.height)
  },
  { immediate: true },
)

function commitW(): void {
  const n = Number(wBuf.value)
  if (Number.isFinite(n)) setW(n)
  else wBuf.value = String(effective.value.width)
}
function commitH(): void {
  const n = Number(hBuf.value)
  if (Number.isFinite(n)) setH(n)
  else hBuf.value = String(effective.value.height)
}

/** delete from inside the dialog (with pages confirm when referenced) */
function removeFromDialog(): void {
  const target = bg.value
  if (!target) return
  if (store.book.backgrounds.length <= 1) return
  const used = store.book.pages.filter((p) => p.backgroundId === target.id).length
  if (used > 0) {
    const ok = window.confirm(
      `"${target.name}" is used by ${used} page${used === 1 ? '' : 's'}.\n\n` +
        'OK deletes the background AND those pages.',
    )
    if (!ok) return
  }
  store.removeBackground(target.id, used > 0)
  close()
}
</script>

<template>
  <div v-if="bg" class="overlay" @pointerdown.self="close">
    <div class="dialog" role="dialog" aria-label="Properties for Background">
      <div class="titlebar">
        <h3>Properties for Background</h3>
        <button class="x" title="Close" @click="close">✕</button>
      </div>

      <div class="field">
        <label>Name</label>
        <input
          :value="bg.name"
          @input="store.setBackgroundProp(bg.id, { name: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <div class="field">
        <label>Colour (fills every page on this background)</label>
        <div class="color-row">
          <input
            type="color"
            :value="bg.color"
            @input="store.setBackgroundProp(bg.id, { color: ($event.target as HTMLInputElement).value })"
          />
          <input
            class="hex"
            :value="bg.color"
            spellcheck="false"
            @change="store.setBackgroundProp(bg.id, { color: ($event.target as HTMLInputElement).value })"
          />
        </div>
      </div>

      <div class="sizebox">
        <label class="check use-default">
          <input
            type="checkbox"
            :checked="usesDefault"
            @change="setUseDefault(($event.target as HTMLInputElement).checked)"
          />
          Use the book default page size ({{ bookDefault.width }} × {{ bookDefault.height }} ·
          {{ BP_LABEL[bp] || bp }})
        </label>

        <div v-if="!usesDefault" class="presets">
          <label v-for="p in PRESETS" :key="`${p.width}x${p.height}`" class="radio">
            <input
              type="radio"
              name="bgsize"
              :checked="which === `${p.width}x${p.height}`"
              @change="pickPreset(p)"
            />
            {{ p.width }} × {{ p.height }}
          </label>
          <label class="radio other">
            <input
              type="radio"
              name="bgsize"
              :checked="which === 'other'"
              @change="pickOther"
            />
            Other:
            <span class="units">Page units</span>
            <span class="wh">
              <em>Width</em>
              <input
                v-model="wBuf"
                class="num"
                inputmode="numeric"
                @change="commitW"
              />
              <em>Height</em>
              <input
                v-model="hBuf"
                class="num"
                inputmode="numeric"
                @change="commitH"
              />
            </span>
          </label>
        </div>

        <div class="preview">
          <div
            class="page-rect"
            :style="{ width: `${previewW}px`, height: `${previewH}px` }"
          >
            <div
              class="handle"
              title="Drag to resize the page"
              @pointerdown.prevent="onHandleDown"
            ></div>
          </div>
        </div>
        <p class="dims">{{ effective.width }} × {{ effective.height }} page units — drag the corner of the preview</p>
      </div>

      <p class="note">
        Pages on this background show {{ effective.width }} × {{ effective.height }} at
        {{ BP_LABEL[bp] || bp }}; other breakpoints follow the book size unless overridden.
      </p>
      <div class="foot">
        <button
          class="danger"
          :disabled="store.book.backgrounds.length <= 1"
          :title="store.book.backgrounds.length <= 1 ? 'A book always keeps one background' : 'Delete this background'"
          @click="removeFromDialog"
        >Delete…</button>
        <button class="done" @click="close">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 420px;
  max-height: 86vh;
  overflow: auto;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 12px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
  padding: 14px 16px 16px;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.titlebar h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ed-text-dim);
}

.x {
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
}

.x:hover {
  color: #fff;
  background: var(--ed-border);
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
}

.field input:focus {
  outline: none;
  border-color: var(--ed-accent);
}

.color-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-row input[type='color'] {
  width: 42px;
  height: 32px;
  padding: 2px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  cursor: pointer;
}

.hex {
  width: 110px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
}

.sizebox {
  border: 1px solid var(--ed-border);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 12px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  cursor: pointer;
}

.check input,
.radio input {
  accent-color: var(--ed-accent);
}

.presets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0 4px 4px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  cursor: pointer;
}

.radio.other {
  flex-wrap: wrap;
}

.radio .units {
  color: var(--ed-text-dim);
  font-size: 11px;
}

.wh {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-left: 22px;
}

.wh em {
  font-style: normal;
  font-size: 11px;
  color: var(--ed-text-dim);
  width: 44px;
}

.num {
  width: 74px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 5px 8px;
  font: 12px ui-monospace, 'SF Mono', Menlo, monospace;
}

.num:focus {
  outline: none;
  border-color: var(--ed-accent);
}

.preview {
  margin-top: 12px;
  border-radius: 8px;
  background:
    linear-gradient(45deg, #2a2f3a 25%, transparent 25%, transparent 75%, #2a2f3a 75%),
    linear-gradient(45deg, #2a2f3a 25%, #232833 25%, #232833 75%, #2a2f3a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
  border: 1px solid var(--ed-border);
  height: 164px;
  width: 244px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
}

.page-rect {
  position: absolute;
  left: 12px;
  top: 12px;
  background: #f8fafc;
  border: 1px solid #94a3b8;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.handle {
  position: absolute;
  right: -7px;
  bottom: -7px;
  width: 14px;
  height: 14px;
  background: #fff;
  border: 2px solid var(--ed-accent);
  border-radius: 3px;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 2;
}

.handle:hover {
  background: var(--ed-accent);
}

.dims {
  margin: 8px 2px 0;
  font: 10.5px ui-monospace, 'SF Mono', Menlo, monospace;
  color: #94a3b8;
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  margin-top: 12px;
}

.note {
  font-size: 10.5px;
  color: var(--ed-text-dim);
  line-height: 1.4;
  margin: 12px 2px 0;
}

.danger {
  font: 600 12px/1 system-ui, sans-serif;
  color: var(--ed-err, #f87171);
  background: transparent;
  border: 1px solid var(--ed-err, #f87171);
  border-radius: 8px;
  padding: 7px 12px;
  cursor: pointer;
  flex: none;
}

.danger:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.12);
}

.danger:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.done {
  font: 600 12.5px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  cursor: pointer;
  flex: none;
}

.done:hover {
  filter: brightness(1.1);
}
</style>
