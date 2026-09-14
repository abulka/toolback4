<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ControlKind, PageObject } from '@toolback/format'
import { treeRows } from '@toolback/format'
import { isDeleteSelectionKey, isDuplicateKey, isGroupKey, isUndoKey, isCopyKey, isCutKey, isPasteKey, shouldToggleRun, zOrderActionOf } from '@toolback/runtime'
import { wireCanvas } from './canvasClient'
import { startPaletteDrag } from './paletteDrag'
import { useBookStore } from './stores/book'
import { openBookFile, saveBookFile, saveTextFile, bookFileName } from './files'
import { basePackageName, buildStandaloneHtml, libUrlMapFor, scanLibImports, standaloneFileName } from './publish'
import PropertiesPanel from './components/PropertiesPanel.vue'
import ScriptEditor from './components/ScriptEditor.vue'
import HelpButton from './components/HelpButton.vue'
import ImportHelper from './components/ImportHelper.vue'
import PagesPanel from './components/PagesPanel.vue'
import StoreBrowser from './components/StoreBrowser.vue'
import BackgroundDialog from './components/BackgroundDialog.vue'
import OpenDialog from './components/OpenDialog.vue'

const store = useBookStore()
const iframe = ref<HTMLIFrameElement | null>(null)

// --- RHS panel tabs (Objects and Store live in their own tabs)
type PropsTab = 'page' | 'selection' | 'objects' | 'store'
const TABS: Array<{ id: PropsTab; label: string }> = [
  { id: 'page', label: 'Page' },
  { id: 'selection', label: 'Selection' },
  { id: 'objects', label: 'Objects' },
  { id: 'store', label: 'Store' },
]
const propsTab = ref<PropsTab>(
  (localStorage.getItem('toolback.propsTab') as PropsTab | null) ?? 'page',
)
function setTab(t: PropsTab): void {
  propsTab.value = t
  localStorage.setItem('toolback.propsTab', t)
}
// selecting objects on the canvas or in the list reveals the properties
watch(
  () => store.selectionIds.join(','),
  (ids) => {
    if (ids) propsTab.value = 'selection'
  },
)

// --- panel visibility: manual toggles + optional auto-hide while running
function boolPref(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : raw === '1'
}
const showLeft = ref(boolPref('toolback.showLeft', true))
const showRight = ref(boolPref('toolback.showRight', true))
const autoHide = ref(boolPref('toolback.autoHidePanels', true))
let preRunLeft = showLeft.value
let preRunRight = showRight.value

watch(
  () => store.isRunning,
  (running) => {
    if (running) {
      preRunLeft = showLeft.value
      preRunRight = showRight.value
      if (autoHide.value) {
        showLeft.value = false
        showRight.value = false
      }
    } else {
      showLeft.value = preRunLeft
      showRight.value = preRunRight
    }
  },
)

function toggleLeft(): void {
  showLeft.value = !showLeft.value
  localStorage.setItem('toolback.showLeft', showLeft.value ? '1' : '0')
}

function toggleRight(): void {
  showRight.value = !showRight.value
  localStorage.setItem('toolback.showRight', showRight.value ? '1' : '0')
}

const settingsOpen = ref(false)
const settingsPop = ref<HTMLElement | null>(null)
const fileMenuOpen = ref(false)
const fileMenu = ref<HTMLElement | null>(null)
const openDialogOpen = ref(false)
const authorMenuOpen = ref(false)
const authorMenu = ref<HTMLElement | null>(null)

interface FileAction {
  label: string
  hint?: string
  /** draw a separator above this item */
  sep?: boolean
  action: () => Promise<void>
}
const fileActions: FileAction[] = [
  { label: 'New', action: onNew },
  { label: 'Open…', action: onOpen },
  { label: 'Save', hint: '⌘S', action: onSave },
  { label: 'Import…', sep: true, action: onImport },
  { label: 'Export project…', action: onExport },
  { label: 'Publish', sep: true, action: onPublish },
]

function invokeFile(a: FileAction): void {
  fileMenuOpen.value = false
  void a.action()
}

function onDocClickFile(e: MouseEvent): void {
  if (!fileMenuOpen.value) return
  if (fileMenu.value && !fileMenu.value.contains(e.target as Node)) {
    fileMenuOpen.value = false
  }
}

const pluginPages = computed(() => store.book.pages.filter((p) => p.author))

function bookIndexOf(page: { id: string }): number {
  return store.book.pages.findIndex((p) => p.id === page.id)
}

function runPlugin(page: { id: string; name: string }): void {
  authorMenuOpen.value = false
  if (store.authorActive === page.name) {
    store.stopAuthor()
    return
  }
  store.startAuthor(bookIndexOf(page))
}

function onDocClickAuthor(e: MouseEvent): void {
  if (!authorMenuOpen.value) return
  if (authorMenu.value && !authorMenu.value.contains(e.target as Node)) {
    authorMenuOpen.value = false
  }
}

function setAutoHide(v: boolean): void {
  autoHide.value = v
  localStorage.setItem('toolback.autoHidePanels', v ? '1' : '0')
}

function onDocClick(e: MouseEvent): void {
  if (!settingsOpen.value) return
  if (settingsPop.value && !settingsPop.value.contains(e.target as Node)) {
    settingsOpen.value = false
  }
}

