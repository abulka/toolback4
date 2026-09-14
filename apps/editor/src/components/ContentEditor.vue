<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DynamicTextEditor from './DynamicTextEditor.vue'
import EditorWindow from './EditorWindow.vue'
import MonacoContent from './MonacoContent.vue'
import { makeScriptLink, type ScriptLinkHandle } from '../scriptLink'
import { registerToolbackIntellisense, setContentStoreKeys } from '../monacoApi'
import { getMonaco } from '../monaco'

/**
 * The content field for a markdown/HTML viewer: the `{{key}}`-aware textarea
 * inline, plus the two editor affordances scripts already have —
 * ⤢ a resizable Monaco popout, ⇄ file a two-way VS Code link on disk.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    flavor: 'markdown' | 'html'
    storeKeys?: string[]
    title?: string
    linkKey?: string
  }>(),
  { storeKeys: () => [], title: '', linkKey: '' },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const language = computed<'markdown' | 'html'>(() => props.flavor)
const placeholder = computed(() =>
  props.flavor === 'markdown' ? '# Markdown…' : '<p>HTML…</p>',
)
const instanceUid = `content-${Math.random().toString(36).slice(2, 10)}`

const popped = ref(false)
function togglePopout(): void {
  popped.value = !popped.value
}

// ---- on-disk link (VS Code round-trip) ----
let link: ScriptLinkHandle | null = null
const linkPhase = ref<string>('')
const linkName = ref<string>('')
const linkNote = ref<string>('')

function syncLinkView(): void {
  if (!link) return
  linkPhase.value = link.phase.value
  linkName.value = link.fileName.value
}

function applyValue(text: string): void {
  emit('update:modelValue', text)
  link?.push(text)
}

function initLink(): void {
  if (link) return
  link = makeScriptLink(
    props.linkKey,
    (text) => emit('update:modelValue', text),
    (message) => {
      linkNote.value = message
      syncLinkView()
    },
    props.flavor,
  )
  syncLinkView()
  void (async () => {
    await link!.restore()
    if (props.modelValue) link!.push(props.modelValue)
  })()
}

function onLinkClick(): void {
  if (!link) initLink()
  if (!link) return
  void (async () => {
    try {
      await link!.link()
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

function linkTitle(): string {
  const ext = props.flavor === 'html' ? '.html' : '.md'
  return `Link this viewer to a ${ext} file on disk (edit in VS Code, saves sync back)`
}

onMounted(() => {
  initLink()
  setContentStoreKeys(props.storeKeys)
  // the `{{` provider is shared by the popout editor; make sure it is alive
  void getMonaco().then((monaco) => registerToolbackIntellisense(monaco))
})

watch(
  () => props.storeKeys,
  (keys) => setContentStoreKeys(keys),
)

// follow the selected object's field (the panel instance is reused)
watch(
  () => props.linkKey,
  (key, prev) => {
    if (key === prev) return
    link?.dispose()
    link = null
    linkNote.value = ''
    initLink()
  },
)

onBeforeUnmount(() => {
  link?.dispose()
  link = null
})
</script>

<template>
  <div class="tb-content-wrap">
    <div class="tb-content-toolbar">
      <template v-if="linkPhase === 'linked'">
        <span
          class="tb-link-chip"
          title="Click for sync details"
          @click="linkNote = `Linked to ${linkName || 'a file'} — edit + save in VS Code to sync back`"
        >
          <span class="tb-link-name">⇄ {{ linkName || 'linked' }}</span>
          <button
            class="tb-link-x"
            title="Unlink — stop syncing with this file"
            aria-label="Unlink viewer file"
            @click.stop="onUnlink"
          >✕</button>
        </span>
      </template>
      <button v-else class="tb-content-btn" :title="linkTitle()" @click="onLinkClick">⇄ file</button>
      <button class="tb-content-btn" title="Open in a resizable window" @click="togglePopout">⤢</button>
    </div>
    <p v-if="linkNote" class="tb-content-note">{{ linkNote }}</p>
    <DynamicTextEditor
      :model-value="modelValue"
      :store-keys="storeKeys"
      :placeholder="placeholder"
      multiline
      @update:model-value="applyValue"
    />
  </div>

  <EditorWindow
    v-if="popped"
    :title="title || (flavor === 'markdown' ? 'Markdown editor' : 'HTML editor')"
    :skey="`editor-${instanceUid}`"
    @close="popped = false"
  >
    <MonacoContent
      :model-value="modelValue"
      :language="language"
      @update:model-value="applyValue"
    />
  </EditorWindow>
</template>

<style scoped>
.tb-content-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tb-content-toolbar {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.tb-content-btn {
  font: 500 10px/1 system-ui, sans-serif;
  color: var(--ed-text-dim, #8b93a1);
  background: var(--ed-bg, #0f1115);
  border: 1px solid var(--ed-border, #262c37);
  border-radius: 5px;
  padding: 3px 7px;
  cursor: pointer;
}

.tb-content-btn:hover {
  color: #fff;
  border-color: var(--ed-accent, #6366f1);
}

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

.tb-content-note {
  margin: 0;
  font-size: 10.5px;
  color: var(--ed-text-dim, #8b93a1);
  word-break: break-all;
}
</style>
