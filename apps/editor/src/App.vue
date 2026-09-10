<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ControlKind } from '@toolback/format'
import { shouldToggleRun } from '@toolback/runtime'
import { wireCanvas } from './canvasClient'
import { startPaletteDrag } from './paletteDrag'
import { useBookStore } from './stores/book'
import { openBookFile, saveBookFile, saveTextFile } from './files'
import { buildStandaloneHtml, standaloneFileName } from './publish'
import PropertiesPanel from './components/PropertiesPanel.vue'
import ScriptEditor from './components/ScriptEditor.vue'
import HelpButton from './components/HelpButton.vue'
import PagesPanel from './components/PagesPanel.vue'

const store = useBookStore()
const iframe = ref<HTMLIFrameElement | null>(null)

// F3 or ⌥3 (Alt+3) toggles Run. Capture phase + stopPropagation so it wins
// over Monaco's F3 find-next; ⌥3 is skipped in editable targets by shouldToggleRun.
// Keydowns inside the canvas iframe are handled canvas-side (editorLink) instead.
function onRunKey(e: KeyboardEvent): void {
  if (!shouldToggleRun(e)) return
  e.preventDefault()
  e.stopPropagation()
  store.toggleRun()
}

onMounted(async () => {
  window.addEventListener('keydown', onRunKey, true)
  if (iframe.value) wireCanvas(iframe.value)
  await store.restoreAutosave()
  await store.refreshRecents()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onRunKey, true)
})

const palette: ControlKind[] = ['button', 'label', 'input', 'image', 'card', 'container']

function onPaletteDown(kind: ControlKind, e: PointerEvent): void {
  if (iframe.value && !store.isRunning) startPaletteDrag(e, kind, iframe.value)
}

async function onNew(): Promise<void> {
  store.newBook()
  await store.rememberCurrent()
}

async function onSave(): Promise<void> {
  try {
    const result = await saveBookFile(store.book)
    await store.rememberCurrent()
    store.fileNote = result === 'saved' ? 'saved to file' : 'downloaded'
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = String(err)
    }
  }
}

async function onOpen(): Promise<void> {
  try {
    const book = await openBookFile()
    if (book && store.hydrate(book)) await store.rememberCurrent()
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = `Open failed: ${String(err)}`
    }
  }
}

async function onRecent(e: Event): Promise<void> {
  const id = (e.target as HTMLSelectElement).value
  ;(e.target as HTMLSelectElement).value = ''
  if (id) await store.openRecent(id)
}

const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const

async function onPublish(): Promise<void> {
  try {
    const player = await fetch('/toolback-player.js').then((r) => r.text())
    const html = buildStandaloneHtml(store.book, player)
    const result = await saveTextFile(standaloneFileName(store.book), html, 'text/html')
    store.fileNote = result === 'saved' ? 'published to file' : 'published (downloaded)'
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = `Publish failed: ${String(err)}`
    }
  }
}

const canvasStyle = computed(() => {
  const size = store.book.canvas[store.breakpoint] ?? store.book.canvas.desktop
  return { width: `${size.width}px`, height: `${size.height}px` }
})

function startSplitDrag(e: PointerEvent): void {
  const startX = e.clientX
  const startW = store.propsWidth
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent): void => {
    const w = Math.round(Math.min(640, Math.max(260, startW - (ev.clientX - startX))))
    store.propsWidth = w
  }
  const up = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    store.savePropsWidth()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
</script>

