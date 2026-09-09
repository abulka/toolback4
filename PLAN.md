# toolback v4 — Plan & Progress

A modern ToolBook spiritual successor: book → pages → objects, authored visually,
scripted in plain JavaScript. Fourth attempt — informed by the post-mortem of
`../pyinvent`, `../toolback`, `../toolback-lite`, `../toolback-lite-vue3`
(those folders are archived reference material; salvage ideas, not code).

**Status: M0 complete — M1 (authoring loop) is next**
(see [Milestones](#milestones) and [Progress log](#progress-log)).

---

## Goal & locked decisions

Personal joy project (nostalgia + fun). Not a product; multiplayer/SCORM/analytics are
non-goals for now.

| Decision | Choice | Why |
|---|---|---|
| Framework | Vue 3 + Vite + TS | Continuity with prior attempts; known well |
| Layout model | Absolute position + breakpoints | Least painful approach across all attempts (pyinvent proved it); grid libraries stalled two attempts |
| Persistence | Local-first: `.toolbook.json` file + IndexedDB autosave | No backend for v1; Redis/S3/Firebase killed attempt #2 |
| Canvas | Sandboxed same-origin iframe | Editor survives broken user scripts; design/run isolation (toolback's F3 pattern) |
| Drag layer | Custom, pointer-events, zero drag-drop deps | Both prior stalls were grid-library internals (`calcXY`, `@noction` fork) |

## Architecture

pnpm monorepo. Dependency direction: `format ← controls ← runtime ← editor`.

```
toolback4/
├── packages/
│   ├── format/      # Book/Page/Object zod schemas + factories. Zero runtime deps beyond zod.
│   ├── controls/    # Control renderers (plain DOM + CSS design tokens): button, label, input, image, card, container
│   └── runtime/     # Player. Plain DOM, NO Vue. Renders JSON, runs scripts, editor message protocol.
└── apps/
    └── editor/      # Vue 3 + Pinia + Monaco(M2). Palette | iframe canvas | properties.
```

### Data model (packages/format)

```ts
Book    { id, title, canvas{desktop{w,h}}, pages: Page[] }
Page    { id, name, script, background, objects: PageObject[] }
PageObject {
  id, name,                       // name = unique per page, the `controls[name]` handle
  control: 'button'|'label'|'input'|'image'|'card'|'container',
  rects: { desktop: Rect, tablet?: Rect, mobile?: Rect },
  props: Record<string, unknown>, // control-specific (e.g. { text })
  on: Record<string, string>,     // eventName -> script
}
```

Schema is stable from day one; renderers for the 6 controls fill in across milestones.

### Runtime & scripting

- Scripts run via `new Function` inside the canvas iframe with an injected API:
  `page`, `controls.<name>`, `store.get/set` (reactive; powers `{{key}}` dynamic labels),
  plus real `fetch`/async-await for free.
- Event wiring: explicit `on: {}` per object **plus** the validated "top-level
  `function click()` = event" sugar (regex-scan; see salvage list).
- Design-time input suppression: `pointer-events: none` on canvas content; editor
  overlay captures pointer events (replaces toolback's `eventPause.js` hack).

### Persistence & export

- Open/save single `.toolbook.json` via File System Access API; IndexedDB autosave.
- Publish (M4) = one-click standalone HTML (runtime + embedded JSON), all in-browser.

## Salvage list (references in archived attempts)

| Idea | Where |
|---|---|
| Function-name = event convention | `../toolback/src/script-editing/user-script-helpers.js` |
| Design/run iframe toggle + `run`/`design` events | `../toolback/src/build.js:146-186` |
| Author/run ESC-toggle UX | `../pyinvent/pyinvent.py:269-305` |
| Dynamic `{{key}}` label bindings | `../toolback-lite/src/utils/dyno.js` |
| **What to avoid** | grid library internals; backend infra; GrapesJS style manager |

## Milestones

Each milestone ends with a demo you actually build *in* the tool.

### M0 — Skeleton
- [x] pnpm monorepo: format / controls / runtime / editor
- [x] format: zod schemas, factories, sample book, tests
- [x] controls: button + label renderers, design tokens
- [x] runtime: renderBook on breakpoint rect, editor↔canvas message handshake, tests
- [x] editor shell: header / palette / iframe canvas / properties / status bar
- [x] Demo: "hello world" button + label render in iframe from JSON

### M1 — Authoring loop
- [ ] Custom drag layer: palette → canvas drop, move, 8px-grid snap
- [ ] Selection overlay + resize handles (editor-side, pointer capture)
- [ ] Property panel (text, position/size per breakpoint)
- [ ] Remaining control renderers: input, image, card, container
- [ ] Demo: build a form layout by hand

### M2 — Scripting
- [ ] Monaco script editor (object events + page script)
- [ ] Run/design toggle (F3-style) in iframe; scripts via `new Function`
- [ ] `controls.<name>` API, `store`, function-name sugar, `{{key}}` labels
- [ ] Demo: counter button + live label

### M3 — Book
- [ ] Page navigator, add/remove/duplicate pages
- [ ] `page.go('name')`, onPageEnter/Leave
- [ ] Save/open `.toolbook.json` (File System Access), IndexedDB autosave, recent books
- [ ] Demo: 2-page quiz with score

### M4 — Publish
- [ ] One-click standalone HTML export (runtime + JSON blob)
- [ ] Breakpoint preview (desktop/tablet/mobile switcher)
- [ ] Demo: quiz exports, runs by double-clicking the file

## Explicit v1 non-goals (roadmap, not scope)

Multiplayer, SCORM/xAPI, Electron/PWA packaging, 3D/Lottie/maps, theming system,
reusable widget/component library, version history, AI helpers, analytics.

## Risks

- **M1 editor chrome is the biggest single build item** — it's custom, so no library can stall it; budget attention there first.
- **Scope creep** — the milestone demos are the fence. A feature is in scope when a demo needs it.

## Progress log

- **2026-09-09** — Post-mortem of all four prior attempts completed; plan written; M0 scaffolded and verified.
- **2026-09-09** — **M0 complete.** Monorepo + format/controls/runtime/editor all green: 9/9 vitest, tsc + vue-tsc clean, vite production build ok. Editor↔canvas handshake verified in a real browser (screenshot: `doco/m0-demo.png`). One lesson captured: Pinia reactive proxies are not structured-cloneable — book crosses the iframe boundary as a plain JSON copy (`apps/editor/src/canvasClient.ts`). Next: M1 authoring loop (drag layer, selection, properties).
