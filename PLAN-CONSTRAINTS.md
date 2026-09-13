# Plan & architecture: Responsive constraints ("glue") for toolback4

Status: **constraints-only model on branch `feature/page-size`** — one authored
layout per object plus a per-axis `fit` lens; no per-breakpoint rects.
Implemented and verified (304/304 vitest + browser acceptance; see
"Verification recipe"). The markdown/HTML viewer and auto-height features are
separate (see `PLAN-MARKDOWN-HTML-VIEWERS.md`, `PLAN-AUTO-HEIGHT-PAGES.md`).

## Goal

Objects are placed by absolute coordinates (the tool's locked layout model).
Constraints answer a different question: **"how should this object adapt when
the page is a different size?"** — without ever taking the object away from the
author.

## The model (locked)

1. **One layout per object.** `PageObject.rect` is the single authored layout.
   There are **no per-breakpoint rects** — a breakpoint changes the page size
   and constraints re-derive from `rect`. (The earlier `rects.tablet/mobile`
   override model was removed: whole-rect overrides vs per-axis constraints
   caused latent frame/group bugs and a confusing "is this hand-tuned?" state.)
2. **Two independent axes.** Each object carries an optional `fit` with a
   horizontal and a vertical mode. Constraining one axis leaves the other
   completely free.
3. **Free is the default.** No `fit` (or the stored value `free`, which exists
   only for schema stability) means "no constraint": the authored coordinate
   applies everywhere.
4. **The constraint is a non-destructive render lens.** It NEVER writes `rect`.
   `resolveObjectRect` derives the constrained axes at render/read time;
   switching a mode back to Free restores the authored layout exactly.
5. **Modes per axis** (H / V):
   - `free` **Free** — the authored x/y applies at every size
   - `left` / `top` — the anchored margin keeps its share of the page: the
     coordinate scales with the page (`x·W/W₀`)
   - `center` — `x=(W−w)/2` / `y=(H−h)/2` (same word on both axes)
   - `right` / `bottom` — the edge gap keeps its share of the page:
     `x=(r.x+r.w)·(W/W₀) − w`
   - `stretch` — a true scale: both margins keep their share, so position and
     size scale with the page (`x = r.x·W/W₀`, `w = r.w·W/W₀`)
   The edge modes are **proportional by design**: position something N from an
   edge and N scales with the page so the visual proportion is preserved. A
   constant-pixel margin from right/bottom is the Phase 4 "pin" item.
6. **At the base size the constrained axes are identity** (page size == the
   desktop reference), so only Center moves — which is how "set Center" shows
   the object centered where you are. Constraints govern the other sizes.

### Lens math (`resolveObjectRect`, packages/format)

```
r = obj.rect; W,H = page size; W0,H0 = base (desktop) page size
rx = W/W0, ry = H/H0
w = stretch-x ? max(1, round(r.w · rx)) : r.w                      (h: mirror)
x = center ? (W − w)/2
    : left | stretch ? r.x · rx
    : right ? (r.x + r.w) · rx − w
    : r.x                                                      (free)
```
`free` and absent = identity. `constrainsX/constrainsY` exported (true iff the
mode is set and not `free`).

### Inverse lens (`unlensObjectRect`, packages/format)

Turns the rect the author **dragged** (or typed) at the current page size back
into the base `rect` that produces it — this is how a drag edits the shared
layout while keeping glue. At the base size every inverse is the identity.

```
w = stretch-x ? max(1, round(dragged.w · (W0/W))) : dragged.w   (h: mirror)
x = left | stretch ? dragged.x · (W0/W)
    : right ? (dragged.x + dragged.w) · (W0/W) − dragged.w
    : center ? ref.x                                              (rigid)
    : dragged.x                                                   (free)
```

## Rendering pipeline

- `renderPage`/`renderBookPage`/`renderBackgroundView` compute `{page, ref}`
  sizes and thread them into `renderObjectInto` → `resolveObjectRect`. Page
  objects AND background objects both lens.
- Group members never lens (relative coords). A **stretching group scales its
  members** at render via the same fixed-corner `scaleRect` math as interactive
  group resize (`renderObjectInto`, `overrideRect` param) — and ONLY for a real
  scale (a stretch lens, or a parent scaling a nested group); an interactive
  resize already scaled the members in the store, so it is not applied twice.
  A **top-level group can carry glue** (same modes as any object): the group box
  lenses, members ride it (non-stretch) or scale with it (stretch). The panel
  offers the Responsive controls for groups too; only members/nested objects are
  excluded (fit is top-level only).
- Each wrapper is stamped `data-tb-fit-x` / `data-tb-fit-y` for the spring
  hints, plus `data-tb-lens-x` / `data-tb-lens-y` when the lens produced that
  axis (used to clamp Center drags).
- Popups and the author box render through the same path — glue works there.
- ControlApi `x/y/width/height` reads report the **rendered (lensed) rect**.

## Editor store (`apps/editor/src/stores/book.ts`)

- `setObjectFit(id, axis, mode|null)` — fit-only, undoable, top-level objects
  only (group members are relative). Writes `fit`; the canvas re-lenses.
- `applyRects(list, {dir})` — canvas drags. A top-level object's dragged rect
  runs through `unlensObjectRect` and writes its **one `rect`** (constrained
  axes re-anchor, free axes take the value), so every size follows. Center is
  rigid (the canvas clamps its axis). A member is rebased to its group's
  rendered box. A **resized group** scales its descending base rects around the
  handle's fixed corner (the `dir` comes from the canvas resize commit) and
  skips their batch entries; then `expandGroup` re-hugs.
- `setGeometry(id, patch)` — one undoable patch backing the panel's Geometry
  fields and the author bridge. Top-level: the typed value is folded through the
  lens back onto `rect`; a typed position on a centered axis releases that axis.
  A member patches its relative rect directly.
- **Group invariants**: `expandGroup` keeps the box hugging its members in the
  group's local frame (shift members so the union starts at the origin, set the
  base size to the union); `groupSelected` makes a group from the members' union
  and rebases them; `ungroupSelected` makes children absolute against the
  group's rendered box at the current breakpoint.
