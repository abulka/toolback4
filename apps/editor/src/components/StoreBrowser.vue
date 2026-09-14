<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBookStore } from '../stores/book'
import { parseDesignValue } from '../storeValue'
import { isStoreLabelSentinel } from '@toolback/runtime'

const store = useBookStore()

/** identical to the runtime store-value display for ordinary values */
function valueText(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/** display text for a run-mode store entry (labels are already resolved) */
function runValueText(v: unknown): string {
  return isStoreLabelSentinel(v) ? v.__tbLabel : valueText(v)
}

function kindOf(label: string): 'str' | 'other' {
  return label.startsWith('undefined') || label.startsWith('ƒ') || /^[[{]/.test(label) || /^-?\d/.test(label) || label === 'true' || label === 'false'
    ? 'other'
    : 'str'
}

/** whether a run value can be copied verbatim into the design store */
function copyable(v: unknown): boolean {
  return !isStoreLabelSentinel(v)
}

// ---- design-time editor ----

const entries = computed<Array<[string, unknown]>>(() => [...(store.book.store ?? [])])

const newKey = ref('')
const newValue = ref('')

/** the literal template syntax, shown as prose (Vue would eat {{ ... }}) */
const templateSample = '{{key}}'

/** replace the design store: drop blank keys, last occurrence wins (matching
 *  the runtime Map), keep insertion order */
function commit(next: Array<[string, unknown]>): void {
  const out: Array<[string, unknown]> = []
  for (const [k, v] of next) if (k.trim()) out.push([k.trim(), v])
  const seen = new Set<string>()
  const dedup: Array<[string, unknown]> = []
  for (let i = out.length - 1; i >= 0; i--) {
    const [k, v] = out[i]!
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push([k, v])
  }
  store.setDesignStore(dedup.reverse())
}

function onKeyInput(i: number, ev: Event): void {
  const next = entries.value.slice()
  next[i] = [String((ev.target as HTMLInputElement).value), next[i]![1]]
  commit(next)
}

function onValueInput(i: number, ev: Event): void {
  const next = entries.value.slice()
  next[i] = [next[i]![0], parseDesignValue(String((ev.target as HTMLInputElement).value))]
  commit(next)
}

function removeEntry(i: number): void {
  const next = entries.value.slice()
  next.splice(i, 1)
  commit(next)
}

function addEntry(): void {
  if (!newKey.value.trim()) return
  const next = entries.value.slice()
  next.push([newKey.value.trim(), parseDesignValue(newValue.value)])
  commit(next)
  newKey.value = ''
  newValue.value = ''
}

// ---- run mode: live stream with an explicit "copy to design" ----

/** the key whose row currently shows the "copied" confirmation */
const copiedKey = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

/** deliberately freeze a computed value back into the design store for the
 *  next run (undo isn't available while running, like every run-mode edit) */
function copyToDesign(k: string, v: unknown): void {
  const next = entries.value.filter(([key]) => key !== k)
  next.push([k, v])
  store.setDesignStore(next)
  copiedKey.value = k
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedKey.value = null
  }, 1200)
}
</script>

<template>
  <div class="store-browser">
    <template v-if="!store.isRunning">
      <p v-if="entries.length === 0" class="empty-hint">
        No design-time store values yet. Add keys below — they seed the store
        every time you <strong>Run</strong> (F3 or ⌥3), and
        <code>{{ templateSample }}</code> labels resolve against them right
        here in design view.
      </p>
      <ul v-else class="kv">
        <li v-for="(entry, i) of entries" :key="i" class="row">
          <input
            class="k"
            :value="entry[0]"
            aria-label="Store key"
            spellcheck="false"
            @input="onKeyInput(i, $event)"
          />
          <input
            class="v"
            :value="valueText(entry[1])"
            aria-label="Store value"
            spellcheck="false"
            @input="onValueInput(i, $event)"
          />
          <button class="icon" title="Remove entry" @click="removeEntry(i)">✕</button>
        </li>
      </ul>
      <div class="add-row">
        <input
          v-model="newKey"
          class="k"
          placeholder="key"
          aria-label="New store key"
          spellcheck="false"
        />
        <input
          v-model="newValue"
          class="v"
          placeholder="value"
          aria-label="New store value"
          spellcheck="false"
          @keydown.enter.prevent="addEntry"
        />
        <button class="add" title="Add entry" @click="addEntry">＋</button>
      </div>
      <p class="hint">
        Numbers, <code>true</code>/<code>false</code>, <code>null</code> and
        JSON <code>[…]</code>/<code>{…}</code>/<code>"…"</code> are parsed;
        anything else is stored as a string.
      </p>
    </template>

    <template v-else>
      <p v-if="store.storeEntries.length === 0" class="empty-hint">
        Running — no values yet. Scripts fill this as they call
        <code>store.set()</code>. Design-time values are already seeded.
      </p>
      <ul v-else class="kv">
        <li v-for="[k, v] in store.storeEntries" :key="k" class="row">
          <span class="k">{{ k }}</span>
          <span class="v" :class="kindOf(runValueText(v))">
            {{ runValueText(v) === '' ? '""' : runValueText(v) }}
          </span>
          <button
            class="icon"
            :class="{ copied: copiedKey === k }"
            :title="copiedKey === k ? 'Copied to design store' : 'Copy to design store (seeds the next run)'"
            :disabled="!copyable(v)"
            :aria-label="copiedKey === k ? 'Copied to design store' : 'Copy to design store'"
            @click="copyToDesign(k, v)"
          >
            {{ copiedKey === k ? '✓' : '⇓' }}
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.store-browser {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
}

.empty-hint {
  font-size: 12px;
  color: var(--ed-text-dim);
  background: var(--ed-bg);
  border: 1px dashed var(--ed-border);
  border-radius: 8px;
  padding: 12px;
  margin: 0;
}

.empty-hint code {
  color: var(--ed-accent);
}

.kv {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kv li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
}

.row .k,
.add-row input.k {
  flex: 4 1 0;
  min-width: 0;
}

.row .v,
.add-row input.v {
  flex: 5 1 0;
  min-width: 0;
}

.row input.k,
.row input.v {
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 4px;
  color: var(--ed-text);
  font: inherit;
  padding: 2px 6px;
}

.row input.k:hover,
.row input.v:hover,
.row input.k:focus,
.row input.v:focus {
  border-color: var(--ed-accent);
  outline: none;
  background: var(--ed-panel);
}

.row input.k {
  color: var(--ed-accent);
  word-break: break-all;
}

.row input.v {
  color: var(--ed-text);
  word-break: break-all;
  text-align: right;
}

.row button.icon {
  flex: 0 0 auto;
  background: none;
  border: none;
  color: var(--ed-text-dim);
  cursor: pointer;
  font: inherit;
  padding: 2px 4px;
}

.row button.icon:hover:not(:disabled) {
  color: var(--ed-accent);
}

.row button.icon.copied {
  color: var(--ed-ok);
  opacity: 1;
}

.row button.icon:disabled {
  opacity: 0.35;
  cursor: default;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.add-row input {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  font: inherit;
  padding: 4px 6px;
}

.add-row input.k {
  color: var(--ed-accent);
}

.add-row .add {
  flex: 0 0 auto;
  background: var(--ed-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  width: 26px;
  height: 26px;
  font: inherit;
  cursor: pointer;
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 8px 0 0;
}

.hint code {
  color: var(--ed-accent);
}

.v.str {
  color: var(--ed-ok);
}

.v.other {
  color: #fbbf24;
}
</style>