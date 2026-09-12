# toolback example books

Ready-made `.toolbook.json` books you can open in the editor and play or take
apart: **Open…** in the file bar (or just open one from your OS's file dialog).

| Book | Demonstrates |
| --- | --- |
| `hello-counter.toolbook.json` | The classic first book: `pageEnter` seeding the store, a click script, a `{{count}}` dynamic label. Start here. |
| `quiz.toolbook.json` | Two pages with `page.go` navigation, per-page `pageEnter` lifecycle, a score travelling through the shared store. |
| `author-plugin.toolbook.json` | **Author-mode plugin**: the "Poster" page is plugin-flagged (⚡) with buttons that recolour the current selection and group-and-move it. See below. |
| `kitchen-sink.toolbook.json` | Everything at once — see below. |

## Author plugin demo

The **Poster** page is ticked as a *Plugin page* (Page tab). Open the book,
press **⚡** in the top bar, run **Poster**, then select objects on the
**Playground** page (shift-click for several) and press the plugin's buttons
while the book stays editable:

- **Random colour** — reads the selection through the bridge and patches each
  selected object's `color` prop
- **Group + 20px right** — groups the selection with `author.command('group')`
  (which returns the new group's handle) and writes its `x` via
  `author.updateProps` — geometry is just properties

Everything the plugin does is ordinary book history: ⌘Z reverts it. The
scripts are documented (and copyable) in the scripting guide's
*Author plugins* section.

## Kitchen sink

A guided tour — the **Home** page is a menu, and every page demonstrates one
feature with explanatory text, a live demo, and a "where the scripts live"
tip (open any object's **Script** section — scripted events are marked with
a `•` in the event dropdown):

| Page | Demonstrates |
| --- | --- |
| **Home** | The feature menu — each button is one line: `page.go('…')`. `{{pages}}` / `{{where}}` labels via `pageEnter`. |
| **Store** | `store.set`/`store.get`, `{{key}}` live labels, an input with `input` + `change` handlers, click counting with a `dblclick` reset, `enabled` toggling. |
| **Self** | `{{self.name}}` name tags (duplicate a button — the copy shows its own name), `self` in scripts, `self` vs `target`, the `this` alias. |
| **Groups** | A group holding two buttons **and a nested group**: the `forward()` rule (a handler stops unless it forwards; script-less objects let the event pass up), `target` = member, `self` = group. |
| **Motion** | Scripted geometry (`x`/`y`/`width`/`height`), an `await` drop-in animation in `pageEnter`, `pageLeave` recording the visit, a shared page function (`resetBox`). |
| **Events** | `click` / `dblclick` / `mouseenter` / `mouseleave` on one button, `input` / `change` on a field — all writing to the store. |
| **Editor** | Design-mode features with a practice group: undo/redo, duplicate (⧉ / ⌥D), group/ungroup (⌥G / ⌥U), Copy JSON, drill-in navigation. |
| **Npm** | Dynamic `await import(...)` of npm packages: build & re-parse a two-note MIDI with `@tonejs/midi` (data path), play it through Tone.js (audio path), and download it as a `.mid` Blob (file path). |

A runtime deep-dive of everything the demos touch lives in
[../docs/runtime-internals.md](../docs/runtime-internals.md).
