<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FONT_FAMILIES, backgroundFor, type Book } from '@toolback/format'
import { useBookStore, type LoadGeneratedResult } from '../stores/book'
import { fetchModels, generateBook, styleGuide, type AiSettings, type ChatMessage } from '../ai'
import { diffBooks, type LoadMode } from '../aiDiff'
import { detectIntent } from '../aiIntent'
import { smokeBook } from '../canvasClient'
import { SYSTEM_PROMPT } from '../aiPrompt'
import {
  DEFAULT_STYLE,
  clearAllKeys,
  loadAiConfig,
  saveAiConfig,
  settingsFor,
  withProvider,
  withStyle,
  type AiConfig,
  type StyleTokens,
} from '../aiConfig'
import { PROVIDER_PRESETS, presetFor } from '../providers'

const store = useBookStore()

const SESSION_KEY = 'toolback.ai.session'

type Mode = 'append' | 'modify' | 'replace'

interface Turn {
  prompt: string
  label: string
  at: number
}

interface Session {
  request: string
  raw: string
  log: string[]
  mode: Mode
  keepExisting?: boolean
  history?: ChatMessage[]
  turns?: Turn[]
}

function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      return {
        request: '',
        raw: '',
        log: [],
        mode: 'append',
        ...(JSON.parse(raw) as Partial<Session>),
      }
    }
  } catch {
    /* ignore */
  }
  return { request: '', raw: '', log: [], mode: 'append' }
}

const config = ref<AiConfig>(loadAiConfig(localStorage))
const providerId = ref(config.value.lastProvider)
const preset = computed(() => presetFor(providerId.value))

const apiKey = ref('')
const model = ref('')
const baseUrl = ref('')
const fetchedModels = ref<string[]>([])
const modelError = ref('')
const showKey = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string): void {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 4000)
}

const session = loadSession()
const request = ref(session.request)
const mode = ref<Mode>(session.mode)
const keepExisting = ref(session.keepExisting ?? false)
const raw = ref(session.raw)
const log = ref<string[]>(session.log)
const history = ref<ChatMessage[]>(session.history ?? [])
const turns = ref<Turn[]>(session.turns ?? [])
const lastChange = ref<{ before: Book; diff: string[]; label: string } | null>(null)
const busy = ref(false)
const busyModels = ref(false)
const showSettings = ref(true)
const copied = ref(false)
let controller: AbortController | null = null

const comparing = computed(() => store.compareBook !== null)

function modeLabel(): string {
  if (mode.value === 'modify') return keepExisting.value ? 'added to page' : 'modified page'
  return mode.value === 'append' ? 'added pages' : 'replaced project'
}

function reuseTurn(prompt: string): void {
  request.value = prompt
}

function timeText(at: number): string {
  return new Date(at).toLocaleTimeString()
}

/** keep the follow-up context small: last few turns, bounded total size */
function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  const list = messages.filter((m) => m.role !== 'system')
  const out: ChatMessage[] = []
  let budget = 20000
  for (let i = list.length - 1; i >= 0 && out.length < 6; i--) {
    const m = list[i]!
    if (m.content.length > budget && out.length > 0) break
    budget -= m.content.length
    out.unshift(m)
  }
  return out
}

function newChat(): void {
  history.value = []
  turns.value = []
  lastChange.value = null
  store.setCompare(null)
  log.value = []
  raw.value = ''
  showToast('Started a new chat')
}

function loadForProvider(): void {
  const s = settingsFor(config.value, providerId.value)
  apiKey.value = s.apiKey
  model.value = s.model
  baseUrl.value = s.baseUrl ?? ''
}

function persistCurrent(): void {
  config.value = withProvider(config.value, providerId.value, {
    apiKey: apiKey.value,
    model: model.value,
    ...(baseUrl.value.trim() ? { baseUrl: baseUrl.value.trim() } : {}),
  })
  saveAiConfig(config.value, localStorage)
}