// --- run shortcut (F3 / ⌥3), z-order (⌘[/⌘]) and delete — global keys

// F3 or ⌥3 (Alt+3) toggles Run. Capture phase + stopPropagation so it wins
// over Monaco's F3 find-next; ⌥3 also toggles from editable targets (the
// preventDefault here stops the £ that ⌥3 would otherwise type on Mac).
// Keydowns inside the canvas iframe are handled canvas-side (editorLink) instead.
function onRunKey(e: KeyboardEvent): void {
  if (!shouldToggleRun(e)) return
  e.preventDefault()
  e.stopPropagation()
  store.toggleRun()
}

// undo/redo: ⌘Z / ⌘⇧Z (or Ctrl). Capture phase like F3, but skipped in
// editable targets — inside Monaco/inputs ⌘Z undoes text in place, and the
// resulting content change is simply coalesced into a book history step.
function onUndoKey(e: KeyboardEvent): void {
  const ur = isUndoKey(e)
  if (!ur) return
  const el = e.target as HTMLElement | null
  const editable =
    !!el &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)
  if (editable) return
  e.preventDefault()
  e.stopPropagation()
  if (ur === 'undo') store.undo()
  else store.redo()
}

// save: ⌘S / Ctrl+S. Capture phase, skipped in editable targets so Monaco
// and inputs keep their own save/insert behavior.
function onSaveKey(e: KeyboardEvent): void {
  const mod = e.metaKey || e.ctrlKey
  if (!mod || e.key.toLowerCase() !== 's') return
  const el = e.target as HTMLElement | null
  const editable =
    !!el &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)
  if (editable) return
  e.preventDefault()
  e.stopPropagation()
  void store.save()
}

// z-order + delete: skip while typing (⌘[ is outdent in Monaco); only when
// there is a selection
function onArrangeKey(e: KeyboardEvent): void {
  const action = zOrderActionOf(e)
  if (action) {
    const el = e.target as HTMLElement | null
    const editable =
      !!el &&
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)
    if (editable || store.selectionIds.length === 0) return
    e.preventDefault()
    store.reorderSelection(action)
    return
  }
  if (isDeleteSelectionKey(e)) {
    const el = e.target as HTMLElement | null
    const editable =
      !!el &&
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)
    if (editable || store.selectionIds.length === 0) return
    e.preventDefault()
    store.removeSelected()
  }
}

function onDocKey(e: KeyboardEvent): void {
  // Escape closes the settings popup, and in run mode also closes the
  // topmost modal popup on the canvas (Esc never deselects in design mode —
  // that path is handled canvas-side)
  if (e.key === 'Escape') {
    settingsOpen.value = false
    fileMenuOpen.value = false
    if (store.isRunning && iframe.value) {
      iframe.value.contentWindow?.postMessage({ type: 'toolback:esc' }, '*')
    }
  }
}

// duplicate: ⌥D (Alt+D). isDuplicateKey already skips editable targets
// (⌥D types ∂ on Mac) and requires no modifiers beyond Alt. Design-only:
// nothing to duplicate while running.
function onDuplicateKey(e: KeyboardEvent): void {
  if (!isDuplicateKey(e)) return
  if (store.isRunning) return
  if (store.selectionIds.length === 0) return
  e.preventDefault()
  e.stopPropagation()
  store.duplicateSelected()
}

// group/ungroup: ⌥G / ⌥U (Alt+G/Alt+U). Same editable-target skip (⌥U is the
// umlaut dead key on Mac). The store actions already no-op when the selection
// isn't eligible, so we only gate on run mode here.
function onGroupKey(e: KeyboardEvent): void {
  const gk = isGroupKey(e)
  if (!gk) return
  if (store.isRunning) return
  e.preventDefault()
  e.stopPropagation()
  if (gk === 'group') store.groupSelected()
  else store.ungroupSelected()
}

// copy/cut/paste: ⌘C / ⌘X / ⌘V (Ctrl on Windows/Linux). The editable-target
// skip keeps the browser's own text clipboard — Monaco script editors, prop
// inputs, contenteditable fields — untouched, so object copy/paste never
// interferes with copying script text. Capture phase so we win over the
// document-level handlers. Design-only.
function onClipboardKey(e: KeyboardEvent): void {
  let action: 'copy' | 'cut' | 'paste' | null = null
  if (isCopyKey(e)) action = 'copy'
  else if (isCutKey(e)) action = 'cut'
  else if (isPasteKey(e)) action = 'paste'
  if (!action) return
  const el = e.target as HTMLElement | null
  const editable =
    !!el &&
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable)
  if (editable) return
  if (store.isRunning) return
  if (action === 'paste') {
    if (!store.canPaste) return
  } else if (store.selectionIds.length === 0) {
    return
  }
  e.preventDefault()
  e.stopPropagation()
  let n = 0
  if (action === 'copy') n = store.copySelected()
  else if (action === 'cut') n = store.cutSelected()
  else n = store.pasteClipboard()
  if (n) store.flashCanvasNote(`${action === 'paste' ? 'Pasted' : action === 'copy' ? 'Copied' : 'Cut'} ${n} object${n === 1 ? '' : 's'}`)
}

