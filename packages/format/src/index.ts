import { z } from 'zod'

export const CONTROL_KINDS = [
  'button',
  'label',
  'input',
  'image',
  'card',
  'container',
  'switch',
  'group',
  'markdown',
  'html',
] as const
export type ControlKind = (typeof CONTROL_KINDS)[number]

/**
 * Edge constraints: a control stores the distance(s) it keeps from the page
 * edges it follows, like CSS `left`/`right`/`top`/`bottom`.
 *
 * Horizontal:
 *   left   keeps `left` px from the left edge and its own width
 *   right  keeps `right` px from the right edge and its own width
 *   both   keeps both margins, so the width grows/shrinks with the page
 *   center keeps its width and stays in the middle
 *
 * Vertical mirrors with top / bottom / both / center on the height. Member
 * objects constrain against their group box instead of the page.
 */
export type XEdge =
  | { mode: 'left'; left: number; width: number }
  | { mode: 'right'; right: number; width: number }
  | { mode: 'both'; left: number; right: number }
  | { mode: 'center'; width: number }

export type YEdge =
  | { mode: 'top'; top: number; height: number }
  | { mode: 'bottom'; bottom: number; height: number }
  | { mode: 'both'; top: number; bottom: number }
  | { mode: 'center'; height: number }

export type XEdgeMode = XEdge['mode']
export type YEdgeMode = YEdge['mode']

/**
 * An object's outer margin, in the CSS sense: space reserved around the
 * control, outside its box. On the edge(s) the object follows it offsets the
 * control away from that edge, and on a fluid page a near-edge (left/top)
 * object's trailing margin grows the page past it — so a Follows-top control
 * can keep `margin.bottom` px of empty page below it instead of sitting flush
 * on the auto-sized edge. Missing sides are zero.
 */
export interface Margin {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

/** every side of an object's margin, missing sides filled in as 0 */
export function marginOf(obj: PageObject): Required<Margin> {
  return {
    top: obj.margin?.top ?? 0,
    right: obj.margin?.right ?? 0,
    bottom: obj.margin?.bottom ?? 0,
    left: obj.margin?.left ?? 0,
  }
}

/** which objects show edge-spring hints in the editor (persisted UI state) */
export type FitHintMode = 'all' | 'selected' | 'off'

/** how the edge-spring hints are drawn (the all/sel/off toggle plus its options) */
export interface FitHintOptions {
  mode: FitHintMode
  /** draw the edge-word captions at all */
  labels: boolean
  /** include the pixel distance in each caption (`left 198`, not just `left`) */
  lengths: boolean
  /** in `all` mode, also draw springs for objects inside groups */
  groupMembers: boolean
  /** hide objects whose constraints are the default left + top */
  nonDefaultOnly: boolean
  /** omit a caption when its distance rounds to zero (flush with the edge) */
  skipZeroLabels: boolean
}

export const DEFAULT_FIT_HINTS: FitHintOptions = {
  mode: 'all',
  labels: true,
  lengths: true,
  groupMembers: true,
  nonDefaultOnly: false,
  skipZeroLabels: true,
}

const FIT_HINT_MODES: FitHintMode[] = ['all', 'selected', 'off']

/**
 * Coerce whatever the UI (or an older stored value) hands us into a complete
 * options object: a bare mode string, the legacy `'1'`/`'0'` values, or a
 * partial object. Unknown fields fall back to the defaults.
 */
export function normalizeFitHints(
  raw?: FitHintOptions | FitHintMode | string | number | null,
): FitHintOptions {
  if (raw === null || raw === undefined || raw === '') return { ...DEFAULT_FIT_HINTS }
  if (typeof raw === 'number') raw = raw === 0 ? 'off' : 'all'
  if (typeof raw === 'string') {
    const mode = raw === '1' ? 'all' : raw === '0' ? 'off' : raw
    return { ...DEFAULT_FIT_HINTS, mode: FIT_HINT_MODES.includes(mode as FitHintMode) ? (mode as FitHintMode) : 'all' }
  }
  const mode = FIT_HINT_MODES.includes(raw.mode) ? raw.mode : DEFAULT_FIT_HINTS.mode
  return {
    mode,
    labels: raw.labels ?? DEFAULT_FIT_HINTS.labels,
    lengths: raw.lengths ?? DEFAULT_FIT_HINTS.lengths,
    groupMembers: raw.groupMembers ?? DEFAULT_FIT_HINTS.groupMembers,
    nonDefaultOnly: raw.nonDefaultOnly ?? DEFAULT_FIT_HINTS.nonDefaultOnly,
    skipZeroLabels: raw.skipZeroLabels ?? DEFAULT_FIT_HINTS.skipZeroLabels,
  }
}

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Rect = z.infer<typeof RectSchema>

const XEdgeSchema: z.ZodType<XEdge> = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('left'), left: z.number(), width: z.number().positive() }),
  z.object({ mode: z.literal('right'), right: z.number(), width: z.number().positive() }),
  z.object({ mode: z.literal('both'), left: z.number(), right: z.number() }),
  z.object({ mode: z.literal('center'), width: z.number().positive() }),
])

