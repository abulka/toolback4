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
examples/           ready-made .toolbook.json books; a test runs every page of every book
docs/               scripting-guide.md, runtime-internals.md, screenshots/
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

- **The responsive "glue" (`fit`) is a render lens, never a write.**
  `PageObject.fit` (`x`/`y` modes: free/left/top · right/bottom · center ·
  stretch) is the internal data behind the user-facing **Responsive** section in
  the properties panel (the Horizontal/Vertical dropdowns —
  `apps/editor/src/components/PropertiesPanel.vue:419`) and the "glue"/"spring"
  language in the docs. It is declarative: `resolveObjectRect` is the only source
  of rects at render/read time and never touches `rect` (the one authored
  layout). Never bake a lensed rect back into `rect` — that freezes the glue, so
  later breakpoints derive from an already-derived value. Deliberate geometry
  writes (drag, typed X/Y/W/H, script setter, author bridge) fold the rendered
  target back through `unlensObjectRect` onto the base `rect`.
- **Group members are relative.** Fit is top-level only; a group's box carries
  the glue and members ride/scale with it.
- **Pinia proxies are not structured-cloneable** — the book always crosses the
  iframe as `JSON.parse(JSON.stringify(book))`.
- **Page ↔ background share one naming namespace** (`controls[name]`).
- Group handlers are reached only through the owner-chain dispatch, never by
  attaching listeners to group wrappers.

## Docs map & screenshots

- `docs/scripting-guide.md` — author-facing, rendered in-app (`?raw` import); the
  single source to edit for API docs.
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
  old build. Fix: restart `pnpm dev` (or run Vite with `--force`) and hard-refresh.
- **Plain JS only** in the script editors (see conventions); the editor flags TS
  annotations with a squiggle but the runtime would throw at compile time.