onMounted(async () => {
  window.addEventListener('keydown', onRunKey, true)
  window.addEventListener('keydown', onUndoKey, true)
  window.addEventListener('keydown', onSaveKey, true)
  window.addEventListener('keydown', onClipboardKey, true)
  document.addEventListener('keydown', onArrangeKey)
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
  document.addEventListener('keydown', onDuplicateKey)
  document.addEventListener('keydown', onGroupKey)
  document.addEventListener('click', onDocClickAuthor)
  document.addEventListener('click', onDocClickFile)
  document.addEventListener('click', onDocClick)
  if (iframe.value) wireCanvas(iframe.value)
  await store.restoreAutosave()
  await store.refreshRecents()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onRunKey, true)
  window.removeEventListener('keydown', onUndoKey, true)
  window.removeEventListener('keydown', onSaveKey, true)
  window.removeEventListener('keydown', onClipboardKey, true)
  document.removeEventListener('keydown', onDocKey)
  document.removeEventListener('keydown', onArrangeKey)
  document.removeEventListener('keydown', onDuplicateKey)
  document.removeEventListener('keydown', onGroupKey)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('click', onDocClickAuthor)
  document.removeEventListener('click', onDocClickFile)
})

const objectRows = computed(() => treeRows(store.targetObjects))

// the background of the page being edited (for the Page tab's selector)
const pageBackgroundId = computed(
  () => store.activePage.backgroundId || store.book.backgrounds[0]?.id || '',
)

function onPageBackgroundChange(e: Event): void {
  const id = (e.target as HTMLSelectElement).value
  if (id) store.movePageToBackground(store.currentPageIndex, id)
}

function selectInList(obj: PageObject): void {
  store.setSelection([obj.id])
}

const palette: ControlKind[] = ['button', 'label', 'input', 'image', 'card', 'container', 'switch', 'markdown', 'html']

function onPaletteDown(kind: ControlKind, e: PointerEvent): void {
  if (iframe.value && !store.isRunning) startPaletteDrag(e, kind, iframe.value)
}

async function onNew(): Promise<void> {
  store.newBook()
  await store.rememberCurrent()
}

async function onOpen(): Promise<void> {
  openDialogOpen.value = true
}

async function onImport(): Promise<void> {
  openDialogOpen.value = false
  try {
    const book = await openBookFile()
    if (book && store.hydrate(book)) await store.rememberCurrent()
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = `Import failed: ${String(err)}`
    }
  }
}

/** explicit save to IndexedDB (named project snapshot + autosave slot) */
async function onSave(): Promise<void> {
  await store.save()
}

/** export the project as a .toolbook.json file */
async function onExport(): Promise<void> {
  try {
    const result = await saveBookFile(store.book)
    await store.rememberCurrent()
    store.fileNote = result === 'saved' ? 'saved to file' : 'downloaded'
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = String(err)
    }
  }
}

const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const

