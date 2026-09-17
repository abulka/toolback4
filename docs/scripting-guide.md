# toolback scripting guide

Scripts are **plain modern JavaScript**. No special language to learn — if you can
write JavaScript, you already know toolback scripting. This guide covers everything
you can use inside a script, plus recipes you can copy straight into your book.
(For how it all works under the hood — script compilation, the forward
dispatch chain, the editor↔canvas protocol — see
[runtime-internals.md](./runtime-internals.md).)

> **Plain JavaScript means no type annotations.** `const numbers: number[] = []` is
> TypeScript and won't run — toolback executes scripts as JavaScript, so write
> `const numbers = []`. The editor flags any TS annotation with a red squiggle
> ("Type annotations can only be used in TypeScript files") before you hit Run.
> The on-disk link file is also `.js`, so VS Code treats it the same way.

## Where scripts live

There are two places a script can live:

- **Object script** — select an object on the canvas, open the **Script** section in
  the properties panel, pick an **event** (click, change, input…), and write the
  handler body. It runs every time that event fires on that object.
- **Page script** — the **Page script** panel in the properties sidebar. Define
  functions once here and call them from any object script. Also the home of
  `pageEnter()`, which runs when you press **Run** (shortcut: `F3` or `⌥3`).
  On a plugin page (⚡ author mode), `pageEnter()` fires when the plugin opens.

## How names work

