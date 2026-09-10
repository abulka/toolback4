# toolback v4 — Plan & Progress

A modern ToolBook spiritual successor: book → pages → objects, authored visually,
scripted in plain JavaScript. Fourth attempt — informed by the post-mortem of
`../pyinvent`, `../toolback`, `../toolback-lite`, `../toolback-lite-vue3`
(those folders are archived reference material; salvage ideas, not code).

**Status: M0 + M1 + M2 + M3 + M4 complete — v1 loop finished; backlog next**
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
- [x] RHS panel splitter (drag to resize 260–640px, double-click resets, persisted in localStorage)
- [x] One-click standalone HTML publish (player bundle via esbuild + embedded `<`-escaped book JSON; File System Access save with download fallback)
- [x] Breakpoint preview switcher (desktop/tablet/mobile; pre-M4 books upgraded with default sizes on switch)
- [x] Demo: quiz published to a single `Nav-Bug.html`, served standalone, played end-to-end (page render → `page.go` → `pageEnter` effects → store-bound label)

### M5 — Z-order, multi-select & groups
- [x] Z-order: sibling-array order is paint order; Arrange buttons (front/forward/backward/back) + ⌘[/⌘] shortcuts (canvas-focused too)
- [x] Multi-select: id-set selection model, shift-click, rubber-band marquee, group move (batched commits), multi-delete (Delete key)
- [x] Groups: recursive `children` in the format, invisible wrapper rendering, click selects group (alt/double-click enters), scaled group resize, group/ungroup commands (same-parent rule), nested groups
- [x] Group scripts: group `on` handlers bubble from members (event.target = member), group rect/visible as ControlApi, members stay script-addressable, IntelliSense includes members
- [x] Demo: grouped the kitchen-sink Box card + its buttons; one shared click script on the group; animated the group with `x/y`

## Explicit v1 non-goals (roadmap, not scope)

Multiplayer, SCORM/xAPI, Electron/PWA packaging, 3D/Lottie/maps, theming system,
reusable widget/component library, version history, AI helpers, analytics.

## Backlog (requested, post-M3)

- **Z-order control** — ✅ shipped in M5 (sibling-array order + Arrange buttons/shortcuts)
- **Multi-select** — ✅ shipped in M5 (shift-click + marquee + group move/delete; group resize deferred — resize scales groups instead)
- **Group scripts** — ✅ shipped in M5 (groups are parent objects; DOM bubbling powers group handlers)

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
- **2026-09-10** — **Scripting fixes from first real user session.** Two reports, both fixed and verified in-browser against a seeded copy of the user's own book:
  1. **Bare object names now work in scripts** — `button2.text = 'fred'` in a page script previously threw `ReferenceError: button2 is not defined`. Object names are now auto-destructured into every script scope (page scripts and object event scripts) as shorthand for `controls.<name>`. Collision rules: names that collide with the page's own function declarations or the API (`page`, `controls`, `store`, `event`) are excluded so nothing is shadowed; a missing name yields a clearer `Cannot set properties of undefined` instead of `ReferenceError`. Guide updated (shorthand documented in the controls + names sections). +3 player tests.
  2. **`pageEnter` double-fire investigated** — unit tests proved the player fires exactly once per navigation (new `pagelifecycle.test.ts`), and a seeded in-browser replay of the exact user flow confirmed a single fire (`enterCount: 1`, one console line). The double the user saw is consistent with stacked `message` listeners from a hot-reload mid-session (each `wireCanvas` mount adds a window listener; two listeners ⇒ two `runBook` compilations ⇒ two fires with different VM ids, matching the console evidence). Hardened: `wireCanvas` is now idempotent, so duplicate editor-side listeners are structurally impossible. Also hardened `persist.ts openDb` (creates the `kv` store even when the DB exists at the same version without it — found while seeding).
  Backlog noted: the editor's page indicator doesn't follow in-run `page.go` navigation (status still shows the page you ran from). 42/42 vitest, typecheck + build clean.
