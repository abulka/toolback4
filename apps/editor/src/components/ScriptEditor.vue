<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type * as Monaco from 'monaco-editor'
import { getMonaco } from '../monaco'
import { registerToolbackIntellisense, releaseApiLib, updateApiLib } from '../monacoApi'
import { buildApiLib, buildBackgroundApiLib, buildBackgroundEditorContext, buildEditorContext } from '../monacoApiLib'
import { collectStoreKeys } from '../storeKeys'
import { useBookStore } from '../stores/book'
import EditorWindow from './EditorWindow.vue'
import { makeScriptLink, type ScriptLinkHandle } from '../scriptLink'

const props = withDefaults(
  defineProps<{
    modelValue: string
    height?: string
    editorClass?: string
    /** which editor pane this is — selects the right API lib + completions */
    kind?: 'page' | 'background' | 'object'
    /** window title for the popout */
    title?: string
    /** stable key for the on-disk file link (defaults to kind + target id) */
    linkKey?: string
    /** render inside a popout window: no toolbar, fills the window */
    embedded?: boolean
    /** stable identity for this editor instance (renders a fresh uri each use) */
    uid?: string
    /** share an existing monaco model instead of creating our own (popout) */
    sharedModel?: Monaco.editor.ITextModel | null
  }>(),
  { height: '150px', editorClass: '', kind: 'page', title: '', linkKey: '', embedded: false },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const host = ref<HTMLDivElement | null>(null)
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
const model = shallowRef<Monaco.editor.ITextModel | null>(null)

const store = useBookStore()

// every editor instance gets its own monaco model uri — the completion
// provider serves each model its own per-editor context. Scripts are plain
// JavaScript, so the model uri must end in `.js` (not `.ts`): with a `.ts`
// uri the TS worker treats the model as TypeScript and silently accepts type
// annotations that the JS runtime can never execute.
const instanceUid = props.uid || `ed-${Math.random().toString(36).slice(2, 10)}`
// a popout shares its parent's model, so its context key is the parent's URI
const modelUri = computed(() => {
  if (props.sharedModel) return props.sharedModel.uri.toString()
  if (model.value) return model.value.uri.toString()
  return `inmemory://toolback/${instanceUid}.js`
})

// a logical key for the on-disk link ("page script of page X", …) so links
// survive page switches / remounts
const resolvedLinkKey = computed(() => {
  if (props.linkKey) return props.linkKey
  if (props.kind === 'background') return `bg:${store.activeBackground?.id ?? 'none'}`
  if (props.kind === 'object') return `object:${instanceUid}`
  return `page:${store.activePage.id}`
})

// fingerprint of everything the generated API lib + completion context depend on
const libFingerprint = computed(() => {
  if (props.kind === 'background') {
    const bg = store.activeBackground
    return JSON.stringify({
      kind: 'background',
      bg: bg?.id ?? '',
      names: bg?.objects.map((o) => o.name) ?? [],
      script: bg?.script ?? '',
      keys: collectStoreKeys(store.book),
    })
  }
  const page = store.activePage
  return JSON.stringify({
    pi: store.currentPageIndex,
    names: page.objects.map((o) => o.name),
    script: page.script,
    keys: collectStoreKeys(store.book),
  })
})

function buildLib(): { lib: string; ctx: ReturnType<typeof buildEditorContext> | ReturnType<typeof buildBackgroundEditorContext> } {
  if (props.kind === 'background') {
    const bg = store.activeBackground
    return {
      lib: buildBackgroundApiLib(bg),
      ctx: buildBackgroundEditorContext(bg, collectStoreKeys(store.book)),
    }
  }
  return {
    lib: buildApiLib(store.book, store.currentPageIndex),
    ctx: buildEditorContext(store.book, store.currentPageIndex, collectStoreKeys(store.book)),
  }
}

async function refreshLib(): Promise<void> {
  const monaco = await getMonaco()
  const { lib, ctx } = buildLib()
  // a popout shares its parent's model + URI, so the parent's context already
  // serves it — re-registering here would just clobber the same entry
  if (!props.sharedModel) updateApiLib(monaco, modelUri.value, lib, ctx)
}

onMounted(async () => {
  if (!host.value) return
  const monaco = await getMonaco()
  registerToolbackIntellisense(monaco)
  await refreshLib()
  // a popout shares its parent editor's model — two ScriptEditors bound to the
  // SAME model means the TS program still sees ONE implementation of every
  // function (no phantom "Duplicate function implementation" squiggles)
  const m = props.sharedModel ?? monaco.editor.createModel(props.modelValue, 'javascript', monaco.Uri.parse(modelUri.value))
  model.value = m
  editor = monaco.editor.create(host.value, {
    model: m,
    theme: 'toolback-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 12,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
    renderLineHighlight: 'line',
    padding: { top: 6, bottom: 6 },
    autoClosingBrackets: 'never',
    autoIndent: 'keep',
    formatOnType: false,
    fixedOverflowWidgets: true,
    suggestSelection: 'first',
    wordBasedSuggestions: 'off',
  })
  editor.onDidChangeModelContent(() => {
    const v = editor!.getValue()
    emit('update:modelValue', v)
    if (!props.embedded) link?.push(v)
  })
})

// refresh the generated API lib (debounced) as the book changes
let refreshTimer: ReturnType<typeof setTimeout> | undefined
watch(libFingerprint, () => {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    void refreshLib()
  }, 300)
})

