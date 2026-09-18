import { flattenObjects, newId, type Background, type Book, type Page, type PageObject } from '@toolback/format'

export interface MergeReport {
  pagesAdded: number
  backgroundsAdded: number
  /** names of existing backgrounds the generated pages were joined to */
  reusedBackgrounds: string[]
  /** generated background objects dropped because the background was reused */
  droppedBackgroundObjects: number
  renamedPages: string[]
  renamedObjects: string[]
}

export interface ModifyReport {
  renamedObjects: string[]
  keptObjects: number
  addedObjects: number
}

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base)
    return base
  }
  let n = 2
  while (taken.has(`${base}${n}`)) n++
  const name = `${base}${n}`
  taken.add(name)
  return name
}

function makeRewrite(nameMap: Map<string, string>): (src: string) => string {
  return (src) => {
    let out = src
    for (const [from, to] of nameMap) {
      if (from === to) continue
      out = out
        .split(`'${from}'`)
        .join(`'${to}'`)
        .split(`"${from}"`)
        .join(`"${to}"`)
        .replace(new RegExp(`\\b${from}\\b`, 'g'), to)
    }
    return out
  }
}

function rewriteHandlers(objs: PageObject[], rewrite: (src: string) => string): void {
  for (const o of objs) {
    o.on = Object.fromEntries(Object.entries(o.on).map(([ev, src]) => [ev, rewrite(src)]))
    if (o.children) rewriteHandlers(o.children, rewrite)
  }
}

/**
 * Replace a page's content with a generated page, keeping its id, name and
 * background. Object names that collide are renamed and every reference to them
 * in scripts/handlers is rewritten.
 *
 * With `keepExisting` (strict add-only), the target's existing objects are kept
 * verbatim — same ids, props, geometry and handlers — and only objects with new
 * names are added. That is what stops an "add one more button" request from
 * recolouring the buttons that were already there.
 */
export function applyModifiedPage(
  target: Page,
  source: Page,
  reservedNames: Iterable<string>,
  options: { keepExisting?: boolean } = {},
): ModifyReport {
  const beforeNames = new Set(flattenObjects(target.objects).map((o) => o.name))
  const nameMap = new Map<string, string>()
  const renamedObjects: string[] = []

  if (options.keepExisting) {
    const taken = new Set<string>([...reservedNames, ...beforeNames])
    const build = (objs: PageObject[], top: boolean): PageObject[] => {
      const out: PageObject[] = []
      for (const o of objs) {
        if (top && beforeNames.has(o.name)) continue
        const next = uniqueName(o.name, taken)
        if (next !== o.name) {
          nameMap.set(o.name, next)
          renamedObjects.push(`${o.name} → ${next}`)
        }
        out.push({
          ...o,
          id: newId('obj'),
          name: next,
          children: o.children ? build(o.children, false) : undefined,
        })
      }
      return out
    }
    const added = build(source.objects, true)
    const rewrite = makeRewrite(nameMap)
    rewriteHandlers(added, rewrite)
    target.script = rewrite(source.script)
    target.objects = [...target.objects, ...added]
  } else {
    const taken = new Set<string>(reservedNames)
    const walkNames = (objs: PageObject[]): void => {
      for (const o of objs) {
        const next = uniqueName(o.name, taken)
        if (next !== o.name) {
          nameMap.set(o.name, next)
          renamedObjects.push(`${o.name} → ${next}`)
        }
        if (o.children?.length) walkNames(o.children)
      }
    }
    walkNames(source.objects)
    const rewrite = makeRewrite(nameMap)
    const reid = (objs: PageObject[]): PageObject[] =>
      objs.map((o) => ({
        ...o,
        id: newId('obj'),
        name: nameMap.get(o.name) ?? o.name,
        on: { ...o.on },
        children: o.children ? reid(o.children) : undefined,
      }))
    const next = reid(source.objects)
    rewriteHandlers(next, rewrite)
    target.script = rewrite(source.script)
    target.objects = next
  }

  const afterNames = new Set(flattenObjects(target.objects).map((o) => o.name))
  return {
    renamedObjects,
    keptObjects: [...afterNames].filter((n) => beforeNames.has(n)).length,
    addedObjects: [...afterNames].filter((n) => !beforeNames.has(n)).length,
  }
}


const normalizeBgName = (name: string): string => name.trim().toLowerCase()

