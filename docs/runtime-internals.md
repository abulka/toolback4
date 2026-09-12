# toolback v4 — runtime & editor internals

The deep architectural reference: how scripts are compiled and dispatched, how
the editor and canvas talk, and the invariants that hold the system together.
The [scripting guide](./scripting-guide.md) documents what authors *use*; this
document explains how it *works*. When you change the runtime, update both.

---

## 1. Architecture map

```
toolback4/
├── packages/
│   ├── format/    # zod schemas, factories, geometry/tree helpers (no runtime deps beyond zod)
│   ├── controls/  # DOM renderers per control + design tokens
│   └── runtime/   # player (scripts/store), design controller (canvas editing), editorLink (protocol)
└── apps/
    └── editor/    # Vue 3 + Pinia + Monaco; the single source of truth for the book
```

Dependency direction: `format ← controls ← runtime ← editor`. The editor never
imports controls directly; it renders everything through the runtime inside a
**same-origin sandbox iframe** (`canvas.html`), so broken user scripts can
never take the editor down and design/run mode share one iframe (ToolBook's
F3 pattern).

Everything the user authors — objects, geometry, scripts — lives in one plain
JSON document (`Book`). The editor owns it; the canvas is a renderer.

## 2. Data model (`packages/format`)

```ts
Book    { id, title, canvas: { desktop: {w,h}, tablet?, mobile? }, store?: [key,value][], pages: Page[] }
Page    { id, name, script, background, objects: PageObject[] }
PageObject {
  id, name,                       // name = unique per page; the `controls[name]` handle
  control: 'button'|'label'|'input'|'image'|'card'|'container'|'switch'|'group',
  rects: { desktop: Rect, tablet?: Rect, mobile?: Rect },
  props: Record<string, unknown>, // control-specific, e.g. { text }
  on: Record<string, string>,     // eventName -> script source
  children?: PageObject[],        // groups only; members' rects are parent-relative
}
```

- Zod schemas with `.default()`s; `parseBook` normalizes on load. Factories
  (`createObject`, `createGroup`, `createPage`, `createBook`) return parsed
  plain objects, safe to JSON round-trip.
- `rects[bp] ?? rects.desktop` is the universal fallback: a breakpoint without
  its own rect inherits desktop.
- Groups are **parent objects**: a member's rect is relative to its group; a
  group's rect is the tight union of its members (see §5.3).
- Style props: `color` (colour names via `resolveColor` — a curated map plus
  any CSS colour string — or raw CSS) and `fontFamily` (one of the five
  simplified stacks in `FONT_STACKS`) are applied at render
  (`applyStyleProps`) and are also live accessors on `ControlApi`
  (`color`/`fontFamily` getters/setters that write the prop AND the inline
  style, surface vs text depending on the control). Switches apply
  fontFamily/size to their text span and `color` to the toggle track
  (`--tb-switch-on`).
- Pinia reactive proxies are **not structured-cloneable** — the book always
  crosses the iframe boundary as `JSON.parse(JSON.stringify(book))`.

## 3. The player (`packages/runtime/src/player.ts`)

### 3.1 Run loop & navigation

`runBook(book, root, breakpoint, onError, startPageIndex)` builds a `RunState`
and calls `runPage`. One global `active` handle — a second `runBook` replaces
the first (`stopRun` unwinds everything). `runPage`:

1. `navLock` guards re-entrancy (`page.go` inside `pageEnter` etc.).
2. Fires `pageLeave` (async-safe: `Promise.resolve(leave()).catch`), then
   tears down **all** listeners and store subscriptions.
3. Re-renders the page DOM wholesale (`renderBookPage`), rebuilds
   `st.controls` (one `ControlApi` per object, keyed by name).
4. Compiles the page script → `st.pageFns` (§3.3), wires event dispatchers
   (§3.4), wires dynamic labels (§3.5), clears the lock, fires `pageEnter`.

`page.go(name)` finds the page by name (unknown names report an error and stay
put) and re-enters `runPage`. The store survives navigation; scripts do not.

### 3.2 The store

`createStore(initial?)`: a `Map` (optionally pre-seeded) plus a subscriber set.
`set` writes and **notifies every subscriber synchronously** — that is what
re-renders `{{key}}` labels and drives the editor's store browser. No per-key
granularity; snapshots are insertion-ordered entries.

**The design-time store.** `Book.store` is an ordered array of `[key, value]`
pairs (zod default `[]`; JSON data only — the book crosses the iframe as a JSON
clone). `runBook` seeds its store with `book.store`, so **every run starts from
the book's stored values** (`runBook` reads the book it already receives — no
caller changes; published exports inherit the same seed via `player-entry.ts`).
Run mutations never write back into the book; the editor's Store tab offers an
explicit per-row "copy to design" for deliberately freezing a computed value.
Author-mode (`author.ts`) sessions seed from `book.store` the same way.

