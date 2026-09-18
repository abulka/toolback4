<script setup lang="ts">
import { BORDER_STYLES } from '@toolback/format'

defineProps<{
  caps: { border: boolean; radius: boolean; opacity: boolean }
  borderWidth: string
  borderStyle: string
  borderColor: string
  borderColorSwatch: string
  radius: string
  opacity: string
  mixed: Record<string, boolean>
}>()

const emit = defineEmits<{ set: [key: string, value: unknown] }>()

function onNumber(key: string, min: number, max: number, e: Event): void {
  const raw = (e.target as HTMLInputElement).value
  if (raw.trim() === '') {
    emit('set', key, undefined)
    return
  }
  const n = Number(raw)
  emit('set', key, Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined)
}
function onInput(key: string, e: Event): void {
  emit('set', key, (e.target as HTMLInputElement | HTMLSelectElement).value)
}
</script>

<template>
  <div v-if="caps.border" class="field">
    <label>Border</label>
    <div class="pair-row">
      <input
        type="number"
        min="0"
        placeholder="width"
        title="Border width (px)"
        :value="borderWidth"
        @input="onNumber('borderWidth', 0, 100, $event)"
      />
      <select :value="borderStyle" title="Border style" @change="onInput('borderStyle', $event)">
        <option v-for="s in BORDER_STYLES" :key="s" :value="s">{{ s }}</option>
      </select>
      <input
        type="color"
        class="color-swatch"
        :value="borderColorSwatch"
        title="Border colour"
        @input="onInput('borderColor', $event)"
      />
    </div>
    <input
      class="color-input"
      :value="borderColor"
      placeholder="border colour, e.g. #d1d5db…"
      @input="onInput('borderColor', $event)"
    />
  </div>

  <div v-if="caps.radius" class="field">
    <label>Corner radius</label>
    <input
      type="number"
      min="0"
      placeholder="px"
      :value="radius"
      @input="onNumber('radius', 0, 999, $event)"
    />
  </div>

  <div v-if="caps.opacity" class="field">
    <label>Opacity</label>
    <input
      type="number"
      min="0"
      max="1"
      step="0.1"
      placeholder="0–1"
      :value="opacity"
      @input="onNumber('opacity', 0, 1, $event)"
    />
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color-scheme: dark;
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
  width: 100%;
}

.field input:focus {
  outline: 1px solid var(--ed-accent);
}

.pair-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.field .pair-row input[type='number'] {
  width: 72px;
  flex: 0 0 auto;
  font: inherit;
}

.field .pair-row select {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 110px;
  width: auto;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px;
  font: inherit;
}

.field .color-swatch {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  padding: 0;
  background: none;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
}

.field .color-input {
  width: 100%;
}

.color-swatch::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
</style>