- **2026-09-10** — **Script editor IntelliSense + `{{key}}` completions.** Script editors now have full autocomplete: Ctrl+Space lists objects, the API, and template snippets; typing `.` lists an object's members (`text/value/visible/enabled/on/el` with JSDoc tooltips); curated snippets (`pageEnter`, `store.set/get`, `page.go`, `input-to-store`, `fetch-to-store`, …) expand with tab stops; and **live error squiggles** catch syntax errors (stray `}`) before Run. In any Text property, typing `{{` opens a book-wide store-key picker (keys harvested from all `store.set` calls and existing `{{key}}` templates via a live-updating collector), inserting with auto-closed braces. Implementation: `monacoApiLib.ts` generates a per-page TypeScript extra-lib from the book — single source of truth via the runtime's exported `shortNamesFor` (editor completions exactly match runtime bare-name bindings: page-scoped, API-reserved names excluded, page-function collisions excluded); `monacoApi.ts` registers the lib/snippets/diagnostics once on the shared Monaco instance and hot-swaps the lib (debounced) as the book changes; `DynamicTextEditor.vue` is the `{{key}}`-aware text field. Runtime tweak: an object's own bare name is now also usable in its own scripts (+1 test). Verified in-browser: `button2.` lists members, `store.` lists get/set, snippets expand, `{{` lists keys and inserts cleanly (incl. auto-close when `}}` already typed), stray `}` squiggles while valid scripts stay clean. Bare-name typos intentionally don't squiggle (JS permits implicit globals) — completions only offer valid names and Run still reports undefined-name errors in the status bar. Guide: new "Autocomplete and error squiggles" section. 48/48 vitest, typecheck + build clean. Next: M4 — publish + breakpoint preview.
- **2026-09-10** — **IntelliSense rebuilt after user report (broken UX).** The first cut had Monaco's TS-worker completions enabled: the list was flooded with ~2000 DOM globals (AbortController/unescape/status…), buried toolback items, rendered above line 1 clipped by the editor's overflow, and rows were unreadable (unthemed widget). Rebuilt: worker completions disabled via `setModeConfiguration({ completionItems: false, … })` (diagnostics/hovers kept); one curated provider now supplies everything — bare object names + API + snippets top-level, per-receiver member lists (`store.`/`page.`/`controls.`/`event.`/`<object>.`), and `{{` in scripts offers store keys inserting `store.get('key')` with the `{{` auto-removed. Root-cause find of the session: **Monaco silently discards suggestions whose replacement range covers non-word characters** (proved with an isolated experiment — `{{`-spanning ranges ⇒ empty widget, caret ranges ⇒ items appear); fixed by caret-anchored ranges + `additionalTextEdits` removing the `{{` prefix. Readability fixed with suggest-widget theme colors + `fixedOverflowWidgets` + explicit CSS fallbacks (verified white readable rows in a screenshot, `doco/intellisense-fixed.png`). `wordBasedSuggestions: 'off'` + `suggestSelection: 'first'` so Tab takes the preselected toolback item. Verified in-browser: empty line-1 Ctrl+Space shows 13 curated readable rows; Tab inserts `button2`; `button2.` lists 7 members; `{{`+Enter produces `store.get('enterCount')`; page script popup drops downward; squiggles fire on a stray `}` and clear on valid code. 49/49 vitest, typecheck + build clean.
- **2026-09-10** — **Docs fix:** the "Pages and navigation" section of `docs/scripting-guide.md` still contained the stale "Coming in M3" stub — the M3 rewrite edit had silently failed (oldString mismatch) and was missed. The section now documents the Pages panel (switch / rename / duplicate / delete), the `page` API (`name`, `names`, `go` + error behaviour), `pageEnter`/`pageLeave` lifecycle, the cross-page store, and the quiz recipe; Sandbox notes updated (store spans pages within a run). Verified rendered in the in-app help popup (Pages `?` opens at the right anchor). Process takeaway: when a guide-section edit is part of a milestone, re-grep the guide for stale stubs before closing the milestone — now done (no other stale text remains).
- **2026-09-10** — **M3 complete: multi-page books + persistence.** Verified end-to-end in-browser (screenshot: `doco/m3-demo.png`): built a 2-page quiz through the UI — Quiz page (question label, Paris/London/Berlin buttons with scripts `store.set("score", …); page.go("Results")`, `pageEnter` seeds score), Results page (`Score: {{score}} - {{verdict}}` label, `pageEnter` sets verdict, Play again button `page.go("Quiz")`) — then ran it: Paris → "Score: 1 - Nice!", Play again → Quiz, London → "Score: 0 - Try again". Runtime: `runBook` now drives multi-page navigation (`page.go` fires `pageLeave` → re-renders page → rebuilds controls/scripts → fires `pageEnter`; store persists across pages; unknown page names report an error and stay put; `startPageIndex` supported; `Run` plays the page being edited). Editor: Pages panel (click to switch, double-click rename, ⧉ duplicate-with-objects, ✕ delete, + Add), file bar (New / Open… / Save via File System Access API with automatic download/input fallbacks), debounced IndexedDB autosave that restores on reload, recents menu. Scripting guide rewritten with the pages/navigation API + quiz recipe; `?` on the Pages panel opens it. Fixes found by acceptance: template-ref-in-v-for broke rename autofocus (array ref); Monaco auto-closing brackets turned scripted inserts into syntax errors — disabled (`autoClosingBrackets: 'never'`) since it also confuses beginners. 37/37 vitest, typecheck + build clean. Notes: autosave is session crash-recovery (New overwrites it — recents only lists Saved/Open'ed books); a "New discards unsaved changes" confirm is backlog-worthy. Next: M4 — one-click standalone HTML export + breakpoint preview.
  - Run mode = same iframe, `design:false` in the load message: player compiles scripts (`new Function`, injected `api`), wires events, resolves `{{key}}` labels against the reactive store, and unwinds everything on stop.
  - Two bugs found and fixed by the acceptance run: (1) `canvasClient.sendLoad` hardcoded `design:true` from M1 — the store's sync flag was dead code; (2) Monaco auto-bracket-pairing + scripted blind typing produced a stray `}` (a human watching the screen wouldn't hit it; kept auto-pairing, adjusted the test).
  Next: M3 — page navigator, `page.go()`, save/open `.toolbook.json`, autosave.
