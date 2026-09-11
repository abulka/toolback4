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
] as const
export type ControlKind = (typeof CONTROL_KINDS)[number]

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const
export type Breakpoint = (typeof BREAKPOINTS)[number]

const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Rect = z.infer<typeof RectSchema>

const RectsSchema = z.object({
  desktop: RectSchema,
  tablet: RectSchema.optional(),
  mobile: RectSchema.optional(),
})
export type Rects = z.infer<typeof RectsSchema>

export interface PageObject {
  id: string
  name: string
  control: ControlKind
  rects: Rects
  props: Record<string, unknown>
  on: Record<string, string>
  /** groups only: member objects, positioned relative to the group */
  children?: PageObject[]
}

// recursive schema (groups contain groups) — explicit interface + z.lazy
const PageObjectSchema: z.ZodType<PageObject, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    control: z.enum(CONTROL_KINDS),
    rects: RectsSchema,
    props: z.record(z.unknown()).default({}),
    on: z.record(z.string()).default({}),
    children: z.array(PageObjectSchema).optional(),
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
})
export type Book = z.infer<typeof BookSchema>

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
  return BookSchema.parse(migrateBackgrounds(data))
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
}

export function safeParseBook(data: unknown) {
  return BookSchema.safeParse(data)
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
  rects: Rects,
  props: Record<string, unknown> = {},
): PageObject {
  return PageObjectSchema.parse({
    id: newId('obj'),
    name,
    control,
    rects,
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

export function createGroup(name: string, rects: Rects, children: PageObject[]): PageObject {
  return PageObjectSchema.parse({
    id: newId('obj'),
    name,
    control: 'group',
    rects,
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