- `duplicateSelected` offsets the base rect only.
- `fitHintsVisible` pref (localStorage `toolback.fitHints`, default on) sent on
  every `toolback:load`.

## Springs (canvas hint layer, `design.ts`)

- Drawn for EVERY constrained object (page + background; group members
  skipped) on every render and drag redraw — no selection needed. Gated by the
  **≋** toolbar toggle. Free draws nothing.
- Per mode, a distinct shape: **Left/Top/Right/Bottom** = one solid zigzag edge
  spring with a square page-edge anchor and an arrowhead at the object pointing
  back at it (side unambiguous); **Center** = a plain straight **dashed pale
  grey** line with circle anchors; **Stretch** = a **dashed circular coil** with
  triangle anchors. Muted colours are a redundant accent (slate / pale grey /
  amber).
- Stretch coils are a prolate-cycloid helix path (`coilD`: ~10px pitch, 3.5px
  radius, loops when R > L/2πN); edge zigzags are `zigzagD` (amplitude 3px,
  coil every 9px); center is a straight `lineD`. Every spring draws a
  translucent white halo under the coloured stroke. Spans under 12px (edge) /
  16px (stretch) collapse to a stub; center always draws the line. Shapes are
  `position:absolute` (`.tb-fithint-line/spring/anchor/arrow`); the container
  is `pointer-events:none`. The hint is the page's first child — above the page
  background, under the controls — and page-edge anchors are nudged just inside
  the page so clipping keeps them whole.
- The toolbar **≋ All/Sel/Off** control has a hover/focus legend popover
  explaining the shapes.
- **Center lock feedback:** while a Center axis is lensed, movement drags clamp
  that axis in `onPointerMove`, so the object simply doesn't slide along it.

## Panel UI (`PropertiesPanel.vue`)

- **Responsive** section (top-level objects only): two selects — Free/Left/
  Center/Right/Stretch and Free/Top/Center/Bottom/Stretch — plus a one-line
  plain-English description of the active modes. Badge shows only real
  constraints ("Center · Left"), hidden when both Free.
