# Glue-springs "Selected only" mode — segmented control

## Summary
Today the `≋` toolbar button toggles glue-spring hints on/off for **every** glued object via a single boolean `fitHintsVisible`. This adds a third, in-between mode: **show springs only for the currently selected object(s)** — a "focus" view while designing a complex page. The three states are **All / Selected / Off**, surfaced as a small **segmented control** (mirroring the existing breakpoint-switch), not the old single toggle. "Selected" means *all* objects in the current selection (supports marquee/shift multi-select). Selection changes already re-drive the hint redraw, so "Selected" mode auto-updates for free.

Chosen UI metaphor (confirmed): **segmented control**, styled like the existing `bp-switch`, with segments **All / Sel / Off**. Chosen scope (confirmed): **all selected** objects.

## Behavior / states
- `FitHintMode = 'all' | 'selected' | 'off'`, the single source of truth replacing the boolean.
  - **All** — springs for every glued object (current "on"; the default for new/first-time users).
  - **Selected** — springs only for the current selection set; when nothing is selected, nothing is drawn (clean).
  - **Off** — no springs (current "off").
- In **Selected** mode the hint set follows the live selection: clicking/dragging/marquee/selecting a group re-renders, so the springs track the current selection without re-arming the toggle. Selecting a group shows only that top-level group box's springs (group members already don't draw springs, consistent with All).

## Changes by area (behavior-level)

### 1. Shared type + wire
- Add `export type FitHintMode = 'all' | 'selected' | 'off'` in `packages/format/src/index.ts` (next to `FitHMode`/`FitVMode`), so it is importable everywhere.
- `packages/runtime/src/editorLink.ts`: change `EditorToCanvasMessage.fitHints?: boolean` → `fitHints?: FitHintMode`. In the `toolback:load` handler, replace `design.setFitHintsVisible(data.fitHints !== false)` with `design.setFitHintMode(normalizeFitHintMode(data.fitHints))`. Add `normalizeFitHintMode(v: FitHintMode | boolean | undefined): FitHintMode` mapping `undefined`→`'all'`, `true`→`'all'`, `false`→`'off'`, an in-set string as-is, anything else→`'all'`. This keeps legacy boolean callers (and the existing `fitHints:false` test) valid.
- `apps/editor/src/canvasClient.ts`: `fitHints: store.fitHintsVisible` → `fitHints: store.fitHintsMode`.

### 2. Runtime drawing (`packages/runtime/src/design.ts`)
- Import `FitHintMode` from `@toolback/format`.
- Replace the closure `let fitHintsVisible = true` with `let fitHintMode: FitHintMode = 'all'`.
- `DesignController` interface: replace `setFitHintsVisible(visible: boolean): void` with `setFitHintMode(mode: FitHintMode): void`; implementation: no-op if unchanged; set `fitHintMode`; if `'off'` → `clearFitHint()`; else if `enabled && pageRoot` → `drawFitHints()`.
- `drawFitHints()`: change the gate `if (!...|| !fitHintsVisible)` to bail on `'off'` (clear + return). Inside the object loop, add `if (fitHintMode === 'selected' && !selected.has(id)) continue;` (the `selected` set and the `redrawSelection() → drawFitHints()` re-draw path already exist). `'all'` keeps the current "draw every glued object" behavior.
- The only caller of the old setter is `editorLink.ts`, which is updated above. No other references exist.

### 3. Editor store (`apps/editor/src/stores/book.ts`)
- Replace `const fitHintsVisible = ref<boolean>(localStorage.getItem('toolback.fitHints') !== '0')` with `const fitHintsMode = ref<FitHintMode>(readFitHintsMode())`, where `readFitHintsMode()` reads `localStorage['toolback.fitHints']` and maps legacy `'1'`→`'all'`, `'0'`→`'off'`, a valid `'all'|'selected'|'off'` as-is, unset/anything-else→`'all'`.
- Replace `setFitHintsVisible(v: boolean)` with `setFitHintsMode(mode: FitHintMode)`: set the ref, `localStorage.setItem('toolback.fitHints', mode)`, then `sync()`.
- In `sync()`, send `fitHints: fitHintsMode.value` (was `fitHintsVisible.value`).
- Export `fitHintsMode` / `setFitHintsMode` in the returned store object (replace the old two). Remove the old `fitHintsVisible`/`setFitHintsVisible` symbols.

