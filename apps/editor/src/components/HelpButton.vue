<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { marked } from 'marked'
import guideMd from '../../../../docs/scripting-guide.md?raw'

const props = defineProps<{ anchor?: string }>()

const open = ref(false)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}

const html = computed(() =>
  marked
    .parse(guideMd, { async: false })
    .replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
      return `<h${level} id="${slugify(inner.replace(/<[^>]+>/g, ''))}">${inner}</h${level}>`
    }),
)

async function show(): Promise<void> {
  open.value = true
  await nextTick()
  if (props.anchor) {
    document.getElementById(props.anchor)?.scrollIntoView({ block: 'start' })
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}

watch(open, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <button class="tb-help-btn" title="Open the scripting guide" @click.stop="show">?</button>
  <Teleport to="body">
    <div v-if="open" class="tb-help-overlay" @click.self="open = false">
      <div class="tb-help-modal" role="dialog" aria-modal="true" aria-label="Scripting guide">
        <header class="tb-help-header">
          <span>toolback · scripting guide</span>
          <button class="tb-help-close" title="Close" @click="open = false">×</button>
        </header>
        <div class="tb-help-content" v-html="html"></div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.tb-help-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--ed-border);
  background: var(--ed-bg);
  color: var(--ed-text-dim);
  font: 600 11px/1 system-ui, sans-serif;
  cursor: help;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.tb-help-btn:hover {
  color: #fff;
  border-color: var(--ed-accent);
}

.tb-help-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.tb-help-modal {
  display: flex;
  flex-direction: column;
  width: 760px;
  max-width: 100%;
  max-height: 85vh;
  background: #14171d;
  border: 1px solid var(--ed-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}

.tb-help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font: 600 13px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-panel);
  border-bottom: 1px solid var(--ed-border);
}

.tb-help-close {
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
}

.tb-help-close:hover {
  color: #fff;
}

.tb-help-content {
  overflow-y: auto;
  padding: 20px 26px 30px;
  font: 14px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #d3d8e0;
}

.tb-help-content h1 {
  font-size: 22px;
  color: #fff;
  margin: 4px 0 14px;
}

.tb-help-content h2 {
  font-size: 15px;
  color: #fff;
  margin: 26px 0 8px;
  padding-top: 14px;
  border-top: 1px solid var(--ed-border);
  scroll-margin-top: 12px;
}

.tb-help-content h3 {
  font-size: 13px;
  color: var(--ed-accent);
  margin: 18px 0 6px;
}

.tb-help-content p,
.tb-help-content ul,
.tb-help-content ol {
  margin: 8px 0;
}

.tb-help-content li {
  margin: 3px 0;
}

.tb-help-content strong {
  color: #fff;
}

.tb-help-content code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  background: #0f1115;
  border: 1px solid var(--ed-border);
  border-radius: 4px;
  padding: 1px 5px;
  color: #a5b4fc;
}

.tb-help-content pre {
  background: #0f1115;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  margin: 10px 0;
}

.tb-help-content pre code {
  background: transparent;
  border: none;
  padding: 0;
  color: #9fe8c5;
}

.tb-help-content table {
  border-collapse: collapse;
  margin: 10px 0;
  width: 100%;
}

.tb-help-content th,
.tb-help-content td {
  border: 1px solid var(--ed-border);
  padding: 6px 10px;
  text-align: left;
  font-size: 13px;
}

.tb-help-content th {
  background: var(--ed-panel);
  color: #fff;
}

.tb-help-content a {
  color: var(--ed-accent);
}
</style>