loadForProvider()
saveAiConfig(config.value, localStorage)

const baseOverridden = computed(() => baseUrl.value.trim() !== preset.value.baseUrl)

function resetBaseUrl(): void {
  baseUrl.value = preset.value.baseUrl
}

watch([apiKey, model, baseUrl], persistCurrent)
watch(
  [request, mode, keepExisting, raw, log, history, turns],
  () =>
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        request: request.value,
        mode: mode.value,
        keepExisting: keepExisting.value,
        raw: raw.value,
        log: log.value.slice(-40),
        history: trimHistory(history.value),
        turns: turns.value.slice(-20),
      }),
    ),
  { deep: true },
)

function changeProvider(id: string): void {
  persistCurrent()
  providerId.value = id
  fetchedModels.value = []
  modelError.value = ''
  history.value = []
  lastChange.value = null
  store.setCompare(null)
  loadForProvider()
}

/** Fetched models win once a fetch has run; otherwise the curated list. */
const modelOptions = computed(() => {
  const base = fetchedModels.value.length ? fetchedModels.value : preset.value.models
  const list = [...base]
  if (model.value && !list.includes(model.value)) list.unshift(model.value)
  return list
})

const canAddModel = computed(() => preset.value.editableBase || modelOptions.value.length === 0)

function addModel(): void {
  const id = window.prompt('Model id')?.trim()
  if (!id) return
  if (!fetchedModels.value.includes(id)) fetchedModels.value = [...fetchedModels.value, id]
  model.value = id
}

const needsKey = computed(() => !preset.value.keyless && !preset.value.editableBase)
const ready = computed(() =>
  Boolean(request.value.trim() && model.value.trim() && (!needsKey.value || apiKey.value.trim())),
)

function currentSettings(): AiSettings {
  return {
    baseUrl: baseUrl.value || preset.value.baseUrl,
    apiKey: apiKey.value,
    model: model.value,
    api: preset.value.api,
    headers: preset.value.headers,
    maxTokens: preset.value.api === 'anthropic' ? 8192 : undefined,
  }
}

/** The current page + its background, as JSON context for a modify request. */
function modifyContext(): string {
  const page = store.activePage
  const bg = backgroundFor(store.book, page)
  return JSON.stringify(
    {
      page: { name: page.name, script: page.script, objects: page.objects },
      background: { name: bg.name, script: bg.script, objects: bg.objects },
    },
    null,
    2,
  )
}

const style = computed<StyleTokens>(() => config.value.style ?? DEFAULT_STYLE)

function setStyle(patch: Partial<StyleTokens>): void {
  config.value = withStyle(config.value, { ...style.value, ...patch })
  saveAiConfig(config.value, localStorage)
}

function seedStyleFromBook(): void {
  const bg = store.book.backgrounds[0]
  if (bg) setStyle({ background: bg.color })
}

function buildPrompt(): string {
  const text = request.value.trim()
  const tokens = styleGuide(style.value)
  if (mode.value !== 'modify') return `${tokens}\n\nRequest: ${text}`
  const keep = keepExisting.value
    ? 'This is an ADD-ONLY change: reproduce every existing object exactly as given ' +
      '(same id, name, control, x, y, props and on) and add only the new element(s) requested. ' +
      'Never recolour, restyle, move, resize, rename or remove an existing object.'
    : 'Change only what the request asks for; keep every other object and the page as it is.'
  return (
    `${tokens}\n\n` +
    `Modify the CURRENT PAGE ("${store.activePage.name}") of this toolback book. ` +
    'Keep the page name, its background and every other page unchanged. ' +
    'Return the complete book JSON with just that page updated. ' +
    keep +
    `\n\nRequested change: ${text}\n\nCurrent page and background:\n${modifyContext()}`
  )
}