const YEdgeSchema: z.ZodType<YEdge> = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('top'), top: z.number(), height: z.number().positive() }),
  z.object({ mode: z.literal('bottom'), bottom: z.number(), height: z.number().positive() }),
  z.object({ mode: z.literal('both'), top: z.number(), bottom: z.number() }),
  z.object({ mode: z.literal('center'), height: z.number().positive() }),
])

const MarginSchema = z
  .object({
    top: z.number().optional(),
    right: z.number().optional(),
    bottom: z.number().optional(),
    left: z.number().optional(),
  })
  .optional()

export interface PageObject {
  id: string
  name: string
  control: ControlKind
  /** horizontal edge constraint (against the page or the parent group box) */
  x: XEdge
  /** vertical edge constraint (against the page or the parent group box) */
  y: YEdge
  /** outer margin (space reserved around the control); see {@link Margin} */
  margin?: Margin
  props: Record<string, unknown>
  on: Record<string, string>
  /** groups only: member objects, constrained to the group box */
  children?: PageObject[]
}

// recursive schema (groups contain groups) — explicit interface + z.lazy
const PageObjectSchema: z.ZodType<PageObject, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    control: z.enum(CONTROL_KINDS),
    x: XEdgeSchema,
    y: YEdgeSchema,
    margin: MarginSchema,
    props: z.record(z.unknown()).default({}),
    on: z.record(z.string()).default({}),
    children: z.array(PageObjectSchema).optional(),
  }),
)

const CanvasSizeSchema = z.object({ width: z.number(), height: z.number() })
export type CanvasSize = z.infer<typeof CanvasSizeSchema>

/**
 * Background: the ToolBook-style shared page resource. Objects live under
 * every member page. Pages no longer carry a fill color — the background
 * paints.
 */
export interface Background {
  id: string
  name: string
  color: string
  /** shared functions + backgroundEnter() hook, compiled like a page script */
  script: string
  objects: PageObject[]
}

const BackgroundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default('#ffffff'),
  script: z.string().default(''),
  objects: z.array(PageObjectSchema).default([]),
})

const PageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  script: z.string().default(''),
  backgroundId: z.string().default(''),
  /**
   * fixed page size: a dialog / popup / author window. An ordinary page has
   * no size and fills the window it is shown in, growing with its content.
   */
  size: CanvasSizeSchema.optional(),
  /** plugin page: offered in the editor's Author menu, runs with the author API */
  author: z.boolean().optional(),
  objects: z.array(PageObjectSchema).default([]),
})
export type Page = z.infer<typeof PageSchema>

/**
 * The design-time store: the book's starting values for the run store, as
 * ordered [key, value] pairs (order matches the runtime `snapshot()` —
 * insertion-ordered). Values are JSON data — the book always crosses the
 * iframe as a JSON clone, so functions/non-JSON values can't be persisted
 * here. Every run (and published export) seeds its store from these.
 */
const StoreEntrySchema = z.tuple([z.string().min(1), z.unknown()])
const StoreSchema = z.array(StoreEntrySchema).default([])
export type StoreEntry = z.infer<typeof StoreEntrySchema>

const BookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  backgrounds: z.array(BackgroundSchema).default([]),
  pages: z.array(PageSchema).min(1),
  /** page the app opens on (a spawned/published run, and the editor on load);
   *  absent or dangling = the first page */
  startPageId: z.string().optional(),
  store: StoreSchema,
})
export type Book = Omit<z.infer<typeof BookSchema>, 'store'> & {
  /** design-time store values; seeded into every run (see StoreEntrySchema) */
  store?: StoreEntry[]
}

/**
 * Legacy upgrade: pre-background books carried the fill color on each page
 * (`page.background`). Group pages by color into one background per distinct
 * color (in page order), assign `backgroundId`s, and normalize dangling
 * backgroundIds. Runs before schema validation so old files parse unchanged.
 */
function migrateBackgrounds(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  const raw = data as Record<string, unknown>
  if (!Array.isArray(raw['pages'])) return data
  const pages = raw['pages'] as Array<Record<string, unknown>>
  const backgrounds = Array.isArray(raw['backgrounds']) ? (raw['backgrounds'] as Background[]) : []
  if (backgrounds.length === 0) {
    // one background per distinct legacy page color, in first-seen order
    const byColor = new Map<string, Background>()
    for (const page of pages) {
      const color = typeof page['background'] === 'string' ? (page['background'] as string) : '#ffffff'
      let bg = byColor.get(color)
      if (!bg) {
        bg = {
          id: newId('bg'),
          name: `Background ${byColor.size + 1}`,
          color,
          script: '',
          objects: [],
        }
        byColor.set(color, bg)
      }
      page['backgroundId'] = bg.id
    }
    raw['backgrounds'] = [...byColor.values()]
  } else {
    for (const page of pages) {
      const known =
        typeof page['backgroundId'] === 'string' &&
        backgrounds.some((b) => b.id === page['backgroundId'])
      if (!known) page['backgroundId'] = backgrounds[0]!.id
    }
  }
  return data
}

