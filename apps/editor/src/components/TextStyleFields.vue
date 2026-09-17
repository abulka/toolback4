<script setup lang="ts">
import {
  FONT_FAMILIES,
  type TextAlign,
  type VerticalAlign,
} from '@toolback/format'

defineProps<{
  caps: {
    bold: boolean
    italic: boolean
    textAlign: boolean
    vAlign: boolean
    textColor: boolean
    background: boolean
  }
  fontSize: string
  fontFamily: string
  bold: boolean
  italic: boolean
  textAlign: string
  vAlign: string
  textColor: string
  textColorSwatch: string
  background: string
  backgroundSwatch: string
  mixed: Record<string, boolean>
}>()

const emit = defineEmits<{ set: [key: string, value: unknown] }>()

const H_ALIGN: Array<{ id: TextAlign; icon: string; label: string }> = [
  { id: 'left', icon: '⇤', label: 'Align left' },
  { id: 'center', icon: '↔', label: 'Align centre' },
  { id: 'right', icon: '⇥', label: 'Align right' },
]
const V_ALIGN: Array<{ id: VerticalAlign; icon: string; label: string }> = [
  { id: 'top', icon: '⤒', label: 'Align top' },
  { id: 'middle', icon: '↕', label: 'Align middle' },
  { id: 'bottom', icon: '⤓', label: 'Align bottom' },
]

function onInput(key: string, e: Event): void {
  emit('set', key, (e.target as HTMLInputElement | HTMLSelectElement).value)
}
function onFontSize(e: Event): void {
  const raw = (e.target as HTMLInputElement).value
  if (raw.trim() === '') {
    emit('set', 'fontSize', undefined)
    return
  }
  const n = Math.round(Number(raw))
  emit('set', 'fontSize', Number.isFinite(n) && n >= 8 ? n : undefined)
}
function toggleAlign(key: 'textAlign' | 'vAlign', value: string, current: string): void {
  emit('set', key, current === value ? '' : value)
}
</script>

<template>
  <div class="field">
    <label>Font size · Font</label>
    <div class="pair-row">
      <input type="number" min="8" placeholder="size" :value="fontSize" @input="onFontSize" />
      <select :value="fontFamily" @change="onInput('fontFamily', $event)">
        <option value="">default</option>
        <option v-for="fam in FONT_FAMILIES" :key="fam" :value="fam">{{ fam }}</option>
      </select>
    </div>
  </div>

  <div v-if="caps.bold || caps.italic || caps.textAlign || caps.vAlign" class="field">
    <label>Style</label>
    <div class="style-row">
      <button
        v-if="caps.bold"
        type="button"
        class="style-btn"
        :class="{ on: bold }"
        :title="mixed.bold ? 'Bold (mixed)' : 'Bold'"
        @click="emit('set', 'bold', !bold)"
      ><b>B</b></button>
      <button
        v-if="caps.italic"
        type="button"
        class="style-btn"
        :class="{ on: italic }"
        :title="mixed.italic ? 'Italic (mixed)' : 'Italic'"
        @click="emit('set', 'italic', !italic)"
      ><i>I</i></button>
      <span v-if="caps.textAlign" class="style-sep" />
      <button
        v-for="a in caps.textAlign ? H_ALIGN : []"
        :key="a.id"
        type="button"
        class="style-btn"
        :class="{ on: textAlign === a.id }"
        :title="a.label"
        @click="toggleAlign('textAlign', a.id, textAlign)"
      >{{ a.icon }}</button>
      <span v-if="caps.textAlign && caps.vAlign" class="style-sep" />
      <button
        v-for="a in caps.vAlign ? V_ALIGN : []"
        :key="a.id"
        type="button"
        class="style-btn"
        :class="{ on: vAlign === a.id }"
        :title="a.label"
        @click="toggleAlign('vAlign', a.id, vAlign)"
      >{{ a.icon }}</button>
    </div>
  </div>

  <div v-if="caps.textColor" class="field">
    <label>Text colour</label>
    <div class="color-row">
      <input
        class="color-input"
        :value="textColor"
        placeholder="red, #3b82f6…"
        @input="onInput('textColor', $event)"
      />
      <input type="color" class="color-swatch" :value="textColorSwatch" @input="onInput('textColor', $event)" />
    </div>
  </div>

  <div v-if="caps.background" class="field">
    <label>Background</label>
    <div class="color-row">
      <input
        class="color-input"
        :value="background"
        placeholder="fill, e.g. #f3f4f6…"
        @input="onInput('background', $event)"
      />
      <input type="color" class="color-swatch" :value="backgroundSwatch" @input="onInput('background', $event)" />
    </div>
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
  max-width: 130px;
  width: auto;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px;
  font: inherit;
}

.style-row {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.style-sep {
  width: 1px;
  align-self: stretch;
  margin: 2px 3px;
  background: var(--ed-border);
}

.style-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}

.style-btn:hover {
  border-color: var(--ed-accent);
}

.style-btn.on {
  border-color: var(--ed-accent);
  color: var(--ed-accent);
  background: rgba(79, 70, 229, 0.14);
}

.color-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.field .color-row .color-input {
  flex: 0 1 auto;
  width: 140px;
  min-width: 0;
}

.field .color-row .color-swatch {
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

.color-swatch::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-swatch::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
</style>