watch(request, (text) => {
  const intent = detectIntent(text)
  if (!intent) return
  if (intent.mode === mode.value && intent.keepExisting === keepExisting.value) return
  mode.value = intent.mode
  keepExisting.value = intent.keepExisting
  showToast(
    intent.keepExisting
      ? 'Mode: Modify this page — existing objects kept'
      : `Mode: ${mode.value === 'append' ? 'Add pages' : 'Modify this page'}`,
  )
})

async function loadModels(): Promise<void> {
  busyModels.value = true
  modelError.value = ''
  const previous = fetchedModels.value
  try {
    const info = await fetchModels(currentSettings())
    const next = info.filter((m) => m.chat).map((m) => m.id)
    const hidden = info.length - next.length
    fetchedModels.value = next
    if (next.length && !next.includes(model.value)) model.value = next[0]!
    const before = new Set(previous)
    const after = new Set(next)
    const added = next.filter((m) => !before.has(m)).length
    const removed = previous.filter((m) => !after.has(m)).length
    showToast(
      next.length === 0
        ? hidden > 0
          ? `No chat models (hid ${hidden} non-text)`
          : 'No models returned'
        : `Fetched ${next.length} model${next.length === 1 ? '' : 's'} · ${added} new, ${removed} removed` +
            (hidden > 0 ? ` · hid ${hidden} non-text` : ''),
    )
  } catch (err) {
    modelError.value = (err as Error).message
  } finally {
    busyModels.value = false
  }
}

function push(line: string): void {
  log.value.push(line)
}

function applyBook(book: Book, loadMode: LoadMode): LoadGeneratedResult {
  const report: LoadGeneratedResult = store.loadGeneratedBook(book, loadMode, {
    keepExisting: loadMode === 'modify' ? keepExisting.value : false,
  })
  if (!report.ok) {
    push(`Could not load: ${report.error ?? 'unknown error'}`)
    return report
  }
  if (loadMode === 'modify') {
    const bits = [`kept ${report.keptObjects ?? 0} existing`, `added ${report.addedObjects ?? 0}`]
    if (report.renamedObjects?.length) bits.push(`renamed ${report.renamedObjects.join(', ')}`)
    push(`Modified “${store.activePage.name}” · ${bits.join(' · ')}`)
  } else {
    const bits = [`${report.pagesAdded} page(s)`, `${report.backgroundsAdded} background(s)`]
    if (report.renamedPages?.length) bits.push(`renamed pages ${report.renamedPages.join(', ')}`)
    push(`Loaded (${loadMode}): ${bits.join(' · ')}`)
  }
  return report
}

function showBefore(): void {
  if (lastChange.value) store.setCompare(lastChange.value.before)
}

function showAfter(): void {
  store.setCompare(null)
}

function keepChange(): void {
  store.setCompare(null)
  lastChange.value = null
}

function undoChange(): void {
  store.setCompare(null)
  store.undo()
  lastChange.value = null
}

