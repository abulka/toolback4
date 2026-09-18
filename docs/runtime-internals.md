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
Book    { formatVersion, id, title,
          backgrounds: Background[], pages: Page[],
          startPageId?, store?: [key,value][] }
Background {
  id, name, color, script,        // script = shared fns + backgroundEnter() hook
  objects: PageObject[],
}
Page    { id, name, script, backgroundId, author?, size?: {w,h}, objects: PageObject[] }
PageObject {
  id, name,                       // name = unique per page/background; the `controls[name]` handle
  control: 'button'|'label'|'input'|'image'|'card'|'container'|'switch'|'group'|'shape'|'canvas',
  x: XEdge,                       // horizontal edge constraint (see §4.1)
  y: YEdge,                       // vertical edge constraint
  props: Record<string, unknown>, // control-specific, e.g. { text }
  on: Record<string, string>,     // eventName -> script source
  children?: PageObject[],        // groups only; members constrain to the group box
}
XEdge = { mode:'left'; left; width }
      | { mode:'right'; right; width }
      | { mode:'both'; left; right }
      | { mode:'center'; width }
YEdge = { mode:'top'; top; height }
      | { mode:'bottom'; bottom; height }
      | { mode:'both'; top; bottom }
      | { mode:'center'; height }
```

- **Pages are web pages.** A page with no `size` fills the window it is shown in
  (the editor canvas area, or the browser) and grows with its content, never
  shorter than the window. A page with a `size` is a fixed surface (dialog /
  popup / author plugin window). Breakpoints, `Book.canvas`, `Book.design`,
  `Background.size` and `Background.autoHeight` are gone.

- **Format version.** `Book.formatVersion` (`FORMAT_VERSION` in
  `packages/format`) is the persisted-format baseline. `parseBook` stamps it,
  treats an absent version as current (AI output needs no version), rejects a
  book from a newer version (it may use unknown shapes), and runs the ordered
  `MIGRATIONS` chain for an older one. There is no pre-v1 migration:
  `rect`/`rects`/`fit`/`canvas` books are unsupported. **When the stored shape
  changes, bump `FORMAT_VERSION` and add a `{ from, run }` step to `MIGRATIONS`**
  — the chain upgrades a book one version at a time, then the schema parse stamps
  the current version.

- Zod schemas with `.default()`s; `parseBook` normalizes on load. Factories
  (`createObject`, `createGroup`, `createPage`, `createBook`) return parsed
  plain objects, safe to JSON round-trip.
- **Start page.** `book.startPageId` names the page a run opens on. It is
  optional/dangling-safe: `resolveStartPageIndex(book)` returns the matching
  index or `0`. The published entry (`player-entry.ts`) passes it to `runBook`,
  and the editor opens it on load/refresh; it is not a per-run override.
- Every object stores its **edge distances** (`x`/`y`; see §4.1), not a rect or
  a scale mode; there is no remembered "designed at" size.
- Groups are **parent objects**: a member constrains to the group box; a group's
  box is its own `x`/`y` and hugs its members. A group handle resize (or a typed
  W/H / scripted size) scales the members with it (see §5).
- Style props are all optional keys on `props`; renderers apply them through
  `applyStyleToTree` (`packages/controls`), the single place that knows which
  node each kind paints. `color` (colour names via `resolveColor` — a curated
  map plus any CSS colour string — or raw CSS) keeps its role meaning: surface
  fill for buttons/cards/containers, text for labels/viewers, toggle track for
  switches. `textColor`, `background` and `trackColor` are explicit overrides
  that win over `color` per role. `fontFamily` (one of five stacks in
  `FONT_STACKS`), `fontSize`, `bold`, `italic`, `textAlign`, `vAlign` round out
  the text set; `borderWidth`/`borderStyle`/`borderColor`, `radius` and
  `opacity` are box decoration (`applyBoxStyle`, applied for `BOX_KINDS`). A
  **shape** is an SVG geometry in a `0 0 100 100` viewBox and applies its own
  paint (`applyShapeStyle`): `background`/`color` become `fill`, the border
  props become `stroke`/`stroke-width`/`stroke-dasharray`, `radius` rounds a
  rectangle, and `shape`/`sides`/`points`/`innerRatio`/`path` select the
  geometry. A **canvas** is a real `<canvas>`; the player sizes its backing
  store to the object box at the device pixel ratio and paints it by running
  the object's reserved `draw` handler, exposing `self.canvas`/`self.ctx`/
  `self.redraw()`/`self.animate()` per canvas in `runPage`.
  `background`/`color` are the CSS surface behind the drawing; border/radius/
  opacity are box decoration.
  `styleKindsForProp` (`format`) is the shared prop→kinds table the editor
  selection patch and the runtime group propagation both read. Labels and
  buttons are flex **columns** (horizontal alignment is `text-align` on a
  stretched text item; vertical is `justify-content`), so alignment maps cleanly
  on both axes. Every prop is also a live `ControlApi` accessor that writes the
  prop AND re-applies the inline styles. Switches apply text styling to their
  text span and `trackColor`/`color` to the toggle track (`--tb-switch-on`).
- A **group** has no box of its own, so its style setters flow the prop to the
  members that support it (`styleKindsForProp`), mutating member `props` so the
  styling survives a re-render, and keep the value on the group for getter
  readback. `text`/`value` stay inert on groups.
- Pinia reactive proxies are **not structured-cloneable** — the book always
  crosses the iframe boundary as `JSON.parse(JSON.stringify(book))`.

## 3. The player (`packages/runtime/src/player.ts`)

### 3.1 Run loop & navigation

`runBook(book, root, onError, startPageIndex)` builds a `RunState` and calls
`runPage`. One global `active` handle — a second `runBook` replaces the first
(`stopRun` unwinds everything). `runPage`:

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

The reserved **`draw`** event is compiled like any other handler but is **not**
attached as a DOM listener (`types.delete('draw')`); after the dispatchers are
wired, `runPage` finds every canvas object, injects `canvas`/`ctx`/`redraw`/
`animate` onto its ControlApi, and calls its compiled `draw` handler on render,
on resize, on each `store.subscribe` tick, and per frame while `animate(true)`.
Every canvas loop and store subscription is added to `scope.listeners`, so
`pageLeave`/`stop()` tears them down with the rest.

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
  re-snaps group boxes to the tight union of their members. During a move the
  controller also re-derives the cached `rects` of every descendant of a moved
  object from their start rects (`followers`, captured at pointer-down), so a
  group's members' springs and hit-testing track the ghost live instead of
  lagging until the commit's re-render. Before sending, `compensateMoveForScroll`
  nudges the committed rects by the scroll the browser is about to clamp: moving
  the far-edge control inwards shrinks a scrolled fluid page until it stops
  overflowing, so `scrollLeft`/`scrollTop` reset and the page would snap
  sideways. `scrollClampShift` iterates the page size / clamp to preserve the
  dropped object's on-screen position (top-level moves only; no-op when the page
  isn't scrolled or other content still overflows).
- **Group resize**: a group handle drag leaves the layout box alone and previews
  a CSS `transform: scale(fx, fy)` anchored on the fixed corner, stretching the
  whole subtree. The commit sends only the group's rect + `dir`; the store scales
  every descendant's edge distances by the box ratio (`scaleSubtreeEdges`, §5)
  and writes the box, so the preview maps onto the re-render. A stretch axis
  (`both`) that the handle moved becomes a fixed near-edge size. Non-group
  objects resize their own box directly; their members re-resolve their edges.
- **Aspect lock (Shift-drag)**: holding Shift on a **corner** handle resizes
  with the object's start aspect ratio held (`resizeRectAspect`,
  `packages/runtime/src/design.ts`) — the driver axis is whichever the pointer
  moved further along, and the fixed-opposite-corner math is preserved.
  Single-axis edge handles resize normally. No schema field: the lock is a
  gesture, captured at drag start.
- **Clip indicators**: after every render (and live during drags) the
  controller lays a dashed red `.tb-clip` box over any object that sticks out
  of the page. The controller's `rects` map is always the source of truth for
  these — it reads rendered DOM positions, so CSS edge rendering is
  automatically reflected.
- **Selection chrome**: the `.tb-sel` outline, the eight resize handles and the
  `w × h` size badge are drawn in the overlay. The badge prefers just below the
  selected object, flips above it when there is no room, and is clamped inside
  the page box (`badgePosition`, `design.ts`) — so a control on the bottom/right
  page edge keeps its size label visible instead of clipping it against the
  overlay's `overflow: hidden`.
- **Edge springs**: the `.tb-fithint` overlay draws a spring from every object
  to each edge it follows, **one axis at a time** (by default every object draws
  at least the left/top springs). The load message carries the whole
  `FitHintOptions` (`mode: 'all' | 'selected' | 'off'` plus the popover options)
  and `setFitHints` normalizes a bare mode string for back-compat; the All/Sel/Off
  buttons patch `mode`, the fourth segment opens the options popover.
  `springShown(el)` gates the drawing pass: the `modeAllows` gate (Selected =
  selection only) plus `groupMembers:false` (skip members in All) and
  `nonDefaultOnly` (skip objects whose x/y are both the default left/top). The
  group-outline pass uses `modeAllows` alone, so hiding a member's spring never
  hides the group box it sits in. Each spring carries a
  `.tb-fithint-label` caption with the edge word and (unless `lengths:false`) its
  pixel distance (`right 198`, `top 46`, `centre`); `labels:false` drops captions
  entirely and `skipZeroLabels` (default on) drops the ones whose distance rounds
  to 0, so a flush edge is not captioned. Captions are **placed on the roomier
  side of the spring and clamped inside the page/group box** using text-derived
  size estimates (no layout read), so a page-edge caption is pushed clear of the
  border instead of sitting on it. **Shape encodes the anchor**: an **edge**
  choice (left/top/right/bottom, and both) is a zigzag with a square anchor and an
  arrowhead at the object pointing back at it; **center** is a plain straight
  connector with circle anchors. Distances are always fixed, so every edge spring
  is solid. Edges are slate, center is pale grey, and every spring is drawn over a
  translucent white halo so it reads on dark pages. **Members draw their own
  springs against the parent group box** (the group wrapper's rect, via the
  `rects`/`bgRects` maps) rather than the page; top-level objects use the page box
  (`origin` + `pageBounds`). **Page padding** is shaded too: soft bands
  (`.tb-fithint-padding`) run along the page's right/bottom edge, drawn under the
  springs. They always show in `all` mode. In `selected` mode they show only when
  the padding actually contributes on that axis (the page is content-sized —
  `bounds` bigger than the document viewport) **and** the selected object follows
  the near edge (x `left` → right band, y `top` → bottom band), so the padding
  reads as the real gap past it rather than a strip on a window-sized page. When
  the page padding
  changes, `revealPaddingChange` scrolls the page's far corner into view
  (`scrollIntoView` on a transient probe) so the gap can be watched growing.
  Covers background objects too (`bgRects`
  fallback), with a **?** help popup in the toolbar (buttons + options + line
  legend). The hint is the page's first child, so it
  paints above the page background but **under** the controls; page-edge anchor
  glyphs are nudged just inside the page so clipping doesn't cut them. Pure
  decoration — `pointer-events: none`, rebuilt on render, drag redraws and window
  resizes (`DesignController.refresh`). Reads the `data-tb-edge-x/y` modes the
  renderer stamps on each wrapper in `applyEdgeStyles`, and the page's
  `data-tb-padding` stamped in `renderPage`.
- **Group outlines** (`.tb-group-outline`): a quiet dashed slate box tracing a
  group that has no selection box of its own but whose edges matter — every
  group in `drillPath` (so each nesting level stays faintly visible while an
  inner child is selected), plus every group whose members are in view at the
  current mode (so a member's springs always land on a visible edge; the
  `groupMembers`/`nonDefaultOnly` filters hide springs, not the box). A group
  can be both drilled and in-view, or selected: a selected group is
  always excluded — its `.tb-sel` box is the loud one — and `fitHints.mode:'off'`
  leaves only the drilled ancestors. **Borderless controls** — labels and
  markdown/HTML viewers — join the set too (detected by their `.tb-label`,
  `.tb-markdown`/`.tb-html` element): they have no chrome of their own, so their
  box is traced whenever they're not selected, independent of the spring mode —
  otherwise an unselected label or empty viewer is invisible at design time, and
  the edge springs pointing at it land on nothing.
  Built by `redrawGroupOutlines` (the group part is the pure `groupOutlineIds`),
  positioned from the `rects`/`bgRects` maps like the selection boxes, painted
  under `.tb-sel`, and refreshed whenever the selection, drill path or hint mode
  changes.
- **Drags rewrite edge distances**: canvas drags send page-absolute rects; the
  store converts each to the object's `x`/`y` distances against its page/group
  box, keeping the edges it already follows. A centred axis is rigid (the canvas
  clamps it); there is nothing to release.

### 4.1 Edge constraints (`x` / `y`)

Every `PageObject` stores the distance(s) it keeps from the edges it follows,
like CSS `left`/`right`/`top`/`bottom`:

- `{ mode:'left', left, width }` — fixed distance from the left edge, fixed size
- `{ mode:'right', right, width }` — fixed distance from the right edge
- `{ mode:'both', left, right }` — both distances fixed, so the size stretches
- `{ mode:'center', width }` — fixed size, centred

`y` mirrors with `top` / `bottom` / `both` / `center`. There is no stored
reference size and no scaling mode; `resolveX`/`resolveY` derive a rect against a
containing box (`rectForObject`), and the renderer writes the distances straight
to CSS (`applyEdgeStyles`: `left`+`width`, `right`+`width`, `left`+`right`, or
`left: calc(50% - w/2)`). Percentages resolve against the containing box — the
page for top-level objects, the parent group wrapper for members — so the browser
repositions everything on resize with **no JavaScript re-render**.

There is no per-object margin: an object's outer space is the edge distance
itself (a right/bottom control's inset, a follows-both control's stretch). The
only page-level space is **page padding** (`Page.padding`, fluid pages only,
missing = 0): `resolvePageBox` and `renderPage` size the page as
`max(viewport, content extent + padding)` on each axis, so the page keeps that
much empty space past its content on the right/bottom. It is masked when the
window is already bigger (the `max` wins), and fixed-size pages ignore it.
`contentExtent` measures only the near-edge (left/top) content outer edges.
`pagePadding(page)` is the accessor. Editor-only (the Page tab's **Content
padding** field, `setPagePadding` store action).

The author-facing surface is the **Responsive** section of the properties panel
(`apps/editor/src/components/PropertiesPanel.vue`): four plain choices per axis
(Follows left · Follows right · Follows both (stretches) · Centred), stored
directly as the `mode`. `apps/editor/src/fitModes.ts` holds the labels and
descriptions. Switching a choice re-derives the distances from the current
rendered rect (`xEdgeFromRect`/`yEdgeFromRect`), so the object stays put.

Invariant: **an edge constraint is the stored geometry, not a render lens.**
Deliberate writes (`writeRectPart`, used by panel fields, scripts and the author
bridge) move the control now while keeping the mode: `x`/`y` on a follows-both
control translates it, on a centred control drops the centring to a near edge,
and a `width`/`height` write on a follows-both control switches that axis to a
fixed size held to the left/top. Canvas drags go through `applyRects`, which
builds the new distances for top-level objects and rebases members into their
group's frame.

Edge constraints are the only stored layout: pre-v1 `rect`/`rects` + `fit`
books are unsupported and fail the version gate (`parseBook`), not migrated.

ControlApi reads use the same resolution: `runPage` and `author.ts` build a
`parentBoxMap` (the resolved page box for top-level objects, the resolved group
box for members) plus `pageBoxFor`, and each `ControlApi` resolves its
`x`/`y`/`width`/`height` — and the box a write re-derives against — from that
containing box, so script reads agree with the render.

Known limitations: a centred axis is rigid (its position is fully determined, so
the canvas clamps it and it must be changed from the dropdown); group members
carry their own constraints **relative to the group box** (see §5).

### 4.2 Fluid pages (the page box)

`resolvePageBox(page, container, objects)` (`packages/format`) is the single
source of a page's size. A **fixed** page (`Page.size`) returns that size. An
**ordinary** page returns `max(container, content extent + page padding)`, where
the extent is `contentExtent(objects)`: the outer right/bottom of every object
whose x/y mode is **left/top** (near edge, groups included). Right/bottom/both/
centred objects sit inside the page box by definition and never enlarge it — this
is what makes "follows bottom" mean a fixed distance from the page's real bottom
edge without circularity. Adding `Page.padding` is what lets a Follows-top
control keep empty page below it instead of sitting flush on the auto-grown edge.

At render time a fluid page is given `width:100%; height:100vh` (or `100%` inside
a sized popup/author box) with `min-width`/`min-height` set to the content
extent, so the browser grows and scrolls the page with no re-measure. Only layout
at render/navigation time drives growth; a script moving an object mid-run does
not re-grow the page. The container is `measureViewport(root)` (the document's
client box) for a base page, or an explicit box for popups/author windows. A
fixed page is centred in the window (`margin: auto`); a fluid page fills it.

The editor canvas mirrors this: `renderBookPage`/`renderBackgroundView` render
fluid pages, and `editorLink`'s `syncCanvasWidth()` toggles
`.tb-canvas-root--fluid` so the wrapper spans **max(viewport, content extent)**
— `min-width:100%` covers the empty case (a plain `max-content` wrapper would
collapse a fluid page whose content fits), while the inherited `max-content`
covers horizontal overflow so objects past the right edge stay inside the design
overlay and remain hit-testable. `syncCanvasWidth()` runs **before** the rects
are measured/`onRendered`, because a fixed→fluid navigation must widen the
wrapper first: measuring against a still-collapsed wrapper puts right/bottom
anchors (and the selection/clip overlays derived from them) in the wrong place
until the next re-render. On resize the editor sends a fresh viewport and
calls `design.refresh()` to re-measure the overlay; the page itself reflows
purely in CSS. Scroll preservation is gone — the page's size comes from
constraints, not from measuring the DOM, so clearing and rebuilding the page no
longer collapses it.

## 5. Group invariants (`apps/editor/src/stores/book.ts`)

1. **Hug the members**: after any member move/resize/delete, a member's edge
   change, or a group-level resize, `expandGroup` solves every member against
   the current group box, shifts the group so the union starts at its local
   origin, and sets the box to the union — near/far members keep their absolute
   positions. Members keep their own edge modes. A **centred** member re-centres
   when the box changes, so `expandGroup` **iterates to a fixed point** (up to
   12 passes) to reach a genuinely tight box. Recurses up for nested groups.
   **Two ways a group changes size:** a **handle drag** — and a typed W/H, and a
   scripted `group.width`/`height` — means "size the group": the store scales
   every descendant's edges by the box ratio (`scaleSubtreeEdges` in
   `@toolback/format`) around the fixed corner, so sizes and positions scale
   together, and `expandGroup` then only rounds the box tight. A **page/window
   resize** is ambient: CSS re-resolves each member's own edges and nothing is
   scaled. Because a page box change caused by a **content** edit (moving another
   control, resizing the page) would otherwise leave a stretch (`both`) group
   larger than its members, every `sync()` first runs `rehugStretchedGroups()` —
   an idempotent depth-first `expandGroup` over `both`-axis groups, so only a
   pure viewport reflow (no store mutation) can leave a group bigger than its
   contents. A stretch (`both`) axis that a handle resized becomes a fixed
   near-edge size so the hand resize sticks.
2. **Same-parent rule**: grouping requires all selected objects to share a
   parent. Ungrouping splices children back at the group's index with their
   rects made absolute against the group's rendered box at the current
   viewport (so it never jumps on screen); ungrouping a scripted group asks
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
| `toolback:load` | book, pageIndex, view, design, selection, fitHints | full re-render (the only sync; idempotent) |
| `toolback:dragOver` / `dragEnd` | control, rect | palette ghost preview |
| `toolback:authorStart` | book, pageIndex | run a plugin page in author mode (M6c) |
| `toolback:authorStop` | — | stop the running plugin |
| `toolback:authorReply` | id, ok, result / error | resolves one pending bridge call |
| `toolback:smoke` | id, book | run a book off-screen and report script errors (AI generation); skipped while a run is active |

| Canvas → editor | payload | meaning |
|---|---|---|
| `toolback:ready` | — | iframe booted; editor answers with `load` |
| `toolback:viewport` | width, height | measured canvas viewport (the editor store mirrors it for its page-box/edge math) |
| `toolback:rects` | rects map | layout measured (design hit-testing) |
| `toolback:selection` | ids | canvas selection changed (multi-select, drill) |
| `toolback:commit` | kind move/resize, objects | a drag/resize finished (undoable edit) |
| `toolback:scriptError` / `toolback:error` | message | status bar |
| `toolback:runToggle` | — | F3/⌥3 pressed inside the canvas |
| `toolback:store` | entries | run-mode store browser stream — cloneable values raw, functions as `{__tbLabel}` sentinels |
| `toolback:popups` | open names | run-mode popup stack changed |
| `toolback:authorCall` | id, op, args | plugin script called `author.<op>` (async bridge) |
| `toolback:authorState` | active, pageName | plugin started/stopped (✕ in the box) |
| `toolback:smokeResult` | id, errors | result of a `toolback:smoke` run (empty = clean) |
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
- **Edge writes / page box**: `pageBox()` is `resolvePageBox` against the
  mirrored viewport; `renderedRectOf`/`renderedPageRectOf` resolve an object's
  rect from its `x`/`y` against its page/group box (`boxForObject`).
  `applyRects` (canvas commits), `setGeometry` (panel fields, author bridge) and
  `setObjectEdge` (Responsive dropdowns) all write through
  `writeRectPart`/`applyRectToObject`, keeping the edges each control follows.
  `fillObjectToPage`/`fillObjectWidth`/`fillObjectHeight` pin both edges;
  `centerObjectInPage` sets both axes centred. `expandGroup` re-hugs a group box
  around its members.
- **Align / distribute / match** (`alignSelection`, `distributeSelection`,
  `matchSizeSelection`, `centerSelectionOnPage`): five pure helpers in
  `@toolback/format` (`alignRects`, `centerBlockRects`, `distributeRects`,
  `matchSizeRects`) applied to the selection's **rendered** page-absolute rects
  (`renderedPageRectOf` sums the ancestor group boxes), then written back through
  `writeRenderedRects` (members rebase into the group's local frame; every
  object keeps its edges). All four are one `record` step each and no-op on a
  mixed-parent selection.

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
- `.toolback.json` via File System Access API with download/input fallbacks.
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
4. **Edges are the stored geometry.** `x`/`y` are the single source of a
   control's rect at render and ControlApi reads (`rectForObject` + CSS). A
   geometry write keeps the control's mode via `writeRectPart`; a canvas drag
   converts the page-absolute rect through `applyRects`. Never bake a resolved
   rect back into `x`/`y` — the distances are the authored data.
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
9. **Far edges cannot feed the page size.** `resolvePageBox` may grow the page
   *box* past the container; only left/top (near-edge) objects contribute to
   `contentExtent` (see §4.2). A right/bottom/both/centred object never enlarges
   the page — it sits inside the box. `Page.padding` is the only extra page-level
   space (fluid pages, right/bottom). `xEdgeFromRect`/`yEdgeFromRect` must not
   bake a resolved rect back into `x`/`y`.
10. **A group scales when you size it, not when the page reflows.** A group
    resize — a handle drag (`applyRects` with `dir`), a typed W/H
    (`setGeometry`), or a scripted `group.width`/`height` — scales descendants'
    edge distances via `scaleSubtreeEdges`, around the fixed corner. An ambient
    reflow (page/window resize, no `dir`) must **not** scale: CSS re-resolves
    each member's own edges. A stretch (`both`) axis a handle resized becomes a
    fixed near-edge size. `sync()` re-hugs every `both`-axis group
    (`rehugStretchedGroups`) so a page box change caused by an edit can never
    leave a group larger than its members — never re-hug on a pure viewport
    resize (no store mutation), which must stay CSS-only.
11. **The capability manifest is the source of truth for what a book can
    contain.** A new control kind, property or script API member must be added
    to `CONTROL_PROPS`/`SCRIPT_API` in `@toolback/format` and
    `CAPABILITY_VERSION` bumped, so the AI prompt, validation and drift tests
    stay correct (see §11).

## 11. AI authoring (`apps/editor/src/{ai,aiPrompt,aiConfig,providers,aiIntent,aiDiff,mergeBook}.ts`)

The AI panel turns a prompt into an ordinary `Book`; there is no second format
and no server. Everything it produces goes through the same validation and store
paths as a hand-built book.

**Capability manifest (single source of truth).** `packages/format/src/index.ts`
exports `CONTROL_PROPS` (per control kind: name, type, enum, default,
`scriptable`, doc), `SCRIPT_API` (the runtime globals) and `CAPABILITY_VERSION`.
`apps/editor/src/ai.ts` (`manifestText`/`styleGuide`) renders those into the
system prompt, which `aiPrompt.ts` appends to `docs/llm-authoring.md` at its
`<!-- CAPABILITY_MANIFEST -->` marker. `validateBook` flags props not in
`CONTROL_PROPS`, and `capabilities.test.ts` asserts every `CONTROL_KINDS` entry
is covered and every `DEFAULT_PROPS` key is declared. **Add a control, property
or script API member → edit the manifest and bump `CAPABILITY_VERSION`** (see
AGENTS.md).

**Generation loop.** `generateBook(systemPrompt, request, settings, opts)`:

1. `chatComplete` dispatches on `settings.api` — OpenAI-compatible
   `/chat/completions` (the default) or Anthropic `/messages` (with the
   `anthropic-dangerous-direct-browser-access` opt-in header).
2. Parse the reply (`extractJson` tolerates markdown fences).
3. `normalizeBook` fills gaps only — ids/names, geometry from `DEFAULT_SIZES`,
   `DEFAULT_PROPS` — returning notes and never overriding an explicit value.
4. `validateBook` = zod `safeParseBook` (which also enforces the version gate)
   + semantic lints (unique/valid names, `controls.<x>` / `page.go` /
   `popupOpen` targets, `{{key}}` seeds, unknown props as warnings).
5. `smokeBook` runs the parsed book off-screen in the canvas
   (`toolback:smoke`) and returns any script errors. Each smoke is independent:
   `runSmoke` finishes with `stopRun()`, which clears the player's module `active`
   so the next smoke is not skipped by its own `isRunActive()` guard.
6. Failures are fed back for a bounded number of repair turns; `notes` and
   issues surface in the panel log.

**Load modes** — `loadGeneratedBook(raw, mode, { keepExisting })`, each one undo
step:

- `append` — `mergeGeneratedBook`: an incoming background whose name matches an
  existing one is **reused** (the new pages join it and the existing shared
  objects/script win; any objects the model put on it are dropped and counted),
  while genuinely new backgrounds are re-idded and appended. Page names are
  de-duplicated (references rewritten). A page joining a reused background has
  colliding object names renamed, with `controls.<name>` references rewritten
  (the page and its background share one runtime namespace). The append prompt in
  `AiPanel.vue` carries the existing background/page names and the current
  background's function names, so the model reuses the current background instead
  of inventing a duplicate and avoids redefining its helpers. The merge returns
  non-blocking `warnings` for a page function that shadows a function of the same
  name on the reused background and for helpers discarded with a reused
  background's script; `AiPanel` also smoke-runs the merged book (start page moved
  to the first appended page) before applying, so merge-induced runtime errors
  surface in the result card/log.
- `modify` — `applyModifiedPage`: replaces the current page's objects/script,
  keeping its id, name and background; names colliding with the background are
  renamed. With `keepExisting` (strict add-only) the existing objects are kept
  verbatim and only new names are added, so an "add a button" request can never
  recolour what is already there. It walks into a matching group, so a child the
  model added inside an existing group (a new indicator on an existing widget) is
  appended to that group rather than the whole group being skipped.
  `aiIntent.ts` derives the mode + flag from the
  prompt text; the panel applies that at generate time and, when it differs from
  the current mode, asks the author to confirm (Switch / Keep) before switching
  — it never overrides the radio silently.
- `replace` — swap the whole book.

**Provider layer.** `providers.ts` holds the presets (base URL, API shape,
keyless, curated models); `aiConfig.ts` persists per-provider keys/models and
global style tokens, migrating the legacy single-provider shape; `fetchModels`
reads `GET {base}/models` and filters to chat models using modality metadata
(Groq `output_modalities`, OpenRouter `architecture.modality`) with id
heuristics as fallback.

**Compare & history.** After applying, the panel can show the pre-change book:
the store's `compareBook` makes `sync()` send that snapshot instead of the live
book, and `canvasClient` exits compare before any mutating canvas message. The
capped `history` messages are sent to the model on follow-ups, while `turns` is
the visible prompt list (click to restore a prompt).