/**
 * Legacy size upgrade, run after {@link migrateBackgrounds}:
 *  - `book.canvas` (a size per breakpoint) becomes a temporary `book.design`
 *    reference (the desktop size) that {@link migrateConstraints} measures the
 *    old fitted rects against before it is dropped.
 *  - a background that carried a `size` hands its desktop override to every
 *    page that uses it as `Page.size` (a fixed dialog surface) and loses it.
 *  - the old `Background.autoHeight` flag is dropped: pages are fluid now.
 */
function migrateSizes(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  const raw = data as Record<string, unknown>
  const canvas = raw['canvas']
  if (canvas && typeof canvas === 'object') {
    const sizes = canvas as Record<string, unknown>
    const desktop = (sizes['desktop'] ?? sizes['tablet'] ?? sizes['mobile']) as
      | Record<string, unknown>
      | undefined
    if (desktop && typeof desktop['width'] === 'number' && typeof desktop['height'] === 'number') {
      raw['design'] = { width: desktop['width'], height: desktop['height'] }
    }
    delete raw['canvas']
  }
  if (!raw['design']) raw['design'] = { width: 1280, height: 800 }
  const pages = Array.isArray(raw['pages']) ? (raw['pages'] as Array<Record<string, unknown>>) : []
  const bgs = Array.isArray(raw['backgrounds'])
    ? (raw['backgrounds'] as Array<Record<string, unknown>>)
    : []
  for (const bg of bgs) {
    const size = bg['size']
    if (size && typeof size === 'object') {
      const sizes = size as Record<string, unknown>
      const desktop = (sizes['desktop'] ?? sizes['tablet'] ?? sizes['mobile']) as
        | Record<string, unknown>
        | undefined
      if (desktop && typeof desktop['width'] === 'number' && typeof desktop['height'] === 'number') {
        for (const page of pages) {
          if (page['backgroundId'] === bg['id'] && !page['size']) {
            page['size'] = { width: desktop['width'], height: desktop['height'] }
          }
        }
      }
      delete bg['size']
    }
    delete bg['autoHeight']
  }
  return data
}

export function parseBook(data: unknown): Book {
  return BookSchema.parse(migrateConstraints(migrateSizes(migrateObjects(migrateBackgrounds(data)))))
}

/**
 * Edge-constraint upgrade, run last (after {@link migrateSizes} has produced
 * the reference `design` size): each object's one `rect` + `fit` pair becomes
 * fixed edge distances that freeze its appearance at the reference size.
 *
 *   free / left / top / stretch      -> follows the near edge (left / top)
 *   right / bottom / pin-right / -bottom -> follows the far edge
 *   fill                             -> follows both edges (stretches)
 *   center                           -> centred
 *
 * Objects that already carry `x`/`y` constraints pass through untouched, and
 * `design` is deleted once every object has been measured.
 */
function migrateConstraints(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  const raw = data as Record<string, unknown>
  const rawDesign = raw['design'] as Record<string, unknown> | undefined
  const design: CanvasSize = {
    width: typeof rawDesign?.['width'] === 'number' ? (rawDesign['width'] as number) : 1280,
    height: typeof rawDesign?.['height'] === 'number' ? (rawDesign['height'] as number) : 800,
  }
  const mapObjects = (objs: unknown): void => {
    if (!Array.isArray(objs)) return
    for (const o of objs) {
      if (!o || typeof o !== 'object') continue
      const obj = o as Record<string, unknown>
      const rect = obj['rect']
      if (rect && typeof rect === 'object' && !obj['x'] && !obj['y']) {
        const r = rect as Rect
        const fit = obj['fit'] as Record<string, unknown> | undefined
        const fx = typeof fit?.['x'] === 'string' ? (fit['x'] as string) : 'free'
        const fy = typeof fit?.['y'] === 'string' ? (fit['y'] as string) : 'free'
        const right = Math.round(design.width - (r.x + r.w))
        const bottom = Math.round(design.height - (r.y + r.h))
        obj['x'] =
          fx === 'right' || fx === 'pin-right'
            ? { mode: 'right', right, width: r.w }
            : fx === 'center'
              ? { mode: 'center', width: r.w }
              : fx === 'fill'
                ? { mode: 'both', left: Math.round(r.x), right }
                : { mode: 'left', left: Math.round(r.x), width: r.w }
        obj['y'] =
          fy === 'bottom' || fy === 'pin-bottom'
            ? { mode: 'bottom', bottom, height: r.h }
            : fy === 'center'
              ? { mode: 'center', height: r.h }
              : fy === 'fill'
                ? { mode: 'both', top: Math.round(r.y), bottom }
                : { mode: 'top', top: Math.round(r.y), height: r.h }
      }
      delete obj['rect']
      delete obj['fit']
      mapObjects(obj['children'])
    }
  }
  if (Array.isArray(raw['pages'])) {
    for (const p of raw['pages'] as Array<Record<string, unknown>>) mapObjects(p['objects'])
  }
  if (Array.isArray(raw['backgrounds'])) {
    for (const b of raw['backgrounds'] as Array<Record<string, unknown>>) mapObjects(b['objects'])
  }
  delete raw['design']
  return data
}

