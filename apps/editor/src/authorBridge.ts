import type { ControlKind, Rect } from '@toolback/format'
import type { useBookStore } from './stores/book'

type Store = ReturnType<typeof useBookStore>

const GRID = 8
function snap(v: number): number {
  return Math.round(v / GRID) * GRID
}
function snapRect(r: Rect): Rect {
  return { x: snap(r.x), y: snap(r.y), w: snap(r.w), h: snap(r.h) }
}

/** wire marker: the runtime materialises this into a live handle */
export function authorRef(o: { id: string; name: string; control: string }): {
  __authorRef: true
  id: string
  name: string
  control: string
} {
  return { __authorRef: true, id: o.id, name: o.name, control: o.control }
}

/** flat snapshot for handle.get(): props + geometry at the active breakpoint */
function objectSnapshot(store: Store, id: string): Record<string, unknown> | null {
  const obj = store.allObjects.find((o) => o.id === id)
  if (!obj) return null
  const r = store.effectiveRectOf(obj.id) ?? obj.rect
  return {
    id: obj.id,
    name: obj.name,
    control: obj.control,
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    ...JSON.parse(JSON.stringify(obj.props)),
  }
}

/**
 * Editor-side executor of the author-mode bridge: plugin scripts call
 * `author.<op>(...args)` in the canvas; the call arrives here against the
 * live book store and the result is posted back. `args` is the positional
 * argument array from the proxy. Ops are capability-scoped to what a plugin
 * plausibly needs — the author scripts are trusted (same as page scripts),
 * so this is convenience scoping, not a security boundary.
 */
