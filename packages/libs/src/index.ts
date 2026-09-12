/**
 * The library shelf is intentionally empty: dependencies declared in this
 * package's package.json are what build-libs.mjs pre-bundles to ESM under
 * apps/editor/public/libs/. Scripts in books can then `await import('name')`.
 */
export {}