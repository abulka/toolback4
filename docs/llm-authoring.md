# toolback — book authoring spec (for language models)

You generate **one** toolback book as JSON. A toolback book is a small app:
`book → pages → objects`, scripted in **plain JavaScript**. Return the JSON
object only — no prose, no markdown fences.

A book always crosses into the runtime as a JSON clone, so every value you write
must be JSON data (no functions, `undefined`, or comments).

---

## 1. Book shape

```jsonc
{
  "id": "book_myapp",            // any unique string
  "title": "My App",
  "backgrounds": [               // shared objects shown on every page that uses them
    {
      "id": "bg_main",
      "name": "Main",
      "color": "#0f172a",        // page fill colour
      "script": "",              // shared functions + backgroundEnter()
      "objects": []
    }
  ],
  "pages": [
    {
      "id": "page_main",
      "name": "Main",            // page.go / popupOpen resolve pages BY NAME
      "script": "function pageEnter() {\n  store.set('n', 0)\n}\n",
      "backgroundId": "bg_main", // must match a background id
      "objects": [ /* PageObject[] */ ]
    }
  ],
  "startPageId": "page_main",    // optional; first page if omitted
  "store": []                    // optional design-time seed: [[key, value], ...]
}
```

`formatVersion` is managed by the loader — omit it. The current build stamps the
version on every parsed book and rejects a book from a newer toolback.

### PageObject

```jsonc
{
  "id": "obj_ok",                          // unique across the whole book
  "name": "okBtn",                         // unique + a valid JS identifier
  "control": "button",                     // one of the control kinds below
  "x": { "mode": "left", "left": 40, "width": 140 },  // horizontal edge constraint
  "y": { "mode": "top", "top": 240, "height": 48 },   // vertical edge constraint
  "props": { "text": "OK" },
  "on": { "click": "store.set('done', true)" },        // event -> plain-JS handler body
  "children": []                           // groups only
}
```

---

## 2. Geometry — edge constraints

An object does **not** store a plain `x/y/w/h`. It stores the page (or parent
group) edges it follows, so the browser can reflow it. Think in a rect
`(x, y, w, h)`, then pick one horizontal and one vertical mode:

| Intent | `x` | `y` |
| --- | --- | --- |
| Fixed top-left (the default) | `{"mode":"left","left":X,"width":W}` | `{"mode":"top","top":Y,"height":H}` |
| Anchored to the right/bottom | `{"mode":"right","right":R,"width":W}` | `{"mode":"bottom","bottom":B,"height":H}` |
| Stretches with the page | `{"mode":"both","left":L,"right":R}` | `{"mode":"both","top":T,"bottom":B}` |
| Centred | `{"mode":"center","width":W}` | `{"mode":"center","height":H}` |

Rules of thumb:

- **New objects are `left` + `top`.** Put `left: x`, `width: w`, `top: y`,
  `height: h` — that is the usual choice.
- `right`/`bottom` mean "keep this many pixels from that edge", so compute
  `right = pageWidth − (x + w)` if you are thinking in rects.
- Use `both` only for things that should grow with the page (a full-width bar,
  a content panel with fixed gutters).
- A group's members constrain against the **group box**, not the page.
- Give every object a positive width and height (minimum 1).

---

## 3. Controls and properties

The exact list of control kinds and the properties each supports is appended to
this spec at request time from the app's capability manifest (the single source
of truth). Only use a control kind and property names that appear there.
Unknown properties are ignored and reported as warnings.

Most text controls also accept a set of styling props, and box controls
(button, label, input, card, container, image, markdown, html) accept
`borderWidth`, `borderStyle` (`'solid' | 'dashed'`), `borderColor`, `radius` and
`opacity` (0–1); a switch accepts `trackColor`. Use these to give an app a
consistent look instead of inventing CSS.

---

## 4. Scripting API

Scripts are plain modern JavaScript (no TypeScript annotations). Two homes:

- **Page script** (`page.script`): shared `function`s any object script can call,
  plus `pageEnter()` (runs when the page opens) and `pageLeave()`.
- **Object scripts** (`object.on.<event>`): the handler body for one event.
  Events: `click`, `dblclick`, `change`, `input`, `mouseenter`, `mouseleave`.

The API table (appended from the manifest) lists `store`, `controls`, `page`,
`event`, `target`, `self`, `forward()` and the plugin-only `author` bridge.

`{{key}}` in a **text** property is a live binding: it shows `store.get('key')`
and updates on every `store.set`. Seed starting values in `pageEnter()`.

---

## 5. Rules and gotchas

1. **Unique, valid names.** Every `name` is a JavaScript identifier and unique
   within its page or background. A page's objects and its background's objects
   share **one** namespace.
2. **Unique ids.** Every object/page/background `id` is unique.
3. **Plain JavaScript.** No `: string`, no `interface`, no imports at top level.
   `await import('pkg')` works inside `async` functions and event handlers.
