# toolback v4 — Plan & Progress

A modern ToolBook spiritual successor: book → pages → objects, authored visually,
scripted in plain JavaScript. Fourth attempt — informed by the post-mortem of
`../pyinvent`, `../toolback`, `../toolback-lite`, `../toolback-lite-vue3`
(those folders are archived reference material; salvage ideas, not code).

**Status: M0 + M1 + M2 + M3 complete — M4 (publish) is next**
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

## Documentation conventions

- **`docs/scripting-guide.md` is the canonical scripting reference** — the in-app `?` buttons
  (next to "Page script" and "Script") open it rendered as HTML, jumping to the relevant
  section. It is imported into the editor via Vite `?raw`, so the file in `docs/` is the
  single source to edit.
- **Keep it current**: any change to the scripting API (`store`, `controls`, `page`, events,
  dynamic labels) must update the guide in the same milestone.

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
- [x] Custom drag layer: palette → canvas drop, move, 8px-grid snap
- [x] Selection overlay + resize handles (in-canvas design controller, pointer capture)
- [x] Property panel (content props + X/Y/W/H per object, delete)
- [x] Remaining control renderers: input, image, card, container
- [x] Demo: built a sign-up form layout by hand (card + label + input + button)

### M2 — Scripting
- [x] Monaco script editor (object events dropdown + page script) with syntax highlighting
- [x] Run/design toggle (F3-style, same iframe); scripts via `new Function` in the sandbox
- [x] `controls.<name>` API (text/value/visible/enabled/on), reactive `store`, `{{key}}` dynamic labels
- [x] Page-script shared functions callable directly from object scripts (function-name sugar via regex scan)
- [x] `pageEnter()` lifecycle hook; script errors surfaced in the editor status bar
- [x] Demo: counter — pageEnter seeds 100, button increments, label shows `Count: {{count}}` live

### M3 — Book
- [x] Page navigator (add / duplicate / rename via double-click / delete, per-page editing)
- [x] `page.go('name')`, `page.names`, `pageEnter`/`pageLeave` per page; shared store across the run
- [x] IndexedDB autosave (debounced, restores on load), recents list (Save/Open/Recent… menu)
- [x] `.toolbook.json` save/open via File System Access API with download/input fallback
- [x] `docs/scripting-guide.md`: pages & navigation fully documented (API, lifecycle, quiz recipe) + `?` button on the Pages panel
- [x] Demo: 2-page quiz (Quiz → Paris/London/Berlin → Results with `Score: {{score}} - {{verdict}}` → Play again) built and played through the UI

### M4 — Publish
- [ ] One-click standalone HTML export (runtime + JSON blob)
- [ ] Breakpoint preview (desktop/tablet/mobile switcher)
- [ ] Demo: quiz exports, runs by double-clicking the file

## Explicit v1 non-goals (roadmap, not scope)

Multiplayer, SCORM/xAPI, Electron/PWA packaging, 3D/Lottie/maps, theming system,
reusable widget/component library, version history, AI helpers, analytics.

## Backlog (requested, post-M3)

- **Z-order control** — bring to front / send to back / nudge forward / backward
  per object (needs a `z` field in the format or explicit array-order controls).
- **Multi-select** — shift/ rubber-band selection, group move (and group resize?),
  group delete; selection model must move from single id to id sets.
- **Group scripts** — attach scripts to groups of objects (depends on a grouping
  model; also unlocks shared behaviours across a group).

## Risks

- **M1 editor chrome is the biggest single build item** — it's custom, so no library can stall it; budget attention there first.
- **Scope creep** — the milestone demos are the fence. A feature is in scope when a demo needs it.

## Progress log

- **2026-09-09** — Post-mortem of all four prior attempts completed; plan written; M0 scaffolded and verified.
- **2026-09-09** — **M0 complete.** Monorepo + format/controls/runtime/editor all green: 9/9 vitest, tsc + vue-tsc clean, vite production build ok. Editor↔canvas handshake verified in a real browser (screenshot: `doco/m0-demo.png`). One lesson captured: Pinia reactive proxies are not structured-cloneable — book crosses the iframe boundary as a plain JSON copy (`apps/editor/src/canvasClient.ts`). Next: M1 authoring loop (drag layer, selection, properties).
- **2026-09-09** — **M1 complete.** Full authoring loop verified interactively in a browser (screenshot: `doco/m1-demo.png`): palette→canvas drag-drop with 8px snap, click-to-select across the iframe boundary, live property editing, drag-move, SE-handle resize (min-size clamp), delete, auto-naming (`button1`, `card1`…), z-order via object order. 22/22 vitest, typecheck + build clean. Two lessons captured:
  1. **iframe event boundary**: pointermove/pointerup over the canvas dispatch inside the iframe document, so editor-side window listeners never fire. Fixed with `setPointerCapture` on the palette element (`apps/editor/src/paletteDrag.ts`) — capture retargets events across the boundary; this is the trick that makes custom (library-free) drag work.
  2. **Architecture validated**: the design controller lives inside the canvas (`packages/runtime/src/design.ts`), the editor stays the single source of truth, and the only sync message is `toolback:load` (full book + selection). Move/resize commits flow canvas→store→sync-back (idempotent). No coordinate conversion, no scale math, no library internals — the failure mode that killed attempts #3 and #3.5 did not recur.
  Known micro-risk: an editor sync arriving mid-drag would break the drag (acceptable; syncs happen only on commit). Next: M2 scripting (Monaco, run/design toggle, `controls.` API, store, function-name sugar).
