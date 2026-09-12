# Plan: npm library support for toolback4

Status: **implemented** (CDN-primary, shelf-optional offline upgrade). Decisions locked in: auto-scan detection, esm.sh as the default resolver, library shelf for offline exports.

## Goal

Authors write `await import('@tonejs/midi')` in user scripts; preview and export
behave identically. Exports resolve packages through esm.sh by default (works
everywhere, needs network); packages installed on the library shelf
(`packages/libs` dependencies) are embedded as inline base64 `data:` URLs so
exported books stay offline and self-contained. Pure browser app throughout —
publish stays client-side.

## Architecture (why this shape)

- **No import map at all.** User scripts are `new Function` bodies in classic
  script scope; instead of import maps, every compile site
  (`player.ts` background/page/object-event factories, `author.ts` factories)
  rewrites bare dynamic imports to an injected `__tbImport(spec)` resolver
  (`packages/runtime/src/libs.ts`, `rewriteLibImports`).
- **`__tbImport` resolution order**: `window.__TOOLBACK_LIBS__[spec]` (set at
  publish as data: URLs for shelf hits; set in preview from the shelf manifest
  at canvas boot) → else `https://esm.sh/<spec>` for bare names → native
  `import()` for non-bare specifiers (URLs, data:).
- **CJS normalization**: bundled CommonJS packages surface as
  `{default: exports}`; the resolver unwraps that so named destructuring works
  (`const { Midi } = await import('@tonejs/midi')`). Real ESM namespaces pass
  through; default-only ESM modules come back as their default.
- **Declaration = `pnpm add`** (offline shelf only): dependencies of
  `packages/libs` are pre-bundled by `apps/editor/scripts/build-libs.mjs` to
  ESM under `apps/editor/public/libs/<name>.js` + `importmap.json` manifest.
  CJS deps convert via esbuild; the resolver's default-unwrap makes even
  `default`-only bundles destructure correctly.
- **Detection = auto-scan**: publish scans every script string for
  `import('...')` (same regex as the rewrite), maps shelf hits to data: URLs,
  everything else to esm.sh, and shows status-bar warnings for non-shelf
  imports (they need network at runtime).
- Hosted toolback means users can never run local npm installs — CDN-primary
  was chosen over local-installs-are-the-norm; the shelf is the opt-in offline
  path, not the requirement.

Rejected alternatives (for the record):
- `<script type="importmap">` (inline data URLs in exports) — worked, but
  browser support floor (importmap + data: modules) and no clean preview story
  for per-book CDN imports; the resolver approach has no floor and identical
  behavior in preview/export.
- Baking libs into the player IIFE → every hello-world carries every lib forever.
- esbuild-wasm / browser bundling → reimplementing npm dependency resolution client-side.
- CLI publish (node) → forks the publishing story; reserved for a possible later Electron/Tauri rung.

## Implemented pieces

1. **`packages/libs`** — the shelf package; its dependencies are the shelf.
   Seeded with `@tonejs/midi`. `pnpm --filter @toolback/libs add X` = declare.
2. **`apps/editor/scripts/build-libs.mjs`** — bundles each shelf dep to ESM at
   `public/libs/<name>.js` + `public/libs/importmap.json` + `manifest.json`;
   wired into editor dev/build npm scripts; per-lib loud errors.
3. **`packages/runtime/src/libs.ts`** — `rewriteLibImports`, `toolbackImport`
   (map → esm.sh → CJS normalize, per-spec promise cache), `scanLibImports`,
   `basePackageName`, `isBareSpecifier`, `normalizeModule`, `setLibMap`,
   `loadShelfManifest`. Exported from the runtime index.
4. **Compile sites** — `player.ts` (background/page/object-event) and
   `author.ts` (page/object-event) rewrite script bodies and inject
   `__tbImport` as a reserved param; `NAME_RESERVED` includes `__tbImport`.
5. **Preview parity** — `editorLink.listenForEditor()` fetches
   `/libs/importmap.json` at boot and calls `setLibMap`; unknown imports fall
   back to esm.sh at runtime, exactly like exports.
6. **Publish** — `apps/editor/src/publish.ts`: `libUrlMapFor(specifiers,
   shelf)` maps shelf hits to base64 data: URLs (App.vue fetches
   `/libs/<name>.js` and base64s it) and non-shelf names to esm.sh with
   warnings; `buildStandaloneHtml` embeds
   `<script>window.__TOOLBACK_LIBS__=…</script>` between book JSON and player,
   `<`-escaped like the book.
7. **Docs** — scripting-guide "npm libraries" section + runtime-internals §9
   and invariant 7.
8. **Tests** — publish scan/map/embed coverage, runtime libs unit tests
   (rewrite, normalize, bare rules), build-libs bundling test. Browser-verified
   via playwright: shelf `@tonejs/midi` destructuring (offline data: URL, zero
   network) and `nanoid` via esm.sh both work from an exported file.

## Remaining / later rungs

- `book.libraries` schema field for explicit pinning (scan is the sole
  mechanism; warnings surface uninstalled imports).
- Bundling user code (not just libs) into the export.
- CLI publish / Electron / Tauri export rungs.
- Trimming zod from the player bundle (independent cleanup).
- Book script layer (see PLAN.md backlog) — the proper home for global
  imports; until then the documented pattern is `backgroundEnter()` +
  `window` stash.
- Shipped since first draft: npm import helper popup in the editor
  (`components/ImportHelper.vue` — README snippet → toolback syntax + shelf
  status), kitchen-sink Npm demo page, `@version` pinning shelf-matching.