4. **References must resolve.** `controls.<name>` must name a real object;
   `page.go('X')` / `page.popupOpen('X')` must name a real page.
5. **Seeded keys.** A `{{key}}` binding should have a value: set it in
   `pageEnter()` or list it in `book.store`.
6. **Groups** have no props of their own — put content in the members.
7. Return JSON only. Do not wrap it in a code fence.

---

## 5a. Editing an existing book

When you are asked to change or extend an existing book, the current book (or
page + background) is provided. **Reproduce every existing object exactly as it
was given** — identical `id`, `name`, `control`, `x`, `y`, `props`, `on` and
`children` — and change only what the request asks for. In particular:

- Never recolour, restyle, move, resize, rename or remove an existing object
  unless the request explicitly names it.
- For an **add-only** request ("add another button", "insert a label"), add the
  new object(s) and leave all existing objects byte-for-byte unchanged. Do not
  "tidy up" or re-theme the page.
- Preserve page names, backgrounds and every other page.
- Keep existing `props` key order and values exactly.
- When adding a page to an existing app, put it on an existing background by
  giving your background **exactly the same `name`** as that background (usually
  the current one) and leaving the background's `objects` empty — the app keeps
  the existing shared objects and script. Only invent a new background name when
  the request needs a distinct surface (for example a popup, whose size comes from
  its background). `page.go('Name')` can navigate to any existing page by name.
- Call the shared background functions by name to reuse them, and **do not
  define a page function with the same name** as one of them — the page version
  silently shadows the shared one. The current background's function names are
  listed in the request context.

The app keeps existing objects verbatim for add-only requests and only accepts
new objects, so any edits you make to existing objects will simply be ignored.

---

## 6. Worked example — a working calculator

One page, a display label bound to `{{display}}`, and 16 buttons. The page
script holds the state machine; each button calls one helper.

```json
{
  "id": "book_calculator",
  "title": "Calculator",
  "backgrounds": [
    { "id": "bg_calc", "name": "Calculator", "color": "#0f172a", "script": "", "objects": [] }
  ],
  "pages": [
    {
      "id": "page_calc",
      "name": "Calculator",
      "script": "function pageEnter() {\n  store.set('display', '0')\n  store.set('acc', null)\n  store.set('op', null)\n  store.set('fresh', true)\n}\n\nfunction digit(d) {\n  const cur = String(store.get('display'))\n  const fresh = store.get('fresh')\n  let next\n  if (fresh || cur === '0') next = String(d)\n  else next = cur + d\n  store.set('display', next)\n  store.set('fresh', false)\n}\n\nfunction compute() {\n  const acc = store.get('acc')\n  const op = store.get('op')\n  const cur = Number(store.get('display'))\n  if (op === null || acc === null) {\n    store.set('acc', cur)\n    return\n  }\n  let result = acc\n  if (op === '+') result = acc + cur\n  else if (op === '-') result = acc - cur\n  else if (op === '*') result = acc * cur\n  else if (op === '/') result = cur === 0 ? 0 : acc / cur\n  store.set('acc', result)\n  store.set('display', String(Math.round(result * 1e10) / 1e10))\n}\n\nfunction chooseOp(o) {\n  compute()\n  store.set('op', o)\n  store.set('fresh', true)\n}\n\nfunction equals() {\n  compute()\n  store.set('op', null)\n  store.set('acc', null)\n  store.set('fresh', true)\n}\n\nfunction clearAll() {\n  store.set('display', '0')\n  store.set('acc', null)\n  store.set('op', null)\n  store.set('fresh', true)\n}\n",
      "backgroundId": "bg_calc",
      "objects": [
        {
          "id": "obj_calc_display",
          "name": "display",
          "control": "label",
          "x": { "mode": "left", "left": 40, "width": 310 },
          "y": { "mode": "top", "top": 30, "height": 60 },
          "props": { "text": "{{display}}", "fontSize": 28, "textAlign": "right", "textColor": "#f8fafc", "background": "#1e293b" },
          "on": {}
        },
        {
          "id": "obj_calc_7",
          "name": "btn7",
          "control": "button",
          "x": { "mode": "left", "left": 40, "width": 70 },
          "y": { "mode": "top", "top": 170, "height": 50 },
          "props": { "text": "7", "fontSize": 18 },
          "on": { "click": "digit(7)" }
        }
      ]
    }
  ],
  "startPageId": "page_calc",
  "store": []
}
```

The full 16-button version lives at `examples/calculator.toolback.json`; open it
to see the complete layout. Every button follows the same pattern:

```json
{ "control": "button", "props": { "text": "7" }, "on": { "click": "digit(7)" } }
```

---

## 7. Capability manifest (appended at request time)

The sections below are generated from the running app, so they always match the
controls and script API this build understands. Use only what is listed.

<!-- CAPABILITY_MANIFEST -->