<template>
  <div class="shell" :style="{ gridTemplateColumns: `220px 1fr 6px ${store.propsWidth}px` }">
    <header class="topbar">
      <div class="left-group">
        <div class="brand">
          <span class="logo">toolback</span>
          <span class="badge">v4 · M4 publish</span>
        </div>
        <div class="filebar">
          <button @click="onNew">New</button>
          <button @click="onOpen">Open…</button>
          <button @click="onSave">Save</button>
          <button class="publish" @click="onPublish">Publish</button>
          <select v-if="store.recents.length" class="recents" @change="onRecent">
            <option value="">Recent…</option>
            <option v-for="r in store.recents" :key="r.id" :value="r.id">{{ r.title }}</option>
          </select>
        </div>
        <div class="bp-switch" title="Preview breakpoint">
          <button
            v-for="bp in BREAKPOINTS"
            :key="bp"
            :class="{ on: store.breakpoint === bp }"
            :disabled="store.isRunning"
            @click="store.setBreakpoint(bp)"
          >
            {{ bp[0]!.toUpperCase() + bp.slice(1, 3) }}
          </button>
        </div>
      </div>
      <button
        class="run"
        :class="{ running: store.isRunning }"
        title="Toggle run mode (F3 or ⌥3)"
        @click="store.toggleRun()"
      >
        {{ store.isRunning ? 'Stop' : 'Run' }}
      </button>
    </header>

    <aside class="palette">
      <h2>Palette</h2>
      <ul>
        <li v-for="kind in palette" :key="kind" @pointerdown="onPaletteDown(kind, $event)">
          <span class="swatch"></span>
          <span class="name">{{ kind }}</span>
        </li>
      </ul>
      <p class="hint">Drag onto the canvas →</p>
      <PagesPanel />
    </aside>

    <main class="canvas-area" :class="{ active: store.dragOverCanvas }">
      <iframe
        ref="iframe"
        class="canvas"
        :style="canvasStyle"
        src="/canvas.html"
        title="toolback canvas"
      ></iframe>
    </main>

    <div
      class="splitter"
      title="Drag to resize · double-click to reset"
      @pointerdown="startSplitDrag"
      @dblclick="store.resetPropsWidth()"
    ></div>

    <aside class="properties">
      <h2>Page</h2>
      <div class="field">
        <label>Title</label>
        <input :value="store.book.title" disabled />
      </div>
      <div class="field">
        <label>Page name</label>
        <input :value="store.activePage.name" disabled />
      </div>

      <div class="row">
        <h2>Page script</h2>
        <HelpButton anchor="page-script" />
      </div>
      <p class="hint mono-hint">
        Shared functions + <code>pageEnter()</code>. Object scripts can call these directly.
      </p>
      <ScriptEditor
        editor-class="page-script"
        :model-value="store.activePage.script"
        height="190px"
        @update:model-value="store.setPageScript"
      />

      <h2>Selection</h2>
      <PropertiesPanel />

      <h2>Objects</h2>
      <ul class="objects">
        <li
          v-for="obj in store.activePage.objects"
          :key="obj.id"
          :class="{ selected: obj.id === store.selectionId }"
          @click="store.setSelection(obj.id)"
        >
          <span class="obj-kind">{{ obj.control }}</span>
          <span class="obj-name">{{ obj.name }}</span>
        </li>
      </ul>
    </aside>

    <footer class="status">
      <template v-if="store.error">
        <span class="err">canvas error: {{ store.error }}</span>
      </template>
      <template v-else-if="store.canvasReady">
        <span class="ok">● canvas ready</span>
        <span class="mode" :class="{ running: store.isRunning }">{{ store.isRunning ? 'RUNNING' : 'design' }}</span>
        <span>page {{ store.currentPageIndex + 1 }}/{{ store.book.pages.length }} · {{ store.objectCount }} objects · "{{ store.book.title }}"</span>
        <span v-if="store.autosaveAt" class="dim">autosaved {{ new Date(store.autosaveAt).toLocaleTimeString() }}</span>
        <span v-if="store.fileNote" class="dim">{{ store.fileNote }}</span>
        <span v-if="store.scriptError" class="err">script: {{ store.scriptError }}</span>
      </template>
      <template v-else>
        <span>waiting for canvas…</span>
      </template>
    </footer>
  </div>
</template>

