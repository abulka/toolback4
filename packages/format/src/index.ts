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

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const
export type Breakpoint = (typeof BREAKPOINTS)[number]

/**
 * Responsive ("glue") modes. The stored desktop rect is the reference; when a
 * breakpoint has no explicit rect of its own, the renderer derives one from
 * the desktop rect + the fit spec against the page sizes.
 *
 * Horizontal:
 *   free     x stays at the authored px (the default — absolute from left)
 *   left     x scales with the page: x·(W/W₀) — the left ratio is preserved
 *   center   x = (W − w)/2
 *   right    the gap to the right edge scales: x = (r.x+r.w)·(W/W₀) − w
 *   stretch  both margins scale: x = r.x·(W/W₀), w = r.w·(W/W₀) — a true scale
 *
 * Vertical mirrors with free / top / center / bottom / stretch on y/h.
 *
 * `left`/`right`/`top`/`bottom`/`stretch` keep the VISUAL PROPORTION of the
 * anchored margin (it scales with the page). A constant-pixel margin from
 * right/bottom is a future "pin" mode (see the backlog in plans/PLAN.md).
 */
export const FIT_H_MODES = ['free', 'left', 'center', 'right', 'stretch'] as const
export const FIT_V_MODES = ['free', 'top', 'center', 'bottom', 'stretch'] as const
export type FitHMode = (typeof FIT_H_MODES)[number]
export type FitVMode = (typeof FIT_V_MODES)[number]
export interface FitSpec {
  x?: FitHMode
  y?: FitVMode
}

/** which objects show glue-spring hints in the editor (persisted UI state) */
export type FitHintMode = 'all' | 'selected' | 'off'

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Rect = z.infer<typeof RectSchema>

export interface PageObject {
  id: string
  name: string
  control: ControlKind
  /** the object's one authored layout; `fit` adapts it to each page size */
  rect: Rect
  props: Record<string, unknown>
  on: Record<string, string>
  /** groups only: member objects, positioned relative to the group */
  children?: PageObject[]
  /** responsive glue: how `rect` adapts at each breakpoint page size */
  fit?: FitSpec
}

// recursive schema (groups contain groups) — explicit interface + z.lazy
const PageObjectSchema: z.ZodType<PageObject, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    control: z.enum(CONTROL_KINDS),
    rect: RectSchema,
    props: z.record(z.unknown()).default({}),
    on: z.record(z.string()).default({}),
    children: z.array(PageObjectSchema).optional(),
    fit: z
      .object({
        x: z.enum(FIT_H_MODES).optional(),
        y: z.enum(FIT_V_MODES).optional(),
      })
      .optional(),
  }),
)

const CanvasSizeSchema = z.object({ width: z.number(), height: z.number() })
export type CanvasSize = z.infer<typeof CanvasSizeSchema>

/**
 * Background: the ToolBook-style shared page resource. Objects live under
 * every member page; `size` overrides the page size per breakpoint (absent
 * breakpoint = book default). Pages no longer carry a fill color — the
 * background paints.
 */
export interface Background {
  id: string
  name: string
  color: string
  size?: Partial<Record<Breakpoint, CanvasSize>>
  /** shared functions + backgroundEnter() hook, compiled like a page script */
  script: string
  objects: PageObject[]
}

const BackgroundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default('#ffffff'),
  script: z.string().default(''),
  size: z
    .object({
      desktop: CanvasSizeSchema.optional(),
      tablet: CanvasSizeSchema.optional(),
      mobile: CanvasSizeSchema.optional(),
    })
    .optional(),
  objects: z.array(PageObjectSchema).default([]),
})

const PageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  script: z.string().default(''),
  backgroundId: z.string().default(''),
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
  canvas: z
    .object({
      desktop: CanvasSizeSchema,
      tablet: CanvasSizeSchema.optional(),
      mobile: CanvasSizeSchema.optional(),
    })
    .default({ desktop: { width: 1280, height: 800 } }),
  backgrounds: z.array(BackgroundSchema).default([]),
  pages: z.array(PageSchema).min(1),
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

export function parseBook(data: unknown): Book {
  return BookSchema.parse(migrateObjects(migrateBackgrounds(data)))
}

/**
 * Legacy object upgrade, applied recursively before validation:
 *  - `rects.tablet` / `rects.mobile` are dropped; the authored layout is
 *    `rect = rects.desktop` (constraints-only model — per-breakpoint rects are
 *    no longer supported).
 *  - legacy fit tokens: `prop`→`left`/`top`, `middle`→`center`. `left`/`top`
 *    are NOT rewritten — they are first-class modes in the current model
 *    (proportional left/top margins) and the editor writes them directly.
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
  return BookSchema.safeParse(migrateObjects(migrateBackgrounds(data)))
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
    rect,
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
 * Page size for a page in a breakpoint: the background's size override for
 * that breakpoint, else the book canvas, else the desktop book size.
 */
