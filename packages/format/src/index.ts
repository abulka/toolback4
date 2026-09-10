import { z } from 'zod'

export const CONTROL_KINDS = [
  'button',
  'label',
  'input',
  'image',
  'card',
  'container',
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

const PageObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  control: z.enum(CONTROL_KINDS),
  rects: RectsSchema,
  props: z.record(z.unknown()).default({}),
  on: z.record(z.string()).default({}),
})
export type PageObject = z.infer<typeof PageObjectSchema>

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
}

export const DEFAULT_PROPS: Record<ControlKind, Record<string, unknown>> = {
  button: { text: 'Button' },
  label: { text: 'Label' },
  input: { placeholder: 'Type here' },
  image: {},
  card: { title: 'Card', text: 'Card body' },
  container: {},
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
    pages: [createPage('Page 1')],
  })
}
