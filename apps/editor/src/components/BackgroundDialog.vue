<script setup lang="ts">
import { computed } from 'vue'
import { useBookStore } from '../stores/book'

const store = useBookStore()

const bg = computed(() =>
  store.book.backgrounds.find((b) => b.id === store.backgroundDialogId) ?? null,
)

function close(): void {
  store.backgroundDialogId = null
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

      <p class="note">
        Pages on this background fill the window and grow with their content. Give an
        individual page a fixed size (Page tab) when it should be a dialog or popup.
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
