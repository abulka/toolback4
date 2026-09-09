<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { wireCanvas } from './canvasClient'
import { useBookStore } from './stores/book'

const store = useBookStore()
const iframe = ref<HTMLIFrameElement | null>(null)

onMounted(() => {
  if (iframe.value) wireCanvas(iframe.value)
})

const palette = [
  { kind: 'button', ready: true },
  { kind: 'label', ready: true },
  { kind: 'input', ready: false },
  { kind: 'image', ready: false },
  { kind: 'card', ready: false },
  { kind: 'container', ready: false },
]
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="logo">toolback</span>
        <span class="badge">v4 · M0 skeleton</span>
      </div>
      <button class="run" disabled title="Run mode lands in M2">Run</button>
    </header>

    <aside class="palette">
      <h2>Palette</h2>
      <ul>
        <li v-for="item in palette" :key="item.kind" :class="{ off: !item.ready }">
          <span class="swatch" :data-kind="item.kind"></span>
          <span class="name">{{ item.kind }}</span>
          <span v-if="!item.ready" class="chip">M1</span>
        </li>
      </ul>
      <p class="hint">Drag onto canvas arrives in M1.</p>
    </aside>

    <main class="canvas-area">
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

      <h2>Objects</h2>
      <ul class="objects">
        <li v-for="obj in store.activePage.objects" :key="obj.id">
          <span class="obj-kind">{{ obj.control }}</span>
          <span class="obj-name">{{ obj.name }}</span>
        </li>
      </ul>
      <p class="hint">Selection & editing land in M1.</p>
    </aside>

    <footer class="status">
      <template v-if="store.error">
        <span class="err">canvas error: {{ store.error }}</span>
      </template>
      <template v-else-if="store.canvasReady">
        <span class="ok">● canvas ready</span>
        <span>{{ store.objectCount }} objects · book "{{ store.book.title }}" · page "{{ store.activePage.name }}"</span>
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

.shell {
  display: grid;
  grid-template-rows: 48px 1fr 28px;
  grid-template-columns: 220px 1fr 280px;
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
  opacity: 0.45;
  cursor: not-allowed;
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
}

.palette li.off {
  opacity: 0.45;
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: var(--ed-accent);
}

.chip {
  margin-left: auto;
  font-size: 10px;
  color: var(--ed-text-dim);
  border: 1px solid var(--ed-border);
  border-radius: 999px;
  padding: 1px 6px;
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
  width: 1320px;
  height: 840px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
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

.err {
  color: var(--ed-err);
}
</style>