async function run(): Promise<void> {
  if (busy.value || !ready.value) return
  busy.value = true
  log.value = []
  raw.value = ''
  lastChange.value = null
  store.setCompare(null)
  controller = new AbortController()
  push(`Asking ${model.value}…`)
  try {
    const result = await generateBook(SYSTEM_PROMPT, buildPrompt(), currentSettings(), {
      signal: controller.signal,
      smoke: smokeBook,
      history: trimHistory(history.value),
    })
    raw.value = result.raw
    push(`Attempt ${result.attempts}: ${result.ok ? 'valid book' : 'still has errors'}`)
    for (const note of result.notes) push(`  note: ${note}`)
    for (const issue of result.issues) {
      push(`  ${issue.severity}: ${issue.path} — ${issue.message}`)
    }
    if (result.ok && result.book) {
      const before = JSON.parse(JSON.stringify(store.book)) as Book
      const diff =
        mode.value === 'modify'
          ? []
          : diffBooks(store.book, result.book, mode.value, store.currentPageIndex)
      const report = applyBook(result.book, mode.value)
      if (report.ok) {
        if (mode.value === 'modify') {
          const lines = [
            `kept ${report.keptObjects ?? 0} existing object(s)`,
            `added ${report.addedObjects ?? 0} new object(s)`,
          ]
          if (report.renamedObjects?.length) lines.push(`renamed ${report.renamedObjects.join(', ')}`)
          diff.push(...lines)
        }
        history.value = trimHistory(result.messages)
        lastChange.value = { before, diff, label: modeLabel() }
        turns.value.push({ prompt: request.value.trim(), label: modeLabel(), at: Date.now() })
        if (turns.value.length > 20) turns.value.shift()
        // the prompt is in History now; restore it from there if needed
        request.value = ''
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') push('Cancelled')
    else push(`Error: ${(err as Error).message}`)
  } finally {
    busy.value = false
    controller = null
  }
}

function cancel(): void {
  controller?.abort()
}

function forgetKeys(): void {
  config.value = clearAllKeys(config.value)
  saveAiConfig(config.value, localStorage)
  apiKey.value = ''
}

async function copyRaw(): Promise<void> {
  try {
    await navigator.clipboard.writeText(raw.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div class="ai-panel">
    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
    <p class="lead">
      Describe an app in plain words and the model writes a toolback book. It is
      checked automatically and corrected if it does not load — then it appears
      in the canvas like any other book.
    </p>

    <button class="link settings-toggle" @click="showSettings = !showSettings">
      {{ showSettings ? '▾' : '▸' }} Model settings
    </button>

    <div v-show="showSettings" class="settings">
      <label class="field">
        <span>Provider</span>
        <select
          :value="providerId"
          autocomplete="off"
          @change="changeProvider(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in PROVIDER_PRESETS" :key="p.id" :value="p.id">{{ p.label }}</option>
        </select>
      </label>

      <div class="field">
        <span>Model</span>
        <div class="model-row">
          <select v-model="model" class="model-select">
            <option v-if="!model" value="" disabled>Select a model…</option>
            <option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</option>
          </select>
          <button
            v-if="canAddModel"
            class="secondary compact"
            title="Add a model id"
            @click="addModel"
          >＋</button>
          <button
            v-if="preset.supportsModelList"
            class="secondary compact"
            :disabled="busyModels || (needsKey && !apiKey.trim())"
            :title="needsKey && !apiKey.trim() ? 'Enter an API key first' : 'Fetch the model list from the provider'"
            @click="loadModels"
          >
            {{ busyModels ? '…' : 'Fetch' }}
          </button>
        </div>
        <p v-if="modelError" class="hint error">{{ modelError }}</p>
      </div>

      <label v-if="!preset.keyless" class="field">
        <span>API key</span>
        <div class="model-row">
          <input
            v-model="apiKey"
            :type="showKey ? 'text' : 'password'"
            name="tb-ai-key"
            autocomplete="new-password"
            autocapitalize="off"
            data-lpignore="true"
            data-1p-ignore="true"
            spellcheck="false"
            placeholder="paste your key"
          />
          <button
            class="secondary compact"
            :title="showKey ? 'Hide the key' : 'Show the key'"
            @click="showKey = !showKey"
          >{{ showKey ? '🙈' : '👁' }}</button>
        </div>
      </label>

      <div class="field">
        <span>Base URL</span>
        <div class="model-row">
          <input v-model="baseUrl" autocomplete="off" spellcheck="false" />
          <button
            v-if="baseOverridden"
            class="secondary compact"
            title="Reset to the provider's default base URL"
            @click="resetBaseUrl"
          >
            ↺
          </button>
        </div>
      </div>

      <p v-if="preset.hint" class="hint">{{ preset.hint }}</p>
      <p v-if="modelError" class="hint error">{{ modelError }}</p>

      <details class="style-box">
        <summary>Style tokens</summary>
        <div class="style-grid">
          <label class="style-item">
            <span>Background</span>
            <input type="color" :value="style.background" @input="setStyle({ background: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="style-item">
            <span>Surface</span>
            <input type="color" :value="style.surface" @input="setStyle({ surface: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="style-item">
            <span>Text</span>
            <input type="color" :value="style.text" @input="setStyle({ text: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="style-item">
            <span>Accent</span>
            <input type="color" :value="style.accent" @input="setStyle({ accent: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="style-item">
            <span>Font</span>
            <select :value="style.fontFamily" @change="setStyle({ fontFamily: ($event.target as HTMLSelectElement).value })">
              <option v-for="f in FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
            </select>
          </label>
          <label class="style-item">
            <span>Radius</span>
            <input type="number" min="0" :value="style.radius" @input="setStyle({ radius: Number(($event.target as HTMLInputElement).value) })" />
          </label>
        </div>
        <button class="link" @click="seedStyleFromBook">Use current book colours</button>
      </details>

      <div class="settings-foot">
        <span class="hint">{{ preset.keyless ? 'No key needed for this provider.' : 'Keys are stored only in this browser.' }}</span>
        <button class="link" @click="forgetKeys">Clear keys</button>
      </div>
    </div>

    <label class="field">
      <span>What should it build?</span>
      <textarea
        v-model="request"
        rows="3"
        placeholder="e.g. build a working calculator"
        @keydown.enter.exact.prevent="run"
      ></textarea>
    </label>

    <div class="mode-row">
      <label class="check-row" title="Add the generated pages to the current project">
        <input v-model="mode" type="radio" value="append" />
        Add pages
      </label>
      <label class="check-row" title="Send the current page (and background) and replace just that page">
        <input v-model="mode" type="radio" value="modify" />
        Modify this page
      </label>
      <label class="check-row" title="Discard the current project and open the generated book">
        <input v-model="mode" type="radio" value="replace" />
        Replace project
      </label>
    </div>

    <label v-if="mode === 'modify'" class="check-row keep-row" title="Existing objects are kept exactly as they are; the model may only add new ones">
      <input v-model="keepExisting" type="checkbox" />
      Keep existing objects unchanged (add only)
    </label>

    <div class="actions">
      <button class="primary" :disabled="busy || !ready" @click="run">
        {{ busy ? 'Working…' : 'Generate' }}
      </button>
      <button v-if="busy" class="secondary" @click="cancel">Cancel</button>
      <button
        v-if="turns.length && !busy"
        class="secondary"
        title="Forget the conversation and start fresh"
        @click="newChat"
      >
        New chat
      </button>
    </div>

    <div v-if="lastChange" class="result-card">
      <div class="result-main">
        <div class="result-head">AI applied · {{ lastChange.label }}</div>
        <ul class="result-diff">
          <li v-for="(line, i) of lastChange.diff" :key="i">{{ line }}</li>
        </ul>
      </div>
      <div class="result-compare" role="group" aria-label="Compare before and after">
        <button :class="{ on: comparing }" @click="showBefore">Before</button>
        <button :class="{ on: !comparing }" @click="showAfter">After</button>
      </div>
      <div class="result-actions">
        <button class="primary" @click="keepChange">Keep</button>
        <button class="secondary" @click="undoChange">Undo</button>
      </div>
    </div>

    <div v-if="turns.length" class="turns">
      <div class="turns-head">History</div>
      <ul>
        <li v-for="(t, i) of turns.slice().reverse()" :key="i">
          <button class="turn" :title="t.prompt" @click="reuseTurn(t.prompt)">{{ t.prompt }}</button>
          <span class="turn-meta">{{ t.label }} · {{ timeText(t.at) }}</span>
        </li>
      </ul>
    </div>

    <ul v-if="log.length" class="log">
      <li v-for="(line, i) of log" :key="i">{{ line }}</li>
    </ul>

    <template v-if="raw">
      <div class="raw-head">
        <span>Last response</span>
        <button class="link" @click="copyRaw">{{ copied ? 'Copied' : 'Copy JSON' }}</button>
      </div>
      <pre class="raw">{{ raw }}</pre>
    </template>
  </div>
</template>

<style scoped>
.ai-panel {
  font-size: 12px;
}

.lead {
  font-size: 12px;
  color: var(--ed-text-dim);
  background: var(--ed-bg);
  border: 1px dashed var(--ed-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.field > span {
  color: var(--ed-text-dim);
}

.field input,
.field textarea,
.field select {
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  font: inherit;
  padding: 5px 7px;
  resize: vertical;
}

.field input:focus,
.field textarea:focus,
.field select:focus {
  border-color: var(--ed-accent);
  outline: none;
}

.field input.readonly {
  color: var(--ed-text-dim);
  cursor: default;
}

.model-row {
  display: flex;
  gap: 6px;
}

.model-row input,
.model-row select {
  flex: 1 1 auto;
  min-width: 0;
}

.model-select {
  cursor: pointer;
}

.settings-toggle {
  margin-bottom: 6px;
}

.link {
  background: none;
  border: none;
  color: var(--ed-accent);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 0 0 6px;
}

.hint.error {
  color: #f87171;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 44px;
  z-index: 50;
  max-width: 320px;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-ok);
  color: var(--ed-text);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  font-size: 12px;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.style-box {
  margin: 0 0 8px;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 6px 8px;
}

.style-box summary {
  cursor: pointer;
  color: var(--ed-text-dim);
  font-size: 11px;
}

.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin: 8px 0;
}

.style-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: var(--ed-text-dim);
  font-size: 11px;
}

.style-item input[type='color'] {
  width: 32px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--ed-border);
  border-radius: 4px;
  background: none;
}

.style-item select,
.style-item input[type='number'] {
  width: 72px;
}

.settings-foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 6px;
}

.settings-foot .hint {
  margin: 0;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  margin: 4px 0 10px;
  color: var(--ed-text-dim);
}

.check-row {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.primary {
  background: var(--ed-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font: inherit;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.secondary {
  background: none;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px 12px;
  font: inherit;
  cursor: pointer;
}

.secondary.compact {
  padding: 0 10px;
}

.secondary:disabled {
  opacity: 0.45;
  cursor: default;
}

.result-card {
  border: 1px solid var(--ed-accent);
  border-radius: 8px;
  padding: 8px 10px;
  margin: 0 0 10px;
  background: var(--ed-bg);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.result-main {
  flex: 1 1 140px;
  min-width: 0;
}

.result-head {
  color: var(--ed-accent);
  font-weight: 600;
  margin-bottom: 6px;
}

.result-compare {
  flex: 0 0 auto;
  display: flex;
  align-self: center;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  overflow: hidden;
}

.result-compare button {
  background: none;
  border: none;
  color: var(--ed-text-dim);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 4px 10px;
}

.result-compare button + button {
  border-left: 1px solid var(--ed-border);
}

.result-compare button.on {
  background: var(--ed-accent);
  color: #fff;
}

.result-actions {
  flex: 1 1 100%;
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.keep-row {
  margin: 2px 0 10px;
  color: var(--ed-text-dim);
}

.result-diff {
  margin: 0 0 8px;
  padding-left: 18px;
  color: var(--ed-text);
  font-size: 11px;
}

.result-diff li {
  margin-bottom: 2px;
}

.turns {
  margin: 0 0 10px;
}

.turns-head {
  color: var(--ed-text-dim);
  font-size: 11px;
  margin-bottom: 4px;
}

.turns ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow: auto;
}

.turns li {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 6px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
}

.turn {
  background: none;
  border: none;
  color: var(--ed-text);
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.turn:hover {
  color: var(--ed-accent);
}

.turn-meta {
  color: var(--ed-text-dim);
  font-size: 10px;
}

.log {
  list-style: none;
  margin: 0 0 10px;
  padding: 8px 10px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow: auto;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
}

.raw-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--ed-text-dim);
  margin-bottom: 4px;
}

.raw {
  margin: 0;
  padding: 8px 10px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
}
</style>