### 3.3 Script compilation — one factory per script

User scripts are compiled with `new Function` inside the iframe (no CSP-safe
alternatives are needed for a local tool). Two factory shapes:

**Page script** — one factory, executed **once** per page entry; its body
declares the page's shared functions, which are harvested and returned:

```
new Function('api', 'self',
  `"use strict";
   const { page, controls, store } = api;
   const { <bareNames> } = controls;      // omitted when empty
   <user page script>
   ;return { fnName: typeof fnName === 'function' ? fnName : undefined, ... }`)
factory(api, pageApi)   // self = the page API (self.name = the page name)
```

- `extractFunctionNames` regex-scans top-level `function name(` /
  `async function name(` declarations; the returned functions become
  `st.pageFns`, callable **directly** from object scripts (`bump(3)`) — the
  ToolBook "shared script" pattern.
- `pageEnter`/`pageLeave` are just page functions recognized by name; they get
  **no parameters** (no `event`/`target`/`self`), invoked async-safe.

**Object event scripts** — one factory per (object, event), compiled once per
page render, invoked per dispatch:

```
new Function('api', ...params,
  `"use strict";
   const { page, controls, store } = api;
   return (async () => {
     const { <bareNames> } = controls;    // inside the IIFE
     <user event script>
   })()`)
```

- `params = [...new Set([...pageFnNames, 'event', 'target', 'self', 'forward'])]`.
- The async IIFE wrapper is why `await` works anywhere in a script; the
  returned promise's rejections are routed to `onError` labelled
  `` `${owner}.${event}: …` `` and shown in the editor status bar.
- `"use strict"` — bare-word typos throw `ReferenceError` (reported in the
  status bar) instead of silently writing globals.
- **Reserved slots win**: a page function named `event`, `target`, `self`, or
  `forward` is shadowed by the runtime binding at that position (the param
  list dedupes; the dispatcher matches reserved names first). Bare object
  names are excluded from the destructure when they collide with page function
  names, so the page function wins for those — the single rule: *runtime
  reserved words > page functions > bare object names*.
- **`this`**: each invocation is `factory.call(selfValue, ...args)`. Strict
  mode preserves it, and the body's async IIFE is an arrow, so `this` inside
  the script (and inside arrow functions it spawns) is the script owner —
  `this === self`.

### 3.4 Event dispatch — the ToolBook forward chain

Scripts do **not** rely on DOM bubbling. Each page render builds:

- a `parentOf` map (owner chains from the object tree),
- a `compiled` registry: `owner name → event → invoke(e, self, forward)`.

For every **non-group** element (group wrappers are `pointer-events: none` —
events always originate on members), the union of event names across its whole
owner chain is attached as **one dispatcher per event type**:

```
dispatch(e):
  i = 0
  forward = () => {                 // step one level up the chain
    while (i < chain.length && !compiled[chain[i]]?.has(event)) i++
    if (i < chain.length) compiled[chain[i++]].invoke(e, selfOfOwner, forward)
  }
  forward()                         // run the first owner with a handler
```

Semantics (ToolBook-faithful):

1. The **innermost owner with a handler** for the event runs first.
2. It **stops** unless it calls `forward()` — so a member can handle-and-stop
   (override) or continue.
3. An owner **without** a handler for the event auto-continues to its parent —
   a group script fires even when the clicked member has no script.
4. `forward()` is a closure over the dispatch's chain cursor: callable after
   `await`, and each call steps exactly one handler up (the chain is walked
   monotonically — no loops).
5. `self` = the owner whose handler is running (in a group script: the group
   itself); `target` = the member that received the event (resolved from
   `e.target` up to the nearest `[data-tb-name]` with a live ControlApi).
6. Because dispatch is an explicit chain walk, **non-bubbling events**
   (`mouseenter`, `mouseleave`, …) reach group handlers the same way bubbling
   ones do.
7. `control.on(event, fn)` (the API method) attaches a *direct* listener on the
   object's element — outside the chain, no forward.

`pageLeave`/`stop()` remove every dispatcher and store subscription.

### 3.5 Dynamic labels `{{…}}`

`wireDynamicText` collects every object whose `props.text` contains `{{`
(buttons and labels — the only text-bearing controls), and rewrites
`textContent` live:

- Regex: `/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g` — bare store keys **and**
  one-level dotted paths.
- `{{key}}` → `store.get(key) ?? ''` (unset keys render empty).
- `{{self.name}}` / `{{this.name}}` → the object's own name. This is how a
  duplicated button displays its own fresh name automatically. Any other
  dotted member (`{{self.nme}}`) renders empty, like an unset key.
- Substitution runs once at render and again on **every** `store.set` (the
  store subscription is torn down with the listeners).
