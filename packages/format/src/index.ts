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
  'shape',
  'canvas',
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

export interface PageObject {
  id: string
  name: string
  control: ControlKind
  /** horizontal edge constraint (against the page or the parent group box) */
  x: XEdge
  /** vertical edge constraint (against the page or the parent group box) */
  y: YEdge
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
  /**
   * fluid pages only: empty space kept past the content on the right/bottom,
   * so content never sits on the page's auto-sized edge. Invisible when the
   * window is already bigger than the content. Missing = 0.
   */
  padding: z.number().nonnegative().optional(),
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

/**
 * Persisted book format version. Bump when the stored shape changes and add a
 * matching step to {@link MIGRATIONS}; every book is stamped on parse.
 */
export const FORMAT_VERSION = 1

const BookSchema = z.object({
  /** persisted book format; stamped on parse (see {@link FORMAT_VERSION}) */
  formatVersion: z.number().int().nonnegative().default(FORMAT_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  backgrounds: z.array(BackgroundSchema).default([]),
  pages: z.array(PageSchema).min(1),
  /** page the app opens on (a spawned/published run, and the editor on load);
   *  absent or dangling = the first page */
  startPageId: z.string().optional(),
  store: StoreSchema,
})
export type Book = Omit<z.infer<typeof BookSchema>, 'store' | 'formatVersion'> & {
  /** persisted book format; parseBook always stamps it, hand-built books may omit it */
  formatVersion?: number
  /** design-time store values; seeded into every run (see StoreEntrySchema) */
  store?: StoreEntry[]
}

/**
 * A persisted-format migration: takes raw book data at version `from` and
 * returns it upgraded to `from + 1`. Add a step here and bump
 * {@link FORMAT_VERSION} whenever the stored shape changes.
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: Array<{ from: number; run: Migration }> = []

/** An absent `formatVersion` is treated as current (AI output, fresh books). */
function versionOf(data: Record<string, unknown>): number {
  const v = data['formatVersion']
  return typeof v === 'number' ? v : FORMAT_VERSION
}

/**
 * Upgrade raw book data through the migration chain and stamp the current
 * version. Throws on a book from a newer build (it may use unknown shapes).
 */
function migrateBook(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  let book = data as Record<string, unknown>
  const from = versionOf(book)
  if (from > FORMAT_VERSION) {
    throw new Error(
      `This book was made with a newer version of toolback (format ${from}; this build supports ${FORMAT_VERSION}).`,
    )
  }
  let at = from
  while (at < FORMAT_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === at)
    if (!step) throw new Error(`No migration from book format ${at} to ${at + 1}.`)
    book = step.run(book)
    at++
  }
  book['formatVersion'] = FORMAT_VERSION
  return book
}

export function parseBook(data: unknown): Book {
  return BookSchema.parse(migrateBook(data))
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
  shape: { w: 120, h: 120 },
  canvas: { w: 360, h: 240 },
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

/** controls whose text (and, for surfaces, fill) the text-style props apply to */
export const TEXT_STYLE_KINDS = ['button', 'label', 'input', 'switch', 'card', 'markdown', 'html'] as const

/** controls that can paint a surface/text colour (text kinds plus surfaces) */
export const APPEARANCE_KINDS = [...TEXT_STYLE_KINDS, 'container', 'shape', 'canvas'] as const

/** controls with a rendered box that border/radius/opacity apply to */
export const BOX_KINDS = ['button', 'label', 'input', 'card', 'container', 'image', 'markdown', 'html', 'shape', 'canvas'] as const

/** which control kinds each style prop writes to — the shared table the editor
 *  selection patch and the runtime group propagation both read */
export function styleKindsForProp(prop: string): readonly string[] {
  if (prop === 'trackColor') return ['switch']
  if (prop === 'borderWidth' || prop === 'borderStyle' || prop === 'borderColor' || prop === 'radius' || prop === 'opacity') {
    return BOX_KINDS
  }
  if (prop === 'background' || prop === 'color') return APPEARANCE_KINDS
  return TEXT_STYLE_KINDS
}

/** horizontal text alignment choices (the `textAlign` prop) */
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const
export type TextAlign = (typeof TEXT_ALIGNS)[number]

/** vertical text alignment choices (the `vAlign` prop) */
export const VERTICAL_ALIGNS = ['top', 'middle', 'bottom'] as const
export type VerticalAlign = (typeof VERTICAL_ALIGNS)[number]

export function resolveTextAlign(value: unknown): TextAlign | null {
  return typeof value === 'string' && (TEXT_ALIGNS as readonly string[]).includes(value)
    ? (value as TextAlign)
    : null
}

export function resolveVerticalAlign(value: unknown): VerticalAlign | null {
  return typeof value === 'string' && (VERTICAL_ALIGNS as readonly string[]).includes(value)
    ? (value as VerticalAlign)
    : null
}

/** border line styles (the `borderStyle` prop); solid when unset */
export const BORDER_STYLES = ['solid', 'dashed'] as const
export type BorderStyle = (typeof BORDER_STYLES)[number]

export function resolveBorderStyle(value: unknown): BorderStyle {
  return value === 'dashed' ? 'dashed' : 'solid'
}

/** the shape control's geometry options (the `shape` prop) */
export const SHAPE_TYPES = [
  'rectangle',
  'ellipse',
  'circle',
  'line',
  'arrow',
  'triangle',
  'diamond',
  'polygon',
  'star',
  'path',
] as const
export type ShapeType = (typeof SHAPE_TYPES)[number]

export function resolveShapeType(value: unknown): ShapeType {
  return typeof value === 'string' && (SHAPE_TYPES as readonly string[]).includes(value)
    ? (value as ShapeType)
    : 'ellipse'
}

export interface BorderDefault {
  width: number
  style: BorderStyle
  color: string
}

/**
 * Each control's CSS border baseline, mirroring `styles.ts`. The panel shows
 * these when the props are unset (so the field never reads blank while a border
 * is visible) and the renderer uses them for whichever of the three the author
 * did not set — so changing just the style or colour still takes effect.
 */
export const BORDER_DEFAULTS: Record<ControlKind, BorderDefault> = {
  button: { width: 0, style: 'solid', color: '#d1d5db' },
  label: { width: 0, style: 'solid', color: '#d1d5db' },
  input: { width: 1, style: 'solid', color: '#d1d5db' },
  image: { width: 0, style: 'solid', color: '#d1d5db' },
  card: { width: 1, style: 'solid', color: '#e5e7eb' },
  container: { width: 1.5, style: 'dashed', color: '#d1d5db' },
  switch: { width: 0, style: 'solid', color: '#d1d5db' },
  group: { width: 0, style: 'solid', color: '#d1d5db' },
  markdown: { width: 0, style: 'solid', color: '#d1d5db' },
  html: { width: 0, style: 'solid', color: '#d1d5db' },
  shape: { width: 0, style: 'solid', color: '#6b7280' },
  canvas: { width: 0, style: 'solid', color: '#d1d5db' },
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
  shape: { shape: 'ellipse', background: '#e5e7eb' },
  canvas: {},
}

/**
 * The machine-readable capability manifest. Single source of truth for what a
 * control kind can carry and what the runtime script API offers — consumed by
 * the AI prompt/schema builders and (later) the IntelliSense lib and the
 * properties panel, so adding a control or prop reaches all of them at once
 * instead of via hand-copied docs that drift.
 */
export interface PropSpec {
  name: string
  type: 'string' | 'number' | 'boolean' | 'color' | 'enum' | 'url' | 'markdown' | 'html'
  enum?: readonly string[]
  default?: unknown
  /** writable from a runtime script (`controls.x.<name> = …`) */
  scriptable?: boolean
  doc: string
}

const P_TEXT: PropSpec = {
  name: 'text',
  type: 'string',
  scriptable: true,
  doc: 'Button/label text, an input value, a switch label, or a markdown viewer source',
}
const P_HTML: PropSpec = {
  name: 'html',
  type: 'html',
  scriptable: true,
  doc: 'Raw HTML source of an html viewer',
}
const P_PLACEHOLDER: PropSpec = {
  name: 'placeholder',
  type: 'string',
  doc: 'Grey hint text shown in an empty input',
}
const P_TITLE: PropSpec = { name: 'title', type: 'string', doc: 'Heading at the top of a card' }
const P_SRC: PropSpec = { name: 'src', type: 'url', doc: 'Image URL' }
const P_ALT: PropSpec = { name: 'alt', type: 'string', doc: 'Alternative text for an image' }
const P_CHECKED: PropSpec = {
  name: 'checked',
  type: 'boolean',
  default: false,
  scriptable: true,
  doc: "A switch's on/off state (script: the switch's .value)",
}
const P_FONT_SIZE: PropSpec = {
  name: 'fontSize',
  type: 'number',
  doc: 'Text size in pixels; set in the Selection panel, not from scripts',
}
const P_BOLD: PropSpec = { name: 'bold', type: 'boolean', scriptable: true, doc: 'Bold text' }
const P_ITALIC: PropSpec = { name: 'italic', type: 'boolean', scriptable: true, doc: 'Italic text' }
const P_FONT_FAMILY: PropSpec = {
  name: 'fontFamily',
  type: 'enum',
  enum: FONT_FAMILIES,
  scriptable: true,
  doc: 'Simplified web-safe font family',
}
const P_TEXT_ALIGN: PropSpec = {
  name: 'textAlign',
  type: 'enum',
  enum: TEXT_ALIGNS,
  scriptable: true,
  doc: 'Horizontal text alignment',
}
const P_V_ALIGN: PropSpec = {
  name: 'vAlign',
  type: 'enum',
  enum: VERTICAL_ALIGNS,
  scriptable: true,
  doc: 'Vertical text alignment (labels and buttons)',
}
const P_TEXT_COLOR: PropSpec = {
  name: 'textColor',
  type: 'color',
  scriptable: true,
  doc: 'Explicit text colour; wins over `color` on text controls',
}
const P_BACKGROUND: PropSpec = {
  name: 'background',
  type: 'color',
  scriptable: true,
  doc: 'Explicit fill colour; wins over `color` on surfaces and adds a background to text controls',
}
const P_COLOR: PropSpec = {
  name: 'color',
  type: 'color',
  scriptable: true,
  doc: 'Object colour: surface fill for buttons/cards/containers, text/toggle for labels and switches',
}
const P_TRACK_COLOR: PropSpec = {
  name: 'trackColor',
  type: 'color',
  scriptable: true,
  doc: "A switch's toggle-track colour",
}
const P_BORDER_WIDTH: PropSpec = {
  name: 'borderWidth',
  type: 'number',
  scriptable: true,
  doc: 'Border thickness in px (0 = none)',
}
const P_BORDER_STYLE: PropSpec = {
  name: 'borderStyle',
  type: 'enum',
  enum: BORDER_STYLES,
  scriptable: true,
  doc: 'Border line style',
}
const P_BORDER_COLOR: PropSpec = {
  name: 'borderColor',
  type: 'color',
  scriptable: true,
  doc: 'Border colour',
}
const P_RADIUS: PropSpec = {
  name: 'radius',
  type: 'number',
  scriptable: true,
  doc: 'Corner radius in px',
}
const P_OPACITY: PropSpec = {
  name: 'opacity',
  type: 'number',
  scriptable: true,
  doc: 'Opacity, 0–1 (1 = solid)',
}
const P_SHAPE: PropSpec = {
  name: 'shape',
  type: 'enum',
  enum: SHAPE_TYPES,
  default: 'ellipse',
  doc: 'Shape geometry: rectangle, ellipse, circle, line, arrow, triangle, diamond, polygon, star or path',
}
const P_SIDES: PropSpec = {
  name: 'sides',
  type: 'number',
  default: 5,
  doc: 'Polygon side count, 3–20 (the `polygon` shape)',
}
const P_POINTS: PropSpec = {
  name: 'points',
  type: 'number',
  default: 5,
  doc: 'Star point count, 3–20 (the `star` shape)',
}
const P_INNER_RATIO: PropSpec = {
  name: 'innerRatio',
  type: 'number',
  default: 0.5,
  doc: 'Star inner radius as a fraction of the outer radius, 0–1 (the `star` shape)',
}
const P_PATH: PropSpec = {
  name: 'path',
  type: 'string',
  default: 'M 10 90 L 50 10 L 90 90 Z',
  doc: 'SVG path data for the `path` shape, in a 0–100 coordinate box',
}

const TEXT_STYLE_PROPS: PropSpec[] = [
  P_FONT_SIZE,
  P_BOLD,
  P_ITALIC,
  P_FONT_FAMILY,
  P_TEXT_ALIGN,
  P_TEXT_COLOR,
  P_BACKGROUND,
]

/** border/radius/opacity — every `BOX_KINDS` member accepts these */
const BOX_PROPS: PropSpec[] = [
  P_BORDER_WIDTH,
  P_BORDER_STYLE,
  P_BORDER_COLOR,
  P_RADIUS,
  P_OPACITY,
]

export const CONTROL_PROPS: Record<ControlKind, PropSpec[]> = {
  button: [P_TEXT, ...TEXT_STYLE_PROPS, P_V_ALIGN, P_COLOR, ...BOX_PROPS],
  label: [P_TEXT, ...TEXT_STYLE_PROPS, P_V_ALIGN, P_COLOR, ...BOX_PROPS],
  input: [P_PLACEHOLDER, ...TEXT_STYLE_PROPS, ...BOX_PROPS],
  image: [P_SRC, P_ALT, ...BOX_PROPS],
  card: [P_TITLE, P_TEXT, ...TEXT_STYLE_PROPS, P_COLOR, ...BOX_PROPS],
  container: [P_COLOR, P_BACKGROUND, ...BOX_PROPS],
  switch: [P_TEXT, P_CHECKED, P_FONT_SIZE, P_BOLD, P_ITALIC, P_FONT_FAMILY, P_COLOR, P_TRACK_COLOR],
  group: [],
  markdown: [P_TEXT, ...TEXT_STYLE_PROPS, ...BOX_PROPS],
  html: [P_HTML, ...TEXT_STYLE_PROPS, ...BOX_PROPS],
  shape: [P_SHAPE, P_SIDES, P_POINTS, P_INNER_RATIO, P_PATH, P_BACKGROUND, P_COLOR, ...BOX_PROPS],
  canvas: [P_COLOR, P_BACKGROUND, ...BOX_PROPS],
}

export interface ScriptApiMember {
  name: string
  detail: string
}
export interface ScriptApiNamespace {
  name: string
  detail: string
  members: ScriptApiMember[]
}

/** What every script can call, with no imports — the AI prompt's API section. */
export const SCRIPT_API: ScriptApiNamespace[] = [
  {
    name: 'store',
    detail: 'Shared key/value state for the whole run',
    members: [
      { name: 'store.get(key)', detail: 'read a value (undefined if never set)' },
      { name: 'store.set(key, value)', detail: 'write a value and refresh {{key}} labels' },
    ],
  },
  {
    name: 'controls',
    detail: 'Every object by name; object names are also bare identifiers in a script',
    members: [
      { name: '<name>.text', detail: 'text content (an input value, switch label, markdown source)' },
      { name: '<name>.value', detail: "an input's value; a switch's checked state" },
      { name: '<name>.visible', detail: 'show/hide the object' },
      { name: '<name>.enabled', detail: 'enable/disable buttons and inputs' },
      { name: '<name>.x / .y / .width / .height', detail: 'position and size in pixels' },
      { name: '<name>.color', detail: "colour name or any CSS colour; '' resets" },
      { name: '<name>.fontFamily / .bold / .italic / .textAlign / .vAlign / .textColor / .background', detail: 'text style' },
      { name: '<name>.trackColor', detail: "a switch's toggle-track colour" },
      { name: '<name>.borderWidth / .borderStyle / .borderColor / .radius / .opacity', detail: 'box style (border, corner radius, opacity)' },
      { name: '<name>.on(event, fn)', detail: 'attach an extra handler in code' },
      { name: '<name>.el', detail: 'the raw DOM element' },
    ],
  },
  {
    name: 'page',
    detail: 'Navigation and dialogs',
    members: [
      { name: 'page.name', detail: 'current page name' },
      { name: 'page.names', detail: 'every page name' },
      { name: "page.go('Name')", detail: "navigate; fires pageLeave then the target's pageEnter" },
      { name: "page.popupOpen('Name', opts?)", detail: 'open a page as a popup ({ modal, chrome, x, y })' },
      { name: 'page.popupClose(name?) / page.popupCloseAll()', detail: 'close popups' },
      { name: 'page.popups', detail: 'open popup names, bottom → top' },
    ],
  },
  {
    name: 'event',
    detail: 'The DOM event that fired (object event scripts)',
    members: [{ name: 'event.target.value', detail: 'the element value (input/change scripts)' }],
  },
  {
    name: 'target',
    detail: 'The object that received the event (a full control API)',
    members: [],
  },
  {
    name: 'self',
    detail: 'The object whose script is running (`this` is an alias)',
    members: [
      { name: 'self.canvas / self.ctx', detail: "a canvas object's element and 2D drawing context" },
      { name: 'self.redraw()', detail: "clear a canvas and re-run its `draw` script" },
      { name: 'self.animate(on?)', detail: 'start/stop a per-frame repaint loop (canvas animation)' },
    ],
  },
  {
    name: 'forward',
    detail: 'Pass the event to the enclosing group handler',
    members: [],
  },
  {
    name: 'author',
    detail: 'Async editor bridge, available on plugin pages only',
    members: [
      { name: 'author.selected() / getSelection() / selectionJson()', detail: 'read the editor selection' },
      { name: "author.insertControl(kind, { x, y, w, h, props })", detail: 'add an object, returns a handle' },
      { name: "author.command('group'|'ungroup'|'delete'|'duplicate'|'front'|'back'|'forward'|'backward')", detail: 'editor commands' },
      { name: 'author.updateProps(id, patch) / author.message(text) / author.pageInfo()', detail: 'patch props, status message, page info' },
    ],
  },
]

/** Bump when the manifest changes so a stale AI conversation is detectable. */
export const CAPABILITY_VERSION = 4

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

export type SafeParseBookResult =
  | { success: true; data: Book; error?: never }
  | {
      success: false
      error: { issues: Array<{ path: (string | number)[]; message: string }> }
      data?: never
    }

export function safeParseBook(data: unknown): SafeParseBookResult {
  try {
    return BookSchema.safeParse(migrateBook(data))
  } catch (err) {
    return {
      success: false,
      error: {
        issues: [
          {
            path: ['formatVersion'],
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      },
    }
  }
}

export type IssueSeverity = 'error' | 'warning'
export interface ValidationIssue {
  path: string
  message: string
  severity: IssueSeverity
}
export interface ValidationResult {
  ok: boolean
  book?: Book
  issues: ValidationIssue[]
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/
const TEMPLATE_KEY_RE = /{{([A-Za-z_$][\w$]*)}}/g
const GO_RE = /page\.go\(\s*['"]([^'"]+)['"]/g
const POPUP_RE = /popupOpen\(\s*['"]([^'"]+)['"]/g
const CONTROLS_RE = /controls\.([A-Za-z_$][\w$]*)/g
const STORE_SET_RE = /store\.set\(\s*['"]([^'"]+)['"]/g
const TS_ANNOTATION_RE = /:\s*(string|number|boolean)\b/

function collectObjectPaths(
  objects: PageObject[],
  base: string,
): Array<{ obj: PageObject; path: string }> {
  const out: Array<{ obj: PageObject; path: string }> = []
  const walk = (objs: PageObject[], p: string): void => {
    objs.forEach((o, i) => {
      const here = `${p}[${i}]`
      out.push({ obj: o, path: here })
      if (o.children?.length) walk(o.children, `${here}.children`)
    })
  }
  walk(objects, base)
  return out
}

function matchAll(re: RegExp, source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(re)) if (m[1]) out.push(m[1])
  return out
}

function allObjectPaths(book: Book): Array<{ obj: PageObject; path: string }> {
  return [
    ...book.backgrounds.flatMap((b, i) =>
      collectObjectPaths(b.objects, `backgrounds[${i}].objects`),
    ),
    ...book.pages.flatMap((p, i) => collectObjectPaths(p.objects, `pages[${i}].objects`)),
  ]
}

function lintBook(book: Book): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const pageNames: string[] = []
  const pageNameSet = new Set<string>()
  for (const [i, page] of book.pages.entries()) {
    if (pageNameSet.has(page.name)) {
      issues.push({
        path: `pages[${i}]`,
        message: `duplicate page name "${page.name}" — page.go resolves pages by name`,
        severity: 'error',
      })
    }
    pageNameSet.add(page.name)
    pageNames.push(page.name)
  }

  const allNames = new Set<string>()
  const allIds = new Set<string>()
  const addObjects = (paths: Array<{ obj: PageObject; path: string }>, container: string): void => {
    const names = new Set<string>()
    for (const { obj, path } of paths) {
      if (allIds.has(obj.id)) {
        issues.push({ path, message: `duplicate object id "${obj.id}"`, severity: 'error' })
      }
      allIds.add(obj.id)
      allNames.add(obj.name)
      if (!IDENT_RE.test(obj.name)) {
        issues.push({
          path,
          message: `object name "${obj.name}" is not a valid JavaScript identifier`,
          severity: 'error',
        })
      }
      if (names.has(obj.name)) {
        issues.push({
          path,
          message: `duplicate object name "${obj.name}" in ${container}`,
          severity: 'error',
        })
      }
      names.add(obj.name)
      const allowed = new Set(CONTROL_PROPS[obj.control].map((p) => p.name))
      for (const key of Object.keys(obj.props)) {
        if (!allowed.has(key)) {
          issues.push({
            path: `${path}.props.${key}`,
            message: `unknown property "${key}" on ${obj.control}`,
            severity: 'warning',
          })
        }
      }
    }
  }

  book.backgrounds.forEach((bg, i) =>
    addObjects(
      collectObjectPaths(bg.objects, `backgrounds[${i}].objects`),
      `background "${bg.name}"`,
    ),
  )
  book.pages.forEach((page, i) => {
    const paths = collectObjectPaths(page.objects, `pages[${i}].objects`)
    addObjects(paths, `page "${page.name}"`)
    const bg = backgroundFor(book, page)
    const bgNames = new Set(flattenObjects(bg.objects).map((o) => o.name))
    for (const o of flattenObjects(page.objects)) {
      if (bgNames.has(o.name)) {
        issues.push({
          path: `pages[${i}]`,
          message: `object name "${o.name}" collides with page background "${bg.name}" (one namespace per run)`,
          severity: 'error',
        })
      }
    }
  })

  const definedStoreKeys = new Set((book.store ?? []).map(([k]) => k))
  const scripts: Array<{ path: string; source: string }> = []
  book.backgrounds.forEach((bg, i) => {
    scripts.push({ path: `backgrounds[${i}].script`, source: bg.script })
    for (const { obj, path } of collectObjectPaths(bg.objects, `backgrounds[${i}].objects`)) {
      for (const [ev, src] of Object.entries(obj.on)) scripts.push({ path: `${path}.on.${ev}`, source: src })
    }
  })
  book.pages.forEach((page, i) => {
    scripts.push({ path: `pages[${i}].script`, source: page.script })
    for (const { obj, path } of collectObjectPaths(page.objects, `pages[${i}].objects`)) {
      for (const [ev, src] of Object.entries(obj.on)) scripts.push({ path: `${path}.on.${ev}`, source: src })
    }
  })

  for (const { path, source } of scripts) {
    if (!source) continue
    for (const name of matchAll(GO_RE, source)) {
      if (!pageNameSet.has(name)) {
        issues.push({ path, message: `page.go("${name}") — no page with that name`, severity: 'error' })
      }
    }
    for (const name of matchAll(POPUP_RE, source)) {
      if (!pageNameSet.has(name)) {
        issues.push({ path, message: `page.popupOpen("${name}") — no page with that name`, severity: 'error' })
      }
    }
    for (const name of matchAll(CONTROLS_RE, source)) {
      if (!allNames.has(name)) {
        issues.push({ path, message: `controls.${name} — no object with that name`, severity: 'error' })
      }
    }
    for (const key of matchAll(STORE_SET_RE, source)) definedStoreKeys.add(key)
    if (TS_ANNOTATION_RE.test(source)) {
      issues.push({
        path,
        message: 'looks like a TypeScript annotation — scripts must be plain JavaScript',
        severity: 'warning',
      })
    }
  }

  for (const { obj, path } of allObjectPaths(book)) {
    for (const [key, value] of Object.entries(obj.props)) {
      if (typeof value !== 'string' || !value.includes('{{')) continue
      for (const name of matchAll(TEMPLATE_KEY_RE, value)) {
        if (!definedStoreKeys.has(name)) {
          issues.push({
            path: `${path}.props.${key}`,
            message: `{{${name}}} is never seeded or set by a script`,
            severity: 'warning',
          })
        }
      }
    }
  }

  return issues
}

/**
 * Parse + lint a book for AI generation. Structural failures come back as
 * `error` issues (a repair turn can feed them straight to the model); semantic
 * misses are linted after a successful parse. Unknown props are warnings so
 * forward-compatible books still load.
 */
export function validateBook(data: unknown): ValidationResult {
  const parsed = safeParseBook(data)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.') || '(root)',
        message: i.message,
        severity: 'error' as const,
      })),
    }
  }
  const issues = lintBook(parsed.data)
  return { ok: !issues.some((i) => i.severity === 'error'), book: parsed.data, issues }
}

/** Compact issue list for feeding back into an AI repair turn. */
export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) return ''
  return issues.map((i) => `- [${i.severity}] ${i.path}: ${i.message}`).join('\n')
}

