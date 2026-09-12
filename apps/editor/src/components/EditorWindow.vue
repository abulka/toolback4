<script lang="ts">
// module-wide z-order counter — a `<script setup>` top-level let is re-created
// per instance, so the counter lives in a plain `<script>` block where it is
// truly shared across every EditorWindow. A window opened later (or clicked)
// always rises above the ones already on screen.
let zCounter = 1000
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A draggable, resizable floating window (the "popout" editor shell).
 * - drag by the title bar
 * - resize from the bottom-right handle
 * - size/position remembered per `skey` in localStorage
 * - closer to the OS window feel for real editing, instead of the cramped
 *   right-hand panel
 */
const props = withDefaults(
  defineProps<{
    title: string
    width?: number
    height?: number
    /** localStorage key suffix — keeps each editor's window size/pos separate */
    skey: string
  }>(),
  { width: 760, height: 520 },
)

const emit = defineEmits<{ (e: 'close'): void }>()

interface SavedGeom {
  x: number
  y: number
  w: number
  h: number
}

const storageKey = `toolback.window.${props.skey}`
function loadGeom(): Partial<SavedGeom> {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<SavedGeom>
  } catch {
    return {}
  }
}
function saveGeom(): void {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ x: x.value, y: y.value, w: w.value, h: h.value }),
  )
}

// centre on first open unless a saved position exists
const saved = loadGeom()
const x = ref(saved.x ?? Math.max(0, Math.round((window.innerWidth - props.width) / 2)))
const y = ref(saved.y ?? Math.max(0, Math.round((window.innerHeight - props.height) / 2)))
const w = ref(saved.w ?? props.width)
const h = ref(saved.h ?? props.height)
const z = ref(0)

function raise(): void {
  zCounter += 1
  z.value = zCounter
}

// a freshly opened window comes to the front immediately
onMounted(() => raise())

// ---- drag ----
const drag = ref<{ dx: number; dy: number } | null>(null)
function onBarDown(e: PointerEvent): void {
  if ((e.target as HTMLElement).closest('.tb-window-close')) return
  raise()
  drag.value = { dx: e.clientX - x.value, dy: e.clientY - y.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onBarMove(e: PointerEvent): void {
  if (!drag.value) return
  x.value = Math.min(
    Math.max(-40, e.clientX - drag.value.dx),
    window.innerWidth - 60,
  )
  y.value = Math.min(Math.max(0, e.clientY - drag.value.dy), window.innerHeight - 40)
}
function onBarUp(e: PointerEvent): void {
  drag.value = null
  saveGeom()
}

const MIN_W = 380
const MIN_H = 260

// ---- resize ----
const resize = ref<{ sx: number; sy: number; sw: number; sh: number } | null>(null)
function onResizeDown(e: PointerEvent): void {
  raise()
  resize.value = { sx: e.clientX, sy: e.clientY, sw: w.value, sh: h.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onResizeMove(e: PointerEvent): void {
  if (!resize.value) return
  w.value = Math.max(MIN_W, resize.value.sw + (e.clientX - resize.value.sx))
  h.value = Math.max(MIN_H, resize.value.sh + (e.clientY - resize.value.sy))
  w.value = Math.min(w.value, window.innerWidth - 20)
  h.value = Math.min(h.value, window.innerHeight - 20)
}
function onResizeUp(): void {
  resize.value = null
  saveGeom()
}

function onClose(): void {
  saveGeom()
  emit('close')
}

// esc closes the window unless the keystroke lands inside a monaco editor
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && !(e.target as HTMLElement).closest('.monaco-editor')) {
    onClose()
  }
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="tb-window"
      :class="{ dragging: drag || resize }"
      :style="{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, zIndex: z }"
      @pointerdown="raise"
    >
      <header
        class="tb-window-titlebar"
        @pointerdown="onBarDown"
        @pointermove="onBarMove"
        @pointerup="onBarUp"
      >
        <span class="tb-window-title">{{ title }}</span>
        <button class="tb-window-close" title="Close (Esc)" @click.stop="onClose">×</button>
      </header>
      <div class="tb-window-content">
        <slot />
      </div>
      <div
        class="tb-window-resize"
        title="Drag to resize"
        @pointerdown="onResizeDown"
        @pointermove="onResizeMove"
        @pointerup="onResizeUp"
      ></div>
    </div>
  </Teleport>
</template>

<style>
.tb-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: #14171d;
  border: 1px solid #2b3240;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}

.tb-window-titlebar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 8px 14px;
  background: #1b2028;
  border-bottom: 1px solid #262c37;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.tb-window.dragging .tb-window-titlebar {
  cursor: grabbing;
}

.tb-window-title {
  font: 600 13px/1 system-ui, -apple-system, sans-serif;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-window-close {
  flex: 0 0 auto;
  border: none;
  background: transparent;
  color: #8b93a1;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 6px;
}

.tb-window-close:hover {
  color: #fff;
  background: rgba(248, 113, 113, 0.15);
}

.tb-window-content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  padding: 10px;
}

.tb-window-content > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.tb-window-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  touch-action: none;
  background: linear-gradient(
    135deg,
    transparent 50%,
    rgba(99, 102, 241, 0.4) 50%
  );
  border-bottom-right-radius: 9px;
}
</style>