/**
 * Append an AI-generated book to the current one.
 *
 * A generated background whose name matches an existing background is **reused**
 * — the new pages join that background (so a "create a page" request does not
 * spawn a duplicate "Main") and its shared objects/script are kept. Genuinely
 * new backgrounds are appended as before (fresh ids). Page names are
 * de-duplicated because `page.go` resolves by name; when one is renamed,
 * references to it inside the incoming book are rewritten.
 *
 * When a page joins an existing background, its object names are checked against
 * that background's objects (they share one namespace at run time); collisions
 * are renamed and references to them rewritten, and any objects the model put on
 * the reused background are dropped (the existing shared shell wins).
 */
export function mergeGeneratedBook(
  current: Book,
  incoming: Book,
): { book: Book; report: MergeReport } {
  const book = JSON.parse(JSON.stringify(current)) as Book

  const usedPageNames = new Set(book.pages.map((p) => p.name))
  const pageNameMap = new Map<string, string>()
  const renamedPages: string[] = []
  for (const page of incoming.pages) {
    let name = page.name
    if (usedPageNames.has(name)) {
      let n = 2
      while (usedPageNames.has(`${page.name} ${n}`)) n++
      name = `${page.name} ${n}`
      renamedPages.push(`${page.name} → ${name}`)
    }
    usedPageNames.add(name)
    pageNameMap.set(page.name, name)
  }

  const rewrite = (source: string): string => {
    let out = source
    for (const [from, to] of pageNameMap) {
      if (from === to) continue
      out = out.split(`'${from}'`).join(`'${to}'`).split(`"${from}"`).join(`"${to}"`)
    }
    return out
  }

  const reid = (objs: PageObject[]): PageObject[] =>
    objs.map((o) => ({
      ...o,
      id: newId('obj'),
      on: Object.fromEntries(Object.entries(o.on).map(([ev, src]) => [ev, rewrite(src)])),
      children: o.children ? reid(o.children) : undefined,
    }))

  const byName = new Map<string, Background>()
  for (const bg of book.backgrounds) {
    const key = normalizeBgName(bg.name)
    if (!byName.has(key)) byName.set(key, bg)
  }

  const bgIdMap = new Map<string, string>()
  const reservedByBg = new Map<string, Set<string>>()
  const newBackgrounds: Background[] = []
  const reusedBackgrounds: string[] = []
  let droppedBackgroundObjects = 0
  for (const bg of incoming.backgrounds) {
    const key = normalizeBgName(bg.name)
    const existing = byName.get(key)
    if (existing) {
      bgIdMap.set(bg.id, existing.id)
      if (!reusedBackgrounds.includes(existing.name)) reusedBackgrounds.push(existing.name)
      reservedByBg.set(
        existing.id,
        new Set(flattenObjects(existing.objects).map((o) => o.name)),
      )
      droppedBackgroundObjects += flattenObjects(bg.objects).length
      continue
    }
    const fresh: Background = {
      ...bg,
      id: newId('bg'),
      script: rewrite(bg.script),
      objects: reid(bg.objects),
    }
    byName.set(key, fresh)
    bgIdMap.set(bg.id, fresh.id)
    newBackgrounds.push(fresh)
  }
  const fallbackBgId = newBackgrounds[0]?.id ?? book.backgrounds[0]!.id

  const renamedObjects: string[] = []
  for (const page of incoming.pages) {
    const backgroundId = bgIdMap.get(page.backgroundId) ?? fallbackBgId
    const reserved = reservedByBg.get(backgroundId)
    let objects: PageObject[]
    let script = rewrite(page.script)
    if (reserved && reserved.size) {
      const taken = new Set(reserved)
      const objMap = new Map<string, string>()
      const build = (objs: PageObject[]): PageObject[] =>
        objs.map((o) => {
          const next = uniqueName(o.name, taken)
          if (next !== o.name) {
            objMap.set(o.name, next)
            renamedObjects.push(`${o.name} → ${next}`)
          }
          return { ...o, id: newId('obj'), name: next, children: o.children ? build(o.children) : undefined }
        })
      objects = build(page.objects)
      const objRewrite = makeRewrite(objMap)
      rewriteHandlers(objects, objRewrite)
      script = objRewrite(script)
    } else {
      objects = reid(page.objects)
    }
    book.pages.push({
      ...page,
      id: newId('page'),
      name: pageNameMap.get(page.name) ?? page.name,
      backgroundId,
      script,
      objects,
    })
  }
  book.backgrounds.push(...newBackgrounds)

  return {
    book,
    report: {
      pagesAdded: incoming.pages.length,
      backgroundsAdded: newBackgrounds.length,
      reusedBackgrounds,
      droppedBackgroundObjects,
      renamedPages,
      renamedObjects,
    },
  }
}