export function resolvePageSize(
  book: Book,
  background: Background | undefined,
  breakpoint: Breakpoint,
): CanvasSize {
  return (
    background?.size?.[breakpoint] ??
    book.canvas[breakpoint] ??
    book.canvas.desktop
  )
}

export function createBook(title: string): Book {
  const bg = createBackground('Background 1')
  return BookSchema.parse({
    id: newId('book'),
    title,
    canvas: {
      desktop: { width: 1280, height: 800 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 390, height: 844 },
    },
    backgrounds: [bg],
    pages: [createPage('Page 1', bg.id)],
  })
}

export function createGroup(name: string, rect: Rect, children: PageObject[]): PageObject {
  return PageObjectSchema.parse({
    id: newId('obj'),
    name,
    control: 'group',
    rect,
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

const DEFAULT_FIT: FitSpec = { x: 'free', y: 'free' }

/**
 * The rect an object renders at for a page size — the responsive "lens".
 *
 * The object has ONE authored `rect`; `fit` derives the constrained axes for
 * the target page size while free axes keep their authored coordinate. At the
 * base size (page size == the desktop reference) Free/Left/Right/Top/Bottom/
 * Stretch are identity and only Center visibly moves — so setting Center shows
 * the object centered where you are, without writing anything.
 */
export function resolveObjectRect(
  obj: PageObject,
  pageSize: CanvasSize,
  refSize: CanvasSize,
): Rect {
  const r = obj.rect
  const fit = obj.fit ?? DEFAULT_FIT
  const W = pageSize.width
  const H = pageSize.height
  const W0 = refSize.width
  const H0 = refSize.height
  const ratioX = W0 === 0 ? 1 : W / W0
  const ratioY = H0 === 0 ? 1 : H / H0
  const round = (n: number): number => Math.max(1, Math.round(n))
  // stretch keeps BOTH margins proportional, so the size scales by the same
  // ratio as the page (and the position rides with the left/top margin)
  const w = fit.x === 'stretch' ? round(r.w * ratioX) : r.w
  const h = fit.y === 'stretch' ? round(r.h * ratioY) : r.h
  const x =
    fit.x === 'center'
      ? (W - w) / 2
      : fit.x === 'left' || fit.x === 'stretch'
        ? r.x * ratioX
        : fit.x === 'right'
          ? (r.x + r.w) * ratioX - w
          : r.x // free
  const y =
    fit.y === 'center'
      ? (H - h) / 2
      : fit.y === 'top' || fit.y === 'stretch'
        ? r.y * ratioY
        : fit.y === 'bottom'
          ? (r.y + r.h) * ratioY - h
          : r.y // free
  return { x: Math.round(x), y: Math.round(y), w, h }
}

/**
 * Inverse of the position/size lens: given the rect the author DRAGGED at the
 * current breakpoint, derive the base rect that produces it.
 *
 * This is what makes a glued object draggable: the drag edits the reference
 * (the free parameter behind the constraint) at every breakpoint instead of
 * being rejected. `center` has no free parameter (its position is fully
 * determined), so its reference axis is left untouched. At desktop the page
 * size equals the reference, so every inverse is the identity.
 */
export function unlensObjectRect(
  ref: Rect,
  dragged: Rect,
  fit: FitSpec | undefined,
  pageSize: CanvasSize,
  refSize: CanvasSize,
): Rect {
  const W = pageSize.width
  const H = pageSize.height
  const W0 = refSize.width
  const H0 = refSize.height
  const ratioX = W === 0 ? 1 : W0 / W
  const ratioY = H === 0 ? 1 : H0 / H
  const round = (n: number): number => Math.max(1, Math.round(n))
  const fx = fit?.x
  const fy = fit?.y
  const w = fx === 'stretch' ? round(dragged.w * ratioX) : dragged.w
  const h = fy === 'stretch' ? round(dragged.h * ratioY) : dragged.h
  const x =
    fx === 'left' || fx === 'stretch'
      ? dragged.x * ratioX
      : fx === 'right'
        ? (dragged.x + dragged.w) * ratioX - dragged.w
        : fx === 'center'
          ? ref.x // rigid: centered is fully determined
          : dragged.x // free
  const y =
    fy === 'top' || fy === 'stretch'
      ? dragged.y * ratioY
      : fy === 'bottom'
        ? (dragged.y + dragged.h) * ratioY - dragged.h
        : fy === 'center'
          ? ref.y
          : dragged.y // free
  return { x: Math.round(x), y: Math.round(y), w, h }
}

/** does the object declare a real constraint on the horizontal axis? */
export function constrainsX(obj: PageObject): boolean {
  return obj.fit?.x !== undefined && obj.fit.x !== 'free'
}

/** does the object declare a real constraint on the vertical axis? */
export function constrainsY(obj: PageObject): boolean {
  return obj.fit?.y !== undefined && obj.fit.y !== 'free'
}