export interface NormalizeResult {
  book: unknown
  notes: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function sanitizeIdent(base: string, fallback: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9_$]/g, '')
  if (/^[A-Za-z_$][\w$]*$/.test(cleaned)) return cleaned
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`
  return fallback
}

function uniqueIdent(base: string, taken: Set<string>): string {
  let name = base
  if (taken.has(name)) {
    let n = 2
    while (taken.has(`${name}${n}`)) n++
    name = `${name}${n}`
  }
  taken.add(name)
  return name
}

/** Page names are free text (page.go resolves them) — only unique them. */
function uniquePageName(base: string, taken: Set<string>): string {
  let name = base.trim() || 'Page'
  if (taken.has(name)) {
    let n = 2
    while (taken.has(`${name} ${n}`)) n++
    name = `${name} ${n}`
  }
  taken.add(name)
  return name
}

/**
 * Fill the gaps an AI-generated book commonly has, so more first attempts pass
 * validation without a repair round. Only ever fills missing/invalid values —
 * it never overrides an explicit one, and never invents a control kind. Every
 * change is reported as a note. Returns the input unchanged if it isn't an
 * object (the schema validator will describe the failure).
 */
export function normalizeBook(data: unknown): NormalizeResult {
  const notes: string[] = []
  if (!isRecord(data)) return { book: data, notes }
  const book = JSON.parse(JSON.stringify(data)) as Record<string, unknown>

  if (typeof book['id'] !== 'string' || !book['id']) {
    book['id'] = newId('book')
    notes.push('assigned a book id')
  }
  if (typeof book['title'] !== 'string' || !book['title']) {
    book['title'] = 'Untitled'
    notes.push('defaulted the title')
  }
  if (!Array.isArray(book['backgrounds'])) book['backgrounds'] = []
  if (!Array.isArray(book['pages'])) book['pages'] = []

  const backgrounds = book['backgrounds'] as unknown[]
  for (let i = backgrounds.length - 1; i >= 0; i--) {
    if (!isRecord(backgrounds[i])) {
      const fresh = { id: newId('bg'), name: `Background ${i + 1}`, color: '#ffffff', script: '', objects: [] }
      backgrounds[i] = fresh
      notes.push('repaired an invalid background')
      continue
    }
    const bg = backgrounds[i] as Record<string, unknown>
    if (typeof bg['id'] !== 'string' || !bg['id']) bg['id'] = newId('bg')
    if (typeof bg['name'] !== 'string' || !bg['name']) bg['name'] = `Background ${i + 1}`
    if (typeof bg['color'] !== 'string') bg['color'] = '#ffffff'
    if (typeof bg['script'] !== 'string') bg['script'] = ''
    if (!Array.isArray(bg['objects'])) bg['objects'] = []
  }

  const bgIds = new Set(
    backgrounds.filter(isRecord).map((b) => (b as Record<string, unknown>)['id'] as string),
  )
  if (bgIds.size === 0) {
    const bg = { id: newId('bg'), name: 'Background 1', color: '#ffffff', script: '', objects: [] }
    backgrounds.push(bg)
    bgIds.add(bg.id)
    notes.push('added a default background')
  }
  const fallbackBgId = backgrounds.find(isRecord)!['id'] as string

  const pages = book['pages'] as unknown[]
  const pageNames = new Set<string>()
  const refMap = new Map<string, string>()

  const normalizeObjects = (objs: unknown[]): void => {
    for (let i = objs.length - 1; i >= 0; i--) {
      if (!isRecord(objs[i])) {
        objs.splice(i, 1)
        notes.push('dropped a non-object')
      }
    }
    const taken = new Set<string>()
    for (const raw of objs) {
      const o = raw as Record<string, unknown>
      if (typeof o['id'] !== 'string' || !o['id']) o['id'] = newId('obj')
      const control = typeof o['control'] === 'string' ? o['control'] : ''
      const kind = (CONTROL_KINDS as readonly string[]).includes(control)
        ? (control as ControlKind)
        : null
      const declared = typeof o['name'] === 'string' ? o['name'] : ''
      const name = uniqueIdent(sanitizeIdent(declared, kind ?? 'item'), taken)
      if (name !== declared) {
        if (declared) refMap.set(declared, name)
        o['name'] = name
      }
      const size = kind ? DEFAULT_SIZES[kind] : { w: 120, h: 40 }
      if (!isRecord(o['x'])) {
        o['x'] = { mode: 'left', left: 0, width: size.w }
      }
      if (!isRecord(o['y'])) {
        o['y'] = { mode: 'top', top: 0, height: size.h }
      }
      const props = isRecord(o['props']) ? (o['props'] as Record<string, unknown>) : {}
      if (kind) {
        for (const [k, v] of Object.entries(DEFAULT_PROPS[kind])) {
          if (!(k in props)) props[k] = v
        }
      }
      o['props'] = props
      if (!isRecord(o['on'])) o['on'] = {}
      if (Array.isArray(o['children'])) normalizeObjects(o['children'] as unknown[])
    }
  }

  for (const raw of pages) {
    if (!isRecord(raw)) continue
    const page = raw as Record<string, unknown>
    if (typeof page['id'] !== 'string' || !page['id']) page['id'] = newId('page')
    const declared = typeof page['name'] === 'string' ? page['name'] : ''
    const name = uniquePageName(declared, pageNames)
    if (name !== declared) {
      if (declared) refMap.set(declared, name)
      page['name'] = name
      notes.push(`renamed page "${declared || '(unnamed)'}" → ${name}`)
    }
    if (typeof page['script'] !== 'string') page['script'] = ''
    if (typeof page['backgroundId'] !== 'string' || !bgIds.has(page['backgroundId'])) {
      page['backgroundId'] = fallbackBgId
      notes.push(`pointed page "${name}" at a valid background`)
    }
    if (!Array.isArray(page['objects'])) page['objects'] = []
    normalizeObjects(page['objects'] as unknown[])
  }

  for (let i = pages.length - 1; i >= 0; i--) {
    if (!isRecord(pages[i])) {
      pages.splice(i, 1)
      notes.push('dropped a non-page')
    }
  }

  if (refMap.size) {
    const rewrite = (src: string): string => {
      let out = src
      for (const [from, to] of refMap) {
        if (!from || from === to) continue
        out = out
          .split(`'${from}'`)
          .join(`'${to}'`)
          .split(`"${from}"`)
          .join(`"${to}"`)
          .replace(new RegExp(`\\b${from}\\b`, 'g'), to)
      }
      return out
    }
    const walk = (objs: unknown[]): void => {
      for (const raw of objs) {
        if (!isRecord(raw)) continue
        const o = raw as Record<string, unknown>
        if (isRecord(o['on'])) {
          const on = o['on'] as Record<string, unknown>
          for (const k of Object.keys(on)) {
            if (typeof on[k] === 'string') on[k] = rewrite(on[k] as string)
          }
        }
        if (Array.isArray(o['children'])) walk(o['children'] as unknown[])
      }
    }
    for (const raw of backgrounds) {
      if (!isRecord(raw)) continue
      const bg = raw as Record<string, unknown>
      if (typeof bg['script'] === 'string') bg['script'] = rewrite(bg['script'] as string)
      if (Array.isArray(bg['objects'])) walk(bg['objects'] as unknown[])
    }
    for (const raw of pages) {
      if (!isRecord(raw)) continue
      const page = raw as Record<string, unknown>
      if (typeof page['script'] === 'string') page['script'] = rewrite(page['script'] as string)
      if (Array.isArray(page['objects'])) walk(page['objects'] as unknown[])
    }
  }

  return { book, notes }
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
export function resolveX(c: XEdge, boxWidth: number): { left: number; width: number } {
  switch (c.mode) {
    case 'left':
      return { left: c.left, width: c.width }
    case 'right':
      return { left: boxWidth - c.right - c.width, width: c.width }
    case 'both':
      return { left: c.left, width: Math.max(1, boxWidth - c.left - c.right) }
    case 'center':
      return { left: (boxWidth - c.width) / 2, width: c.width }
  }
}

/** resolve a vertical edge constraint against a containing box height */
export function resolveY(c: YEdge, boxHeight: number): { top: number; height: number } {
  switch (c.mode) {
    case 'top':
      return { top: c.top, height: c.height }
    case 'bottom':
      return { top: boxHeight - c.bottom - c.height, height: c.height }
    case 'both':
      return { top: c.top, height: Math.max(1, boxHeight - c.top - c.bottom) }
    case 'center':
      return { top: (boxHeight - c.height) / 2, height: c.height }
  }
}

/** the rect an object renders at inside `box` (its page or its group box) */
export function rectForObject(obj: PageObject, box: CanvasSize): Rect {
  const x = resolveX(obj.x, box.width)
  const y = resolveY(obj.y, box.height)
  return {
    x: Math.round(x.left),
    y: Math.round(y.top),
    w: Math.max(1, Math.round(x.width)),
    h: Math.max(1, Math.round(y.height)),
  }
}

/** build a horizontal constraint for a rendered rect in `box`, keeping `mode` */
export function xEdgeFromRect(rect: Rect, boxWidth: number, mode: XEdgeMode): XEdge {
  const left = Math.round(rect.x)
  const width = Math.max(1, Math.round(rect.w))
  const right = Math.round(boxWidth - (rect.x + rect.w))
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
export function yEdgeFromRect(rect: Rect, boxHeight: number, mode: YEdgeMode): YEdge {
  const top = Math.round(rect.y)
  const height = Math.max(1, Math.round(rect.h))
  const bottom = Math.round(boxHeight - (rect.y + rect.h))
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
  obj.x = xEdgeFromRect(rect, box.width, modes?.x ?? obj.x.mode)
  obj.y = yEdgeFromRect(rect, box.height, modes?.y ?? obj.y.mode)
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
 * resize: a follows-both axis scales both distances, a centred axis its size, a
 * near/far axis its distance and size.
 */
export function scaleEdges(obj: PageObject, fx: number, fy: number): void {
  obj.x = scaleXEdge(obj.x, fx)
  obj.y = scaleYEdge(obj.y, fy)
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
    if (obj.x.mode === 'left') {
      right = Math.max(right, obj.x.left + obj.x.width)
    }
    if (obj.y.mode === 'top') {
      bottom = Math.max(bottom, obj.y.top + obj.y.height)
    }
  }
  return { right, bottom }
}

/** the empty space a page keeps past its content on the right/bottom */
export function pagePadding(page: Page): number {
  return Math.max(0, page.padding ?? 0)
}

/**
 * The size a page renders at: a fixed page (`Page.size`) is its own box; an
 * ordinary page fills `container` and grows on either axis by the content
 * extent placed past the fold (plus the page padding).
 */
export function resolvePageBox(
  page: Page,
  container: CanvasSize,
  objects: PageObject[],
): CanvasSize {
  if (page.size) return { width: page.size.width, height: page.size.height }
  const extent = contentExtent(objects)
  const pad = pagePadding(page)
  return {
    width: Math.max(Math.max(1, Math.round(container.width)), Math.ceil(extent.right) + pad),
    height: Math.max(Math.max(1, Math.round(container.height)), Math.ceil(extent.bottom) + pad),
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