### 4. Editor UI (`apps/editor/src/App.vue` + its `<style>`)
- Replace the single `≋` toggle button (`.panel-toggle.spring-toggle`, `@click="store.setFitHintsVisible(!store.fitHintsVisible)"`) with a segmented control modeled on `.bp-switch`:
  - A wrapper `div.spring-switch` with `title="Glue springs — which objects to show"` and an optional decorative leading `≋` glyph (`aria-hidden`) to keep the control recognizable.
  - Three `button.spring-toggle` segments, each `:class="{ on: store.fitHintsMode === 'all' | 'selected' | 'off' }"`, `:disabled="store.isRunning"` (springs are a design-only affordance; matches `bp-switch` staying visible-but-disabled while running), with descriptive `title`s ("All glued objects" / "Selected object(s) only" / "Hide all springs") and `@click="store.setFitHintsMode('all'|'selected'|'off')"`. Compact segment labels **All / Sel / Off** keep the bar narrow; tooltips carry the long form.
  - Remove the old button and any `fitHintsVisible` references in the template (title/class/`onClick`).
- Add CSS mirroring `.bp-switch`/`.bp-switch button`/`.bp-switch button.on`: `.spring-switch` (flex row, `gap:2px`, 1px `--ed-border`, `border-radius:6px`, `padding:2px`, `background:var(--ed-bg)`), segment buttons inheriting the `.bp-switch button` look, `.spring-toggle.on` = accent background + white text, `:disabled` = `opacity:0.4`. Drop the now-unneeded standalone `.spring-toggle` button styling if present, or reuse the class name on the segments.

## Edge cases / failure modes
- **Empty selection in Selected mode** → loop draws nothing and `clearFitHint()` runs on the `drew` flag, leaving a clean overlay.
- **Group / members** → `selected` holds only top-level ids and the loop already skips group members, so a selected group shows its box's springs and no member springs — identical treatment to All mode.
- **Run mode** → segments are disabled (springs are design-only); the canvas shows no springs in run mode regardless.
- **Mode changes vs. selection changes** → `setFitHintMode` redraws immediately when enabled+rendered; selection changes go through the existing `redrawSelection → drawFitHints` path, so Selected mode tracks the selection with no extra wiring.
- **Backward compatibility** → old `toolback:load` messages with `fitHints: true/false` and legacy `localStorage` values `'1'/'0'` normalize correctly; new builds send the string mode.
- **Load ordering** → `setFitHintMode(mode)` is called before `onRendered(selection)` in the load handler, so the post-load redraw uses the right mode.

## Tests & verification
- `packages/runtime/src/design.test.ts` (core behavior, jsdom + `getBoundingClientRect` mock — follow the existing "draws glue springs for objects with real constraints" case):
  - New: `fitHints:'selected'` with two glued objects and `selection:['a']` draws only object `a`'s springs (assert anchor/line/coil counts correspond to a single object; the unselected `b` contributes nothing).
  - New: same scene but `selection:[]` → `.tb-fithint` is null (Selected + empty selection ⇒ nothing).
  - New: `fitHints:'all'` (explicit string) draws springs for both objects (string parity with the default).
  - New: a second `toolback:load` with `selection:['b']` and `fitHints:'selected'` swaps which object's springs are shown (verifies the selection-change re-draw path).
  - Keep the existing `fitHints:false` "hides all springs" test passing (normalizes to `'off'`), and the no-`fitHints`-field default (draws all) unaffected.
- `apps/editor/src/stores/book.test.ts`: `setFitHintsMode('selected')` updates the ref and writes `localStorage['toolback.fitHints']==='selected'`; loading the store under `'selected'`, `'1'`→`'all'`, `'0'`→`'off'`, and unset→`'all'` yields the expected `fitHintsMode` (legacy-mapping coverage).
- UI: verified by `tsc`/build + manual smoke (no component-DOM harness exists in `apps/editor`), matching how other toolbar controls change.
- Run: the project's vitest suite (e.g. `pnpm test` / `pnpm -r test`), plus a typecheck/build of the editor so the renamed store members and the new `FitHintMode` type are exercised end to end.

## Assumptions & defaults
- Default mode for first-time users is **All** (unchanged on-behavior); **Selected** is opt-in; **Off** is the old "off".
- The `≋` glyph is retained as an optional decorative label on the grouped segmented control for recognizability; segments stay compact with descriptive tooltips.
- The control stays visible but disabled while running, exactly like the breakpoint switch.
- `FitHintMode` is new and lives in `@toolback/format`; it is additive (no data migration of saved books — the mode is editor UI state, not book content).

## Public interface changes
- `packages/format`: new exported `FitHintMode` union.
- `packages/runtime` (`DesignController`): `setFitHintsVisible(boolean)` → `setFitHintMode(FitHintMode)`; `EditorToCanvasMessage.fitHints` → `FitHintMode` (runtime-tolerant of legacy booleans).
- `apps/editor` store: `fitHintsVisible`/`setFitHintsVisible` → `fitHintsMode`/`setFitHintsMode`; old symbols removed.
- `apps/editor` UI: the single `≋` toggle is replaced by the 3-segment `.spring-switch` control.