- **Design mode** calls the same one-shot renderer (`renderDynamicText`,
  exported) against a throwaway store seeded from `book.store` on every design
  `load` — so the canvas shows the design-time values, not the literal
  template, and unset keys still render empty exactly as at run time. Templates
  re-resolve on every design sync (each sync re-renders the page).

## 4. The design controller (`packages/runtime/src/design.ts`)

Owns in-canvas editing: selection, drill-in, drag, resize, marquee. It works
on a `rects` map (page-absolute, refreshed from the DOM after every render)
and communicates with the editor only through messages (`toolback:selection`,
`toolback:commit`).

- **Hit-testing**: `chainAt(x, y)` — the deepest `[data-tb-id]` whose rect
  contains the point (topmost-paint wins on overlap), then the ancestor walk
  gives the full chain `[outerGroup, …, innerGroup, object]`.
- **Drill path** (`drillPath: string[]`): the ancestors of the selected
  object. The "current level" is `chain[drillPath.length]`. Gentle clicks
  select at the current level and never descend; double-click descends exactly
  one level past the selection; alt-click jumps to the deepest object;
  `Escape` pops one level (selecting the group you were in) and is **ignored
  at the outermost level** — it never deselects.
- **Drag**: one batched `toolback:commit {kind:'move', objects:[{id, rect}]}` per
  gesture, rects in **page-absolute** coordinates. The store rebases each into
  its parent-relative slot (`absOriginOf` sums the ancestor origins) and
  re-snaps group boxes to the tight union of their members.
- **Group resize**: live preview via a CSS `transform` scale from the fixed
  corner (the layout box is untouched mid-drag); the commit sends the group
  rect plus every descendant scaled around the same fixed corner — preview
  and commit agree for every handle.

## 5. Group invariants (`apps/editor/src/stores/book.ts`)

1. **Tight union**: after any member move/resize/delete, `expandGroup` recomputes
   the group's rect as the exact union of its members; if the union's origin
   moves, **all** members shift by the origin delta so nothing jumps on
   screen. Recurses through nested groups (grandparent unions recompute with
   absolute origins, not local ones).
2. **Same-parent rule**: grouping requires all selected objects to share a
   parent. Ungrouping splices children back at the group's index with their
   rects unrebased per breakpoint; ungrouping a scripted group asks first
   (the script is lost).
3. **Duplication** (`duplicateSelected`): deep-clone with fresh ids and fresh
   names from a shared used-names set (nested group levels never collide),
   inserted after each original and nudged +24px down-right; group subtrees
   copy whole; undoable in one step.

## 6. Editor ↔ canvas protocol (`packages/runtime/src/editorLink.ts`)

All messages are `type: 'toolback:*'` posted between the editor window and the
iframe.

| Editor → canvas | payload | meaning |
|---|---|---|
| `toolback:load` | book, breakpoint, pageIndex, design, selection | full re-render (the only sync; idempotent) |
| `toolback:dragOver` / `dragEnd` | control, rect | palette ghost preview |
| `toolback:authorStart` | book, pageIndex, breakpoint | run a plugin page in author mode (M6c) |
| `toolback:authorStop` | — | stop the running plugin |
| `toolback:authorReply` | id, ok, result / error | resolves one pending bridge call |

| Canvas → editor | payload | meaning |
|---|---|---|
| `toolback:ready` | — | iframe booted; editor answers with `load` |
| `toolback:rects` | rects map | layout measured (design hit-testing) |
| `toolback:selection` | ids | canvas selection changed (multi-select, drill) |
| `toolback:commit` | kind move/resize, objects | a drag/resize finished (undoable edit) |
| `toolback:scriptError` / `toolback:error` | message | status bar |
| `toolback:runToggle` | — | F3/⌥3 pressed inside the canvas |
| `toolback:store` | entries | run-mode store browser stream — cloneable values raw, functions as `{__tbLabel}` sentinels |
| `toolback:popups` | open names | run-mode popup stack changed |
| `toolback:authorCall` | id, op, args | plugin script called `author.<op>` (async bridge) |
| `toolback:authorState` | active, pageName | plugin started/stopped (✕ in the box) |
| `toolback:reorder` / `deleteSelection` / `undo` / `redo` / `duplicate` / `group` / `ungroup` | — | canvas-focused shortcuts forwarded |

Keyboard routing: canvas-side keydowns never reach the editor window, so
every editor-wide shortcut exists twice — in the editor (`App.vue` capture
phase, skipped in editable targets so Monaco keeps its own ⌘Z) and inside the
canvas (`listenForEditor` forwards as messages). The design controller claims
keyboard focus on pointer-down (`window.focus()`) because `preventDefault`
otherwise leaves the iframe focusless and canvas-side keys silently die.

## 7. Editor store (`apps/editor/src/stores/book.ts`)