export function executeAuthorOp(store: Store, op: string, args: unknown): unknown {
  const pos = Array.isArray(args) ? args : [args]
  const a0 = pos[0] as Record<string, unknown> | undefined
  const a1 = pos[1] as Record<string, unknown> | undefined
  const a = a0 ?? {}
  switch (op) {
    case 'getSelection': {
      return {
        ids: [...store.selectionIds],
        names: store.selectedObjects.map((o) => o.name),
        kinds: store.selectedObjects.map((o) => o.control),
        pageName: store.editing.kind === 'page' ? store.activePage.name : store.activeBackground?.name,
        target: store.editing.kind,
      }
    }
    case 'getSelectionJson':
    case 'selectionJson': {
      // JSON round-trip: Pinia proxies are not structured-cloneable
      return JSON.parse(JSON.stringify(store.selectedObjects))
    }
    case 'getObject': {
      const id = typeof a0 === 'string' ? a0 : (a['id'] as string)
      if (!id) throw new Error('author.getObject: id is required')
      const snap = objectSnapshot(store, id)
      if (!snap) throw new Error(`author.getObject: unknown id "${id}"`)
      return snap
    }
    case 'insertControl': {
      // positional: insertControl(kind, opts?) — or object form: ({kind, ...})
      const opts = (typeof a0 === 'object' && a0 !== null && 'kind' in a0 ? a0 : a1) ?? {}
      const kind = (typeof a0 === 'string' ? a0 : opts['kind']) as ControlKind
      if (!kind) throw new Error('author.insertControl: kind is required')
      const w = typeof opts['w'] === 'number' ? opts['w'] : undefined
      const h = typeof opts['h'] === 'number' ? opts['h'] : undefined
      const x = typeof opts['x'] === 'number' ? Math.round(opts['x']) : 40
      const y = typeof opts['y'] === 'number' ? Math.round(opts['y']) : 40
      const rect = snapRect({ x, y, w: w ?? 176, h: h ?? 48 })
      store.addObject(kind, rect)
      if (opts['props'] && typeof opts['props'] === 'object') {
        const sel = store.selectionIds[0]
        if (sel) store.updateProps(sel, opts['props'] as Record<string, unknown>)
      }
      const made = store.selectedObject
      return made
        ? authorRef({ id: made.id, name: made.name, control: made.control })
        : { id: null, name: null }
    }
    case 'updateProps': {
      // geometry keys are ControlApi-style page-space properties (x, y,
      // width, height) applied at the editor's active breakpoint through the
      // same path the design canvas uses (a group's rect moves its members
      // with it — children are stored relative to the group). Everything
      // else is a props patch.
      const GEOM = ['x', 'y', 'width', 'height'] as const
      const applyOne = (id: string, patch: Record<string, unknown>): void => {
        const geomKeys = GEOM.filter((k) => patch[k] !== undefined)
        const props: Record<string, unknown> = { ...patch }
        for (const k of geomKeys) delete props[k]
        if (geomKeys.length) {
          const obj = store.allObjects.find((o) => o.id === id)
          if (!obj) throw new Error(`author.updateProps: unknown id "${id}"`)
          // deliberate writes release the glued axes they touch
          store.setGeometry(id, {
            ...(patch['x'] !== undefined ? { x: Math.round(Number(patch['x'])) } : {}),
            ...(patch['y'] !== undefined ? { y: Math.round(Number(patch['y'])) } : {}),
            ...(patch['width'] !== undefined ? { w: Math.max(1, Math.round(Number(patch['width']))) } : {}),
            ...(patch['height'] !== undefined ? { h: Math.max(1, Math.round(Number(patch['height']))) } : {}),
          })
        }
        if (Object.keys(props).length) store.updateProps(id, props)
      }
      if (typeof a0 === 'string') {
        const patch = a1
        if (!patch || typeof patch !== 'object') throw new Error('author.updateProps: patch is required')
        applyOne(a0, patch)
        return { id: a0 }
      }
      // no id: patch EVERY selected object (the selection is the default target)
      const patch = a0
      if (!patch || typeof patch !== 'object') throw new Error('author.updateProps: patch is required')
      if (!store.selectionIds.length) throw new Error('author.updateProps: nothing selected')
      for (const id of [...store.selectionIds]) applyOne(id, patch)
      return { ids: [...store.selectionIds] }
    }
    case 'moveObject': {
      // positional: moveObject(id, dx, dy) — one undoable step; a group's
      // rect moves its members with it
      const id = typeof a0 === 'string' ? a0 : (a['id'] as string)
      const dx = typeof pos[1] === 'number' ? (pos[1] as number) : 0
      const dy = typeof pos[2] === 'number' ? (pos[2] as number) : 0
      const obj = store.allObjects.find((o) => o.id === id)
      if (!obj) throw new Error(`author.moveObject: unknown id "${id}"`)
      const r = store.effectiveRectOf(obj.id) ?? obj.rect
      store.setGeometry(id, { x: r.x + dx, y: r.y + dy })
      return { id }
    }
    case 'command': {
      const action = typeof a0 === 'string' ? a0 : (a['action'] as string)
      switch (action) {
        case 'delete':
          store.removeSelected()
          return { ok: true }
        case 'duplicate':
          store.duplicateSelected()
          return { ok: true }
        case 'group': {
          store.groupSelected()
          // the new group becomes the selection — return its handle so the
          // script can keep working with it (move it, patch it, …)
          const g = store.selectedObject
          return g
            ? { ok: true, ...authorRef({ id: g.id, name: g.name, control: g.control }) }
            : { ok: false }
        }
        case 'ungroup':
          store.ungroupSelected()
          return { ok: true, ids: [...store.selectionIds] }
        case 'front':
        case 'back':
        case 'forward':
        case 'backward':
          store.reorderSelection(action)
          return { ok: true }
        default:
          throw new Error(`author.command: unknown action "${action}"`)
      }
    }
    case 'pageInfo': {
      return {
        editing: store.editing.kind,
        pageName: store.editing.kind === 'page' ? store.activePage.name : undefined,
        pageIndex: store.editing.kind === 'page' ? store.currentPageIndex : undefined,
        backgroundName: store.editing.kind === 'background' ? store.activeBackground?.name : undefined,
        pageNames: store.book.pages.map((p) => p.name),
        backgroundNames: store.book.backgrounds.map((b) => b.name),
        pluginPages: store.book.pages.filter((p) => p.author).map((p) => p.name),
        objectCount: store.objectCount,
        canvas: store.activeCanvasSize,
        breakpoint: store.breakpoint,
      }
    }
    case 'message': {
      const text = typeof a0 === 'string' ? a0 : String(a0 ?? '')
      store.flashCanvasNote(text)
      return { ok: true }
    }
    default:
      throw new Error(`author: unknown op "${op}"`)
  }
}