- Geometry fields show the **rendered (lensed) rect**; typing edits the shared
  layout (re-anchoring a glued axis). Header is just `Geometry` (no per-
  breakpoint dots, no "Reset to inherit" — there are no overrides).

## Migration (`packages/format`)

`parseBook`/`safeParseBook` run `migrateObjects` (after `migrateBackgrounds`),
recursively:
- `o.rect = o.rects.desktop`, then `rects` is deleted; `rects.tablet/mobile`
  are dropped (the constraints-only model).
- legacy fit tokens: `prop→left` / `prop→top`, `middle→center`. `left`/`top`
  are first-class current modes (proportional margins) and are never rewritten.

## Tests inventory (304 total)

- `packages/format/src/index.test.ts` — lens math for all modes, identity at
  the base size, `unlensObjectRect` round trip + identity, schema round-trip,
  legacy-object migration (bp rects dropped, fit tokens mapped), invalid-mode
  rejection.
- `packages/runtime/src/design.test.ts` — spring geometry per mode, all-objects
  drawing, `fitHints:false` hides, clip indicators.
- `packages/runtime/src/index.test.ts` — render-time lens (left/right/center/
  stretch, base-size identity, group-stretch member scaling, background-object
  glue).
- `packages/runtime/src/player.test.ts` — ControlApi behaviour (reads lens,
  writes edit the shared rect).
- `apps/editor/src/stores/book.test.ts` — setObjectFit fit-only + undo;
  effectiveRectOf lens; Free restore; re-anchor on drag (desktop + mobile);
  center rigid; stretch resize; group create/expand/ungroup; setGeometry
  re-anchor / centered-axis release; duplicate.

## Verification recipe (browser)

1. `pnpm dev` from a **cold start** (see the environment gotcha below).
2. New book → drop a button → set Horizontal=Right ⇒ springs appear. Drag it
   left/right at desktop **or** mobile ⇒ its one layout moves and it stays glued
   at every size. Switch breakpoints ⇒ the gap is proportionally preserved.
3. Set Horizontal=Center ⇒ it snaps to the page middle and stops moving on the
   x axis when dragged (the y axis still moves). Set Vertical=Center too and it
   is fully locked.
4. Set Stretch ⇒ resize an edge; switch breakpoints to see it scale with the
   page.
5. Open an older book that used per-breakpoint rects ⇒ it loads (those rects are
   dropped) at the desktop layout, ready to re-constrain.

## Environment gotcha

The editor app hot-reloads via Vite, but the canvas iframe runs
`@toolback/runtime` through Vite's pre-bundle cache. A long-running dev server
can serve a stale canvas bundle next to a fresh editor. Fix: restart `pnpm dev`
(or `vite --force`) + hard refresh, and start it from **this worktree**.

## Phase 4 backlog (next steps)

1. **Fixed "pin" margins.** A mode/toggle that keeps a constant-pixel margin
   from an edge instead of scaling it — e.g. "Cancel stays 20px from the right
   at every size".
2. **Group / row layout + distribution.** Treat a group as a small container
   with flex-like `justify` (start · center · end · **space-between** ·
   space-around · space-evenly), `align`, and a `gap` that can be fixed or
   proportional — the clean solution to "OK/Cancel centred with margins from
   both sides, gap shrinking on mobile".
3. **Align / distribute selection commands** (design-time convenience).
4. **Min/max size clamps** and aspect-ratio lock.

## Known limitations

- Center cannot be dragged along its axis (position is fully determined); use
  the dropdown.
- Top-level groups can be constrained; resizing a group on the canvas scales its
  members onto the new box. Members and nested groups have no independent fit.
- On an auto-height page (future, `PLAN-AUTO-HEIGHT-PAGES.md`) vertical glue
  must always measure the BASE height, never the grown height.
- Two deferred features wait in their own plan docs (markdown/HTML viewers —
  incl. `{{key}}` substitution; auto-height web pages).
