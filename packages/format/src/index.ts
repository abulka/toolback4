import { z } from 'zod'

export const CONTROL_KINDS = [
  'button',
  'label',
  'input',
  'image',
  'card',
  'container',
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

const PageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  script: z.string().default(''),
  background: z.string().default('#ffffff'),
  objects: z.array(PageObjectSchema).default([]),
})
export type Page = z.infer<typeof PageSchema>

const CanvasSizeSchema = z.object({ width: z.number(), height: z.number() })

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
  pages: z.array(PageSchema).min(1),
})
export type Book = z.infer<typeof BookSchema>

export function parseBook(data: unknown): Book {
  return BookSchema.parse(data)
}

export const DEFAULT_SIZES: Record<ControlKind, { w: number; h: number }> = {
  button: { w: 176, h: 48 },
  label: { w: 240, h: 40 },
  input: { w: 280, h: 44 },
  image: { w: 280, h: 200 },
  card: { w: 360, h: 220 },
  container: { w: 400, h: 280 },
  group: { w: 200, h: 200 },
}

export const DEFAULT_PROPS: Record<ControlKind, Record<string, unknown>> = {
  button: { text: 'Button' },
  label: { text: 'Label' },
  input: { placeholder: 'Type here' },
  image: {},
  card: { title: 'Card', text: 'Card body' },
  container: {},
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

export function createPage(name: string): Page {
  return PageSchema.parse({
    id: newId('page'),
    name,
  })
}

export function createBook(title: string): Book {
  return BookSchema.parse({
    id: newId('book'),
    title,
    canvas: {
      desktop: { width: 1280, height: 800 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 390, height: 844 },
    },
    pages: [createPage('Page 1')],
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
