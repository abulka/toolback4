<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ControlKind } from '@toolback/format'
import { wireCanvas } from './canvasClient'
import { startPaletteDrag } from './paletteDrag'
import { useBookStore } from './stores/book'
import PropertiesPanel from './components/PropertiesPanel.vue'
import ScriptEditor from './components/ScriptEditor.vue'
import HelpButton from './components/HelpButton.vue'

const store = useBookStore()
const iframe = ref<HTMLIFrameElement | null>(null)

onMounted(() => {
  if (iframe.value) wireCanvas(iframe.value)
})

const palette: ControlKind[] = ['button', 'label', 'input', 'image', 'card', 'container']

function onPaletteDown(kind: ControlKind, e: PointerEvent): void {
  if (iframe.value && !store.isRunning) startPaletteDrag(e, kind, iframe.value)
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">toolback</span>
        <span class="badge">v4 · M2 scripting</span>
      </div>
      <button
        class="run"
        :class="{ running: store.isRunning }"
        title="Toggle run mode"
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
    </aside>

    <main class="canvas-area" :class="{ active: store.dragOverCanvas }">
      <iframe
        ref="iframe"
        class="canvas"
        src="/canvas.html"
        title="toolback canvas"
      ></iframe>
    </main>

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
        <span>{{ store.objectCount }} objects · book "{{ store.book.title }}" · page "{{ store.activePage.name }}"</span>
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
  grid-template-columns: 220px 1fr 330px;
  grid-template-areas:
    'top top top'
    'palette canvas props'
    'status status status';
  height: 100vh;
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
  width: 1280px;
  height: 800px;
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