/** browser-safe base64 of UTF-8 text, chunked for large payloads */
function toDataUrl(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:text/javascript;base64,${btoa(bin)}`
}

async function onPublish(): Promise<void> {
  try {
    const player = await fetch('/toolback-player.js').then((r) => r.text())
    const specifiers = scanLibImports(store.book)
    const available = new Map<string, string>()
    if (specifiers.length > 0) {
      const shelfRes = await fetch('/libs/importmap.json')
      const shelf = shelfRes.ok
        ? ((await shelfRes.json()) as { imports: Record<string, string> })
        : { imports: {} }
      for (const spec of specifiers) {
        const name = basePackageName(spec)
        const url = shelf.imports[name]
        if (!url || available.has(name)) continue
        available.set(
          name,
          toDataUrl(
            await fetch(url).then((r) => {
              if (!r.ok) throw new Error(`${url} missing — run "pnpm dev" to rebuild the library shelf`)
              return r.text()
            }),
          ),
        )
      }
    }
    const { libs, warnings } = libUrlMapFor(specifiers, available)
    const html = buildStandaloneHtml(store.book, player, libs)
    const result = await saveTextFile(standaloneFileName(store.book), html, 'text/html')
    const base = result === 'saved' ? 'published to file' : 'published (downloaded)'
    store.fileNote = warnings.length ? `${base}; ${warnings.join(' ')}` : base
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      store.error = `Publish failed: ${String(err)}`
    }
  }
}

const canvasStyle = computed(() => {
  const size = store.activeCanvasSize
  return { width: `${size.width}px`, height: `${size.height}px` }
})

/** objects rendered at least partly outside the current page box (the clip
 *  indicators on the canvas + this chip make the clipping visible) */
const offPageCount = computed(() => {
  if (store.isRunning || !store.canvasReady) return 0
  const size = store.activeCanvasSize
  let n = 0
  for (const r of Object.values(store.rects)) {
    if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > size.width + 0.5 || r.y + r.h > size.height + 0.5) n++
  }
  return n
})

/** what the status bar calls the thing being edited */
const targetLabel = computed(() =>
  store.editing.kind === 'background'
    ? `background "${store.activeBackground?.name ?? '?'}"`
    : `page ${store.currentPageIndex + 1}/${store.book.pages.length}`,
)

const shellStyle = computed(() => ({
  gridTemplateColumns: `${showLeft.value ? `${store.paletteWidth}px` : '0px'} ${showLeft.value ? '6px' : '0px'} 1fr ${showRight.value ? '6px' : '0px'} ${showRight.value ? `${store.propsWidth}px` : '0px'}`,
}))

function startSplitDrag(e: PointerEvent): void {
  const startX = e.clientX
  const startW = store.propsWidth
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const move = (ev: PointerEvent): void => {
    const w = Math.round(Math.min(640, Math.max(260, startW - (ev.clientX - startX))))
    store.propsWidth = w
  }
  const up = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    store.savePropsWidth()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function startPaletteSplitDrag(e: PointerEvent): void {
  const startX = e.clientX
  const startW = store.paletteWidth
  const target = e.currentTarget as HTMLElement
  try {
    target.setPointerCapture(e.pointerId)
  } catch {
    // window listeners below track the drag regardless
  }
  const move = (ev: PointerEvent): void => {
    store.setPaletteWidth(startW + (ev.clientX - startX))
  }
  const up = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    store.savePaletteWidth()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
</script>

<template>
  <div class="shell" :style="shellStyle">
    <header class="topbar">
      <div class="left-group">
        <div class="brand">
          <span class="logo">toolback</span>
          <span class="badge">v4 · M4 publish</span>
        </div>
        <div class="filebar">
          <div class="file-wrap">
            <button
              class="file-trigger"
              :class="{ on: fileMenuOpen }"
              @click.stop="fileMenuOpen = !fileMenuOpen"
            >File ▾</button>
            <div v-if="fileMenuOpen" ref="fileMenu" class="file-menu" @click.stop>
              <template v-for="a in fileActions" :key="a.label">
                <div v-if="a.sep" class="file-sep"></div>
                <button class="file-item" @click="invokeFile(a)">
                  <span>{{ a.label }}</span>
                  <span v-if="a.hint" class="kbd">{{ a.hint }}</span>
                </button>
              </template>
            </div>
          </div>
        </div>
        <div class="historybar" title="Undo (⌘Z) · Redo (⌘⇧Z) · Duplicate (⌥D)">
          <button :disabled="!store.canUndo" @click="store.undo()">↶</button>
          <button :disabled="!store.canRedo" @click="store.redo()">↷</button>
          <button class="dup" :disabled="store.isRunning || !store.selectionIds.length" @click="store.duplicateSelected()">⧉</button>
        </div>
        <div class="bp-switch" title="Preview breakpoint">
          <button
            v-for="bp in BREAKPOINTS"
            :key="bp"
            :class="{ on: store.breakpoint === bp }"
            :disabled="store.isRunning"
            @click="store.setBreakpoint(bp)"
          >
            {{ bp[0]!.toUpperCase() + bp.slice(1) }}
          </button>
        </div>
        <div class="spring-wrap">
          <div class="spring-switch" title="Glue springs — which objects to show">
            <span class="spring-glyph" aria-hidden="true">≋</span>
            <button
              class="spring-toggle"
              :class="{ on: store.fitHintMode === 'all' }"
              :disabled="store.isRunning"
              title="All glued objects"
              @click="store.setFitHintMode('all')"
            >All</button>
            <button
              class="spring-toggle"
              :class="{ on: store.fitHintMode === 'selected' }"
              :disabled="store.isRunning"
              title="Selected object(s) only"
              @click="store.setFitHintMode('selected')"
            >Sel</button>
            <button
              class="spring-toggle"
              :class="{ on: store.fitHintMode === 'off' }"
              :disabled="store.isRunning"
              title="Hide all springs"
              @click="store.setFitHintMode('off')"
            >Off</button>
          </div>
          <div class="spring-legend" role="tooltip">
            <div class="spring-legend-inner">
              <div class="legend-row">
                <svg class="legend-swatch" width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
                  <path class="lz-edge" d="M2 6 L6 3 L10 9 L14 3 L18 9 L22 3 L26 9 L30 6" />
                  <rect class="la-edge" x="0" y="3" width="4" height="6" />
                  <path class="lz-edge" d="M29 2 L34 6 L29 10" />
                </svg>
                <span><b>Edge</b> Left / Top / Right / Bottom — solid zigzag, square anchor, arrow points at the object</span>
              </div>
              <div class="legend-row">
                <svg class="legend-swatch" width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
                  <path class="lz-center" d="M3 6 L31 6" />
                  <circle class="la-center" cx="3" cy="6" r="2.5" />
                  <circle class="la-center" cx="31" cy="6" r="2.5" />
                </svg>
                <span><b>Center</b> — plain dashed line, circle anchor</span>
              </div>
              <div class="legend-row">
                <svg class="legend-swatch" width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
                  <path class="lz-stretch" d="M2 6 C4 1 7 1 9 6 S14 11 16 6 S21 1 23 6 S28 11 30 6" />
                  <polygon class="la-stretch" points="2,2 0,6 2,10" />
                  <polygon class="la-stretch" points="32,2 34,6 32,10" />
                </svg>
                <span><b>Stretch</b> — dashed circular coil, triangle anchor</span>
              </div>
              <p class="legend-note">Muted colours: slate = edge, pale grey = center, amber = stretch.</p>
            </div>
          </div>
        </div>
      </div>
        <div class="right-group">
          <div class="author-wrap">
            <button
              class="author"
              :class="{ on: !!store.authorActive }"
              :disabled="store.isRunning"
              :title="store.authorActive ? `Stop plugin '${store.authorActive}'` : 'Run a plugin page in author mode'"
              @click.stop="authorMenuOpen = !authorMenuOpen"
            >⚡</button>
            <div v-if="authorMenuOpen" ref="authorMenu" class="author-menu" @click.stop>
              <h3>Author plugins</h3>
              <template v-if="pluginPages.length">
                <button
                  v-for="p in pluginPages"
                  :key="p.id"
                  class="author-item"
                  @click="runPlugin(p)"
                >⚡ {{ p.name }}</button>
              </template>
              <p v-else class="hint">No plugin pages yet. Open a page and tick “Plugin page” in the Page tab — its scripts then run with the author API.</p>
            </div>
          </div>
          <button
          class="panel-toggle"
          :class="{ off: !showLeft }"
          title="Hide/show the left panel (palette + pages)"
          @click="toggleLeft"
        >◧</button>
        <button
          class="panel-toggle"
          :class="{ off: !showRight }"
          title="Hide/show the right panel (properties)"
          @click="toggleRight"
        >◨</button>
        <div class="gear-wrap">
          <button
            class="panel-toggle gear"
            :class="{ on: settingsOpen }"
            title="Settings"
            @click.stop="settingsOpen = !settingsOpen"
          >⚙</button>
          <div v-if="settingsOpen" ref="settingsPop" class="settings-pop">
            <h3>Settings</h3>
            <label class="check">
              <input
                type="checkbox"
                :checked="autoHide"
                @change="setAutoHide(($event.target as HTMLInputElement).checked)"
              />
              Hide panels while running
            </label>
            <p class="hint">Run (F3 or ⌥3) tucks the panels away; stopping brings them back.</p>
          </div>
        </div>
        <button
          class="run"
          :class="{ running: store.isRunning }"
          title="Toggle run mode (F3 or ⌥3)"
          @click="store.toggleRun()"
        >
          {{ store.isRunning ? 'Stop' : 'Run' }}
        </button>
      </div>
    </header>

    <aside v-show="showLeft" class="palette">
      <h2>Palette</h2>
      <ul class="palette-list">
        <li v-for="kind in palette" :key="kind" @pointerdown="onPaletteDown(kind, $event)">
          <span class="swatch"></span>
          <span class="name">{{ kind }}</span>
        </li>
      </ul>
      <p class="hint">Drag onto the canvas →</p>
      <PagesPanel />
    </aside>

    <div
      v-show="showLeft"
      class="splitter split-l"
      title="Drag to resize · double-click to reset"
      @pointerdown="startPaletteSplitDrag"
      @dblclick="store.resetPaletteWidth()"
    ></div>

    <main class="canvas-area" :class="{ active: store.dragOverCanvas }">
      <iframe
        ref="iframe"
        class="canvas"
        :style="canvasStyle"
        src="/canvas.html"
        title="toolback canvas"
      ></iframe>
    </main>

    <div
      v-show="showRight"
      class="splitter"
      title="Drag to resize · double-click to reset"
      @pointerdown="startSplitDrag"
      @dblclick="store.resetPropsWidth()"
    ></div>

    <aside v-show="showRight" class="properties">
      <div class="props-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          :class="{ on: propsTab === t.id }"
          @click="setTab(t.id)"
        >{{ t.id === 'page' && store.editing.kind === 'background' ? 'Background' : t.label }}</button>
      </div>

      <div v-show="propsTab === 'page'">
        <template v-if="store.editing.kind === 'page'">
          <div class="field">
            <label>Page name</label>
            <input :value="store.activePage.name" disabled />
          </div>
          <div class="field">
            <label>Background (shared objects + page size)</label>
            <div class="bg-row">
              <select :value="pageBackgroundId" @change="onPageBackgroundChange">
                <option v-for="b in store.book.backgrounds" :key="b.id" :value="b.id">
                  {{ b.name }}
                </option>
              </select>
              <button
                class="bg-props"
                title="Background properties"
                @click="store.backgroundDialogId = pageBackgroundId"
              >Properties…</button>
            </div>
          </div>
          <label class="check-row" title="Offer this page in the ⚡ Author menu — its scripts get the author API at authoring time">
            <input
              type="checkbox"
              :checked="!!store.activePage.author"
              @change="store.setPageAuthorFlag(store.currentPageIndex, ($event.target as HTMLInputElement).checked)"
            />
            Plugin page (runs in author mode with the author API)
          </label>
          <label class="check-row" title="The published app and the editor on refresh open on this page. Unset: the first page.">
            <input
              type="checkbox"
              :checked="store.book.startPageId === store.activePage.id"
              @change="store.setStartPage(($event.target as HTMLInputElement).checked ? store.currentPageIndex : null)"
            />
            Start page (app opens here)
          </label>

          <div class="row">
            <h2 class="tab-head">Page script</h2>
            <HelpButton anchor="page-script" />
            <ImportHelper />
          </div>
          <p class="hint mono-hint">
            Shared functions + <code>pageEnter()</code>. Object scripts can call these directly.
          </p>
          <ScriptEditor
            editor-class="page-script"
            title="Page script"
            :model-value="store.activePage.script"
            height="190px"
            @update:model-value="store.setPageScript"
          />
        </template>

        <template v-else>
          <p class="hint bg-banner">
            Editing background <strong>"{{ store.activeBackground?.name }}"</strong> — its objects
            appear on all {{ store.backgroundPageCount }} page(s) that use it. Page-size:
            {{ store.activeCanvasSize.width }} × {{ store.activeCanvasSize.height }}.
          </p>
          <div class="field">
            <label>Background name</label>
            <input
              :value="store.activeBackground?.name"
              @change="store.renameBackground(store.editing.id, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field">
            <label>Colour</label>
            <input
              type="color"
              class="bg-color"
              :value="store.activeBackground?.color"
              @input="store.setBackgroundProp(store.editing.id, { color: ($event.target as HTMLInputElement).value })"
            />
          </div>
          <button
            class="bg-props full"
            title="Page size, per breakpoint"
            @click="store.backgroundDialogId = store.editing.id"
          >Page size & properties…</button>

          <div class="row">
            <h2 class="tab-head">Background script</h2>
            <HelpButton anchor="background-scripts" />
            <ImportHelper />
          </div>
          <p class="hint mono-hint">
            Shared functions + <code>backgroundEnter()</code>. Pages on this background can call these.
          </p>
          <ScriptEditor
            editor-class="background-script"
            kind="background"
            title="Background script"
            :model-value="store.activeBackground?.script ?? ''"
            height="190px"
            @update:model-value="store.setBackgroundScript"
          />

          <p class="hint">
            Pages always play at run time — Run shows the first page on this background.
          </p>
        </template>
      </div>

      <div v-show="propsTab === 'selection'">
        <PropertiesPanel />
      </div>

      <div v-show="propsTab === 'objects'">
        <div class="field">
          <label>Project name</label>
          <input
            :value="store.book.title"
            placeholder="Untitled"
            @change="store.renameBook(($event.target as HTMLInputElement).value)"
          />
          <p class="hint file-hint">Exports as <code>{{ bookFileName(store.book) }}</code></p>
        </div>
        <ul class="objects">
          <li
            v-for="row in objectRows"
            :key="row.obj.id"
            :class="{ selected: store.selectionIds.includes(row.obj.id) }"
            :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
            @click="selectInList(row.obj)"
          >
            <span class="obj-kind">{{ row.obj.control }}</span>
            <span class="obj-name">{{ row.obj.name }}</span>
            <span v-if="row.obj.children?.length" class="obj-count">{{ row.obj.children.length }}</span>
          </li>
        </ul>
      </div>

      <div v-show="propsTab === 'store'">
        <StoreBrowser />
      </div>
    </aside>

    <BackgroundDialog v-if="store.backgroundDialogId" />
    <OpenDialog v-if="openDialogOpen" @close="openDialogOpen = false" @import="onImport" />

    <footer class="status">
      <template v-if="store.error">
        <span class="err-line">
          <span class="err">canvas error: {{ store.error }}</span>
          <button class="dismiss" title="Dismiss error" aria-label="Dismiss error" @click="store.error = ''">✕</button>
        </span>
      </template>
      <template v-else-if="store.canvasReady">
        <span class="ok">● canvas ready</span>
        <span class="mode" :class="{ running: store.isRunning }">{{ store.isRunning ? 'RUNNING' : 'design' }}</span>
        <span>{{ targetLabel }} · {{ store.objectCount }} objects · "{{ store.book.title }}"</span>
        <span v-if="store.popupsOpen.length" class="popups">popup: {{ store.popupsOpen.join(', ') }}</span>
        <span v-if="offPageCount" class="offpage" :title="'Objects sticking out of the ' + store.breakpoint + ' page — dashed red outline on the canvas. Use the Responsive glue (Right/Stretch/…) or drag them back in.'">{{ offPageCount }} off-page</span>
        <span v-if="store.authorActive" class="author-chip">⚡ plugin: {{ store.authorActive }}</span>
        <span v-if="store.savedAt" class="dim">saved {{ new Date(store.savedAt).toLocaleTimeString() }}</span>
        <span v-if="store.autosaveAt" class="dim">autosaved {{ new Date(store.autosaveAt).toLocaleTimeString() }}</span>
        <span v-if="store.fileNote" class="dim">{{ store.fileNote }}</span>
        <span v-if="store.scriptError" class="err-line">
          <span class="err">script: {{ store.scriptError }}</span>
          <button class="dismiss" title="Dismiss error" aria-label="Dismiss script error" @click="store.scriptError = ''">✕</button>
        </span>
        <span v-else-if="store.canvasNote" class="note">{{ store.canvasNote }}</span>
      </template>
      <template v-else>
        <span>waiting for canvas…</span>
      </template>
    </footer>
  </div>
</template>

<style>
:root {
  --ed-bg: #0f1115;
  --ed-panel: #161a21;
  --ed-border: #262c37;
  --ed-text: #e5e7eb;
  --ed-text-dim: #8b93a1;
  --ed-accent: #6366f1;
  --ed-ok: #34d399;
  --ed-err: #f87171;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
}

body.tb-palette-dragging,
body.tb-palette-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}

.tb-drag-ghost {
  position: fixed;
  z-index: 999;
  pointer-events: none;
  font: 600 12px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
}

.shell {
  display: grid;
  grid-template-rows: 48px 1fr 28px;
  grid-template-columns: 220px 6px 1fr 6px 330px;
  grid-template-areas:
    'top top top top top'
    'palette splitl canvas split props'
    'status status status status status';
  height: 100vh;
}

.splitter {
  grid-area: split;
  cursor: col-resize;
  background: var(--ed-border);
  touch-action: none;
  user-select: none;
}

.splitter.split-l {
  grid-area: splitl;
}

.splitter:hover {
  background: var(--ed-accent);
}

.topbar {
  grid-area: top;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--ed-panel);
  border-bottom: 1px solid var(--ed-border);
}

.left-group {
  display: flex;
  align-items: center;
  gap: 18px;
}

.filebar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filebar button {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}

.filebar button.on,
.filebar button:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.filebar .file-trigger {
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--ed-text);
}

.filebar .file-trigger:hover:not(.on) {
  color: var(--ed-accent);
}

.filebar .file-trigger.on {
  background: rgba(99, 102, 241, 0.14);
  color: #fff;
}

.file-wrap {
  position: relative;
}

.file-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 80;
  min-width: 170px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
}

.filebar .file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  font: 500 12.5px/1.2 system-ui, sans-serif;
  color: var(--ed-text);
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 6px 8px;
  cursor: pointer;
}

.filebar .file-item:hover {
  background: rgba(99, 102, 241, 0.16);
  color: #fff;
  border-color: transparent;
}

.file-sep {
  height: 1px;
  background: var(--ed-border);
  margin: 3px 6px;
}

.filebar .file-item .kbd {
  font-size: 10.5px;
  color: var(--ed-text-dim);
}

.file-hint {
  margin: 2px 2px 0;
}

.file-hint code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: var(--ed-accent);
}

.historybar {
  display: flex;
  gap: 2px;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 2px;
  background: var(--ed-bg);
}

.historybar button {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 4px 9px;
  cursor: pointer;
  min-width: 24px;
}

.historybar button:hover {
  color: var(--ed-accent);
}

.historybar button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.historybar button.dup {
  margin-left: 4px;
}

.bp-switch {
  display: flex;
  gap: 2px;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 2px;
  background: var(--ed-bg);
}

.bp-switch button {
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
}

.bp-switch button.on {
  color: #fff;
  background: var(--ed-accent);
}

.bp-switch button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spring-wrap {
  position: relative;
}

.spring-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 2px;
  background: var(--ed-bg);
}

.spring-legend {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 90;
  padding-top: 8px;
}

.spring-wrap:hover .spring-legend,
.spring-wrap:focus-within .spring-legend {
  display: block;
}

.spring-legend-inner {
  width: 320px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.legend-row {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 8px;
  font: 400 11px/1.35 system-ui, sans-serif;
  color: var(--ed-text-dim);
}

.legend-row b {
  color: var(--ed-text);
}

.legend-swatch {
  flex: 0 0 auto;
  margin-top: 1px;
}

.legend-swatch path {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.lz-edge {
  stroke: rgba(100, 116, 139, 0.9);
}

.la-edge {
  fill: rgba(100, 116, 139, 0.9);
}

.lz-center {
  stroke: rgba(148, 163, 184, 0.95);
  stroke-dasharray: 4 3;
}

.la-center {
  fill: rgba(148, 163, 184, 0.95);
}

.lz-stretch {
  stroke: rgba(217, 119, 6, 0.8);
  stroke-dasharray: 4 3;
}

.la-stretch {
  fill: rgba(217, 119, 6, 0.85);
}

.legend-note {
  margin: 2px 0 0;
  font-size: 10.5px;
  color: var(--ed-text-dim);
}

.spring-glyph {
  font-size: 13px;
  line-height: 1;
  padding: 0 3px 0 4px;
  color: var(--ed-text-dim);
}

.spring-toggle {
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 5px 8px;
  cursor: pointer;
}

.spring-toggle.on {
  color: #fff;
  background: var(--ed-accent);
}

.spring-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dim {
  color: var(--ed-text-dim);
  opacity: 0.8;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.logo {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.3px;
}

.badge {
  font-size: 11px;
  color: var(--ed-text-dim);
  border: 1px solid var(--ed-border);
  border-radius: 999px;
  padding: 2px 8px;
}

.run {
  font: 600 13px/1 system-ui, sans-serif;
  color: #fff;
  background: var(--ed-accent);
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  cursor: pointer;
  min-width: 76px;
}

.run.running {
  background: #059669;
}

.right-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-toggle {
  font: 500 13px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
}

.panel-toggle:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.panel-toggle.off {
  color: var(--ed-text-dim);
  opacity: 0.55;
}

.panel-toggle.on {
  color: #fff;
  background: var(--ed-accent);
  border-color: var(--ed-accent);
}

.gear-wrap {
  position: relative;
}

.settings-pop {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 50;
  width: 280px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.settings-pop h3 {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ed-text-dim);
}

.settings-pop .check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.settings-pop .check input {
  accent-color: var(--ed-accent);
}

.settings-pop .hint {
  margin: 10px 2px 0;
  font-size: 11px;
  color: var(--ed-text-dim);
}

.props-tabs {
  display: flex;
  gap: 2px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 2px;
  margin-bottom: 12px;
}

.props-tabs button {
  flex: 1;
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 6px 4px;
  cursor: pointer;
}

.props-tabs button:hover {
  color: var(--ed-text);
}

.props-tabs button.on {
  color: #fff;
  background: var(--ed-accent);
}

.tab-head {
  margin-top: 4px;
}

.mono-hint {
  margin: 0 0 6px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row h2 {
  margin-bottom: 4px;
}

.mono-hint code {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  color: var(--ed-accent);
}

.bg-row {
  display: flex;
  gap: 6px;
}

.bg-row select {
  flex: 1;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  color: var(--ed-text);
  padding: 6px 8px;
  font: inherit;
}

.bg-props {
  font: 500 12px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
}

.bg-props:hover {
  border-color: var(--ed-accent);
  color: #fff;
}

.bg-props.full {
  width: 100%;
  padding: 9px 10px;
  margin: 4px 0 8px;
}

.bg-banner {
  margin: 4px 2px 12px;
  padding: 9px 11px;
  border: 1px solid var(--ed-accent);
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--ed-text);
  line-height: 1.5;
}

.bg-banner strong {
  color: var(--ed-accent);
}

.layout-block {
  margin-bottom: 14px;
}

.layout-block .hint {
  margin: 0 0 8px;
}

.bg-color {
  width: 64px;
  height: 34px;
  padding: 2px;
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  cursor: pointer;
}

.status .note {
  color: var(--ed-accent);
}

.status .popups {
  color: var(--ed-ok);
  border: 1px solid var(--ed-ok);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  letter-spacing: 0.4px;
}

.status .offpage {
  color: var(--ed-err);
  border: 1px solid var(--ed-err);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  letter-spacing: 0.4px;
}

.status .author-chip {
  color: #c7d2fe;
  border: 1px solid var(--ed-accent);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  letter-spacing: 0.4px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ed-text-dim);
  cursor: pointer;
  margin: 2px 0 10px;
}

.check-row input {
  accent-color: var(--ed-accent);
}

.author-wrap {
  position: relative;
}

.author {
  font: 600 13px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.author.on,
.author:hover:not(:disabled) {
  border-color: var(--ed-accent);
  color: #fff;
}

.author.on {
  background: rgba(99, 102, 241, 0.2);
}

.author:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.author-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 80;
  width: 260px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.author-menu h3 {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ed-text-dim);
}

.author-menu .hint {
  margin: 6px 2px 2px;
  font-size: 10.5px;
}

.author-item {
  display: block;
  width: 100%;
  text-align: left;
  font: 500 12.5px/1 system-ui, sans-serif;
  color: var(--ed-text);
  background: var(--ed-bg);
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  padding: 7px 10px;
  margin-top: 4px;
  cursor: pointer;
}

.author-item:hover {
  border-color: var(--ed-accent);
}

.palette {
  grid-area: palette;
  background: var(--ed-panel);
  border-right: 1px solid var(--ed-border);
  padding: 12px;
  overflow: auto;
}

.properties {
  grid-area: props;
  background: var(--ed-panel);
  border-left: 1px solid var(--ed-border);
  padding: 12px;
  overflow: auto;
}

h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ed-text-dim);
  margin: 14px 0 8px;
}

h2:first-child {
  margin-top: 2px;
}

.palette-list,
.objects {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* only the palette's own control list — panel li's (pages/backgrounds) style themselves */
.palette-list > li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: grab;
}

.palette-list > li:hover {
  border-color: var(--ed-accent);
}

.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: var(--ed-accent);
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
  color: var(--ed-text-dim);
  padding: 7px 9px;
  font: inherit;
}

.objects li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  cursor: pointer;
}

.objects li.selected {
  border-color: var(--ed-accent);
}

.obj-kind {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ed-accent);
  background: rgba(99, 102, 241, 0.12);
  border-radius: 4px;
  padding: 2px 6px;
}

.obj-name {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 12px;
  flex: 1;
}

.obj-count {
  font-size: 10px;
  color: var(--ed-text-dim);
}

.hint {
  font-size: 11px;
  color: var(--ed-text-dim);
  margin: 12px 2px 0;
}

.canvas-area {
  grid-area: canvas;
  overflow: auto;
  padding: 20px;
}

.canvas {
  background: #fff;
  border: none;
  outline: 1px solid var(--ed-border);
  outline-offset: -1px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.canvas-area.active .canvas {
  outline: 2px solid var(--ed-accent);
  outline-offset: -2px;
}

.status {
  grid-area: status;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 14px;
  font-size: 12px;
  color: var(--ed-text-dim);
  background: var(--ed-panel);
  border-top: 1px solid var(--ed-border);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 120ms ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}

.ok {
  color: var(--ed-ok);
}

.mode {
  border: 1px solid var(--ed-border);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 10px;
  letter-spacing: 0.8px;
}

.mode.running {
  color: #059669;
  border-color: #059669;
}

.err {
  color: var(--ed-err);
}

.err-line {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dismiss {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--ed-text-dim);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: 4px;
}

.dismiss:hover {
  color: #fff;
  background: var(--ed-border);
}
</style>