Single Pinia store; **all** content mutations live here and end in `sync()`,
which (a) posts the full book to the canvas and (b) schedules the debounced
IndexedDB autosave. Components never touch `book` directly.

- **Undo/redo**: whole-book snapshots (book + selection + page index) pushed
  *before* each mutation via `record(label, coalesceKey?)`. Continuous edits
  coalesce by key within 800 ms (one step per typing burst / drag); redo
  clears on new edits; stacks capped at 100; nothing records while running;
  `newBook`/`hydrate`/autosave-restore reset history. `redo()` pushes the
  *pre-redo* state so undo-after-redo steps back instead of bouncing.
- **Run mode** (`isRunning`): the same iframe re-rendered by `runBook`; edits
  made during a run mutate the book but are not recorded in history.
- **Design-time store** (`setDesignStore`): replaces `book.store` (ordered
  `[key, value]` pairs) through the normal `record → sync` path, so Store-tab
  edits are undoable/redoable like any book edit (coalesced under
  `designstore`); still applied while running (record no-ops, matching every
  run-mode edit), which is how the ⇓ "copy to design" action works.

## 8. IntelliSense generation (`apps/editor/src/monacoApiLib.ts`)

The Monaco TS extra-lib is generated from the **same** runtime helper
(`shortNamesFor`) the player uses for bare-name binding — completions exactly
match what will resolve at runtime:

- `declare const controls: { <name>: TBControl … }` for every object on the
  page (members included), one `declare const <bareName>: TBControl` each for
  the surviving bare names (page-fn collisions and reserved words excluded).
- `self` is **not** declared in the TS lib — `lib.dom` already declares the
  global `self` (Window.self) and a duplicate would raise identifier errors.
  It is offered through the curated completion lists instead (top-level +
  `self.`/`this.` member lists), and works at runtime regardless.
- Worker completions are disabled; one curated provider supplies everything
  (Monaco silently discards suggestions whose range covers non-word
  characters — ranges are caret-anchored with `additionalTextEdits`).

## 9. Persistence & publish

- Autosave: debounced 800 ms after every `sync()`, into IndexedDB (`kv` store).
- `.toolbook.json` via File System Access API with download/input fallbacks.
- Publish: `player-entry.ts` self-plays an embedded, `<`-escaped book;
  esbuild bundles it to `public/toolback-player.js`; `buildStandaloneHtml`
  wraps runtime + book into one HTML file.
- Libraries: user scripts write plain `import('name')`; every compile site
  (`player.ts` background/page/object-event factories, `author.ts`) rewrites
  bare specifiers to the injected `__tbImport` param (see `runtime/src/libs.ts`,
  `rewriteLibImports`). The resolver consults `window.__TOOLBACK_LIBS__`
  (`{specifier: url}`) — exports embed shelf libraries as base64 `data:` URLs,
  previews set the map from `public/libs/importmap.json` (the shelf manifest
  built by `scripts/build-libs.mjs`) — and falls back to `https://esm.sh/<spec>`
  for anything else, then normalizes CJS interop (`{default: exports}` unwrap).
  `scanLibImports` (same regex as the rewrite) finds bare specifiers at publish
  time; `libUrlMapFor` maps shelf hits to data: URLs and emits
  `<script>window.__TOOLBACK_LIBS__=…</script>` between the book JSON and the
  player. No import map, no modulepreload — imports run through the same
  `new Function` bodies as every other script. Base64 payloads cannot contain
  `<`, so the `</script>` breakout escaping never applies to library code.

## 10. Invariants to preserve when extending

1. The book crosses the iframe as a **plain JSON clone** (no proxies).
2. Every content mutation goes through the store and ends in `sync()`.
3. New script variables must be added to: the runtime param list + dispatch
   args, `NAME_RESERVED` (both bare-name sources), and the curated completions
   (not the TS lib if the name collides with a DOM global).
4. Group handlers must be reached through the **owner-chain dispatch**, never
   by attaching listeners to group wrappers (double-fire risk).
5. `{{…}}` template grammar and `collectStoreKeys` must stay in sync about
   what is a store key vs a self-binding; `collectStoreKeys` also harvests
   keys from `book.store` so design-time keys surface in the `{{` picker.
6. The examples test (`examples/examples.test.ts`) runs every page of every
   example book and fails on any script error — new runtime features should be
   exercised by an example.
7. Library imports: `rewriteLibImports` and `scanLibImports` must stay in sync
   (same bare-specifier regex); `__tbImport` is a reserved name
   (`NAME_RESERVED` + the author-mode lists) and must stay in every compile
   site's param list; `window.__TOOLBACK_LIBS__` must be set before user
   scripts compile — exports embed it as a script tag before the player, the
   canvas sets it at boot from `public/libs/importmap.json`; shelf output must
   always be ESM — `build-libs.mjs` emits `/libs/<name>.js` and both publish
   and preview consume that layout.
