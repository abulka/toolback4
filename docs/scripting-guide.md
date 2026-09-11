# toolback scripting guide

Scripts are **plain modern JavaScript**. No special language to learn — if you can
write JavaScript, you already know toolback scripting. This guide covers everything
you can use inside a script, plus recipes you can copy straight into your book.
(For how it all works under the hood — script compilation, the forward
dispatch chain, the editor↔canvas protocol — see
[runtime-internals.md](./runtime-internals.md).)

## Where scripts live

There are two places a script can live:

- **Object script** — select an object on the canvas, open the **Script** section in
  the properties panel, pick an **event** (click, change, input…), and write the
  handler body. It runs every time that event fires on that object.
- **Page script** — the **Page script** panel in the properties sidebar. Define
  functions once here and call them from any object script. Also the home of
  `pageEnter()`, which runs when you press **Run** (shortcut: `F3` or `⌥3`).

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

## Copy JSON

The Selection panel has a **{ } JSON** button (next to the object name; the
multi-selection panel has a **Copy JSON** action). It copies the selected
object — including any sub-objects — to the clipboard as pretty-printed JSON
(a multi-selection copies an array). Handy for inspecting and describing
structures, and the seed of a future copy/paste feature.

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

### controls

`controls.<name>` gives you every object on the page, by name.

**Shorthand:** object names are also available directly — `button2.text = 'fred'`
is exactly the same as `controls.button2.text = 'fred'`. This works in page
scripts and object scripts, and you can read too (`if (input1.value === '') …`).

Get/set properties:

- `text` — the text of a button or label (for an input, this is its value; for
  a switch, its label text)
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
across `page.go` navigations. Each breakpoint (desktop/tablet/mobile) keeps its
own position, so editing `x` while running the desktop preview only changes the
desktop rect.

Methods:

- `on(event, fn)` — attach an extra handler in code,
  e.g. `controls.myButton.on('click', () => { ... })`
- `el` — the raw DOM element, if you need something the API above doesn't cover

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

## Groups

Select several objects (shift-click, or drag a box on empty canvas) and press
**Group** in the Selection panel (or `⌥G` / Alt+G — works with the canvas
focused too). The group is a parent object: it has a name
(`group1`, …), a position, and its own Script section. **Ungroup** (`⌥U` /
Alt+U) releases the members back.

What a group gives you:

- **Move as one** — dragging the group (or setting its `x`/`y`) moves every
  member. Resizing the group scales members proportionally.
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
  or resizing a member recomputes it to the minimum bounds.
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
  only that member, never its enclosing groups.
- **Nesting** — groups can contain groups.
- **Ungrouping** discards the group's own scripts — the editor asks first.

`text` and `value` do nothing on a group (a group has no text of its own);
members carry content, the group carries behaviour and position.

## Autocomplete and error squiggles

The script editors help as you type:

- **Ctrl+Space** opens a short, curated list — *only* toolback things: your
  objects (first), the API (`store`, `page`, `controls`, `event`, `target`,
  `self`), and ready-made templates. No thousands of irrelevant browser
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

## Debugging

- Script errors appear in the editor **status bar**, tagged with where they came
  from (`button1.click: Error: …`, `page script: SyntaxError: …`).
- The **Store tab** in the right-hand panel is a live view of the store while a
  run is active — every `store.set()` shows up there as it happens. It clears
  when you stop.
- `console.log(...)` writes to the browser devtools console — open devtools and
  pick the canvas frame's context.
- Referencing an object that doesn't exist gives `undefined` — e.g. setting a
  property on it reports `Cannot set properties of undefined`. Check the
  spelling against the Objects list.
- If you press Run and a page's `pageEnter` seems to run more than expected,
  press Stop and Run again to start a fresh session.
- The store resets every time you press **Run**. Edits made while running re-run
  the page, so it's a live-coding loop.

## Pages and navigation

The **Pages** panel (left sidebar) manages the book's pages:

- click a page to edit it; press **Run** to play the page you're editing
  (shortcut: `F3` or `⌥3` — works even when the canvas has focus)
- **double-click a page name** to rename it
- ⧉ duplicates a page — objects, properties and scripts included
- ✕ deletes it (a book always keeps at least one page)
- **+ Add page** appends a fresh page

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

## Sandbox notes

- Scripts are **your own code**, running inside the app's canvas frame — nothing
  is blocked or sandboxed beyond that. All the normal web platform is available:
  `fetch`, `async/await`, `JSON`, `Math`, `Date`, timers, and so on.
- The store lives for the whole run and is shared by every page — it resets on
  each **Run**.
- Long-running loops freeze the canvas — that's ordinary JavaScript behavior.
