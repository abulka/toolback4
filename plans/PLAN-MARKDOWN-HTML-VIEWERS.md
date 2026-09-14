# Plan: markdown & HTML viewer controls

Status: **designed — not yet implemented**. Independent feature (controls +
player + editor text fields); scheduled after the Responsive ("glue") work.

## Goal

Two new palette controls that display rich content:

- **markdown** — a `text` prop written in Markdown, rendered to styled HTML.
- **html** — an `html` prop injected as raw HTML.

Both are *viewers*: read-only display, first-class objects (positioned/sized
like any control, scriptable via `controls.<name>`, names/keys in the shared
namespace). Both support `{{key}}` store bindings **inside the source**, live
re-rendering on every store change — so a markdown viewer can show
`## Score: {{score}}` and update as the store changes.

## Locked decisions

- **`marked` (^14, already in the repo via the editor) becomes a dependency of
  `packages/controls`.** It is bundled statically through `build-player.mjs`
  (runtime → controls → marked), so published standalone books render markdown
  **offline** — no library-shelf / esm.sh involvement.
- **HTML viewer = raw innerHTML** (no sanitizer in v1). The canvas is a
  same-origin sandbox where authored scripts already run arbitrary JS, so
  sanitization is a robustness nicety, not a security boundary. Note this in
  the guide. (Design mode is inert via the existing `pointer-events: none`.)
- **Content-prop registry**: controls grows a `CONTENT_PROPS` map
  (`label/button/card → 'text'`, `markdown → 'text'`, `html → 'html'`) and
  `applyContent(el, kind, source)` so the player and ControlApi can re-render
  content generically. `renderDynamicText` substitutes `{{key}}` in the
  **source before** rendering for these kinds (today it sets `el.textContent`,
  which is unchanged for label/button/card; markdown/html/switch re-render
  instead).
- **Multiline editing with the `{{` key picker.** The PropertiesPanel gets a
  multiline textarea for these controls, extending the existing
  `DynamicTextEditor` key-picker to work at the caret in multi-line text.

## Data model

```ts
CONTROL_KINDS: ... | 'markdown' | 'html'
DEFAULT_SIZES: markdown { w: 420, h: 260 }, html { w: 420, h: 260 }
DEFAULT_PROPS: markdown { text: '# Heading\n\nBody…', fontSize: 15 },
               html      { html: '<p>Hello</p>' }
```

Book schema needs no changes — `props` and `control` already free-form / enum.

## Controls

- `renderMarkdown(obj)` → `<div class="tb-markdown">` with
  `marked.parse(textProp(obj))` as innerHTML.
- `renderHtml(obj)` → `<div class="tb-html">` with `obj.props.html` (string) as
  innerHTML; empty → empty-state placeholder.
- Typography CSS in `styles.ts` (`.tb-markdown h1-h6/p/ul/ol/code/pre/blockquote/
  table/a`, `overflow-wrap`, inline `fontSize`/`fontFamily` like card).
- Both registered in `registerControls()` + `CONTENT_PROPS`/`applyContent`.

## Runtime

- `wireDynamicText`/`renderDynamicText` (player.ts) resolve templates against
  the **content prop** and call `applyContent` (so store changes re-parse the
  markdown/HTML source, not just swap textContent).
- `ControlApi.text` on markdown/html reads/writes the source prop; a write
  re-renders (for label/switch: existing behavior).
- Editor IntelliSense member lists unchanged (text/value/visible/… are generic).

## Editor

- Palette (`App.vue`) + `PropertiesPanel.textFields`: markdown → `text`
  (textarea), html → `html` (textarea).
- Multiline textarea variant of `DynamicTextEditor` with the `{{` store-key
  picker at the caret.
- `storeKeys.ts` already scans every string prop for `{{key}}` — markdown/html
  bindings are picked up with no change.

## Tests

- format: round-trip both kinds; DEFAULT_SIZES/PROPS present.
- controls: markdown renders headings/lists/code; html injects/sets empty
  state.
- runtime: `{{key}}` in markdown source re-renders on store write; `.text`
  setter re-renders; design preview resolves keys against the book store.
- examples smoke stays green.

## Guide

New "Markdown & HTML viewers" section under controls: the two props, `{{key}}`
bindings inside source, the offline-markdown note (marked is bundled), and the
raw-HTML trust note.