- **2026-09-10** — **Splitter + M4 publish shipped (v1 loop complete).** RHS properties panel got a real splitter (4-column grid, pointer-capture drag, 260–640px clamp, double-click reset, persisted in localStorage) — verified in-browser (330→420 on drag, reset on double-click). M4: `packages/runtime/src/player-entry.ts` self-plays an embedded book; esbuild bundles it to `public/toolback-player.js`; `buildStandaloneHtml` produces a single self-contained `.html` (book JSON with `<` escaped so `</script>` in strings can't break out) saved via File System Access API with download fallback; breakpoint switcher (desktop/tablet/mobile) resizes the canvas and upgrades pre-M4 books with default sizes. Acceptance ran the whole loop: Publish → single `Nav-Bug.html` → served standalone → clicked through page render → `page.go` → `pageEnter` effects → store-bound label. All 9 packages/apps green (52/52 vitest), typecheck + build clean. v1 milestone arc (M0–M4) complete.
- **2026-09-10** — **Scripted geometry + example books (first two backlog items).**
  1. **`x`/`y`/`width`/`height` on every object, in scripts and in Ctrl+Space.** `ControlApi` gained rect getters/setters (backed by the object's per-breakpoint rect): writing updates the wrapper style live *and* the underlying book data, so changes survive `page.go` re-renders for the whole run; sizes clamp to ≥1px, non-finite values are ignored; writing on a breakpoint without its own rect creates it and leaves the desktop rect untouched. The IntelliSense lib (`TBControl` JSDoc) and the curated member list now offer the four properties (screenshot: `doco/rect-intellisense.png`), and the scripting guide documents them with a move/resize recipe + hop animation recipe.
  2. **`examples/` with three runnable books** — `hello-counter` (pageEnter + click script + `{{count}}`), `quiz` (two pages, `page.go`, cross-page store), and `kitchen-sink` (all six controls; all six events; `{{key}}` labels; scripted `x/y/width/height`/`visible`/`enabled`; shared page function; `page.names`; an `await`-based drop-in animation on a second page driven from `pageEnter`; `pageLeave` recording a visit; `Math.random` geometry). `examples/README.md` explains how to open them. New `examples/examples.test.ts` (glob added to vitest include) parses every `.toolbook.json` against the zod schema, checks name uniqueness/identifier validity, and **runs every page of every book** asserting zero script errors — examples can't silently rot.
  Acceptance in-browser (screenshots: `doco/kitchen-sink-run.png`): kitchen-sink opened from disk, `box.` lists the four new members with JSDoc; Run → Nudge×2 + Grow moved the box 640→688 / 240×140→260×150, hide/unhide, Lock click disabled the counter button, Reset demo (shared function) restored everything, Playground → animation landed at y=200, back → "You left this page before: true" via `pageLeave` + shared store. 69/69 vitest, typecheck + build clean.
- **2026-09-10** — **Kitchen-sink feedback fixes.** (1) The infoCard's body text literally contained `{{key}}` as prose about the feature — the dynamic-label engine read it as a binding for an unset store key and rendered it as empty (user report). Reworded to `{{...}}`, which the engine leaves alone (regex requires word chars between the braces), so the syntax now displays as intended; new player test pins the rule: **unset keys render empty, non-word `{{...}}` renders literally**. (2) Confirmed the click button's double-click reset is intentional (multi-event demo, on-screen hint says so) and verified in-browser that a real double-click runs click→click→dblclick, netting `Clicks: 0`. 73/73 vitest.
- **2026-09-10** — **Scripted-event markers + Run shortcuts (backlog items 3 & 4).**
  1. **Events with active scripts read at a glance** — in the object Script section, the event dropdown now marks scripted events: bold (`option.scripted`, where browsers style option popups) **plus a `•` suffix** (reliable everywhere — macOS Chrome/Safari render native popups that ignore per-option styling). Verified: clickButton's dropdown shows `click •` / `dblclick •` bold, others plain.
  2. **Run-mode shortcuts: `F3` + `⌥3` (Alt+3, no fn-key needed).** New shared `shouldToggleRun` in the runtime (exported): F3 always toggles; ⌥3 toggles except in editable targets (on Mac ⌥3 types `£`); repeats ignored. Editor-side window listener runs in **capture phase + stopPropagation**, so F3 beats Monaco's find-next binding (verified: no find widget opens). Keydowns never cross the iframe boundary, so `listenForEditor` also listens for the keys inside the canvas and posts a new `toolback:runToggle` message — the shortcut works with focus in the canvas, the common case right after clicking Run and playing (verified: F3 while canvas focused stops the run). Run button title now hints "Toggle run mode (F3 or ⌥3)"; guide documents the shortcuts. Published standalone players are untouched (they never wire the listener).
  In-browser acceptance (screenshot: `doco/event-scripts-and-shortcuts.png`): F3 from editor → RUNNING → F3 in canvas → design; ⌥3 in Monaco → stays design (no stray character in scripts); ⌥3 on body → RUNNING; F3 in Monaco → RUNNING with no find widget. 76/76 vitest, typecheck + build clean.
- **2026-09-10** — **Store browser + RHS tabs + panel show/hide (backlog items 5 & 6).**
  1. **Store browser, live.** The canvas now streams store contents to the editor: `ToolbackStore.snapshot()` (new, insertion-ordered entries) + `toolback:store` messages on every store change (initial + `subscribe`; values labelled readably — strings bare, numbers/JSON stringify, `undefined`, `ƒ fnName`). New **Store** tab in the RHS panel (`StoreBrowser.vue`): key/value rows, strings green / values amber, empty-state hints. Clears on Stop and on design loads.
  2. **RHS panel is now tabbed** — Page (title/name/page script) · Selection (properties) · Objects (the list, moved here) · Store. Selecting an object (canvas or list) auto-reveals the Selection tab; the active tab persists in localStorage. Tab bodies use `v-show` so the Monaco editors are never remounted.
  3. **Panel show/hide + settings popup.** Topbar got `◧` / `◨` toggles (persisted) and a `⚙` gear popover (click-outside + Escape close) with a **"Hide panels while running"** preference (default on). Run saves the manual layout and hides both panels; Stop restores exactly what was there before (manual mid-run re-show works; stop always returns to the pre-run layout). Shell grid collapses to `0px 1fr 0px 0px` when both are hidden. Found + fixed by the acceptance run: a bool-pref write/read mismatch (`"false"` written, `!== '0'` read) made toggle persistence dead — now written/read as `'1'`/`'0'`.
  Acceptance in-browser (screenshots: `doco/store-tab-and-tabs.png`, `doco/panels-autohidden-run.png`): store tab live during a run (`where/pages/clicks/who/hover` appearing as interactions happen, cleared on stop); auto-hide collapse + restore; manual toggles persist across reload; mid-run toggle brings the RHS back; Escape/click-outside close the settings popup. 79/79 vitest, typecheck + build clean.
- **2026-09-10** — **M5 complete: z-order, multi-select, groups.** All three backlog items shipped.
  1. **Z-order** = sibling-array order. Arrange row in the Selection panel (⤒/↑/↓/⤓) plus `⌘]`/`⌘[` step and `⌘⇧]/⌘⇧[` front/back — forwarded canvas-side too, so they work with the canvas focused; skipped while typing (Monaco uses ⌘[ for outdent). Delete/Backspace deletes the selection.
  2. **Multi-select**: selection is now an id set end-to-end (store ↔ `toolback:selection {ids}` ↔ design controller). Shift-click adds/removes, rubber-band marquee on empty canvas (intersect, shift adds), dragging any selected object moves all with **one batched commit** (`toolback:commit {objects: [...]}`), delete removes all. Found + fixed during the run: a Pinia proxy array crossed `postMessage` and threw `DataCloneError` — selection arrays are spread to plain JSON on send.
  3. **Groups** are parent objects: recursive `children` in the format (zod `z.lazy`), invisible `.tb-group` wrapper (pointer-events none; members re-enable) — **group handlers fire when any member is clicked** (`event.target` = the member), member handlers fire first. Group drag = one rect update; group resize **scales members proportionally** (live CSS-transform feedback, scaled commits, store converts page-absolute → parent-relative per breakpoint). Group/ungroup commands (same-parent rule, bounding box from union, all breakpoints materialised/rebased); nested groups supported; members keep names, bare-name bindings and Ctrl+Space include them; `text`/`value` inert on groups. Group-first click metaphor; alt-click/double-click enters. Objects list is a tree (members indented). Two in-browser finds: `pointer-events: none` on the group wrapper inherited into members (run-mode clicks fell through — fixed with `.tb-group .tb-object { pointer-events: auto }`), and Ungroup was only reachable in the multi panel (added to the single-group panel).
  Acceptance in-browser (screenshot: `doco/groups-m5.png`): marquee over the kitchen-sink right column → 8-object selection → Group; tree shows group1 with indented members; drag moved the group + members together; group click script fired from a member click (store browser showed `groupClicks: 1`); resize scaled members (116→122px at fx≈1.05); canvas-focused ⌘] reordered the group; alt-click entered; ungroup restored 19 objects with the 8 members re-selected; Backspace deleted a selection. 99/99 vitest, typecheck + build clean. Known limitation (noted in the guide): no undo — group/ungroup/reorder are immediate.
- **2026-09-10** — **Group/polish fixes from the first M5 user session.** Four reports, all fixed and verified in-browser:
  1. **Selection outline now follows the drag** — the design controller's rect map updates live during move (it doubles as the outline source), so the outline tracks mid-drag (verified: 664px → 688px while dragging).
  2. **Selected members move individually.** Once a member is selected (alt-click/double-click), plain clicks keep selecting members of that group instead of bouncing back to the group — dragging then moves the member alone. Ghosts for members are written parent-relative (the design overlay works in page coords); group wrapper untouched (verified: group stays at 640px, member slides to rel 48px). Also hardened: dragging a group excludes its selected members from the batch (no double-move), and `Esc` steps back out to whole-group selection (forwarded canvas-side).
  3. **Ungroup warning** — ungrouping a scripted group asks first: `Ungroup "group1"? Its script (click) will be lost.` (window.confirm; the events are listed).
  4. **`target` in event scripts** — new reserved script variable: the object that received the event as a full ControlApi. In a group script it's the member that was clicked (`console.log('you clicked', target.name)` → logs the member's name); in a member's own script it's the object itself. Page functions named `event`/`target` no longer break script compilation (param list deduped, args aligned). Ctrl+Space offers `target` with the full member list, a `target.` member list, and a `log-clicked-member` snippet; guide documents `target` (its own section) and the Groups section.
  Acceptance in-browser (screenshot: `doco/member-drag-and-target.png`): outline tracked mid-drag; member moved individually (group rect unchanged, member rel 0→48px); group script `store.set('who', target.name)` + member click → store browser showed `who: nudgeButton`; ungroup confirm fired and was accepted (20→19 objects, members re-selected); Esc cleared the selection. Editor autosave restored to the pristine kitchen-sink example afterwards. 104/104 vitest, typecheck + build clean.
- **2026-09-10** — **Group bounds auto-grow + deliberate drill-in (M5 follow-ups).**
  1. **Group bounds always contain their members** — when a member is moved or resized past the group's box, the group rect grows (union, grow-only). If the origin moves (member dragged past the left/top edge) every member shifts by the origin delta so nothing jumps on screen. Recurses through nested groups, and the conversion for nested commits now sums the full ancestor origin chain (a depth-2 bug: the parent's *local* rect was used instead of its absolute origin — found by the nested-expansion test). Verified in-browser: member dragged -200px past the edge → group grew 240→440 with origin 640→488, member exactly at its dragged position.
  2. **Drill-in is now a deliberate act** — the sticky "inside the group" mode is gone; gentle single clicks always select the whole group (verified: two spaced clicks + drag moved the group, member untouched). Entering members requires a concerted double-click (OS double-click timing) or alt-click; while inside, single clicks keep selecting members; empty-canvas click or `Esc` steps back out. Verified in-browser: gentle-clicks → group drag; dblclick → member drag individually.
  Guide updated (Groups section). 106/106 vitest, typecheck + build clean; autosave restored to the pristine example.
