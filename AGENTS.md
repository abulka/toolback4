# AGENTS.md — working on toolback

Toolback is a visual authoring tool for small "books" (book → pages → objects),
scripted in plain JavaScript and exported as a single self-contained HTML file.
This file is for agents and developers working on the **codebase**. The user-
facing references are [`docs/scripting-guide.md`](docs/scripting-guide.md) (what
authors use) and [`docs/runtime-internals.md`](docs/runtime-internals.md) (how it
works).

## Layout

pnpm monorepo. Dependency direction: `format ← controls ← runtime ← editor` (the
editor never imports controls directly — it renders through the runtime in a
sandboxed same-origin iframe).

```
apps/editor/        Vue 3 + Pinia + Monaco; owns the book, talks to the canvas via postMessage
packages/format/    @toolback/format   — zod schemas + factories + geometry/tree helpers (only dep: zod)
packages/controls/  @toolback/controls — plain-DOM renderers per control, zero framework
packages/runtime/   @toolback/runtime  — the player (no Vue) + design controller + editorLink protocol
packages/libs/      @toolback/libs     — the npm "library shelf" (its dependencies are the shelf)
examples/           ready-made .toolback.json books; a test runs every page of every book
docs/               scripting-guide.md, runtime-internals.md, llm-authoring.md, screenshots/
plans/              internal design notes + PLAN.md (milestone/progress log)
```

## Commands

```sh
pnpm install      # workspace deps
pnpm dev          # editor dev server (http://localhost:5173); prebuilds the player + libs
pnpm test         # vitest across packages, app and example books
pnpm typecheck    # tsc / vue-tsc across the monorepo
pnpm build        # production build
```

Node 20+. `pnpm dev` / `pnpm build` run `build-player.mjs` and `build-libs.mjs`
first — if a runtime change isn't showing up in the canvas, the player bundle is
the usual suspect.

## Definition of done

- `pnpm test` and `pnpm typecheck` are green. Add or update tests for behaviour
  changes; the example-books test fails on any script error.
- For UI changes, verify in a browser (there is no component-DOM harness).
- Update the matching doc **in the same change**: `docs/scripting-guide.md` for
  anything an author can call, `docs/runtime-internals.md` for architecture /
  internals. When a plan ships, fold its durable bits (backlog → `plans/PLAN.md`,
  architecture → internals) and delete the plan file.
- **Added or changed a control, property or script API member? Update the
  capability manifest in `@toolback/format` and bump `CAPABILITY_VERSION`** — see
  *AI authoring surface* below. The AI prompt and its drift tests read from it.

## AI authoring surface — keep it in sync

The editor's **AI panel** generates books from a model. Its factual tables are
built at request time from the **capability manifest** in
`packages/format/src/index.ts`:

- `CONTROL_PROPS: Record<ControlKind, PropSpec[]>` — every control kind and the
  props it accepts (type, enum, default, `scriptable`, doc).
- `SCRIPT_API` — the runtime script API (`store`, `page`, `controls`, `event`,
  `target`, `self`, `forward`, `author`).
- `CAPABILITY_VERSION` — stamped into the prompt; bump it when either changes.

`apps/editor/src/ai.ts` (`manifestText`/`styleGuide`) and
`apps/editor/src/aiPrompt.ts` build the model prompt from this; `validateBook`
uses `CONTROL_PROPS` to flag unknown props; `capabilities.test.ts` guards drift.

**When you add or change a control, a property or a script API member, edit the
manifest in the same change.** Also update `docs/llm-authoring.md` if the book
JSON shape, geometry, or examples change, and `docs/scripting-guide.md` for
authors. New script variables must also follow
[`docs/runtime-internals.md` §10.3](docs/runtime-internals.md).

## Conventions

- Do **not** add comments unless asked; match the surrounding style.
- User scripts are plain JavaScript (`new Function` bodies) — never TypeScript
  syntax, no type annotations.
- Book data and schemas live in `@toolback/format`; runtime code is framework-
  free; Vue/Pinia only in `apps/editor`.
- The book is the single source of truth; every content mutation goes through the
  editor store and ends in `sync()`, which re-renders the canvas.

## Invariants to preserve

Full list in [`docs/runtime-internals.md` §10](docs/runtime-internals.md); the
ones most easily broken:

- **The persisted shape is versioned.** `Book.formatVersion` (`FORMAT_VERSION`
  in `@toolback/format`) is the baseline: `parseBook` stamps it, rejects a book
  from a newer version, and runs the ordered `MIGRATIONS` chain for an older one
  (there is no pre-v1 migration — `rect`/`canvas` books are unsupported). When you
  change the stored shape, bump `FORMAT_VERSION` and add a migration step in the
  same change.
- **Edge distances are the stored geometry.** `PageObject.x`/`.y` store the
  fixed distance(s) to the page (or parent-group) edges a control follows:
  `left`+`width`, `right`+`width`, `both`, or `center` (and the vertical
  equivalents) — the internal data behind the user-facing **Responsive** section
  in the properties panel (the Horizontal/Vertical dropdowns —
  `apps/editor/src/components/PropertiesPanel.vue`) and the "spring" language in
  the docs. `resolveX`/`resolveY` (via `rectForObject`) derive a rect against the
  containing box and `applyEdgeStyles` writes it straight to CSS, so the browser
  repositions controls on resize with no re-render. Never bake a resolved rect
  back into `x`/`y`; deliberate geometry writes (drag, typed X/Y/W/H, script
  setter, author bridge) keep the mode through `writeRectPart`. There is no
  per-object margin — an object's outer space is its edge distance.
- **A fluid page's extent is driven only by near edges.** `resolvePageBox` grows
  the page past the viewport with `contentExtent`, which counts only objects
  following left/top. Right/bottom/both/centred objects sit inside the page box
  (that is what makes "follows bottom" mean N from the page's bottom edge).
  `Page.padding` (fluid pages) adds trailing space on the right/bottom so content
  never sits on the auto edge; it is masked when the window is already bigger. A
  fluid page uses `width:100%` + content `min-width`/`min-height`; the editor
  wrapper toggles `.tb-canvas-root--fluid` so it spans the viewport.
- **A group scales when you size it, not when the page reflows.** Each member
  carries its own `x`/`y` against the group box. A handle drag (and a typed W/H
  or a scripted `group.width`/`height`) scales every descendant's edges
  (`scaleSubtreeEdges`) around the fixed corner; a page/window resize just
  re-resolves each member's own edges in CSS, with no scaling.
- **Pinia proxies are not structured-cloneable** — the book always crosses the
  iframe as `JSON.parse(JSON.stringify(book))`.
- **Page ↔ background share one naming namespace** (`controls[name]`).
- Group handlers are reached only through the owner-chain dispatch, never by
  attaching listeners to group wrappers.

## Docs map & screenshots

- `docs/scripting-guide.md` — author-facing, rendered in-app (`?raw` import); the
  single source to edit for API docs.
- `docs/llm-authoring.md` — model-facing book authoring spec (canonical format,
  geometry, examples); the AI panel appends a control/API table generated from
  the `CONTROL_PROPS`/`SCRIPT_API` manifest in `@toolback/format`.
- `docs/runtime-internals.md` — deep architecture, protocol tables, invariants.
- `docs/screenshots/` — committed images that docs/README reference.
- `plans/` — internal plans. Each carries a `Status:`. Implemented plans are
  deleted after their durable content is folded into `docs/` + `plans/PLAN.md`.
- **Browser/Playwright screenshots:** write them to `./playwright-screenshots/`
  (gitignored) — do not commit session output. Only intentional, referenced
  images belong in `docs/screenshots/`. (`.playwright-mcp/` is also gitignored.)

## Gotchas

- **Stale canvas bundle:** the canvas iframe pre-bundles `@toolback/runtime` via
  Vite, so a long-running dev server can serve a stale runtime next to a fresh
  editor. Symptom: the editor side hot-reloaded but the canvas behaves like an
  old build — e.g. design-time store values never resolve at design **or** run
  time (while a runtime `store.set` still updates labels), or store edits don't
  survive refresh. Fix: restart `pnpm dev` (or run Vite with `--force`) and
  hard-refresh. `canvasClient` now reloads the iframe whenever an HMR update
  touches `packages/runtime`/`packages/format`/`src/canvas.ts`, which prevents
  the mixed editor+canvas case — but a fully stale tab still needs the manual
  restart + hard refresh.
- **Plain JS only** in the script editors (see conventions); the editor flags TS
  annotations with a squiggle but the runtime would throw at compile time.