watch(
  () => props.modelValue,
  (v) => {
    const m = model.value
    if (editor && m && m.getValue() !== v) m.setValue(v)
    if (!props.embedded && link) link.push(v)
  },
)

onBeforeUnmount(() => {
  clearTimeout(refreshTimer)
  link?.dispose()
  link = null
  editor?.dispose()
  editor = null
  // only dispose models we created ourselves — a popout's model belongs to
  // its parent editor, which disposes it on its own unmount
  if (!props.sharedModel) model.value?.dispose()
  model.value = null
  if (!props.sharedModel) releaseApiLib(modelUri.value)
})

// ---- popout: a second, large window bound to the same script ----
const popped = ref(false)
function togglePopout(): void {
  popped.value = !popped.value
}

// ---- on-disk link (VS Code round-trip) ----
let link: null | ScriptLinkHandle = null
const linkPhase = ref<string>('')
const linkName = ref<string>('')
const linkNote = ref<string>('')

function syncLinkView(): void {
  if (!link) return
  linkPhase.value = link.phase.value
  linkName.value = link.fileName.value
}

function initLink(): void {
  if (link || props.embedded) return
  link = makeScriptLink(
    resolvedLinkKey.value,
    (text) => {
      // external save → write back into the toolback book
      emit('update:modelValue', text)
      const m = model.value
      if (editor && m) m.setValue(text)
    },
    (message) => {
      // e.g. the linked file vanished from disk → the link auto-unlinked
      linkNote.value = message
      syncLinkView()
    },
  )
  syncLinkView()
  void (async () => {
    await link!.restore()
    // if the linked file came back empty (or brand new), seed it with the
    // editor's current content so "⇄ file" never leaves a blank file
    if (props.modelValue) link!.push(props.modelValue)
  })()
}

function onLinkClick(): void {
  if (!link) initLink()
  if (!link) return
  void (async () => {
    try {
      await link!.link()
      // a freshly picked file starts empty — seed it with the current script so
      // "⇄ file" never produces a blank file on first link
      link!.push(props.modelValue)
      syncLinkView()
    } catch (err) {
      linkNote.value = err instanceof Error ? err.message : String(err)
    }
  })()
}

function onUnlink(): void {
  if (!link) return
  void (async () => {
    await link!.unlink()
    syncLinkView()
    linkNote.value =
      'Unlinked. The file itself stays on disk — the browser won\u2019t let a web app delete a file you picked, so remove it manually if you no longer want it.'
  })()
}

function onLinkOpen(): void {
  if (link?.fileName.value) linkNote.value = `Linked to ${link.fileName.value} — edit + save in VS Code to sync back`
}

onMounted(() => {
  if (!props.embedded) initLink()
})

// the page-script / background editors are reused across page/background
// switches, so the link must follow the logical target
watch(resolvedLinkKey, (key, prev) => {
  if (props.embedded || key === prev) return
  link?.dispose()
  link = null
  initLink()
})
</script>