/**
 * Legacy object upgrade, applied recursively before validation:
 *  - `rects.tablet` / `rects.mobile` are dropped; the authored layout is
 *    `rect = rects.desktop` (per-breakpoint rects are no longer supported).
 *  - legacy fit tokens: `prop`→`left`/`top`, `middle`→`center`. `left`/`top`
 *    are kept — they name the near edge in the current model.
 */
const FIT_TOKEN_MAP: Record<'x' | 'y', Record<string, string>> = {
  x: { prop: 'left' },
  y: { middle: 'center', prop: 'top' },
}

function migrateObjects(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  const raw = data as Record<string, unknown>
  const mapObjects = (objs: unknown): void => {
    if (!Array.isArray(objs)) return
    for (const o of objs) {
      if (!o || typeof o !== 'object') continue
      const obj = o as Record<string, unknown>
      const rects = obj['rects']
      if (rects && typeof rects === 'object') {
        const legacy = rects as Record<string, unknown>
        if (legacy['desktop'] && typeof legacy['desktop'] === 'object') {
          obj['rect'] = legacy['desktop']
        }
        delete obj['rects']
      }
      const fit = obj['fit']
      if (fit && typeof fit === 'object') {
        const f = fit as Record<string, unknown>
        for (const axis of ['x', 'y'] as const) {
          const cur = f[axis]
          const mapped = typeof cur === 'string' ? FIT_TOKEN_MAP[axis][cur] : undefined
          if (mapped) f[axis] = mapped
        }
      }
      mapObjects(obj['children'])
    }
  }
  if (Array.isArray(raw['pages'])) {
    for (const p of raw['pages'] as Array<Record<string, unknown>>) mapObjects(p['objects'])
  }
  if (Array.isArray(raw['backgrounds'])) {
    for (const b of raw['backgrounds'] as Array<Record<string, unknown>>) mapObjects(b['objects'])
  }
  return data
}

export const DEFAULT_SIZES: Record<ControlKind, { w: number; h: number }> = {
  button: { w: 176, h: 48 },
  label: { w: 240, h: 40 },
  input: { w: 280, h: 44 },
  image: { w: 280, h: 200 },
  card: { w: 360, h: 220 },
  container: { w: 400, h: 280 },
  switch: { w: 160, h: 40 },
  group: { w: 200, h: 200 },
  markdown: { w: 420, h: 260 },
  html: { w: 420, h: 260 },
}

/** simplified web-safe font families offered in the editor */
export const FONT_FAMILIES = [
  'system',
  'sans',
  'serif',
  'mono',
  'rounded',
] as const
export type FontFamily = (typeof FONT_FAMILIES)[number]

export const FONT_STACKS: Record<FontFamily, string> = {
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  sans: "'Helvetica Neue', Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace",
  rounded: "'Trebuchet MS', 'Comic Sans MS', 'Segoe UI', sans-serif",
}

export const DEFAULT_PROPS: Record<ControlKind, Record<string, unknown>> = {
  button: { text: 'Button', fontSize: 15 },
  label: { text: 'Label', fontSize: 15 },
  input: { placeholder: 'Type here' },
  image: {},
  card: { title: 'Card', text: 'Card body' },
  container: {},
  switch: { text: 'Switch', checked: false, fontSize: 15 },
  group: {},
  markdown: { text: '# Heading\n\nBody…', fontSize: 15 },
  html: { html: '<p>Hello</p>' },
}

/**
 * Free, key-less image hosts behind the image control's "generate" button. All
 * work in a plain `<img src>` (no CORS, no auth) — which is all a page needs.
 * `picsum` returns *actual* photographs; `dummyimage` returns a solid-colour
 * block with a random label, handy when you only need a placeholder sized to
 * the object rather than a real picture.
 */
export const IMAGE_PROVIDERS = ['picsum', 'dummyimage'] as const
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number]

