<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Background } from '@toolback/format'
import { useBookStore } from '../stores/book'
import HelpButton from './HelpButton.vue'

const store = useBookStore()
const renamingBg = ref<string | null>(null)
const renamingPage = ref<number | null>(null)
const buf = ref('')
const renameInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

function startBgRename(bg: Background): void {
  renamingBg.value = bg.id
  buf.value = bg.name
}

function startPageRename(i: number): void {
  renamingPage.value = i
  buf.value = store.book.pages[i]!.name
}

function commitRename(): void {
  if (renamingBg.value !== null) store.renameBackground(renamingBg.value, buf.value)
  if (renamingPage.value !== null) store.renamePage(renamingPage.value, buf.value)
  renamingBg.value = null
  renamingPage.value = null
}

watch([renamingBg, renamingPage], async ([bg, page]) => {
  if (bg !== null || page !== null) {
    await nextTick()
    const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
    el?.focus()
    el?.select()
  }
})

/** pages of a background, as book indices (keeps the page order) */
const groups = computed(() =>
  store.book.backgrounds.map((bg) => ({
    bg,
    pages: store.book.pages
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.backgroundId === bg.id),
  })),
)

/** the background of the page being edited (its group gets the outline) */
const activePageBgId = computed<string | null>(() => {
  if (store.editing.kind !== 'page') return null
  const page = store.activePage
  const known = store.book.backgrounds.some((b) => b.id === page.backgroundId)
  return known ? page.backgroundId : (store.book.backgrounds[0]?.id ?? null)
})

/** label when the background overrides the page size at any breakpoint */
function sizeLabel(bg: Background): string {
  if (!bg.size) return ''
  const parts: string[] = []
  for (const [bp, size] of Object.entries(bg.size)) {
    if (size) parts.push(`${bp[0]}:${size.width}×${size.height}`)
  }
  return parts.join(' ')
}

function editingBg(id: string): boolean {
  return store.editing.kind === 'background' && store.editing.id === id
}

// ---- drag to rearrange pages (within a group, or across backgrounds) ----

type DropTarget =
  | { kind: 'page'; pageIndex: number; before: boolean }
  | { kind: 'bg'; id: string }

const dragFrom = ref<number | null>(null)
const dropTarget = ref<DropTarget | null>(null)

function rowAt(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y)
  const pageEl = el?.closest<HTMLElement>('[data-page-drop]')
  if (pageEl) {
    const rect = pageEl.getBoundingClientRect()
    return {
      kind: 'page',
      pageIndex: Number(pageEl.dataset.pageDrop),
      before: y < rect.top + rect.height / 2,
    }
  }
  const bgEl = el?.closest<HTMLElement>('[data-bg-drop]')
  if (bgEl) return { kind: 'bg', id: bgEl.dataset.bgDrop! }
  return null
}

/** insertion index (pages-array terms) for a computed drop target */
function insertionIndex(target: DropTarget, from: number): { to: number; bgId?: string } {
  if (target.kind === 'bg') {
    const group = groups.value.find((g) => g.bg.id === target.id)!
    if (group.pages.length === 0) {
      // empty group: insert before the next non-empty group's first page
      const gi = groups.value.indexOf(group)
      let nextIdx = store.book.pages.length
      for (let i = gi + 1; i < groups.value.length; i++) {
        const first = groups.value[i]!.pages[0]
        if (first) {
          nextIdx = first.i
          break
        }
      }
      return { to: nextIdx, bgId: target.id }
    }
    const last = group.pages[group.pages.length - 1]!
    return { to: last.i + 1, bgId: target.id }
  }
  const bgId = store.book.pages[target.pageIndex]!.backgroundId
  const to = target.before ? target.pageIndex : target.pageIndex + 1
  return { to, bgId }
}

function onPagePointerDown(e: PointerEvent, pageIndex: number): void {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('button, input')) return
  const startX = e.clientX
  const startY = e.clientY
  let started = false

  const move = (ev: PointerEvent): void => {
    if (!started && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
    started = true
    dragFrom.value = pageIndex
    const target = rowAt(ev.clientX, ev.clientY)
    // don't offer a no-op drop back onto the source position
    dropTarget.value =
      target && target.kind === 'page' && target.pageIndex === pageIndex ? null : target
  }
  const finish = (commit: boolean, ev?: PointerEvent): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    if (commit && ev && started) {
      const target = dropTarget.value ?? rowAt(ev.clientX, ev.clientY)
      if (target && target.kind === 'page' && target.pageIndex !== pageIndex) {
        const { to, bgId } = insertionIndex(target, pageIndex)
        store.reorderPage(pageIndex, to, bgId)
      } else if (target && target.kind === 'bg') {
        const { to, bgId } = insertionIndex(target, pageIndex)
        store.reorderPage(pageIndex, to, bgId)
      }
    }
    dragFrom.value = null
    dropTarget.value = null
  }
  const up = (ev: PointerEvent): void => finish(true, ev)
  const cancel = (): void => finish(false)

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
}

function dropClass(entry: { i: number }): Record<string, boolean> {
  const t = dropTarget.value
  if (!t || t.kind !== 'page' || t.pageIndex !== entry.i) return {}
  return { 'drop-before': t.before, 'drop-after': !t.before }
}