- **2026-09-09** — **M2 complete.** The tool now runs real JavaScript. Verified in-browser (screenshot: `doco/m2-demo.png`): attached `store.set("count", …)` to a button's click via the Monaco event editor, bound a label with `Count: {{count}}`, added `pageEnter()` in the page script, hit Run — label showed `Count: 100` immediately, incremented on every click, Stop returned to design with the selection chrome intact. Script errors surface in the status bar. 30/30 vitest, typecheck + build clean; Monaco lazy-loads on first editor mount. Design notes:
  - Object scripts live in `on[event]` (per-event dropdown); page script holds shared `function name()` definitions that object scripts call directly — the toolback-lite pattern that validated, now with proper multi-event support.
  - Run mode = same iframe, `design:false` in the load message: player compiles scripts (`new Function`, injected `api`), wires events, resolves `{{key}}` labels against the reactive store, and unwinds everything on stop.
  - Two bugs found and fixed by the acceptance run: (1) `canvasClient.sendLoad` hardcoded `design:true` from M1 — the store's sync flag was dead code; (2) Monaco auto-bracket-pairing + scripted blind typing produced a stray `}` (a human watching the screen wouldn't hit it; kept auto-pairing, adjusted the test).
  Next: M3 — page navigator, `page.go()`, save/open `.toolbook.json`, autosave.
- **2026-09-09** — **Live drag-out preview shipped.** Dragging from the palette now renders the **real control** inside the canvas, gliding under the cursor with 8px snap and a dashed placement outline (screenshot: `doco/drag-preview.png`); the editor-side ghost chip auto-hides while over the canvas. Drop commits the object at exactly the ghost's rect — one operation, zero repositioning. ESC cancels mid-drag; palette drag is disabled while running. Mechanics: the editor streams `toolback:dragOver {control, rect}` messages into the iframe (rAF-throttled; pointer capture from M1 makes this cross-document), the design controller renders/moves a `tb-ghost` phantom built from the real control renderers with `DEFAULT_PROPS` (now shared via `packages/format`), and the drop's `addObject` sync seamlessly swaps ghost → real object at the same rect. Verified in-browser: ghost is a real button mid-drag, drop lands at the exact ghost rect, ESC cancels cleanly. 34/34 vitest, typecheck + build clean. Next: M3 — pages, `page.go()`, save/open, autosave.
- **2026-09-10** — **M3 complete: multi-page books + persistence.** Verified end-to-end in-browser (screenshot: `doco/m3-demo.png`): built a 2-page quiz through the UI — Quiz page (question label, Paris/London/Berlin buttons with scripts `store.set("score", …); page.go("Results")`, `pageEnter` seeds score), Results page (`Score: {{score}} - {{verdict}}` label, `pageEnter` sets verdict, Play again button `page.go("Quiz")`) — then ran it: Paris → "Score: 1 - Nice!", Play again → Quiz, London → "Score: 0 - Try again". Runtime: `runBook` now drives multi-page navigation (`page.go` fires `pageLeave` → re-renders page → rebuilds controls/scripts → fires `pageEnter`; store persists across pages; unknown page names report an error and stay put; `startPageIndex` supported; `Run` plays the page being edited). Editor: Pages panel (click to switch, double-click rename, ⧉ duplicate-with-objects, ✕ delete, + Add), file bar (New / Open… / Save via File System Access API with automatic download/input fallbacks), debounced IndexedDB autosave that restores on reload, recents menu. Scripting guide rewritten with the pages/navigation API + quiz recipe; `?` on the Pages panel opens it. Fixes found by acceptance: template-ref-in-v-for broke rename autofocus (array ref); Monaco auto-closing brackets turned scripted inserts into syntax errors — disabled (`autoClosingBrackets: 'never'`) since it also confuses beginners. 37/37 vitest, typecheck + build clean. Notes: autosave is session crash-recovery (New overwrites it — recents only lists Saved/Open'ed books); a "New discards unsaved changes" confirm is backlog-worthy. Next: M4 — one-click standalone HTML export + breakpoint preview.
- **2026-09-09** — **Scripting guide + in-app help shipped.** `docs/scripting-guide.md` is the canonical reference (API: `store` / `controls.<name>` / `page` / `event`, object vs page scripts, `{{key}}` labels, six copy-paste recipes, debugging, sandbox notes, and an honest "pages are coming in M3" stub). `?` buttons next to "Page script" and "Script" open the guide rendered as HTML (imported via Vite `?raw`, rendered with `marked`, heading anchors scroll to the right section). Enabling improvements made while documenting: object event scripts and `pageEnter()` are now async — `await fetch(...)` works directly in any script (`player.ts`, +3 tests); `async function` declarations are recognized by the function-name sugar (regex bug found by the new tests); `input` (per-keystroke) added to the event dropdown. Verified in-browser: both `?` buttons open/scroll/close correctly, and the guide's "echo an input as you type" recipe works verbatim when built through the UI (screenshot: `doco/scripting-guide-popup.png`). 33/33 vitest, typecheck + build clean.
