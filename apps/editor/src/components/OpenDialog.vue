<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useBookStore } from '../stores/book'

const store = useBookStore()
const emit = defineEmits<{ (e: 'close'): void; (e: 'import'): void }>()

const editingId = ref<string | null>(null)
const editBuf = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  void store.refreshRecents()
})

function close(): void {
  emit('close')
}

async function open(id: string): Promise<void> {
  if (id === store.book.id) {
    close()
    return
  }
  await store.openRecent(id)
  close()
}

function startRename(id: string, title: string): void {
  editingId.value = id
  editBuf.value = title || 'Untitled'
  void nextTick(() => renameInput.value?.focus())
}

function commitRename(): void {
  const id = editingId.value
  editingId.value = null
  if (id !== null) void store.renameRecent(id, editBuf.value)
}

function cancelRename(): void {
  editingId.value = null
}

function confirmDelete(id: string, title: string): void {
  const ok = window.confirm(
    `Delete the saved project "${title}"?\n\n` +
      'The open editor keeps working — you can Save again to restore it.',
  )
  if (!ok) return
  void store.deleteRecent(id)
}
</script>

<template>
  <div class="overlay" @pointerdown.self="close">
    <div class="dialog" role="dialog" aria-label="Open a project">
      <div class="titlebar">
        <h3>Open project</h3>
        <button class="x" title="Close" @click="close">✕</button>
      </div>

      <template v-if="store.recents.length">
        <ul class="projects">
          <li
            v-for="r in store.recents"
            :key="r.id"
            :class="{ current: r.id === store.book.id }"
            @click="open(r.id)"
          >
            <div class="row-main">
              <template v-if="editingId === r.id">
                <input
                  ref="renameInput"
                  v-model="editBuf"
                  class="rename"
                  spellcheck="false"
                  @click.stop
                  @keydown.enter="commitRename"
                  @keydown.esc="cancelRename"
                  @blur="commitRename"
                />
              </template>
              <template v-else>
                <div class="name-row" @dblclick.stop="startRename(r.id, r.title || 'Untitled')">
                  <span class="name">{{ r.title || 'Untitled' }}</span>
                  <button
                    class="edit"
                    title="Rename (or double-click the name)"
                    @click.stop="startRename(r.id, r.title || 'Untitled')"
                  >✎</button>
                </div>
              </template>
              <span class="time">{{ new Date(r.at).toLocaleString() }}<template v-if="r.id === store.book.id"> · <em class="open-tag">(currently open)</em></template></span>
            </div>
            <button
              class="del"
              title="Delete this saved project"
              @click.stop="confirmDelete(r.id, r.title || 'Untitled')"
            >✕</button>
          </li>
        </ul>
        <p class="hint">Click a project to open it; double-click a name to rename; ✕ deletes. Saved by the Save button; autosave keeps a separate recovery copy.</p>
      </template>

      <template v-else>
        <p class="empty">No saved projects yet.</p>
        <p class="hint">Save stores the current project here, or Import a .toolback.json from disk.</p>
      </template>

      <div class="foot">
        <button class="import" @click="emit('import')">Import file…</button>
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
  width: 440px;
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

.projects {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.projects li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: pointer;
}

.projects li:hover {
  border-color: var(--ed-accent);
}

.projects li.current {
  border-color: var(--ed-accent);
  background: rgba(99, 102, 241, 0.08);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name {
  font-weight: 600;
  font-size: 13px;
  color: var(--ed-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.edit {
  flex: none;
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 4px;
  opacity: 0.55;
  line-height: 1;
}

.projects li:hover .edit {
  opacity: 1;
}

.edit:hover {
  color: var(--ed-accent);
}

.rename {
  width: 100%;
  font: 600 13px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-accent);
  border-radius: 6px;
  padding: 4px 7px;
  outline: none;
}

.time {
  font-size: 10.5px;
  color: var(--ed-text-dim);
}

.open-tag {
  font-style: normal;
  color: var(--ed-ok, #34d399);
}

.del {
  flex: none;
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 7px;
  border-radius: 5px;
}

.del:hover {
  color: var(--ed-err, #f87171);
  background: rgba(248, 113, 113, 0.12);
}

.empty {
  margin: 18px 4px 2px;
  font-size: 13px;
  color: var(--ed-text);
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 12px 4px 0;
  line-height: 1.5;
}

.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 14px;
}

.import {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  margin-right: auto;
}

.import:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.done {
  font: 600 12.5px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  cursor: pointer;
}

.done:hover {
  filter: brightness(1.1);
}
</style>