/** words the dummyimage placeholder prints so its block looks intentional */
const PLACEHOLDER_WORDS = [
  'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'hello', 'world', 'welcome',
  'image', 'photo', 'picture', 'graphic', 'artwork', 'illustration',
  'demo', 'sample', 'example', 'preview', 'mockup', 'wireframe', 'draft',
  'logo', 'avatar', 'profile', 'portrait', 'headshot', 'cover', 'hero',
  'banner', 'thumb', 'thumbnail', 'poster', 'card', 'tile', 'panel',
  'canvas', 'design', 'layout', 'template', 'theme', 'style', 'concept',
  'gallery', 'album', 'slide', 'screen', 'display', 'view', 'frame',
  'background', 'texture', 'pattern', 'gradient', 'palette', 'colour',
  'landscape', 'cityscape', 'nature', 'abstract', 'minimal', 'modern',
  'retro', 'vintage', 'bright', 'shadow', 'glow', 'focus', 'motion',
  'content', 'media', 'visual', 'render', 'shot', 'snapshot', 'capture',
] as const

/** [background, foreground] hex pairs with comfortable contrast */
const PLACEHOLDER_PALETTES = [
  ['000000', 'ffffff'],
  ['ffffff', '000000'],
  ['3b82f6', 'ffffff'],
  ['22c55e', '000000'],
  ['ef4444', 'ffffff'],
  ['a855f7', 'ffffff'],
  ['f97316', '000000'],
  ['0d9488', 'ffffff'],
] as const

