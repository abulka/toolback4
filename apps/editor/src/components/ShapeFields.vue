<script setup lang="ts">
import { SHAPE_TYPES } from '@toolback/format'

defineProps<{
  shape: string
  sides: string
  points: string
  innerRatio: string
  path: string
  radius: string
}>()

const emit = defineEmits<{ set: [key: string, value: unknown] }>()

function onInput(key: string, e: Event): void {
  emit('set', key, (e.target as HTMLInputElement | HTMLSelectElement).value)
}

function onNumber(key: string, min: number, max: number, e: Event): void {
  const raw = (e.target as HTMLInputElement).value
  if (raw.trim() === '') {
    emit('set', key, undefined)
    return
  }
  const n = Number(raw)
  emit('set', key, Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined)
}
</script>

<template>
  <div class="field">
    <label>Shape</label>
    <select :value="shape || 'ellipse'" @change="onInput('shape', $event)">
      <option v-for="s in SHAPE_TYPES" :key="s" :value="s">{{ s }}</option>
    </select>
  </div>

  <div v-if="shape === 'rectangle'" class="field">
    <label>Corner radius</label>
    <input
      type="number"
      min="0"
      max="50"
      placeholder="px"
      :value="radius"
      @input="onNumber('radius', 0, 50, $event)"
    />
  </div>

  <div v-if="shape === 'polygon'" class="field">
    <label>Sides</label>
    <input
      type="number"
      min="3"
      max="20"
      placeholder="3–20"
      :value="sides"
      @input="onNumber('sides', 3, 20, $event)"
    />
  </div>

  <template v-if="shape === 'star'">
    <div class="field">
      <label>Points</label>
      <input
        type="number"
        min="3"
        max="20"
        placeholder="3–20"
        :value="points"
        @input="onNumber('points', 3, 20, $event)"
      />
    </div>
    <div class="field">
      <label>Inner radius</label>
      <input
        type="number"
        min="0.05"
        max="1"
        step="0.05"
        placeholder="0.05–1"
        :value="innerRatio"
        @input="onNumber('innerRatio', 0.05, 1, $event)"
      />
    </div>
  </template>

  <div v-if="shape === 'path'" class="field field-full">
    <label>Path (SVG d, 0–100 box)</label>
    <input
      :value="path"
      placeholder="M 10 90 L 50 10 L 90 90 Z"
      @input="onInput('path', $event)"
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

.field input,
.field select {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 7px 9px;
  font: inherit;
  width: 100%;
}

.field input:focus,
.field select:focus {
  outline: 1px solid var(--ed-accent);
}
</style>
