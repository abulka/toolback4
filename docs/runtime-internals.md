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
│   ├── controls/  # DOM renderers per control + content registry + design tokens (bundles `marked`)
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
Book    { id, title, canvas: { desktop: {w,h}, tablet?, mobile? },
          backgrounds: Background[], pages: Page[],
          startPageId?, store?: [key,value][] }
Background {
  id, name, color, script,        // script = shared fns + backgroundEnter() hook
  size?: { desktop?, tablet?, mobile? },
  objects: PageObject[],
}
Page    { id, name, script, backgroundId, author?, objects: PageObject[] }
PageObject {
  id, name,                       // name = unique per page/background; the `controls[name]` handle
  control: 'button'|'label'|'input'|'image'|'card'|'container'|'switch'|'group',
  rect: Rect,                     // the ONE authored layout; `fit` adapts it per page size
  props: Record<string, unknown>, // control-specific, e.g. { text }
  on: Record<string, string>,     // eventName -> script source
  children?: PageObject[],        // groups only; members' rects are parent-relative
  fit?: { x?: FitHMode; y?: FitVMode },  // responsive glue (see §4.1)
}
```

- Zod schemas with `.default()`s; `parseBook` normalizes on load. Factories
  (`createObject`, `createGroup`, `createPage`, `createBook`) return parsed
  plain objects, safe to JSON round-trip.
- **Start page.** `book.startPageId` names the page a run opens on. It is
  optional/dangling-safe: `resolveStartPageIndex(book)` returns the matching
  index or `0`. The published entry (`player-entry.ts`) passes it to `runBook`,
  and the editor opens it on load/refresh; it is not a per-run override.
- Every object has **one authored layout** (`rect`) plus an optional `fit`
  (see §4.1); there are no per-breakpoint rects.
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

`startPageIndex` defaults to `0`; the published player passes
`resolveStartPageIndex(book)` (the book's `startPageId`), while the editor's
Run previews the page being edited (`editorLink.ts`) rather than the start page.

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

`wireDynamicText` resolves `{{…}}` for every object with a **content prop** —
`CONTENT_PROPS`/`contentKeyFor` in `@toolback/controls` map a control kind to
the prop that carries its templatable content (`button`/`label`/`card`/`switch`
→ `text`, `markdown` → `text`, `html` → `html`; inputs have none). The
resolved source is fed through `applyContent(el, kind, source)`, which is the
single place DOM content is written:

- Regex: `/\{\{\s*([\w$]+(?:\.[\w$]+)*)\s*\}\}/g` — bare store keys **and**
  one-level dotted paths.
- `{{key}}` → `store.get(key) ?? ''` (unset keys render empty).
- `{{self.name}}` / `{{this.name}}` → the object's own name. This is how a
  duplicated button displays its own fresh name automatically. Any other
  dotted member (`{{self.nme}}`) renders empty, like an unset key.
- **Substitution runs on the source, before rendering.** Plain kinds get
  `textContent`; `card` targets `.tb-card-body` and `switch` targets
  `.tb-switch-text` (never the root, which would wipe the title / checkbox +
  track); `markdown` re-parses the substituted source with `marked` and `html`
  sets `innerHTML` (empty sources → a placeholder). This is why a store change
  re-parses a viewer instead of replacing its rendered DOM with plain text.
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
- **Viewer wheel forwarding**: design mode gives page content
  `pointer-events: none` (so the overlay can select), which would also stop a
  markdown/HTML viewer from scrolling natively. The overlay's `wheel` handler
  hit-tests the point (`chainAt`), finds the object's `.tb-markdown`/`.tb-html`,
  and adds the delta to its `scrollTop`/`scrollLeft` (only when it actually
  overflows). At run time the viewer scrolls natively — `overflow: auto` in
  `styles.ts`.
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
- **Aspect lock (Shift-drag)**: holding Shift on a **corner** handle resizes
  with the object's start aspect ratio held (`resizeRectAspect`,
  `packages/runtime/src/design.ts`) — the driver axis is whichever the pointer
  moved further along, and the fixed-opposite-corner math is preserved.
  Single-axis edge handles resize normally. No schema field: the lock is a
  gesture, captured at drag start.
- **Clip indicators**: after every render (and live during drags) the
  controller lays a dashed red `.tb-clip` box over any object that sticks out
  of the page. The controller's `rects` map is always the source of truth for
  these — it reads rendered DOM positions, so fit-aware rendering is
  automatically reflected.
- **Glue springs**: the `.tb-fithint` overlay draws a spring from every
  *constrained* object (fit with a non-Free axis) to the page edge(s) it's
  glued to. **Shape encodes the anchor**: an **edge** anchor
  (left/top/right/bottom, and both sides) is a zigzag with a square anchor and
  an arrowhead at the object pointing back at it; **center** is a plain straight
  connector with circle anchors and the page centerline. **Line style encodes the
  margin behaviour**: `fixed` is solid, `scaled` is dashed. Edges are slate,
  center is pale grey, and every spring is drawn over a translucent white halo so
  it reads on dark pages. Drawn for all objects —
  background objects included (`bgRects` fallback) — whenever the `≋`
  All/Sel/Off control says so (the load message carries `fitHints` as a
  `FitHintMode`), with a hover legend in the toolbar. `'selected'` draws only
  the current selection; `'off'` draws nothing. Free renders nothing. The hint
  is the page's first child, so it paints above the page background but
  **under** the controls; page-edge anchor glyphs are nudged just inside the
  page so clipping doesn't cut them. Pure decoration — `pointer-events: none`,
  rebuilt on render and drag redraws. Reads `data-tb-fit-x/y` the renderer
  stamps on each wrapper.
- **Drags re-anchor the shared layout**: canvas drags run the dragged rect
  through `unlensObjectRect` and write the object's one `rect` — glued axes
  re-anchor, free axes take the value. Center is rigid (the canvas clamps its
  axis). No constraint ever "fights back" and there is nothing to release.

### 4.1 Responsive glue (`fit`) — the lens model

`PageObject.fit` (`x`, `y`) is a **non-destructive render lens** resolved at
render/read time only by `resolveObjectRect` (`packages/format`): constrained
axes derive from the one authored `rect` (left/top scale position, right/bottom
scale the edge gap, center centers the middle, stretch scales position+size,
**pin-right/pin-bottom** keep the far-edge gap a constant px, **fill** keeps
both margins constant while the size grows), free axes keep the authored
coordinate. Internally this is `fit`; the author-facing surface is the
**Responsive** section of the properties panel
(`apps/editor/src/components/PropertiesPanel.vue`), described as "glue" or
"springs" in the guide. The panel presents each axis as an **anchor** — Free ·
Left/Top · Center · Right/Bottom · **Both sides** — plus a **Fixed** toggle for
Right/Bottom/Both; `apps/editor/src/fitModes.ts` is the single mapping between
that pair and the tokens (Both + Fixed = `fill`, Both + scaled = `stretch`,
Right + Fixed = `pin-right`, …), so the internal names never surface. **The lens
applies at every size, including the reference size** (there the page size
equals the base, so
Free/Left/Right/Top/Bottom/Pin/Stretch/Fill are identity and only Center moves)
— this is what makes setting Center visibly center the object without writing
anything; switching back to Free restores the authored layout exactly.
Invariant: **fit never writes rects.** Deliberate geometry writes (panel
fields, scripts, author bridge) fold through `unlensObjectRect` back onto the
base rect; a typed position on a centered axis releases that axis. Canvas drags
go through `applyRects`, which re-anchors top-level objects and rebases members
to their group's rendered box.

A missing `fit` resolves to **free** (the model default: the authored
coordinate applies everywhere). The editor, however, seeds each newly-placed
control — and each newly-created top-level group — with `{ x: 'left', y: 'top' }`
so a fresh object adapts sensibly when the page resizes; only objects with no
`fit` (e.g. legacy books) fall back to free.

Known limitations: a Center axis is rigid (its position is fully determined, so
the canvas clamps that axis and it must be changed from the dropdown); a
top-level group carries the glue and resizing it scales its members onto the new
box, while members and nested groups have **no independent fit** (they are
relative to the group box and ride/scale with it).

### 4.2 Auto-height "web page" pages

A background can turn on **Height fits content** (a single
`Background.autoHeight: boolean`, applying to every breakpoint; the
properties-dialog checkbox). `resolvePageSize(book, bg, bp, objects?)` then
derives the height from content — the bottom of the lowest top-level object
(fit-aware, groups measured by their box), plus a 24px gap once that passes the
minimum, floored at the authored height for that breakpoint
(`contentHeightFor`, `packages/format`) — while the width stays fixed. The
legacy per-breakpoint object form is collapsed to a boolean by
`migrateBackgrounds`.

Invariant: **auto-height changes the page box, never the fit lens.** The lens is
resolved with the *base* sizes (the number in the size dialog), so vertical glue
(Bottom/Center/Both sides) is measured against the base and can never depend on the
grown height — otherwise bottom-glue would feed its own height back in. So
`renderPage` takes the base `canvasSize` (the lens) plus an optional `boxHeight`
(the CSS height); `renderBookPage`/`renderBackgroundView` compute the box from
their object list but keep the lens on the base, and `runPage`'s ControlApi
`apiSize` / `author.ts` reads also stay base. Only layout at render/navigation
time drives growth; a script moving an object mid-run does not re-measure.

## 5. Group invariants (`apps/editor/src/stores/book.ts`)

1. **Tight union**: after any member move/resize/delete, `expandGroup` shifts
   members so their union starts at the group's local origin and sets the
   group's base rect to the union size (breakpoint-independent — members are
   relative, one base layout covers every size). Member absolute positions are
   preserved; recurses up for nested groups.
2. **Same-parent rule**: grouping requires all selected objects to share a
   parent. Ungrouping splices children back at the group's index with their
   rects made absolute against the group's rendered box at the current
   breakpoint (so it never jumps on screen); ungrouping a scripted group asks
   first (the script is lost).
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
- **Align / distribute / match** (`alignSelection`, `distributeSelection`,
  `matchSizeSelection`, `centerSelectionOnPage`): five pure helpers in
  `@toolback/format` (`alignRects`, `centerBlockRects`, `distributeRects`,
  `matchSizeRects`) applied to the selection's **rendered** page-absolute rects
  (`renderedPageRectOf` mirrors `renderObjectInto`, including a stretched/filled
  top-level group's member scale), then written back through
  `writeRenderedRects`: top-level objects fold through `unlensObjectRect` (glue
  preserved, centered axes released), members rebase into the group's local
  base frame after un-scaling. All four are one `record` step each and no-op on
  a mixed-parent selection. `fillObjectWidth`/`fillObjectHeight`/
  `centerObjectInPage` are the single-object companions to `fillObjectToPage`.

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
- Diagnostics run with explicit compiler options on `javascriptDefaults`:
  `module: ESNext` + `moduleResolution: node` make `await import('pkg')` legal
  (no TS1323) and bare specifiers resolve like a bundler. The unresolved-module
  diagnostics TS2307/TS2792 and the in-memory-URL noise TS80001 are ignored —
  library imports (shelf / esm.sh) legitimately have no installed types.
- The completion **context** is per editor instance, keyed by the editor's
  model URI (`updateApiLib` registers `EditorIntellisenseContext` per URI, and
  the provider looks it up from the model being completed). Page, background
  and object script editors therefore never share stale state, even though
  they may be mounted at the same time.
- User-defined functions from the page and its background scripts are offered
  as top-level completions (`ctx.functionNames`): the same `extractFunctionNames`
  that harvests them at runtime. A page's own helpers and its background's
  shared functions are both callable from any object script, so they all appear.
- Popout: a script editor's ⤢ button renders the same content in a
  draggable/resizable window (`EditorWindow.vue`). The popout **shares the
  parent editor's Monaco `model`** (`sharedModel` prop) rather than creating a
  second one — critical for diagnostics: two models with the same function
  definitions would otherwise produce phantom TS2393 "Duplicate function
  implementation" squiggles. The shared model keeps one diagnosis for both
  views, and the embedded editor neither registers a lib nor disposes the
  model (the owner does). Window z-order uses a module-level counter (a
  `<script setup>` top-level `let` would be per-instance and never stack).
  **Markdown/HTML viewer fields reuse the same shell** (`ContentEditor.vue`):
  ⤢ opens a plain `MonacoContent.vue` (markdown/html highlighting, no toolback
  lib) in an `EditorWindow`, and the inline field stays the `{{`-aware
  textarea. The two bind to the same `modelValue` and sync live, so no shared
  Monaco model is involved.
- `{{` completion in the viewer popout: `monacoApi.ts` registers one
  completion provider for the `markdown` and `html` languages (independent of
  the `javascript` provider's registration flag), reading a shared book-wide
  key list set by `ContentEditor` (`setContentStoreKeys`). It inserts
  `key}}` (or just `key` when the closing braces are already typed).
- VS Code link: `scriptLink.ts` writes the script (plus a short comment
  header marking the marker boundary) to a `.ts` file via the File System
  Access API ("⇄ file" button). It deliberately does **not** dump the generated
  toolback API into the file — the export is the author's script, not a
  library reference; toolback-style autocomplete is a built-in-editor feature.
  The link is **flavour-aware** (`script` / `markdown` / `html`): the picker
  filters to `.js` / `.md` / `.html`, and viewer files use an HTML-comment
  header + marker (`<!-- … -->`) so the file still reads naturally. Same
  mechanics, separate persisted handles (`link:<key>`), so a viewer field and a
  script never share a file.
  Linking to an **empty** file never clobbers the editor's content (the editor
  is the source of truth), and the current script is written out immediately so
  the file is never left blank. A poll re-reads the file; content differing
  from the last toolback write is pulled back into the book. Echo-loop safety
  comes from tracking what the file *actually* contains (`lastWritten` only
  advances after a write lands, never before), and empty files never trigger a
  pull. **The poll never races our own edits:** a `dirty` flag is set from the
  first keystroke until the write completes, and an 800 ms grace window follows
  every write (the OS can serve stale bytes), so the poll cannot mistake our
  in-flight/stale write for an external save and yank the editor back. Writes
  are serialized on a promise chain and always flush the *latest* draft, so
  rapid typing collapses into one write of the final text.

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
- **Rejected alternatives** (kept for the record): `<script type="importmap">`
  with inline data URLs (higher browser-support floor, no clean per-book CDN
  story in preview); baking every shelf library into the player IIFE (every
  hello-world carries every lib); esbuild-wasm / browser-side bundling
  (reimplements npm resolution client-side); a Node CLI publish (forks the
  all-browser publishing story — reserved for a possible later Electron/Tauri
  rung). CDN-primary was chosen because hosted toolback users can never run
  local npm installs; the shelf is the opt-in offline path, not the default.

## 10. Invariants to preserve when extending

1. The book crosses the iframe as a **plain JSON clone** (no proxies).
2. Every content mutation goes through the store and ends in `sync()`.
3. New script variables must be added to: the runtime param list + dispatch
   args, `NAME_RESERVED` (both bare-name sources), and the curated completions
   (not the TS lib if the name collides with a DOM global). Pages/backgrounds
   should also be excluded from `FUNCTION_RESERVED` in `monacoApiLib.ts` if
   they become callable user functions.
4. **Fit is render-time only.** `resolveObjectRect` (the one authored `rect` +
   glue) is the single source of rects at render and ControlApi reads. Never
   write a fitted rect into `rect` — reads would freeze the glue. A deliberate
   geometry write folds the rendered target back onto the base rect via
   `unlensObjectRect`; a canvas drag does the same via `applyRects`.
5. Group handlers must be reached through the **owner-chain dispatch**, never
   by attaching listeners to group wrappers (double-fire risk).
6. `{{…}}` template grammar and `collectStoreKeys` must stay in sync about
   what is a store key vs a self-binding; `collectStoreKeys` also harvests
   keys from `book.store` so design-time keys surface in the `{{` picker.
7. The examples test (`examples/examples.test.ts`) runs every page of every
   example book and fails on any script error — new runtime features should be
   exercised by an example.
8. Library imports: `rewriteLibImports` and `scanLibImports` must stay in sync
   (same bare-specifier regex); `__tbImport` is a reserved name
   (`NAME_RESERVED` + the author-mode lists) and must stay in every compile
   site's param list; `window.__TOOLBACK_LIBS__` must be set before user
   scripts compile — exports embed it as a script tag before the player, the
   canvas sets it at boot from `public/libs/importmap.json`; shelf output must
   always be ESM — `build-libs.mjs` emits `/libs/<name>.js` and both publish
   and preview consume that layout.
9. **Auto-height never feeds the lens.** `resolvePageSize(..., objects)` may
   grow the page *box*; the fit lens stays on the base sizes (see §4.2). Never
   pass the grown size as `resolveObjectRect`'s page size.