function randomSeed(): string {
  return (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    : Math.random().toString(36).slice(2, 10))
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

/**
 * Build a URL to a random image from a free host, sized to (w × h) so the
 * picture fills the image object's own box 1:1. A per-call nonce keeps every
 * click different. `picsum` seeds the photo so a given URL always shows the
 * same picture; `dummyimage` instead prints a random word on a random colour
 * block.
 */
export function randomImageUrl(
  w: number = 600,
  h: number = 400,
  provider: ImageProvider = 'picsum',
): string {
  let width = Math.round(w)
  let height = Math.round(h)
  if (!Number.isFinite(width) || width < 1) width = 600
  if (!Number.isFinite(height) || height < 1) height = 400
  const nonce = randomSeed()
  switch (provider) {
    case 'dummyimage': {
      const [bg, fg] = pick(PLACEHOLDER_PALETTES)
      return `https://dummyimage.com/${width}x${height}/${bg}/${fg}&text=${encodeURIComponent(pick(PLACEHOLDER_WORDS))}`
    }
    default:
      return `https://picsum.photos/seed/${nonce}/${width}/${height}`
  }
}

export function safeParseBook(data: unknown) {
  return BookSchema.safeParse(
    migrateConstraints(migrateSizes(migrateObjects(migrateBackgrounds(data)))),
  )
}

let idCounter = 0

export function newId(prefix: string): string {
  idCounter += 1
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}${idCounter}`
}

export function createObject(
  control: ControlKind,
  name: string,
  rect: Rect,
  props: Record<string, unknown> = {},
): PageObject {
  return PageObjectSchema.parse({
    id: newId('obj'),
    name,
    control,
    x: { mode: 'left', left: rect.x, width: rect.w },
    y: { mode: 'top', top: rect.y, height: rect.h },
    props,
  })
}

export function createBackground(name: string, color = '#ffffff'): Background {
  return BackgroundSchema.parse({
    id: newId('bg'),
    name,
    color,
  })
}

export function createPage(name: string, backgroundId = ''): Page {
  return PageSchema.parse({
    id: newId('page'),
    name,
    backgroundId,
  })
}

/** The background a page renders on (dangling ids fall back to the first). */
export function backgroundFor(book: Book, page: Page): Background {
  return (
    book.backgrounds.find((b) => b.id === page.backgroundId) ?? book.backgrounds[0]!
  )
}

/**
 * Index of the page a run starts on: the book's `startPageId` when set and
 * still present, else the first page. The single source of the "app start"
 * page for the published player and the editor on load.
 */
export function resolveStartPageIndex(book: Book): number {
  if (!book.startPageId) return 0
  const i = book.pages.findIndex((p) => p.id === book.startPageId)
  return i === -1 ? 0 : i
}

/** default size of a dialog surface when a page declares none */
export const DEFAULT_DIALOG_SIZE: CanvasSize = { width: 640, height: 480 }

/** resolve a horizontal edge constraint against a containing box width */
export function resolveX(
  c: XEdge,
  boxWidth: number,
  margin: Margin = {},
): { left: number; width: number } {
  const ml = margin.left ?? 0
  const mr = margin.right ?? 0
  switch (c.mode) {
    case 'left':
      return { left: c.left + ml, width: c.width }
    case 'right':
      return { left: boxWidth - c.right - mr - c.width, width: c.width }
    case 'both':
      return { left: c.left + ml, width: Math.max(1, boxWidth - c.left - c.right - ml - mr) }
    case 'center':
      return { left: (boxWidth - c.width) / 2 + (ml - mr) / 2, width: c.width }
  }
}

/** resolve a vertical edge constraint against a containing box height */
export function resolveY(
  c: YEdge,
  boxHeight: number,
  margin: Margin = {},
): { top: number; height: number } {
  const mt = margin.top ?? 0
  const mb = margin.bottom ?? 0
  switch (c.mode) {
    case 'top':
      return { top: c.top + mt, height: c.height }
    case 'bottom':
      return { top: boxHeight - c.bottom - mb - c.height, height: c.height }
    case 'both':
      return { top: c.top + mt, height: Math.max(1, boxHeight - c.top - c.bottom - mt - mb) }
    case 'center':
      return { top: (boxHeight - c.height) / 2 + (mt - mb) / 2, height: c.height }
  }
}

/** the rect an object renders at inside `box` (its page or its group box) */
export function rectForObject(obj: PageObject, box: CanvasSize): Rect {
  const x = resolveX(obj.x, box.width, obj.margin)
  const y = resolveY(obj.y, box.height, obj.margin)
  return {
    x: Math.round(x.left),
    y: Math.round(y.top),
    w: Math.max(1, Math.round(x.width)),
    h: Math.max(1, Math.round(y.height)),
  }
}

/** build a horizontal constraint for a rendered rect in `box`, keeping `mode` */
export function xEdgeFromRect(
  rect: Rect,
  boxWidth: number,
  mode: XEdgeMode,
  margin: Margin = {},
): XEdge {
  const ml = margin.left ?? 0
  const mr = margin.right ?? 0
  const left = Math.round(rect.x - ml)
  const width = Math.max(1, Math.round(rect.w))
  const right = Math.round(boxWidth - (rect.x + rect.w) - mr)
  switch (mode) {
    case 'left':
      return { mode: 'left', left, width }
    case 'right':
      return { mode: 'right', right, width }
    case 'both':
      return { mode: 'both', left, right }
    case 'center':
      return { mode: 'center', width }
  }
}

/** build a vertical constraint for a rendered rect in `box`, keeping `mode` */
export function yEdgeFromRect(
  rect: Rect,
  boxHeight: number,
  mode: YEdgeMode,
  margin: Margin = {},
): YEdge {
  const mt = margin.top ?? 0
  const mb = margin.bottom ?? 0
  const top = Math.round(rect.y - mt)
  const height = Math.max(1, Math.round(rect.h))
  const bottom = Math.round(boxHeight - (rect.y + rect.h) - mb)
  switch (mode) {
    case 'top':
      return { mode: 'top', top, height }
    case 'bottom':
      return { mode: 'bottom', bottom, height }
    case 'both':
      return { mode: 'both', top, bottom }
    case 'center':
      return { mode: 'center', height }
  }
}

/**
 * Write a rendered rect back onto an object's constraints, keeping the current
 * edge choices unless an override mode is given (e.g. a width write on a
 * follows-both control switches that axis to a fixed size held to the left).
 */
export function applyRectToObject(
  obj: PageObject,
  rect: Rect,
  box: CanvasSize,
  modes?: { x?: XEdgeMode; y?: YEdgeMode },
): void {
  obj.x = xEdgeFromRect(rect, box.width, modes?.x ?? obj.x.mode, obj.margin)
  obj.y = yEdgeFromRect(rect, box.height, modes?.y ?? obj.y.mode, obj.margin)
}

/**
 * Move or resize one rendered coordinate while keeping the edges the control
 * follows (see the script geometry rules): `x`/`y` on a follows-both control
 * translates it, on a centred control drops the centring for a near edge, and
 * a `width`/`height` write on a follows-both control switches it to a fixed
 * size held to the left/top.
 */
export function writeRectPart(
  obj: PageObject,
  part: 'x' | 'y' | 'w' | 'h',
  value: number,
  box: CanvasSize,
): void {
  const r = rectForObject(obj, box)
  const axis: 'x' | 'y' = part === 'x' || part === 'w' ? 'x' : 'y'
  const mode = obj[axis].mode
  if (part === 'x' || part === 'y') {
    const n = Math.round(value)
    if (mode === 'center') {
      r[part] = n
      applyRectToObject(obj, r, box, axis === 'x' ? { x: 'left' } : { y: 'top' })
    } else if (mode === 'both') {
      const delta = n - r[part]
      if (part === 'x') r.x += delta
      else r.y += delta
      applyRectToObject(obj, r, box)
    } else {
      r[part] = n
      applyRectToObject(obj, r, box)
    }
    return
  }
  r[part] = Math.max(1, Math.round(value))
  if (mode === 'both') applyRectToObject(obj, r, box, axis === 'x' ? { x: 'left' } : { y: 'top' })
  else applyRectToObject(obj, r, box)
}

/** Scale one horizontal edge constraint by `fx` (its distance and size). */
export function scaleXEdge(c: XEdge, fx: number): XEdge {
  const s = (n: number): number => Math.round(n * fx)
  switch (c.mode) {
    case 'left':
      return { mode: 'left', left: s(c.left), width: Math.max(1, s(c.width)) }
    case 'right':
      return { mode: 'right', right: s(c.right), width: Math.max(1, s(c.width)) }
    case 'both':
      return { mode: 'both', left: s(c.left), right: s(c.right) }
    case 'center':
      return { mode: 'center', width: Math.max(1, s(c.width)) }
  }
}

/** Scale one vertical edge constraint by `fy` (its distance and size). */
export function scaleYEdge(c: YEdge, fy: number): YEdge {
  const s = (n: number): number => Math.round(n * fy)
  switch (c.mode) {
    case 'top':
      return { mode: 'top', top: s(c.top), height: Math.max(1, s(c.height)) }
    case 'bottom':
      return { mode: 'bottom', bottom: s(c.bottom), height: Math.max(1, s(c.height)) }
    case 'both':
      return { mode: 'both', top: s(c.top), bottom: s(c.bottom) }
    case 'center':
      return { mode: 'center', height: Math.max(1, s(c.height)) }
  }
}

/**
 * Scale one object's edge constraints by (fx, fy) — the stored form of a group
 * resize: a follows-both axis scales both margins, a centred axis its size, a
 * near/far axis its distance and size.
 */
export function scaleEdges(obj: PageObject, fx: number, fy: number): void {
  obj.x = scaleXEdge(obj.x, fx)
  obj.y = scaleYEdge(obj.y, fy)
  const m = obj.margin
  if (m) {
    const s = (n: number | undefined, f: number): number | undefined =>
      n === undefined ? undefined : Math.round(n * f)
    obj.margin = {
      top: s(m.top, fy),
      right: s(m.right, fx),
      bottom: s(m.bottom, fy),
      left: s(m.left, fx),
    }
  }
}

/** Scale an object and every descendant it contains (nested groups included). */
export function scaleSubtreeEdges(obj: PageObject, fx: number, fy: number): void {
  scaleEdges(obj, fx, fy)
  for (const child of obj.children ?? []) scaleSubtreeEdges(child, fx, fy)
}

/**
 * The content extent a page must be large enough to hold. Only top/left
 * anchored objects (near-edge distances) can extend the page — a right/bottom,
 * follows-both or centred object sits inside the page box by definition, so it
 * cannot drive the size without becoming circular.
 */
export function contentExtent(objects: PageObject[]): { right: number; bottom: number } {
  let right = 0
  let bottom = 0
  for (const obj of objects) {
    const m = marginOf(obj)
    if (obj.x.mode === 'left') {
      right = Math.max(right, obj.x.left + m.left + obj.x.width + m.right)
    }
    if (obj.y.mode === 'top') {
      bottom = Math.max(bottom, obj.y.top + m.top + obj.y.height + m.bottom)
    }
  }
  return { right, bottom }
}

/**
 * The size a page renders at: a fixed page (`Page.size`) is its own box; an
 * ordinary page fills `container` and grows on either axis by the content
 * extent placed past the fold.
 */
export function resolvePageBox(
  page: Page,
  container: CanvasSize,
  objects: PageObject[],
): CanvasSize {
  if (page.size) return { width: page.size.width, height: page.size.height }
  const extent = contentExtent(objects)
  return {
    width: Math.max(Math.max(1, Math.round(container.width)), Math.ceil(extent.right)),
    height: Math.max(Math.max(1, Math.round(container.height)), Math.ceil(extent.bottom)),
  }
}

export function createBook(title: string): Book {
  const bg = createBackground('Background 1')
  return BookSchema.parse({
    id: newId('book'),
    title,
    backgrounds: [bg],
    pages: [createPage('Page 1', bg.id)],
  })
}

export function createGroup(name: string, rect: Rect, children: PageObject[]): PageObject {
  return PageObjectSchema.parse({
    id: newId('obj'),
    name,
    control: 'group',
    x: { mode: 'left', left: rect.x, width: rect.w },
    y: { mode: 'top', top: rect.y, height: rect.h },
    props: {},
    on: {},
    children,
  })
}

/**
 * Resolve a colour prop: accepts CSS colour names (red, green, …) and any
 * CSS colour string (hex, rgb/rgba, hsl). Empty/unknown values return null
 * so the object keeps its default styling.
 */
const NAMED_COLOURS: Record<string, string> = {
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', teal: '#0d9488',
  gray: '#6b7280', grey: '#6b7280', black: '#111827', white: '#ffffff',
  dark: '#1f2937', light: '#f3f4f6', navy: '#1e3a8a', indigo: '#4f46e5',
  brown: '#92400e', crimson: '#dc2626', gold: '#d97706', lime: '#84cc16',
}
const RGB_RE = /^(rgb|rgba|hsl|hsla)\(/
export function resolveColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (!v) return null
  if (NAMED_COLOURS[v]) return NAMED_COLOURS[v]
  if (/^#[0-9a-f]{3,8}$/.test(v)) return v
  if (RGB_RE.test(v)) return v
  if (/^[a-z]+$/.test(v)) return null // unknown name — let the default stand
  return null
}

/** Pre-order walk: every object on the page, including group members. */
export function flattenObjects(objects: PageObject[]): PageObject[] {
  const out: PageObject[] = []
  const walk = (objs: PageObject[]): void => {
    for (const o of objs) {
      out.push(o)
      if (o.children?.length) walk(o.children)
    }
  }
  walk(objects)
  return out
}

/** Depth-annotated rows for tree views (objects list). */
export function treeRows(
  objects: PageObject[],
): Array<{ obj: PageObject; depth: number }> {
  const rows: Array<{ obj: PageObject; depth: number }> = []
  const walk = (objs: PageObject[], d: number): void => {
    for (const o of objs) {
      rows.push({ obj: o, depth: d })
      if (o.children?.length) walk(o.children, d + 1)
    }
  }
  walk(objects, 0)
  return rows
}

export function unionRects(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

export function rebaseRect(r: Rect, origin: { x: number; y: number }): Rect {
  return { x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h }
}

export function unrebaseRect(r: Rect, origin: { x: number; y: number }): Rect {
  return { x: r.x + origin.x, y: r.y + origin.y, w: r.w, h: r.h }
}

/**
 * Scale a rect relative to an origin by (fx, fy) — used for group resize
 * (children positions AND sizes scale proportionally).
 */
export function scaleRect(
  r: Rect,
  origin: { x: number; y: number },
  fx: number,
  fy: number,
): Rect {
  const round = (n: number): number => Math.max(0, Math.round(n))
  const w = Math.max(1, round(r.w * fx))
  const h = Math.max(1, round(r.h * fy))
  return {
    x: round(origin.x + (r.x - origin.x) * fx),
    y: round(origin.y + (r.y - origin.y) * fy),
    w,
    h,
  }
}

/** selection-alignment guides: the selection's bounding box edges/centers */
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY'

/** match dimension for {@link matchSizeRects} */
export type MatchDim = 'w' | 'h' | 'both'

function moveRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }
}

/**
 * Align every rect to the selection's bounding box (Figma semantics): `left`
 * moves each rect's left edge to the box's left edge, `right` its right edge
 * to the box's right edge, `centerX` its horizontal center to the box center,
 * and so on. Returns new rects in input order (rounded).
 */
export function alignRects(rects: Rect[], mode: AlignMode): Rect[] {
  if (rects.length < 2) return rects.map((r) => ({ ...r }))
  const box = unionRects(rects)
  return rects.map((r) => {
    const out = { ...r }
    switch (mode) {
      case 'left':
        out.x = box.x
        break
      case 'right':
        out.x = box.x + box.w - r.w
        break
      case 'centerX':
        out.x = box.x + (box.w - r.w) / 2
        break
      case 'top':
        out.y = box.y
        break
      case 'bottom':
        out.y = box.y + box.h - r.h
        break
      case 'centerY':
        out.y = box.y + (box.h - r.h) / 2
        break
    }
    out.x = Math.round(out.x)
    out.y = Math.round(out.y)
    return out
  })
}

/**
 * Center the selection as a BLOCK on the page: translate every rect by the
 * same offset so the bounding box center sits on the page center. This is the
 * "center this OK/Cancel pair" command — aligning each object's own center
 * to the page would stack them on top of each other.
 */
export function centerBlockRects(rects: Rect[], pageSize: CanvasSize): Rect[] {
  if (rects.length === 0) return []
  const box = unionRects(rects)
  const dx = Math.round(pageSize.width / 2 - (box.x + box.w / 2))
  const dy = Math.round(pageSize.height / 2 - (box.y + box.h / 2))
  return rects.map((r) => moveRect(r, dx, dy))
}

/**
 * Distribute rects evenly along an axis by their centers, keeping the two
 * outermost rects fixed (first and last in the sorted-by-center order).
 */
export function distributeRects(rects: Rect[], axis: 'x' | 'y'): Rect[] {
  const out = rects.map((r) => ({ ...r }))
  if (rects.length < 3) return out
  const center = (r: Rect): number => (axis === 'x' ? r.x + r.w / 2 : r.y + r.h / 2)
  const order = rects.map((r, i) => ({ i, c: center(r) })).sort((a, b) => a.c - b.c)
  const first = order[0]!.c
  const last = order[order.length - 1]!.c
  const step = (last - first) / (order.length - 1)
  order.forEach((entry, k) => {
    const target = first + step * k
    const r = out[entry.i]!
    if (axis === 'x') r.x = Math.round(target - r.w / 2)
    else r.y = Math.round(target - r.h / 2)
  })
  return out
}

/** Match every rect's size to the largest in the selection. */
export function matchSizeRects(rects: Rect[], dim: MatchDim): Rect[] {
  if (rects.length < 2) return rects.map((r) => ({ ...r }))
  const w = Math.round(Math.max(...rects.map((r) => r.w)))
  const h = Math.round(Math.max(...rects.map((r) => r.h)))
  return rects.map((r) => ({
    ...r,
    w: dim === 'h' ? r.w : w,
    h: dim === 'w' ? r.h : h,
  }))
}


