<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { basePackageName } from '@toolback/runtime'

/**
 * npm import helper: paste a package's README install snippet (ESM import,
 * require, unpkg script tag, npm/pnpm install command, or a bare package
 * name) and get the toolback import syntax, plus whether the package is on
 * the offline shelf.
 */

const open = ref(false)
const source = ref('')
const shelfNames = ref<Set<string>>(new Set())

watch(open, async (v) => {
  if (v) {
    window.addEventListener('keydown', onKey)
    try {
      const res = await fetch('/libs/importmap.json')
      if (res.ok) {
        const json = (await res.json()) as { imports?: Record<string, string> }
        shelfNames.value = new Set(Object.keys(json.imports ?? {}))
      }
    } catch {
      /* shelf lookup is advisory only */
    }
  } else {
    window.removeEventListener('keydown', onKey)
  }
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') open.value = false
}
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

interface Parsed {
  pkg: string | null
  names: string[]
  style: 'named' | 'default' | 'bare'
}

function parseSnippet(src: string): Parsed {
  const text = src.trim()
  if (!text) return { pkg: null, names: [], style: 'bare' }

  const urlMatch = text.match(/https?:\/\/[^\s"'>]+/)
  if (urlMatch) {
    return { pkg: pkgNameFromUrl(urlMatch[0]), names: [], style: 'bare' }
  }

  const named = text.match(/import\s*\{\s*([^}]+?)\s*\}\s*(?:as\s+\w+\s+)?from\s*['"]([^'"]+)['"]/)
  if (named) {
    const names = named[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/\s+as\s+/, ': '))
    return { pkg: named[2], names, style: 'named' }
  }

  const mixed = text.match(/import\s+(\w+)\s*,\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]([^'"]+)['"]/)
  if (mixed) {
    return {
      pkg: mixed[3],
      names: [
        'default: ' + mixed[1]!,
        ...mixed[2]!
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ],
      style: 'named',
    }
  }

  const star = text.match(/import\s*\*\s*as\s+(\w+)\s*from\s*['"]([^'"]+)['"]/)
  if (star) return { pkg: star[2], names: [star[1]!], style: 'bare' }

  const def = text.match(/import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/)
  if (def) return { pkg: def[2], names: [def[1]!], style: 'bare' }

  const req = text.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/)
  if (req) return { pkg: req[2], names: [req[1]!], style: 'bare' }

  const install = text.match(/(?:npm\s+(?:install|i)|pnpm\s+add|yarn\s+add|bun\s+add)\s+(@?[\w.-]+(?:\/[\w.-]+)?)/)
  if (install) return { pkg: install[1], names: [], style: 'bare' }

  const bare = text.match(/^(@[\w-]+\/[\w.-]+|[\w-]+(?:[\/.][\w.-]+)*)(?:@[\w.-]+)?\s*$/)
  if (bare) return { pkg: bare[1], names: [], style: 'bare' }

  return { pkg: null, names: [], style: 'bare' }
}

/** extract the npm package name from a CDN URL (unpkg / jsDelivr / esm.sh / skypack) */
function pkgNameFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '').replace(/^(npm|package)\//, '')
    const segs = path.split('/').filter(Boolean)
    if (segs.length === 0) return null
    const name = segs[0]!.startsWith('@') ? segs.slice(0, 2).join('/') : segs[0]!
    return name.replace(/@[^@/]+$/, '') || null
  } catch {
    return null
  }
}

const parsed = computed(() => parseSnippet(source.value))

const toolbackLine = computed(() => {
  const { pkg, names, style } = parsed.value
  if (!pkg) return null
  const spec = `'${pkg}'`
  if (style === 'named' && parsed.value.names.length > 0) {
    return `const { ${parsed.value.names.join(', ')} } = await import(${spec})`
  }
  if (parsed.value.names.length === 1) {
    return `const ${parsed.value.names[0]} = await import(${spec})`
  }
  return `const pkg = await import(${spec})`
})

const onShelf = computed(() => {
  const { pkg } = parsed.value
  return !!pkg && shelfNames.value.has(basePackageName(pkg))
})

const shelfNote = computed(() => {
  const { pkg } = parsed.value
  if (!pkg) return ''
  return onShelf.value
    ? `${basePackageName(pkg)} is on the library shelf — imports are embedded offline in exports.`
    : `Not on the shelf — imports resolve via esm.sh at runtime (needs network). For offline exports: pnpm --filter @toolback/libs add ${basePackageName(pkg ?? '')}`
})
</script>

<template>
  <button class="tb-npm-btn" title="npm import helper — paste package docs, get toolback syntax" @click.stop="open = true">npm</button>
  <Teleport to="body">
    <div v-if="open" class="tb-help-overlay" @click.self="open = false">
      <div class="tb-help-modal" role="dialog" aria-modal="true" aria-label="npm import helper">
        <header class="tb-help-header">
          <span>toolback · npm import helper</span>
          <button class="tb-help-close" title="Close" @click="open = false">×</button>
        </header>
        <div class="tb-npm-content">
          <p class="tb-npm-lead">
            Paste an install line from any package's README (ESM import, require,
            unpkg/jsDelivr script tag, npm/pnpm command, or just the package name) —
            toolback imports are the same line, awaited inside a function.
          </p>
          <textarea
            v-model="source"
            class="tb-npm-input"
            spellcheck="false"
            placeholder="import { Midi } from '@tonejs/midi'"
          ></textarea>
          <template v-if="toolbackLine">
            <div class="tb-npm-outlabel">toolback syntax:</div>
            <pre class="tb-npm-out"><code>{{ toolbackLine }}</code></pre>
            <div class="tb-npm-note" :class="{ shelf: onShelf }">{{ shelfNote }}</div>
            <pre class="tb-npm-out"><code>// inside a script — object event scripts are async, so this works directly:
{{ toolbackLine }}
// …or wrap it in a page/background function:
async function useIt() {
  {{ toolbackLine }}
  // …use it here
}</code></pre>
          </template>
          <p v-else-if="source.trim()" class="tb-npm-note">
            Couldn't parse that — paste the import line, the CDN script tag, the
            npm/pnpm install command, or the plain package name.
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.tb-npm-btn {
  height: 18px;
  border-radius: 9px;
  border: 1px solid var(--ed-border);
  background: var(--ed-bg);
  color: var(--ed-text-dim);
  font: 600 10px/1 system-ui, sans-serif;
  cursor: help;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.tb-npm-btn:hover {
  color: #fff;
  border-color: var(--ed-accent);
}

.tb-npm-content,
.tb-npm-lead {
  font: 14px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #d3d8e0;
}

.tb-npm-content {
  overflow-y: auto;
  padding: 20px 26px 30px;
  width: 760px;
  max-width: 100%;
  max-height: 85vh;
}

.tb-npm-lead {
  margin: 0 0 12px;
}

.tb-npm-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 64px;
  resize: vertical;
  background: #0f1115;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  color: #d3d8e0;
  font: 13px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
  padding: 10px 12px;
}

.tb-npm-input:focus {
  outline: none;
  border-color: var(--ed-accent);
}

.tb-npm-outlabel {
  margin: 14px 0 4px;
  font: 600 12px/1 system-ui, sans-serif;
  color: var(--ed-text-dim);
}

.tb-npm-out {
  background: #0f1115;
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 4px 0 10px;
  color: #9fe8c5;
  font: 13px/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
}

.tb-npm-note {
  font: 12px/1.5 system-ui, sans-serif;
  color: var(--ed-text-dim);
  margin: 0 0 10px;
}

.tb-npm-note.shelf {
  color: #9fe8c5;
}
</style>