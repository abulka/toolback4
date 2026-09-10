<script setup lang="ts">
import { useBookStore } from '../stores/book'

const store = useBookStore()

function kindOf(v: string): 'str' | 'other' {
  return v === 'undefined' || v === 'ƒ' || /^[[{]/.test(v) || /^-?\d/.test(v) || v === 'true' || v === 'false'
    ? 'other'
    : 'str'
}
</script>

<template>
  <div class="store-browser">
    <p v-if="!store.isRunning" class="empty-hint">
      The store exists while a run is live. Press <strong>Run</strong> (F3 or ⌥3) and
      interact with the page — values appear here as scripts set them.
    </p>
    <template v-else>
      <p v-if="store.storeEntries.length === 0" class="empty-hint">
        Running — no values yet. Scripts fill this as they call <code>store.set()</code>.
      </p>
      <ul v-else class="kv">
        <li v-for="[k, v] in store.storeEntries" :key="k">
          <span class="k">{{ k }}</span>
          <span class="v" :class="kindOf(v)">{{ v === '' ? '""' : v }}</span>
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
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 8px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
}

.k {
  color: var(--ed-accent);
  word-break: break-all;
}

.v {
  color: var(--ed-text);
  word-break: break-all;
  text-align: right;
}

.v.str {
  color: var(--ed-ok);
}

.v.other {
  color: #fbbf24;
}
</style>