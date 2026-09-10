# toolback scripting guide

Scripts are **plain modern JavaScript**. No special language to learn — if you can
write JavaScript, you already know toolback scripting. This guide covers everything
you can use inside a script, plus recipes you can copy straight into your book.

## Where scripts live

There are two places a script can live:

- **Object script** — select an object on the canvas, open the **Script** section in
  the properties panel, pick an **event** (click, change, input…), and write the
  handler body. It runs every time that event fires on that object.
- **Page script** — the **Page script** panel in the properties sidebar. Define
  functions once here and call them from any object script. Also the home of
  `pageEnter()`, which runs when you press **Run**.

## How names work

Every object gets a name when you drop it on the canvas: `button1`, `label1`,
`input2`, … You can see (and reference) names in the **Objects** list and in the
**Selection** header of the properties panel. Names are how one object talks to
another: `controls.button1`, `controls.nameInput` — or just `button1`,
`nameInput` (object names are usable as plain identifiers in any script; see the
[controls](#controls) section).

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

- `text` — the text of a button or label (for an input, this is its value)
- `value` — the value of an input
- `visible` — `true`/`false`, show or hide the object
- `enabled` — `true`/`false`, enable or disable (buttons and inputs)

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

## Dynamic labels

Put `{{key}}` in a label or button's **Text** property and it stays live:

- label text: `Count: {{count}}` → re-renders every time `store.set('count', …)` runs
- a key that was never set renders as empty text

This is how object state becomes visible text.

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

## Debugging

- Script errors appear in the editor **status bar**, tagged with where they came
  from (`button1.click: Error: …`, `page script: SyntaxError: …`).
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
