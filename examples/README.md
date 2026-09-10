# toolback example books

Ready-made `.toolbook.json` books you can open in the editor and play or take
apart: **Open…** in the file bar (or just open one from your OS's file dialog).

| Book | Demonstrates |
| --- | --- |
| `hello-counter.toolbook.json` | The classic first book: `pageEnter` seeding the store, a click script, a `{{count}}` dynamic label. Start here. |
| `quiz.toolbook.json` | Two pages with `page.go` navigation, per-page `pageEnter` lifecycle, a score travelling through the shared store. |
| `kitchen-sink.toolbook.json` | Everything at once — see below. |

## Kitchen sink

**Home** page:

- all six controls: container, card, input, label, button, image
- every event: `click`, `dblclick`, `input`, `change`, `mouseenter`, `mouseleave`
- `{{key}}` dynamic labels (`Hi {{who}}`, `Clicks: {{clicks}}`, …)
- scripted geometry: `box.x += 24`, `box.width += 20`, `box.visible = !box.visible`,
  `clickButton.enabled = !clickButton.enabled`
- a shared page function (`resetDemo`) called from a button script
- `pageEnter` reading `page.name` / `page.names`

**Playground** page:

- an `await`-based drop-in animation driven by `x`/`y` in `pageEnter`
- `pageLeave` recording that you visited (visible back on Home)
- `Math.random()` + geometry in a click script

Open any object's **Script** section to see the code behind each behaviour.