<style>
:root {
  --ed-bg: #0f1115;
  --ed-panel: #161a21;
  --ed-border: #262c37;
  --ed-text: #e5e7eb;
  --ed-text-dim: #8b93a1;
  --ed-accent: #6366f1;
  --ed-ok: #34d399;
  --ed-err: #f87171;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
}

body.tb-palette-dragging,
body.tb-palette-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}

.tb-drag-ghost {
  position: fixed;
  z-index: 999;
  pointer-events: none;
  font: 600 12px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.shell {
  display: grid;
  grid-template-rows: 48px 1fr 28px;
  grid-template-columns: 220px 1fr 6px 330px;
  grid-template-areas:
    'top top top top'
    'palette canvas split props'
    'status status status status';
  height: 100vh;
}

.splitter {
  grid-area: split;
  cursor: col-resize;
  background: var(--ed-border);
  touch-action: none;
  user-select: none;
}

.splitter:hover {
  background: var(--ed-accent);
}

.topbar {
  grid-area: top;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--ed-panel);
  border-bottom: 1px solid var(--ed-border);
}

.left-group {
  display: flex;
  align-items: center;
  gap: 18px;
}

.filebar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filebar button {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}

.filebar button:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.recents {
  max-width: 140px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text-dim);
  padding: 6px 6px;
  font: 500 12px/1 system-ui, sans-serif;
}

.publish {
  border-color: var(--ed-accent) !important;
  color: #c7d2fe !important;
}

.publish:hover {
  background: var(--ed-accent) !important;
  color: #fff !important;
}

.bp-switch {
  display: flex;
  gap: 2px;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 2px;
  background: var(--ed-bg);
}

.bp-switch button {
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
}

.bp-switch button.on {
  color: #fff;
  background: var(--ed-accent);
}

.bp-switch button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dim {
  color: var(--ed-text-dim);
  opacity: 0.8;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.logo {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.3px;
}

.badge {
  font-size: 11px;
  color: var(--ed-text-dim);
  border: 1px solid var(--ed-border);
  border-radius: 999px;
  padding: 2px 8px;
}

.run {
  font: 600 13px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  cursor: pointer;
  min-width: 76px;
}

.run.running {
  background: #059669;
}

.mono-hint {
  margin: 0 0 6px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row h2 {
  margin-bottom: 4px;
}

.mono-hint code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: var(--ed-accent);
}

.palette {
  grid-area: palette;
  background: var(--ed-panel);
  border-right: 1px solid var(--ed-border);
  padding: 12px;
  overflow: auto;
}

.properties {
  grid-area: props;
  background: var(--ed-panel);
  border-left: 1px solid var(--ed-border);
  padding: 12px;
  overflow: auto;
}

h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ed-text-dim);
  margin: 14px 0 8px;
}

h2:first-child {
  margin-top: 2px;
}

.palette ul,
.objects {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.palette li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: grab;
}

.palette li:hover {
  border-color: var(--ed-accent);
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: var(--ed-accent);
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
  color: var(--ed-text-dim);
  padding: 7px 9px;
  font: inherit;
}

.objects li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: pointer;
}

.objects li.selected {
  border-color: var(--ed-accent);
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
  font-size: 12px;
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 12px 2px 0;
}

.canvas-area {
  grid-area: canvas;
  overflow: auto;
  padding: 20px;
}

.canvas {
  background: #fff;
  border: none;
  outline: 1px solid var(--ed-border);
  outline-offset: -1px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.canvas-area.active .canvas {
  outline: 2px solid var(--ed-accent);
  outline-offset: -2px;
}

.status {
  grid-area: status;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 14px;
  font-size: 12px;
  color: var(--ed-text-dim);
  background: var(--ed-panel);
  border-top: 1px solid var(--ed-border);
}

.ok {
  color: var(--ed-ok);
}

.mode {
  border: 1px solid var(--ed-border);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  letter-spacing: 0.8px;
}

.mode.running {
  color: #059669;
  border-color: #059669;
}

.err {
  color: var(--ed-err);
}
</style>