- **2026-09-10** — **Group bounds snap to the tight union (grow AND shrink).** User follow-up: the box should be the *minimum* bounds of the members, not grow-only. `expandGroup` now recomputes the exact union of the member rects on every member move/resize — growing when a member moves out, shrinking when members move back in — with the origin-delta shift keeping members visually stable in both directions, and recursion through nested groups. Deleting a member also snaps the remaining bounds tight. Verified in-browser: member dragged -200px → group grew 240→440 (origin 640→440); dragged back → group shrank exactly to {640,96,240×212}, both members at rel 0. Guide wording updated. 107/107 vitest, typecheck + build clean; autosave restored to the pristine example (`doco/group-tight-bounds.png`).
- **2026-09-10** — **Group resize fixed for every handle.** User report: SE worked, other handles produced weird member sizings that escaped the group bounds mid-drag (then mostly self-corrected). Root cause: the live preview resized the group's *layout box* to the ghost AND applied the CSS `scale(fx,fy)` — double-scaling the rendered subtree (visual box = ghost × fx), which the post-commit sync then quietly fixed. Fix: during a group resize the layout box is untouched and the transform alone maps it exactly onto the ghost (fx = ghost/G by definition, origin per handle), so the preview equals the final state for every handle. Commit math rewritten to the canonical fixed-corner origin ('w' keeps the right edge, 'n' the bottom; same origin as the CSS preview), and the post-release transform clear was removed (it flickered the group back to its old size for a frame before the sync re-render). Verified in-browser (NW handle, screenshot: `doco/group-resize-handles.png`): mid-drag layout box unchanged with transform scale(1.26667, 1.18868) = exactly the ghost ratio; after release the members scaled around the fixed bottom-right corner (card right edge pinned at 880, group {576,56,304×252} = the tight union). New unit tests: W and N handle commits with stacked members asserting every member stays inside the ghost and the union equals it. 109/109 vitest, typecheck + build clean; autosave restored to the pristine example.
- **2026-09-11** — **Undo/redo shipped** (the last M5 known limitation). Whole-book snapshot history in the editor store: every content mutation records a pre-mutation deep clone of the book *plus* selection + page index (so undoing a delete brings the objects back selected, undoing a page delete restores the active page). Covers objects (add/move/resize/delete), z-order, group/ungroup, pages (add/duplicate/rename/delete), property fields, breakpoint canvas-size upgrades — and **scripts** (page + event handlers live in the book JSON, so they're covered by the same snapshots). Trigger: top-bar ↶/↷ buttons + `⌘Z`/`⌘⇧Z` (Ctrl too), working with focus in the canvas (canvas-side listener posts `toolback:undo`/`toolback:redo` messages, same pattern as the z-order keys); skipped in editable targets so Monaco keeps its own text undo (the resulting content change lands as a coalesced history step). Continuous edits coalesce by target within an 800 ms window — one undo step per typing burst or per drag; redo cleared on new edits; stacks capped at 100. Document-level resets (`New`/`Open`/recent/autosave-restore) clear history; nothing is recorded while running (buttons disabled + shortcut inert, verified). Found by unit test + fixed during the build: redo must re-push the *pre-redo* state as the undo entry, else undo-after-redo bounces back to the same spot. Verified in-browser: geometry X 150→120 → undo/redo round-trip; edit → Run (undo disabled, `⌘Z` inert) → Stop (enabled again); Delete key removed myButton → `⌘Z` restored it with the Selection tab revealed; canvas-focused `⌘Z` undid an edit made in the panel. Guide: new "Undo / redo" section. 125/125 vitest, typecheck + build clean. Autosave restored to the pristine example.
- **2026-09-11** — **Duplicate shipped** (⌥D / Alt+D + top-bar ⧉ button next to ↶/↷, ⧉ re-used from page duplication — checked: no other uses). `duplicateSelected` deep-copies the selection: every object re-idded and re-named (`label1`, `group1`, … via a shared used-names set so nested group levels never collide), copies inserted directly after their originals and nudged **24px down-right** so the duplicate visibly separates from the original (cascades on repeat presses), duplicates selected. Groups copy their whole `children` subtree (members, nested groups, scripts, relative rects all preserved; only the top-level copy's rects are offset — members stay relative to the group as it moves as a whole); if a group *and* one of its members are both selected, the member is skipped. Undoable in one step. Shortcut works with canvas focus (canvas-side listener posts `toolback:duplicate`); skipped in editable targets (⌥D types ∂ on Mac); inert while running. Verified in-browser: toolbar dup moved myButton 96,184 → copy at 120,208 (+24/+24, Selection tab revealed); undo restored pristine. Guide: "Duplicate" section documents the offset + the ⧉ button. 131/131 vitest, typecheck + build clean.
- **2026-09-11** — **Group/ungroup shortcuts shipped** (`⌥G` / ⌥U, Alt+G/Alt+U). New shared runtime helper `isAltShortcutKey` (editable targets always excluded — ⌥G types ‰ and ⌥U is the umlaut dead key on Mac), refactored `isDuplicateKey` onto it; `isGroupKey(e)` returns `'group' | 'ungroup' | null`. Works with canvas focus (canvas-side listener posts `toolback:group` / `toolback:ungroup` messages, same pattern as duplicate/undo); editor-side handler gates only on run mode — the store actions already no-op when the selection isn't eligible (multi same-parent for group, single group for ungroup). Inert while running. Verified in-browser: two palette buttons → shift-click select → editor `⌥G` grouped (3 objects = group + 2 members), `⌥U` ungrouped, canvas-focused `⌥G` grouped, undo/redo covered it, `⌥U` inert while running and worked again after Stop. +2 runtime shortcut tests. Guide Groups section documents both shortcuts. 133/133 vitest, typecheck + build clean.
