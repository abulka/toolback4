# Plan: auto-height "web page" pages

Status: **designed — not yet implemented**. Independent feature (page-size
model + editor canvas plumbing); scheduled after the Responsive ("glue") work.

## Goal

A page mode where the page keeps its **width** but its **height fits its
content** — "keep adding controls and the page accommodates". The canvas/iframe
grows as objects are added or moved below the fold; at run time the page
scrolls like a web page once content exceeds the configured minimum. Popups
inherit it for free (they share the page render path).

## Locked decisions

- **Per-background, per-breakpoint checkbox** — "☐ Height fits content (web
  page)" in the background size dialog. It applies to the *book default* too
  when a background uses the book size (the flag lives alongside size and
  follows the same resolve-chain: background override → book canvas).
- **Width is fixed; only height derives from content.** A web page has a
  viewport width; clipping prevention on the width axis is the Responsive
  feature's job, not this one's.
- **Height = max(bottom of all objects) + 24px margin, floored at the
  configured (or book-default) height.** Bottom measured on *resolved* rects
  (fit-aware once Responsive ships) over page objects **and** background
  objects.
- **Design-time growth is commit-driven** (a drag below the fold grows the page
  on release). True live-drag growth needs streaming the rect map mid-drag and
  is noted as a possible follow-up.
- **No height-stretch circularity**: when this feature lands on top of
  Responsive glue, vertical glue (Bottom/Middle/Stretch) always measures the
  **base** height — the number in the size dialog — never the grown content
  height.

## Data model

```ts
// Background gains:
autoHeight?: Partial<Record<Breakpoint, boolean>>
```

Schema addition is optional and default-absent — no migration. `CanvasSize`
stays `{width, height}`; the *minimum* height stays the stored number.

## Format helpers

- `contentHeightFor(objects, breakpoint, minHeight): number` —
  `max(y+h over resolved rects) + 24`, floored at minHeight.
- `resolvePageSize(book, bg, breakpoint, objects?)` — new optional `objects`
  param; when `bg.autoHeight?.[breakpoint]`, height becomes
  `contentHeightFor(bg.objects + page.objects, …)`; width unchanged.

## Runtime

`renderBookPage`/`renderBackgroundView` pass their page + background objects
through, so the rendered `.tb-page` root grows to fit content (works for the
base page, popups, and published files alike). `.tb-page` keeps `overflow:
hidden`; the page box itself is what grows, so nothing clips.

## Editor

- `stores/book.ts` `activeCanvasSize`: when the active background has
  `autoHeight[bp]`, compute content height from
  `flattenObjects(targetObjects) + background.objects` (resolved rects,
  bottom-most y+h + 24), floored at the base height. The iframe (sized by
  `App.vue canvasStyle`) grows; `.canvas-area { overflow: auto }` already
  scrolls.
- `BackgroundDialog.vue` size box: per-breakpoint "☐ Height fits content"
  checkbox; when on, the height number input + drag handle show `auto` /
  derived and are disabled. Captions in the panel show `auto` height.
- `PagesPanel.vue` caption shows the effective height (derived when auto).

## Tests

- format: `contentHeightFor` math; `resolvePageSize` auto-height with page +
  background objects; floor at base height; flag round-trip.
- runtime: rendered page root height grows with content; popup auto-height;
  absent flag = today's behavior exactly.
- editor store: `activeCanvasSize` derived height recomputes on object
  add/move/remove; undo covers the flag.

## Guide

Backgrounds / page-size section: "Height fits content" — what it does, the
min-height floor, and the scroll-at-runtime behavior.