Every object gets a name when you drop it on the canvas: `button1`, `label1`,
`input2`, … You can see (and reference) names in the **Objects** list (group
members are indented under their group) and in the **Selection** header of the
properties panel. Names are how one object talks to another: `controls.button1`,
`controls.nameInput` — or just `button1`, `nameInput` (object names are usable
as plain identifiers in any script; see the [controls](#controls) section).
Group members are named too, and `controls.group1` is the group itself.

## Z-order

Objects render in **Objects list order**: later = on top. The **Arrange**
buttons in the Selection panel move the selected object to the front, back,
or one step forward/backward — keyboard: `⌘]` / `⌘[` step, `⌘⇧]` / `⌘⇧[`
front/back (works with the canvas focused too). Moving a group moves its whole
subtree together in the order.

## Multi-select

- **Shift-click** adds or removes an object from the selection
- **Drag on empty canvas** draws a selection box (shift adds to the current
  selection)
- Dragging any selected object moves them all together; **Delete** removes them
- Groups: clicking a member selects the **group**; alt-click or double-click
  selects the member itself

## Align & distribute

Select two or more objects under the same parent and the Selection panel grows
an **Align** section. These are design-time geometry commands — they write each
object's edge distances (undoable in a single step), so every object keeps the
edges it follows.

- **Align** (6 buttons) — left / right / top / bottom / horizontal-center /
  vertical-center, aligned to the selection's bounding box. Great for form
  columns, card rows and toolbars.
- **Distribute H / V** (3+ objects) — spaces the centers evenly, keeping the
  outer two where they are.
- **Match W / H / both** — resizes every selected object to the largest in the
  selection (equal-width buttons, equal cards).
- **Center on page** — moves the whole selection as a **block** so its bounding
  box is centered. This is the OK/Cancel case: aligning each button's own
  center to the page would stack them, so Center moves the pair together.

Alignment measures each object's **rendered** position at the current viewport
size, then writes the distances back. Every object keeps the edges it already
follows (a right-following object stays right-following, with its gap
re-derived), exactly like typing a position.

## Duplicate

Duplicating the selection creates a copy right next to the original — nudged
24px down-right so it visibly separates — and selects the copy, so pressing
the shortcut again duplicates the duplicates (each one cascades further).

- **Keyboard:** `⌥D` (Alt+D) — works with the canvas focused too
- **Top bar:** the ⧉ button next to ↶ / ↷ (disabled when nothing is selected
  or while running)
- Duplicating a **group** copies the whole subtree: every member is copied,
  re-idded and re-named, and keeps its scripts and relative position — the two
  groups behave exactly alike
- Undoable in one step (and redoable)

## Copy · cut · paste

Copy, cut and paste move objects around — a single object, or any multi-selection
of objects, however disparate. Groups copy with their whole subtree.

- **Keyboard:** `⌘C` copy · `⌘X` cut · `⌘V` paste (Ctrl on Windows/Linux) — work
  with the canvas focused too
- **Selection panel:** Copy / Cut / Paste buttons (Paste is disabled until
  something is on the clipboard)
- Copies land **24px down-right** of where the copied objects were, so repeat
  pastes cascade. A multi-selection pastes as a set, keeping each object's
  position relative to the others
- **Paste target:** pasting while the selection is inside a group inserts the
  copies into that group; otherwise they go to the top level of the page or
  background being edited
- Pasted and cut-then-pasted objects get fresh ids and names (`label1`,
  `group1`, …) in the shared page+background namespace, so script handles never
  collide with existing ones
- Cut removes the originals; **one undo** brings them back (cut and paste are
  each a single undo step)
- Pasting only accepts toolback clipboard data: a copy writes a JSON payload
  tagged with a `__toolback` key to the system clipboard, so pasting in other
  apps shows that JSON and random copied text can never be pasted as objects
- Object copy/cut/paste never interferes with the **text** clipboard — inside
  script editors, text fields or inputs, `⌘C`/`⌘X`/`⌘V` still copy, cut and
  paste text as usual

The **{ } JSON** button (next to the object name; the multi-selection panel has
a **Copy JSON** action) is unchanged: it copies the selection — subtree included
— to the clipboard as plain pretty-printed JSON, useful for inspecting and
describing structures.

## Undo / redo

Every design edit is undoable: adding, moving, resizing, duplicating or
deleting objects, z-order, grouping/ungrouping, page changes, property fields
— and scripts (page script and event handlers), which are part of the book
like everything else.

- **Keyboard:** `⌘Z` / `⌘⇧Z` (Ctrl on Windows/Linux) — works with the canvas
  focused too
- **Top bar:** the ↶ / ↷ buttons (disabled when there is nothing to undo/redo)
- While typing in a script editor, `⌘Z` undoes text inside that editor
  (Monaco's own undo), and the finished script becomes an undo step
- Continuous typing or repeated geometry edits are merged into a single step,
  so one Undo reverts a whole typing burst at once
- Undoing a delete brings the objects back — selected
- Undo/redo is disabled while running (F3) — it's a design-time tool. Opening
  or creating a new book starts with a clean undo history.

## The runtime API

Every script has these ready to use — no imports needed.

### store

A tiny key/value store shared by everything on the page.

- `store.get(key)` — read a value (`undefined` if it was never set)
- `store.set(key, value)` — write a value and refresh any `{{key}}` labels

Values can be any JavaScript value. Labels render them as text.

**Design-time store.** The Store tab in design mode doubles as an editor for a
book-level store: add/remove keys and set values before you ever press Run.
Every run (and every published export) **seeds** the runtime store from those
values, so scripts can read starting state without a `pageEnter` `store.set`.
`{{key}}` labels resolve against these values **right in design view** — for
example a `Score: {{score}}` label shows `Score: 0` as you type `0` into the
Store tab.

The rules:

- **Design values are data, not code** — strings, numbers, `true`/`false`,
  `null`, and JSON arrays/objects. Typing `3`, `[1,2]`, or `{"a":1}` parses;
  anything else is stored as a string (quote `"true"` to keep it a string).
- **Every Run starts fresh** from the design store. Mutating a value while
  running never writes back to the book, so re-running behaves identically each
  time.
- To deliberately freeze a computed value for the *next* run, use the **⇓
  button** in the Store tab while running — it copies that value into the
  design store. (Undo isn't available while running, matching every run-mode
  edit.)
- Keys you type into the design store show up in the `{{` picker and script
  completions, even before any script references them.
- Author-mode plugins share the same seed rule: opening the plugin box starts
  its session store from the design values.

### controls

`controls.<name>` gives you every object on the page, by name.

**Shorthand:** object names are also available directly — `button2.text = 'fred'`
is exactly the same as `controls.button2.text = 'fred'`. This works in page
scripts and object scripts, and you can read too (`if (input1.value === '') …`).

Get/set properties:

- `text` — the text of a button or label (for an input, this is its value; for
  a switch, its label text). On a **markdown** or **html** viewer it is the
  raw source string — reading returns it, writing re-renders the viewer.
- `value` — the value of an input; for a **switch**, the checked state
  (`true`/`false` — reading and writing both work)
- `visible` — `true`/`false`, show or hide the object
- `enabled` — `true`/`false`, enable or disable (buttons and inputs)
- `x`, `y` — the object's position on the canvas, in pixels (moving it)
- `width`, `height` — the object's size, in pixels (resizing it; minimum 1)
- `color` — a colour for the object: names like `'red'`, `'green'`, `'navy'`,
  `'gold'`… or any CSS colour (`'#3b82f6'`, `'rgb(59 130 246)'`). Buttons,
  cards and containers paint their surface; labels and switches paint their
  text/toggle. `''` restores the default. Also settable from the Selection
  panel's Colour field (with a colour swatch).
- `fontFamily` — `'system' | 'sans' | 'serif' | 'mono' | 'rounded'` (a
  simplified, web-safe set; works on switches too)

Geometry changes apply immediately, and they stick for the whole run — even
across `page.go` navigations. A geometry write moves the control now while
keeping which page edges it follows (see *Responsive edges*), so the change is
visible at every page size.

Methods:

- `on(event, fn)` — attach an extra handler in code,
  e.g. `controls.myButton.on('click', () => { ... })`
- `el` — the raw DOM element, if you need something the API above doesn't cover

### Markdown & HTML viewers

Two palette controls display **rich, read-only content** as ordinary objects —
position, resize, group and name them like anything else:

- **markdown** — a `text` property written in Markdown, rendered to styled
  HTML (headings, lists, `code`, quotes, tables, links, images).
- **html** — an `html` property injected as raw markup.

Both re-render **live**: `{{key}}` bindings work *inside the source*, resolved
**before** the Markdown/HTML is parsed — so a viewer can show
`## Score: {{demoScore}}` and update on every `store.set`.

```js
// a button that feeds a markdown viewer
controls.inc.on('click', () => store.set('score', (store.get('score') ?? 0) + 1))
```

```md
## Score: {{score}}
```

Scripting them: `viewer.text` reads/writes the source (`'# New heading'`) and
re-renders immediately. Markdown viewers also honour the Font size / Font and
Colour fields in the Selection panel.

**Sizing and editing.** A viewer is a fixed box the size you give it; content
that doesn't fit **scrolls inside it** — at run time and while designing (hover
the viewer in design mode and scroll). The Text/HTML field is a multiline
editor with the same `{{` key picker as other Text properties, and the same two
editing affordances scripts have:

- **⤢** opens the source in a resizable Monaco window (`markdown`/`html`
  highlighting, `{{` key completion).
- **⇄ file** links it to a real `.md` or `.html` file on disk for **VS Code**;
  saves sync both ways, exactly like script files.

Things to know:

- **Empty sources show a placeholder** instead of an empty box.
- **Their box is outlined while you design.** A viewer has no border or
  background of its own, so at design time a markdown/HTML control that isn't
  selected shows a faint dashed outline tracing its box (just like an unselected
  group). Selecting it shows the usual selection box instead; the outline never
  appears at run time or in the published book.
- **The canvas is a same-origin sandbox where authored scripts already run, so
  viewer content is trusted.** HTML is injected with **no sanitizer**, and
  Markdown passes raw HTML through — only open books you trust.
- **Markdown is bundled with the player**, so published books render it
  **offline** — no library-shelf or network involved.

### Responsive edges

Every object can carry a **Responsive** setting — a horizontal and a vertical
choice, edited in the Selection panel (the *Responsive* row). It answers the
question *"which page edge does this object follow when the window is a
different size?"* The two axes are independent: changing one leaves the other as
it was.

Each choice keeps a **fixed distance in pixels**:

- **Follows left** — keeps its distance from the page's left edge and its own
  width (it does not grow when the page grows).
- **Follows right** — keeps its distance from the page's right edge and its own
  width.
- **Follows both (stretches)** — keeps its distance from both edges, so it grows
  and shrinks with the page width.
- **Centred** — keeps its width and stays in the middle.

The vertical row mirrors this with **Follows top**, **Follows bottom**,
**Follows both**, and **Centred**.

Example: a hamburger button 24px from the right edge of the page. Horizontal
**Follows right** keeps that 24px gap at every window size, so the button rides
the right edge. **Follows both** would keep a fixed margin on each side and let
the button's width absorb the difference (a content panel with 24px gutters).

Things to know:

- **New objects start Follows left + Follows top.** A freshly placed control —
  and a new group — keeps a fixed offset from the page's top-left. Switch either
  row to change how it follows.
- **The browser does the work.** Each object is positioned with CSS (`left`,
  `right`, `top`, `bottom`, or `50%`), so resizing the window repositions
  everything with no re-render. Reading `x`/`y`/`width`/`height` in a script
  returns the on-screen value.
- **Page size follows content.** A fluid page is as wide and tall as the window
  and grows with content placed from the top/left. Only **Follows left** /
  **Follows top** objects can enlarge the page — a control deliberately placed
  low down makes the page scroll. **Follows right/bottom**, **Follows both** and
  **Centred** objects sit inside the page box, so they never feed the page's own
  size. That is what lets **Follows bottom** mean "N pixels from the page's
  bottom edge" even when the page is taller than the window.
- **Switching a choice keeps the object where it is.** The distances are derived
  from what is on screen, so you only change how it behaves from then on.
- **Dragging edits the distance it follows.** There is no per-window override:
  dragging a right-following object changes its distance from the right; a
  left/top object takes the new position directly. A centred object cannot be
  dragged along its centred axis (change the choice to move it).
- **Shift-drag a corner** holds the object's current aspect ratio — useful for
  images and cards. Single-axis edge handles resize normally.
- **Deliberate writes keep the edges.** Typing X in the Geometry panel (or a
  script writing `button.x`, or the author bridge) moves the control now while
  keeping which edges it follows; a `width`/`height` write on a **Follows both**
  control switches it to a fixed size held to the left/top. See *Scripts and
  geometry* below.
- **Fill to page.** The Geometry section's **Fill to page** group stretches the
  object to the page edges. **Fill page** pins both axes (**Follows both**);
  **Fill width** / **Fill height** do a single axis. The **Fill margin** field
  is the gap left on each side (remembered between sessions); it is *not* the
  control's outer **Margin**. **Center** sets both axes to **Centred**. Works on
  top-level objects; a group member follows its group's box instead.
- **Margin (space reserved on the right/bottom).** The **Margin** fields (R/B)
  in the Geometry section reserve empty space to the right of and below the
  control. The **Enable** tick turns the margin on or off as a preview — the R/B
  values are kept either way, so you can compare the layout with and without it.
  On a **Follows-right/bottom** control the margin offsets it inward (a
  Follows-bottom control keeps its `bottom` distance **plus** its bottom margin).
  On a **Follows-left/top** control the margin is the **far** side: a fluid page
  grows to the outer edge of the bottom/right margin, so a **Follows-top**
  control with a 24px bottom margin keeps 24px of empty page below it instead of
  sitting flush on the auto-sized edge — the fix for "the page always eats my
  bottom gap." On a **Centred** control the margin shifts its box by half
  (a right margin moves it left). There are no left/top margin fields: on a
  left/top control they would just be the `left`/`top` distance by another name,
  and on a right/bottom control they would do nothing. A group wraps only its
  members' boxes, so a margin on a member is internal spacing and does not
  enlarge the group.
- **A spring shows every edge an object follows.** A solid zigzag runs from the
  object to each page edge it follows — a square anchor sits on the edge and a
  small arrowhead at the object points back at it. **Centred** draws a plain
  straight connector to each side with circle anchors. Each spring carries a
  small caption with the edge and its **pixel distance** (e.g. `right 198`,
  `top 46`, `centre`) so you can judge the gaps at a glance. An object's
  **outer margin** is shaded as a soft translucent band on each side that has
  one, so you can see the reserved space even on a default left/top object.
  Changing a margin scrolls the band into view, since a far-side margin grows
  the page rather than moving the control.
  Springs are drawn **behind the controls**, so they never cover what's on the
  page. Background
  objects show their springs too, and a **group's members** show theirs inside
  the group — measured against the **group box**, not the page. The **≋
  All/Sel/Off** control in the top bar shows springs for every object, only the
  current selection, or none (the choice sticks). Switch to **Sel** or **Off**
  when the default left/top springs get busy. Where a spring lands on a
  **group's** edge, that group box is traced with a faint dashed outline too, so
  the edge a spring points at is always visible. Click the **?** beside it for a
  short help popup — what the buttons and options do plus a legend of the lines.
- **Spring options (the ⚙ next to All/Sel/Off).** The options you set stick. You
  can turn the **captions** off, or keep the edge word without the pixel
  **numbers** (`left` instead of `left 198`). In **All** you can leave out the
  springs **inside groups** (much calmer on a busy page — the group boxes stay
  faintly outlined, they just no longer show every member's springs). **Only
  objects with custom constraints** hides everything that just follows the
  default Left + Top, so only the objects you deliberately anchored show springs.
  **Hide zero-length captions** (on by default) drops the label when an object
  sits flush on an edge, and captions are nudged to stay clear of the
  page/group border either way.
- Objects that stick out of the current page get a **dashed red outline** on the
  canvas, so the clipping you'd otherwise have to guess at is made visible.
- **Groups**: a group's box carries its own edge choices. **Resizing the group
  by a handle scales it** — every member's size and its distances inside the box
  grow or shrink together (right/bottom/both and Centred members included), like
  scaling a picture. Resizing the **page** (the browser window or canvas width)
  does **not** scale a group: each member just follows its own edges — a
  Follows-right/bottom/both member rides the matching group edge, and a Centred
  member re-centres. Use group handles to size a group and per-member edges to
  make it adapt. A typed width/height in the panel (or a script setting
  `group.width`/`group.height`) scales it exactly like a handle drag, keeping the
  top-left fixed. A group set to **Follows both** is kept tight around its
  members: a page-size change that follows an edit re-hugs it, so its box never
  shows empty space inside.
- **Backgrounds**: edges work on background objects too — a right-following nav
  button on a background follows the edge on every page that shows it.

### page

- `page.name` — the name of the current page
- `page.names` — the names of all pages in the book
- `page.go('Results')` — navigate to another page (see
  [Pages and navigation](#pages-and-navigation))

### event

In an object script, `event` is the DOM event that fired. The most useful trick:

```js
// in an input's change or input script:
store.set('name', event.target.value)
```

### target

Also available in object event scripts: **`target` is the object that received
the event** — a full control API (`.name`, `.text`, `.value`, …), not just a
DOM element.

- In an **object's own script**, `target` is the object itself
- In a **group's script**, `target` is the member that was actually clicked —
  see [Groups](#groups)

```js
// a group's click script — say which member was clicked
console.log('you clicked', target.name)
```

### self

**`self` is the object that owns the script you're writing** — ToolBook
heritage. Like `target` it is a full control API, and it cannot be set.

- In an **object's own script**, `self` is the object itself (so `target ===
  self` there)
- In a **group's script**, `self` is the **group itself** — while `target` is
  the member that was clicked. That distinction is the whole point: a group
  can act on itself (`self.x += 8`) while still knowing which member was
  clicked (`target.name`)
- In a **page script**, `self` is the page API (`self.name` is the page name)
- `this` works as an alias for `self` anywhere in a script, for the
  TypeScript-flavoured (`this.name === self.name`)

```js
// a button's click script — nudge *itself* right
self.x += 8
```

### forward

Event handling in groups follows the ToolBook rule: the innermost handler for
an event runs and **stops there** unless it calls `forward()` — which sends
the same event to the next enclosing script (the parent group's handler, where
`target` is still the member and `self` is that group). An object with **no
handler** for the event lets the message pass to its parent automatically.

```js
// in a member's click script — let the group's handler also run
store.set('clicked', self.name)
forward()
```

```js
// in the group's click script — runs only if some member forwarded,
// or if a member without its own click script was clicked
store.set('who', target.name)
```

## Object scripts

Select an object → **Script** → pick the event → write the body. The body runs
each time the event fires.

- `await` is allowed (scripts run async under the hood)
- functions from the page script are callable directly, by name

Example — a button's `click` script:

```js
store.set('count', (store.get('count') ?? 0) + 1)
if (store.get('count') > 10) {
  controls.myLabel.text = 'enough already!'
}
```

## Page script

Define shared functions once, use them everywhere. Any top-level
`function name()` you define here can be called directly from any object script.

`pageEnter()` is special: it runs when you press **Run**, before anything else.

```js
async function pageEnter() {
  store.set('visits', (store.get('visits') ?? 0) + 1)
}

function fullName() {
  const first = controls.firstName.value
  const last = controls.lastName.value
  store.set('fullName', `${first} ${last}`.trim())
}
```

Now any object script can call `fullName()` — e.g. a button's click script:

```js
fullName()
```

```text
I am {{self.name}}
```

This is how object state becomes visible text.

**Text sizing**: labels and buttons have a **Font size (px)** field in the
Selection panel (the `fontSize` property). Long text wraps inside the object's
box and clips if it doesn't fit — give a paragraph label a smaller size (14)
and a taller box, or use a card for long body text.

## Events reference

The event dropdown offers:

| Event | Fires when |
| --- | --- |
| `click` | the object is clicked |
| `dblclick` | the object is double-clicked |
| `change` | an input's value is committed (blur / Enter) |
| `input` | an input's value changes, every keystroke |
| `mouseenter` | the pointer enters the object |
| `mouseleave` | the pointer leaves the object |

## Recipes

### Counter (the classic)

Button `click` script:

```js
store.set('count', (store.get('count') ?? 0) + 1)
```

Label text: `Count: {{count}}`

### Echo an input as you type

Input `input` script:

```js
store.set('name', event.target.value)
```

Label text: `Hi {{name}}`

### Disable a button after use

The submit button's own `click` script:

```js
controls.submitBtn.enabled = false
store.set('sent', true)
```

### Toggle a card

A button's `click` script:

```js
controls.card1.visible = !controls.card1.visible
```

### Move and resize objects from script

Every object knows where it is — read or write `x`, `y`, `width`, `height`:

```js
// a button's click script: slide the box right, grow it a little
controls.box.x += 24
controls.box.width = 300
```

Combined with `await` this makes simple animations:

```js
// a button's click script: hop the box up and back down
for (let i = 0; i < 10; i++) {
  box.y -= 8
  await new Promise((r) => setTimeout(r, 30))
}
for (let i = 0; i < 10; i++) {
  box.y += 8
  await new Promise((r) => setTimeout(r, 30))
}
```

### Fetch data when the page runs

Page script:

```js
async function pageEnter() {
  const res = await fetch('https://api.github.com/users/torvalds')
  const data = await res.json()
  store.set('handle', data.name)
}
```

Label text: `Hello {{handle}}` — `await` works in object scripts too.

## npm libraries

Scripts can import npm packages with a plain dynamic import — no configuration
in the book:

```js
async function onPlay() {
  const { Midi } = await import('@tonejs/midi')
  const midi = await Midi.fromUrl('https://example.com/song.mid')
  store.set('name', midi.header.name)
}
```

Packages resolve through **esm.sh** by default (both in the editor preview and
in exports), so any browser-friendly package works immediately — the exported
book fetches it from the CDN at runtime. To make a package **offline** in
exports, install it on toolback's library shelf:

```sh
pnpm --filter @toolback/libs add @tonejs/midi
```

and restart `pnpm dev` — shelf packages are pre-bundled to browser-ready ES
modules and embedded into exports as inline `data:` URLs, keeping the published
book a single self-contained file that works offline.

Import results are normalized for convenience:

- Bundled CommonJS packages come back with their exports available for named
  destructuring: `const { Midi } = await import('@tonejs/midi')`.
- Real ESM namespaces pass through: `const { nanoid } = await import('nanoid')`.
- A package with only a default export comes back as that default:
  `const Chart = await import('chart.js')` gives you the chart constructor.

Things to know:

- **`await import(...)` works in object event scripts (they are async) and
  inside `async function`s defined in page/background scripts** — but not as a
  top-level statement in a page or background script body (those bodies are
  plain functions). Put the import inside a function.
- Subpath imports (`import('lodash/fp')`) resolve to the package's own subpath
  via esm.sh; shelf packages always serve their main entry. Version pinning
  works too: `import('chart.js@4.4.1')`.
- Publishing warns (status bar) for each import that is not on the shelf, since
  those need network at runtime.
- Packages that need Node.js (filesystem, child_process, native modules) cannot
  work in a browser — shelf builds fail loudly for them.

### Reading a package's README

Package documentation assumes bundlers or old-school script tags. Translate
like this (or use the **npm** helper button next to the script editor, which
does it for you):

| README says | toolback script |
|---|---|
| `import { Midi } from '@tonejs/midi'` | `const { Midi } = await import('@tonejs/midi')` |
| `import Chart from 'chart.js'` | `const Chart = await import('chart.js')` |
| `import * as THREE from 'three'` | `const THREE = await import('three')` |
| `const _ = require('lodash')` | `const _ = await import('lodash')` |
| `<script src="https://unpkg.com/…"></script>` | `const Thing = await import('…')` — use the package name, not the URL |

Where imports actually resolve:

- **esm.sh** is the default CDN: it serves browser-ready ES modules, converts
  CommonJS, and resolves a package's own dependencies. This is what
  `await import('name')` hits in previews and exports.
- **jsDelivr** (`cdn.jsdelivr.net/npm/<pkg>@<ver>/+esm`) is an equivalent
  alternative — but toolback standardises on esm.sh, so keep the bare package
  name in scripts.
- **unpkg** (and other raw-file CDNs) serve the files as published — usually
  UMD/global builds that are **not** ES modules. Never import unpkg URLs
  directly; import the package name and let the resolver pick a module build.

### Using one library across the whole book

Imports are cached per specifier — `await import('@tonejs/midi')` in ten places
still loads the package once. Two comfortable patterns:

1. **Import where you use it** (simplest):

```js
async function onPlay() {
  const { Midi } = await import('@tonejs/midi')
  // ...
}
```

2. **Import once, share globally** — stash the library on `window` in the
   background's `backgroundEnter()` hook (runs once per run), then every script
   on every page can use it as a plain global:

```js
// background script
async function backgroundEnter() {
  const { Midi } = await import('@tonejs/midi')
  window.Midi = Midi
}
```

```js
// any object script, any page
async function onParse() {
  const midi = new Midi() // window global — set up by backgroundEnter
  // ...
}
```

Page scripts that need the library at `pageEnter()` time can import there too —
or just await the import in their own scope. A dedicated **book script** layer
(one shared script above background, running once per book) is planned and will
become the natural home for global imports.

## Groups

Select several objects (shift-click, or drag a box on empty canvas) and press
**Group** in the Selection panel (or `⌥G` / Alt+G — works with the canvas
focused too). The group is a parent object: it has a name
(`group1`, …), a position, and its own Script section. **Ungroup** (`⌥U` /
Alt+U) releases the members back.

What a group gives you:

- **Move as one** — dragging the group (or setting its `x`/`y`) moves every
  member that follows the near edges. **Resizing the group scales it**: drag any
  handle and every member's size and its distance inside the box grow or shrink
  together (like scaling a picture) around the corner you didn't drag. This
  holds however a member follows edges — right/bottom/both and Centred included
  — and **Shift** on a corner keeps the group's proportions. The box stays the
  tight bounds of its members. A typed width/height in the panel, or a scripted
  `myGroup.width = 400`, scales the group the same way (holding the top-left).
  By contrast, when the **page** changes size each member simply follows its own
  edges; nothing is scaled. A **Follows both** group is re-hugged to its members
  whenever the page box changes through an edit, so its box always hugs them.
- **Hide as one** — `myGroup.visible = false` hides the whole group.
- **Shared scripts with `forward`** — a group's event handlers fire when the
  event happens on *any* member **that lets the message through**. The
  ToolBook rule: the innermost handler for an event runs and stops there
  unless it calls **`forward()`** — an object with no handler for that event
  lets the message pass to its parent automatically. So a group script runs
  when a member without its own handler is clicked, or when a member's script
  ends with `forward()`. In a group's script, **`target` is the member that
  received the event** and **`self` is the group itself** (see
  [self](#self)):

```js
// okButton's click script — handle it, then let the group react too
store.set('clicked', 'the OK button')
forward()
```

```js
// myGroup's click script — runs after okButton forwards, or when any
// member without its own click script is clicked
console.log('you clicked', target.name)
self.x += 2 // the group itself nudges over
```

- **Members stay addressable** — group members are ordinary objects: bare
  names and `controls.<name>` reach them wherever they sit. A member's `x`/`y`
  are relative to the group. The group's box always hugs its members: moving
  or resizing a **member** (not the group) recomputes it to the minimum bounds.
- **Editing inside a group** — drilling in is **one level per double-click**:
  click a group, then double-click to descend past it — keep double-clicking to
  work your way down to the member you want. Gentle single clicks always
  (re)select the object at the drilled level and never descend further, so once
  a level is selected it stays selected while you click around on deeper
  content. Alt-click jumps straight to the deepest object under the pointer.
  `Esc` steps back out one level at a time (selecting the group you were in);
  at the outermost level `Esc` does nothing — it never deselects. Clicking
  empty canvas steps all the way out. Gentle single clicks always select the
  whole group, so click-and-drag moves the group, never a member, unless you
  deliberately drilled in — and once a member is selected, dragging it moves
  only that member, never its enclosing groups. Each group you are inside stays
  **faintly outlined** on the canvas (a thin dashed box) so you can still see
  the box you're working within; the group you actually have selected keeps the
  normal bold selection box.
- **Nesting** — groups can contain groups.
- **Ungrouping** discards the group's own scripts — the editor asks first.

`text` and `value` do nothing on a group (a group has no text of its own);
members carry content, the group carries behaviour and position.

## Autocomplete and error squiggles

The script editors help as you type:

- **Ctrl+Space** opens a short, curated list — *only* toolback things: your
  objects (first), the API (`store`, `page`, `controls`, `event`, `target`,
  `self`), your page and background **functions** (callable by name from any
  object script), and ready-made templates. No thousands of irrelevant browser
  globals. Filter by typing; **Tab** (or Enter/click) inserts.
- **Typing `.` after an object** lists that object's properties — `button2.`
  offers `text`, `value`, `visible`, `enabled`, `x`, `y`, `width`, `height`,
  `on`, `el` — with short descriptions of each. `store.`, `page.`, `controls.`,
  `event.`, `target.`, `self.` and `this.` all have their own member lists.
- **Templates**: `pageEnter`, `pageLeave`, `store.set`, `store.get`, `page.go`,
  `onEvent`, `input-to-store`, `fetch-to-store`, `log-clicked-member`,
  `console.log`. They expand into ready-to-fill code with tab stops.
- **Typing `{{` in a script** offers your store keys and inserts
  `store.get('key')` (the script-side way to read a value — `{{key}}` bindings
  themselves belong in Text properties). In a Text property, `{{` lists keys
  plus the built-in `self.name` and adds the closing `}}` for you.
- **Red squiggles** underline syntax errors (like a stray `}`) before you even
  press Run. A squiggle is a hint — you can still run the page, and any error
  will also appear in the status bar when it actually happens.

### Bigger editing: spacious script windows

Every script editor has two small buttons above it. **Markdown and HTML viewer
fields get the same pair** — ⤢ a Monaco window, ⇄ file a `.md`/`.html` link
(see "Markdown & HTML viewers").

- **⤢** opens the same script in a **resizable, draggable window** — drag by
  the title bar, resize from the bottom-right corner. Edits stay in sync with
  the in-panel editor live. Size and position are remembered per editor.
- **⇄ file** links the script to a real `.js` file on disk, for editing in
  **VS Code** (or any editor). Saves flow two ways:

  - click **⇄ file**, pick where to save the `.js` file; the file is written
    immediately with **just your script** (plus a short comment marking the
    sync boundary) — no generated API dump, never left blank
  - type in toolback → the file updates; save in VS Code → toolback updates
    (polls the file every second or so)
  - linking to an empty file never wipes the script already in the editor —
    the editor's content is the source of truth until the file says otherwise
  - the linked file shows as a **⇄ name** chip with a **✕** next to it — click
    **✕** to unlink (the file itself stays on disk: the browser won't let a
    web app delete a file you picked, so remove it manually if you want it
    gone). Links survive reloads (per script, stored in the browser) until
    you unlink.
  - **If the file disappears from disk** (deleted or moved while linked),
    toolback notices on the next poll, unlinks itself, and shows a note
    ("`name` disappeared from disk — unlinked…") — no scary console errors.

  The comment header is stripped whenever toolback reads the file back, so
  only your script matters on the toolback side.

## Debugging

- Script errors appear in the editor **status bar**, tagged with where they came
  from (`button1.click: Error: …`, `page script: SyntaxError: …`).
- The **Store tab** in the right-hand panel is where the store lives. In
  **design mode** it edits the book's design-time store (the values every run
  starts from — see [store](#store)). While a **run** is active it's a live
  view: every `store.set()` shows up as it happens (starting from the seeded
  design values), each row's **⇓** copies that value into the design store, and
  it clears when you stop.
- `console.log(...)` writes to the browser devtools console — open devtools and
  pick the canvas frame's context.
- Referencing an object that doesn't exist gives `undefined` — e.g. setting a
  property on it reports `Cannot set properties of undefined`. Check the
  spelling against the Objects list.
- If you press Run and a page's `pageEnter` seems to run more than expected,
  press Stop and Run again to start a fresh session.
- The store resets to its design-time values every time you press **Run**.
  Edits made while running re-run the page, so it's a live-coding loop.

## Backgrounds

A **background** is a shared page resource, in the grand ToolBook tradition: every
object on a background appears on **all pages that use it**. Pages fill the window
they are shown in (see [Page size](#page-size-dialogs)); a page can opt into a
fixed size for a dialog.

The **Backgrounds panel** (left sidebar) shows one group per background with its
pages nested underneath:

- **👁** (or **double-click anywhere on the background row**) edits the background —
  the canvas shows only the background's own objects; drag, script and restyle
  them like page objects. The background of the page you're editing stays
  outlined; the one being edited is highlighted.
  A single click on the background does nothing — this is deliberate, so a stray
  click can't drop you onto an empty background. A click on any page always
  returns the canvas to that page.
- **⚙** opens the background properties: name, colour and **Delete…**
  (backgrounds with pages take them along — confirmed first)
- **✎** renames it; ⧉ duplicates
- **drag pages** to rearrange them, or drop them on another background to move
  them there
- **+ Add background** / **+ Add page** — new pages join the background you're
  currently editing (or the current page's background)

### Page size (dialogs)

Pages behave like web pages: a page is as **wide as the window** showing it — the
editor's canvas area while designing, the browser at run time — and as **large as
its content needs**, never smaller than the window. A control placed past the
right or bottom edge grows the page in that direction by exactly that overflow
and the window scrolls (the control can sit flush with the page edge); a control
that sits inside does not. While designing, hiding a panel makes the canvas
wider, so the page re-lays out live.

A page can instead have a **fixed size** — the Page tab's *Page size* section:

- **Fills the window (grows with content)** — the default (web page) behaviour.
- **Fixed size (dialog / popup / plugin window)** — type a width and height, or
  **drag the grip at the page's bottom-right corner** in the canvas; the page
  becomes a fixed surface, used for popups, author plugin windows and any dialog
  that should not resize with the browser. In the editor it is shown as a centred
  surface at that size.

A page's size belongs to the page, not the background. Vertical edges
(Responsive → Vertical) are resolved against the **page box** — the page's real
grown height, not just the visible viewport — so **Follows bottom** means a
fixed distance from the page's bottom edge even when the page is taller than the
window. Only **Follows top** objects drive growth, so the page height and its
bottom-following controls never chase each other. Only the page *layout* drives
growth: a script that moves an object below the fold at run time does not
re-grow the page.

To test a narrow layout, use the topbar's **preview width** control (Window ·
Phone 390 · Tablet 768 · …). It only restricts the canvas viewport, exactly like
Chrome's device toolbar — it is never stored in the book.

### Scripting backgrounds

Background objects are first-class: they get `controls.<name>` handles, can carry
event scripts, and their `{{key}}` dynamic labels work like any other object. A
button that lives on the background works on **every page** that shows it — the
classic way to build a shared nav bar.

Backgrounds also have a **script** (edit a background, then use *Background
script* in the Page tab): define shared functions here and every page on that
background can call them. A `backgroundEnter()` hook fires **once per run**, on
the first page using the background:

```js
// background script
function helper() { return 'shared' }

function backgroundEnter() {
  store.set('startedAt', Date.now())
}
```

Two things to know:

- names are shared in one namespace per run: a background's object names and its
  pages' object names must not collide (the editor keeps them unique when you add
  and duplicate)
- editing a background's objects changes **every page using it** — objects on a
  page view are shown ghosted and locked; the editor tells you where to edit them
  if you click one

## Popups and dialogs

Any page can open another page as a **popup dialog** at run time:

```js
// open the page named 'Dialog' (modal, with a title bar, centred)
page.popupOpen('Dialog')

// with options
page.popupOpen('Palette', { modal: false, chrome: 'none', x: 100, y: 60 })

page.popupClose('Dialog')  // by name…
page.popupClose()          // …or the topmost popup
page.popupCloseAll()
page.popups                // names of the open popups (bottom → top)
```

The **size of the popup comes from the popup page's own fixed size** — open the
page, choose *Page size → Fixed size* in the Page tab and type e.g. **320 ×
240**. A page with no fixed size opens at the default dialog size (640 × 480) and
grows with its content. That's the whole trick:

1. **+ Add page** (call it "Dialog") and give it a fixed size of 320 × 240 in the
   Page tab (*Page size → Fixed size*)
2. build the dialog on that page — inputs, buttons, scripts
3. from anywhere: `page.popupOpen('Dialog')`

Details worth knowing:

- the popup is **live**: it fires its own `pageEnter()`/`pageLeave()`, its
  objects are scriptable, and `store` is shared with the page underneath
- `page.go(...)` **inside a popup script navigates that popup** (from the base
  page it navigates the book); opening the same page twice reports an error
- navigating the base page closes all popups first (their `pageLeave` runs)
- options: `modal` (default `true` — dims the page behind; a backdrop click or
  `Esc` closes the topmost modal), `chrome: 'none'` for a bare page rect,
  `x`/`y` in canvas coordinates (default: centred)
- `page.popupOpen` returns a handle: `const dlg = page.popupOpen('D')` then
  `dlg.close()`

### Recipe: a modal settings dialog

Page **Settings** with a fixed size of 320 × 240: a switch named `mode`, and an
OK button with the click script:

```js
store.set('applyTheme', controls.mode.value)
page.popupClose()
```

Any button anywhere opens it: `page.popupOpen('Settings')`

## Pages and navigation

The **Backgrounds** panel (left sidebar) groups pages under their backgrounds:

- click a page to edit it; press **Run** to play the page you're editing
  (shortcut: `F3` or `⌥3` — works even when the canvas has focus)
- ✎ renames it
- ⧉ duplicates a page — objects, properties and scripts included
- ✕ deletes it (a book always keeps at least one page)
- **+ Add page** appends a fresh page on the background in context

### Start page

By default a run begins on the first page. To choose a different entry point,
tick **Start page (app opens here)** in the Page properties (right sidebar), or
click the **⌂** button on a page row. The chosen page shows a highlighted **⌂**.

The start page is the page the **published app** opens on, and the page the
editor returns to when you reload. It is independent of **Run**, which always
previews the page you're editing — so you can author anywhere and still ship an
app that starts at the page you picked. Clearing the setting (click **⌂** again
or untick the box) restores the first-page default. Deleting the start page
clears the setting.

### The `page` API

- `page.name` — current page name
- `page.names` — array of every page name
- `page.go('Results')` — navigate. Fires the current page's `pageLeave()` (if
  defined), renders the target page, then fires its `pageEnter()`. If no page
  has that name, an error is reported and the book stays on the current page.

### Page lifecycle

Each page's **page script** can define lifecycle hooks:

```js
function pageEnter() {
  store.set('score', 0)
}

function pageLeave() {
  // runs before leaving this page
}
```

`store` is shared across all pages for the whole run — that's how a score,
a name, or any state travels between pages. It resets when you press Run again.

### Recipe: quiz with a results page

**Quiz** page — the correct answer button's `click` script:

```js
store.set('score', 1)
page.go('Results')
```

Wrong-answer buttons' `click` script:

```js
store.set('score', 0)
page.go('Results')
```

**Results** page — a label with text `Score: {{score}} - {{verdict}}`, and page script:

```js
function pageEnter() {
  store.set('verdict', store.get('score') ? 'Nice!' : 'Try again')
}
```

A "Play again" button's `click` script: `page.go('Quiz')`

## Author plugins

The grand ToolBook trick, complete: **a page can run as a plugin while you
author**. Its scripts get the regular API **plus `author`** — an async bridge
to the editor itself. The book stays fully editable underneath while the
plugin floats on top.

To make one:

1. create a page (a compact one — give it a fixed 320 × 240 size in the Page
   tab), and tick **Plugin page** in the Page tab
2. build its UI: buttons, inputs, labels — all interactive while you author
3. click **⚡** (top right) → the menu lists **only plugin pages** — pick yours

The plugin's `pageEnter()` fires when it opens; its object event scripts run
as usual. `page.go` is disabled (the book is being edited); `store` is a
plugin-local store, fresh each session.

**Scripts hot-reload**: change the plugin's script (or an object's event
handlers) while the plugin is running and just click again — the new code
takes effect. The restart re-runs `pageEnter()` and resets the plugin's
session store; the window stays where you dragged it.

### The `author` API

Anything that creates or selects objects returns a **handle** — a live
reference that works like the objects you already know from run mode. Methods
are async (every call is a fresh round-trip to the editor, so values never go
stale):

```js
// handles for the current selection (what you clicked / shift-clicked)
const objs = await author.selected()

// add something — you get its handle straight back
const card = await author.insertControl('card', {
  x: 80, y: 480, w: 480, h: 160,
  props: { title: 'Stamped', color: 'navy' },
})

// group the selection — the handle IS the new group
const g = await author.command('group')

// handles understand props AND geometry (x/y/width/height resolved
// editor-side, group-aware — moving a group moves its members)
await g.move(20, 0)                       // offset by (dx, dy)
await card.set({ color: 'teal', y: 120 }) // write props + geometry
const y = await card.get('y')             // read one value
const all = await card.get()              // …or the whole snapshot
```

Everything a plugin does is ordinary book mutation: **undo (⌘Z) reverts it**,
autosave and save/open cover it, and publish is unaffected.

A working demo ships as `examples/author-plugin.toolbook.json` — the
plugin-flagged **Poster** page with both recipes below as buttons, and a
**Playground** page of objects to practise on.

### Recipe: recolour the selection

A plugin-page button with the `click` script:

```js
const objs = await author.selected()
if (!objs.length) {
  await author.message('Select an object first, then press me')
} else {
  const colors = ['red', 'orange', 'gold', 'green', 'teal', 'navy', 'indigo', 'purple']
  const c = colors[Math.floor(Math.random() * colors.length)]
  for (const o of objs) await o.set({ color: c })
  await author.message('Coloured ' + objs.length + ' object(s) ' + c)
}
```

`color` accepts any colour name or CSS colour. Every patched object is one
undoable book edit.

### Recipe: group the selection and nudge it

```js
const sel = await author.getSelection()
if (sel.ids.length < 2) {
  await author.message('Select two or more objects, then press me')
} else {
  const g = await author.command('group')   // the handle IS the new group
  await g.move(20, 0)
  await author.message('Grouped ' + sel.ids.length + ' objects, nudged 20px right')
}
```

### Power primitives (id-based)

Handles cover the everyday flow. When you need more, these work with plain
ids (the `id` field of any handle):

- `await author.updateProps(id, patch)` — same as `handle.set(patch)`; pass
  `null` as the id to patch **every** selected object
- `await author.selectionJson()` — deep JSON of the whole selection
  (`Copy JSON` equivalent), rects and props included
- `await author.getSelection()` — `{ ids, names, kinds, pageName, target }`
- `await author.pageInfo()` — page/background names, plugin pages, object
  count and the canvas size
- `await author.command(action)` — also `'delete' | 'duplicate' | 'ungroup' |
  'front' | 'back' | 'forward' | 'backward'`; `ungroup` returns the freed ids

**Design note:** the bridge is deliberately small. Handles (selected /
insertControl / command) plus `set`/`get`/`move` cover what the editor does
to a selection; there is no per-need `move()`-style op at the top level —
geometry is just properties, applied by `set`.

### Recipe: a "title card" stamper

Plugin page **Stamper** (plugin-flagged, with a small fixed size): an input
named `titleIn`, and a button with the click script:

```js
const t = controls.titleIn.value || 'Untitled'
const made = await author.insertControl('card', {
  x: 80, y: 480, w: 480, h: 160,
  props: { title: t, color: 'navy' },
})
await author.message(`Stamped "${t}" (${made.name})`)
```

## Sandbox notes

- Scripts are **your own code**, running inside the app's canvas frame — nothing
  is blocked or sandboxed beyond that. All the normal web platform is available:
  `fetch`, `async/await`, `JSON`, `Math`, `Date`, timers, and so on.
- The store lives for the whole run and is shared by every page — it resets on
  each **Run**.
- Long-running loops freeze the canvas — that's ordinary JavaScript behavior.