function bgDropClass(id: string): Record<string, boolean> {
  const t = dropTarget.value
  return t && t.kind === 'bg' && t.id === id ? { 'drop-into': true } : {}
}
</script>

<template>
  <div class="row">
    <h2>Backgrounds</h2>
    <HelpButton anchor="backgrounds" />
  </div>
  <ul class="bgs" :class="{ dragging: dragFrom !== null }">
    <li
      v-for="g in groups"
      :key="g.bg.id"
      class="bg"
      :class="{
        active: editingBg(g.bg.id),
        'has-page': g.bg.id === activePageBgId && !editingBg(g.bg.id),
        ...bgDropClass(g.bg.id),
      }"
      :data-bg-drop="g.bg.id"
      title="Double-click to edit background objects"
      @dblclick="store.editBackground(g.bg.id)"
    >
      <template v-if="renamingBg === g.bg.id">
        <input
          ref="renameInput"
          v-model="buf"
          class="rename"
          @keydown.enter.prevent="commitRename"
          @keydown.esc="renamingBg = null"
          @blur="commitRename"
          @click.stop
          @dblclick.stop
        />
      </template>
      <template v-else>
        <span class="bg-head">
          <span class="bg-title">
            <span class="chip" :style="{ background: g.bg.color }"></span>
            <span class="bg-name">{{ g.bg.name }}</span>
          </span>
          <span class="page-actions">
            <button title="Edit this background's own objects (or double-click the row)" @click.stop="store.editBackground(g.bg.id)" @dblclick.stop>👁</button>
            <button title="Rename background" @click.stop="startBgRename(g.bg)" @dblclick.stop>✎</button>
            <button title="Background properties (name, colour, page size, delete)" @click.stop="store.backgroundDialogId = g.bg.id" @dblclick.stop>⚙</button>
            <button title="Duplicate background" @click.stop="store.duplicateBackground(g.bg.id)" @dblclick.stop>⧉</button>
          </span>
        </span>
        <span class="bg-size">page size · {{ sizeLabel(g.bg) || 'book default' }}</span>
      </template>
      <ul class="pages">
        <li
          v-for="entry in g.pages"
          :key="entry.p.id"
          :class="[
            {
              active: store.editing.kind === 'page' && entry.i === store.currentPageIndex,
              dragging: dragFrom === entry.i,
            },
            dropClass(entry),
          ]"
          :data-page-drop="entry.i"
          title="Select to edit this page · ✎ rename · ⧉ duplicate · ✕ delete"
          @click.stop="store.selectPage(entry.i)"
          @dblclick.stop
          @pointerdown="onPagePointerDown($event, entry.i)"
        >
          <template v-if="renamingPage === entry.i">
            <input
              ref="renameInput"
              v-model="buf"
              class="rename"
              @keydown.enter.prevent="commitRename"
              @keydown.esc="renamingPage = null"
              @blur="commitRename"
              @click.stop
              @dblclick.stop
            />
          </template>
          <template v-else>
            <span class="page-name">{{ entry.p.name }}</span>
            <span class="page-actions">
              <button title="Rename page" @click.stop="startPageRename(entry.i)" @dblclick.stop>✎</button>
              <button title="Duplicate page" @click.stop="store.duplicatePage(entry.i)">⧉</button>
              <button
                v-if="store.book.pages.length > 1"
                title="Delete page"
                @click.stop="store.removePage(entry.i)"
              >✕</button>
            </span>
          </template>
        </li>
      </ul>
    </li>
  </ul>
  <button class="add" @click="store.addBackground()">+ Add background</button>
  <button class="add" @click="store.addPage()">+ Add page</button>
</template>

<style scoped>
.bgs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bgs.dragging {
  cursor: grabbing;
  user-select: none;
}

.bg {
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  background: var(--ed-bg);
  padding: 4px 6px 6px;
  cursor: pointer;
}

/* the background of the page being edited gets the outline */
.bg.has-page {
  border-color: var(--ed-accent);
}

/* the background being edited is stronger: outline + inset ring (no tint) */
.bg.active {
  border-color: var(--ed-accent);
  box-shadow: inset 0 0 0 1px var(--ed-accent);
}

.bg.drop-into {
  border-color: var(--ed-accent);
  box-shadow: inset 0 0 0 2px var(--ed-accent);
}

.bg-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 4px 2px 2px;
  min-width: 0;
}

.bg-title {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.bg-head .page-actions {
  display: flex;
  gap: 2px;
  padding-left: 19px;
}

.chip {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  flex: none;
}

.bg-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bg-size {
  display: block;
  padding: 0 2px 4px 21px;
  font-size: 10px;
  color: var(--ed-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pages {
  list-style: none;
  margin: 2px 0 0;
  padding: 0 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pages li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: grab;
}

.pages li.active {
  border-color: var(--ed-accent);
  background: rgba(99, 102, 241, 0.08);
}

.pages li.dragging {
  opacity: 0.35;
}

.pages li.drop-before {
  border-top-color: var(--ed-accent);
  box-shadow: 0 -2px 0 0 var(--ed-accent);
}

.pages li.drop-after {
  border-bottom-color: var(--ed-accent);
  box-shadow: 0 2px 0 0 var(--ed-accent);
}

.page-name {
  font-size: 12.5px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-actions {
  display: flex;
  gap: 2px;
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

.add {
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

.add:hover {
  color: #fff;
  border-color: var(--ed-accent);
}
</style>