<template>
  <div class="tb-script-editor-wrap">
    <div v-if="!embedded" class="tb-script-toolbar">
      <template v-if="linkPhase === 'linked'">
        <span class="tb-link-chip" title="Click for sync details" @click="onLinkOpen">
          <span class="tb-link-name">⇄ {{ linkName || 'linked' }}</span>
          <button
            class="tb-link-x"
            title="Unlink — stop syncing with this file"
            aria-label="Unlink script file"
            @click.stop="onUnlink"
          >✕</button>
        </span>
      </template>
      <button
        v-else
        class="tb-script-btn"
        title="Link this script to a .js file on disk (edit in VS Code, saves sync back)"
        @click="onLinkClick"
      >
        ⇄ file
      </button>
      <button class="tb-script-btn" title="Open in a resizable window" @click="togglePopout">⤢</button>
    </div>
    <p v-if="linkNote" class="tb-script-note">{{ linkNote }}</p>
    <div ref="host" class="tb-script-editor" :class="editorClass" :style="{ height: embedded ? '100%' : height }"></div>
  </div>

  <EditorWindow
    v-if="popped && !embedded"
    :title="title || 'Script editor'"
    :skey="`editor-${instanceUid}`"
    @close="popped = false"
  >
    <ScriptEditor
      :model-value="modelValue"
      :kind="kind"
      :title="title"
      :link-key="resolvedLinkKey"
      :shared-model="model"
      embedded
      height="100%"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </EditorWindow>
</template>

<style scoped>
.tb-script-editor-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  min-height: 0;
}

.tb-script-toolbar {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.tb-script-btn {
  font: 500 10px/1 system-ui, sans-serif;
  color: var(--ed-text-dim, #8b93a1);
  background: var(--ed-bg, #0f1115);
  border: 1px solid var(--ed-border, #262c37);
  border-radius: 5px;
  padding: 3px 7px;
  cursor: pointer;
}

.tb-script-btn:hover {
  color: #fff;
  border-color: var(--ed-accent, #6366f1);
}

.tb-script-btn.linked {
  color: #a5b4fc;
  border-color: rgba(99, 102, 241, 0.5);
}

/* linked file chip: the filename (click for sync details) + a separate ✕ that unlinks */
.tb-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--ed-bg, #0f1115);
  border: 1px solid rgba(99, 102, 241, 0.5);
  border-radius: 5px;
  padding: 3px 7px;
  cursor: pointer;
}

.tb-link-chip:hover {
  border-color: var(--ed-accent, #6366f1);
}

.tb-link-name {
  font: 500 10px/1 system-ui, sans-serif;
  color: #a5b4fc;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tb-link-x {
  border: none;
  background: transparent;
  color: var(--ed-text-dim, #8b93a1);
  font-size: 11px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 4px;
  cursor: pointer;
}

.tb-link-x:hover {
  color: #fff;
  background: rgba(248, 113, 113, 0.2);
}

.tb-script-note {
  margin: 0;
  font-size: 10.5px;
  color: var(--ed-text-dim, #8b93a1);
  word-break: break-all;
}

.tb-script-editor {
  border: 1px solid var(--ed-border);
  border-radius: 6px;
  overflow: hidden;
  flex: 1 1 auto;
  min-height: 0;
}
</style>

<style>
/* suggest widget readability fallbacks (fixed layer escapes editor overflow) */
.tb-suggest-host .suggest-widget,
.monaco-editor .suggest-widget {
  background: #14171d !important;
  border: 1px solid #262c37 !important;
}

.monaco-editor .suggest-widget .monaco-list-row {
  color: #d3d8e0 !important;
}

.monaco-editor .suggest-widget .monaco-list-row.focused,
.monaco-editor .suggest-widget .monaco-list-row.selected {
  background: rgba(99, 102, 241, 0.3) !important;
  color: #ffffff !important;
}

.monaco-editor .suggest-widget .details,
.monaco-editor .suggest-widget .monaco-list-row .label-description {
  color: #8b93a1 !important;
}

.monaco-editor .suggest-widget:not(.frozen) .monaco-list-row.focused .label-description,
.monaco-editor .suggest-widget .monaco-list-row.focused .label-description {
  color: #ffffff !important;
}
</style>