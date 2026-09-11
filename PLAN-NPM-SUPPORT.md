# Plan: npm library shelf for toolback4 exports

Status: planned (not started). Decisions locked in: auto-scan detection, esm.sh fallback with editor warning.

## Goal

Authors write `await import('@tonejs/midi')` in user scripts; preview works in the canvas; publish auto-scans scripts and embeds used libraries as data-URL importmap entries → offline, single-file exports. Uninstalled bare names fall back to esm.sh with an editor warning. Pure browser app throughout — publish stays client-side.

## Architecture (why this shape)

- **Declaration = `pnpm add`.** A new workspace package `packages/libs` whose package.json dependencies *are* the library shelf. Adding a lib is `pnpm --filter @toolback/libs add @tonejs/midi` — no allow-list, no config file.
- **Libs are pre-bundled to ESM** by a host-side esbuild step (esbuild is already a dependency via `apps/editor/scripts/build-player.mjs`). CJS deps get converted by esbuild; genuinely Node-only libs fail loudly at build time.
- **Importmap wiring**: canvas iframe gets a static importmap (dev-server URLs) for preview parity; exports get an inline importmap with `data:` URLs so only used libs travel with a book.
- **No player changes**: user scripts are `new Function` bodies (packages/runtime/src/player.ts). Dynamic `import()` already works inside them — object-event scripts are async-wrapped (player.ts:498) and `await import()` works inside async function definitions anywhere. Static `import` remains impossible (classic-script global scope).

Rejected alternatives (for the record):
- Baking libs into the player IIFE → every hello-world carries every lib forever.
- esbuild-wasm / browser bundling → would mean reimplementing npm dependency resolution client-side.
- CLI publish (node) → forks the publishing story; reserved for a possible later Electron/Tauri rung.
- CDN-only importmap → network dependency; offline npm shelf is the reliable path, esm.sh is the fallback.

## 1. Library shelf package — `packages/libs`

- New workspace package `packages/libs/package.json`: name `@toolback/libs`, `"main": "src/index.ts"` (trivial stub — its dependencies are the shelf), `"private": true`.
- Add to `pnpm-workspace.yaml` (check it uses `packages/*` glob — likely already covers it).
- Seed with one real test lib: `pnpm --filter @toolback/libs add @tonejs/midi`.
- Also add a tiny fixture lib (or a local fixture package under `packages/libs/fixtures/`) for deterministic tests.

## 2. Build step — `apps/editor/scripts/build-libs.mjs`

Runs before dev/build, right after `build-player.mjs` in both npm scripts (apps/editor/package.json:7-8):

- Read `packages/libs/package.json` `dependencies` → the shelf list.
- For each name: generate a virtual entry in a temp dir:
  ```js
  import * as m from 'NAME'
  export default m
  export * from 'NAME'
  ```
- esbuild: `bundle: true, format: 'esm', minify: true, outfile: apps/editor/public/libs/<name>.js` (nested path mirrors package name, e.g. `libs/@tonejs/midi.js`). Log a loud error per lib that fails to bundle.
- Emit `apps/editor/public/libs/importmap.json`: `{ "imports": { "@tonejs/midi": "/libs/@tonejs/midi.js" } }`.
- Emit `apps/editor/public/libs/manifest.json`: `[{ name, url, builtAt }]` for the editor UI hint list.

## 3. Preview parity — `apps/editor/canvas.html`

One line before the module script:

```html
<script type="importmap" src="/libs/importmap.json"></script>
```

Vite serves `public/` at root; the importmap resolves before any script runs. Note: canvas.ts is itself a module — the src-based importmap tag sits in the HTML head, so it is processed before module resolution (no "import map added after module load" error). An importmap injected from canvas.ts itself would be too late.

## 4. Publish — `apps/editor/src/publish.ts` (+ App.vue wiring)

- New `scanLibImports(book: Book): string[]` — regex over every script string (`Page.script`, `Background.script`, `PageObject.on.*`) for `import\s*\(\s*['"]([^'"]+)['"]`; keep bare specifiers only (skip `./`, `http(s):`, `data:`), dedupe. Precedent for scanning: `extractFunctionNames` (runtime/src/player.ts:52).
- `buildStandaloneHtml(book, playerJs, libs: { name, esmText }[])`:
  - For each lib: `data:text/javascript;base64,` + base64 of esm text (no escaping concerns — base64 alphabet contains no `<`, so the `</script>` breakout problem disappears).
  - Unknown bare names → importmap entry `https://esm.sh/<name>`; return a `warnings: string[]` alongside so App.vue can surface "not installed — run `pnpm --filter @toolback/libs add X`; falling back to esm.sh".
  - Emit inline `<script type="importmap">{...}</script>` as the **first** script tag (before `__TOOLBACK_BOOK__` and player).
- App.vue `onPublish`: fetch `/libs/importmap.json` to learn available names; fetch each used lib's text from `/libs/<name>.js` (same fetch pattern as the player, App.vue:296-307); pass through to `buildStandaloneHtml`; display warnings.

## 5. Runtime/docs — no player code changes needed

- `await import()` already works in object-event scripts (async IIFE, runtime/src/player.ts:498) and inside async functions in page/background scripts. Document in `docs/scripting-guide.md`: available libs (add via `pnpm --filter @toolback/libs add X`), the import syntax, and the top-level-await constraint (page/background script bodies are sync — player.ts:434, 358 — so imports belong inside functions).
- Update `docs/runtime-internals.md` invariant list with the importmap contract.

## 6. Tests

- `publish.test.ts`: extend — scan picks imports from all three script locations, skips relative/URL specifiers, dedupes; `buildStandaloneHtml` emits the importmap first, base64 payloads contain no `<` / `</script`, esm.sh fallback entries for unknown names.
- New `build-libs` test (node env, real esbuild): bundles a tiny fixture package to ESM text + importmap.json shape.
- Existing self-containment tests keep passing (they assert no external URLs — data: URL importmap entries must not trip them; esm.sh entries only when fallback is triggered — assert the warning is reported).

## 7. Verification

- `pnpm test` (199 existing + new), `pnpm typecheck`.
- Manual: export the Hello example using `await import('@tonejs/midi')`, open the HTML from `file://` with network off → works. Open the same book in the editor canvas → works.
- Playwright sanity check: data:-URL modules + inline importmap in current Chrome/Firefox/Safari. Support floor to document: Chrome ~89, Firefox 108, Safari 16.4.

## Out of scope (later rungs)

- `book.libraries` schema field for explicit pinning/overriding (scan is the sole mechanism for now).
- Editor UI shelf browser (manifest.json endpoint exists for it when wanted).
- Bundling user code (not just libs) into the export.
- CLI publish / Electron / Tauri export rungs.
- Trimming zod from the player bundle (independent cleanup, see research notes).