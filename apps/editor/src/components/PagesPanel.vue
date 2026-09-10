<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useBookStore } from '../stores/book'
import HelpButton from './HelpButton.vue'

const store = useBookStore()
const renaming = ref<number | null>(null)
const buf = ref('')
const renameInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

function startRename(i: number): void {
  renaming.value = i
  buf.value = store.book.pages[i]!.name
}

function commitRename(): void {
  if (renaming.value !== null) store.renamePage(renaming.value, buf.value)
  renaming.value = null
}

watch(renaming, async (v) => {
  if (v !== null) {
    await nextTick()
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
    el?.focus()
    el?.select()
  }
})
</script>

<template>
  <div class="row">
    <h2>Pages</h2>
    <HelpButton anchor="pages-and-navigation" />
  </div>
  <ul class="pages">
    <li
      v-for="(p, i) in store.book.pages"
      :key="p.id"
      :class="{ active: i === store.currentPageIndex }"
      @click="store.selectPage(i)"
    >
      <template v-if="renaming === i">
        <input
          ref="renameInput"
          v-model="buf"
          class="rename"
          @keydown.enter.prevent="commitRename"
          @keydown.esc="renaming = null"
          @blur="commitRename"
          @click.stop
        />
      </template>
      <template v-else>
        <span class="page-name" @dblclick="startRename(i)">{{ p.name }}</span>
        <span class="page-actions">
          <button title="Duplicate page" @click.stop="store.duplicatePage(i)">⧉</button>
          <button
            v-if="store.book.pages.length > 1"
            title="Delete page"
            @click.stop="store.removePage(i)"
          >✕</button>
        </span>
      </template>
    </li>
  </ul>
  <button class="add-page" @click="store.addPage()">+ Add page</button>
</template>

<style scoped>
.pages {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pages li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: pointer;
}

.pages li.active {
  border-color: var(--ed-accent);
}

.page-name {
  font-size: 13px;
}

.page-actions {
  display: flex;
  gap: 4px;
}

.page-actions button {
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 4px;
}

.page-actions button:hover {
  color: #fff;
  background: var(--ed-border);
}

.rename {
  width: 100%;
  background: var(--ed-bg);
  border: 1px solid var(--ed-accent);
  border-radius: 4px;
  color: var(--ed-text);
  font: inherit;
  padding: 2px 6px;
}

.add-page {
  margin-top: 8px;
  width: 100%;
  font: 600 12px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: var(--ed-bg);
  border: 1px dashed var(--ed-border);
  border-radius: 8px;
  padding: 8px 0;
  cursor: pointer;
}

.add-page:hover {
  color: #fff;
  border-color: var(--ed-accent);
}
</style>
