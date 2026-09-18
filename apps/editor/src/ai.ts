import {
  CAPABILITY_VERSION,
  CONTROL_KINDS,
  CONTROL_PROPS,
  SCRIPT_API,
  formatIssues,
  normalizeBook,
  validateBook,
  type Book,
  type ValidationIssue,
} from '@toolback/format'
import type { StyleTokens } from './aiConfig'

export type ApiShape = 'openai' | 'anthropic'

export interface AiSettings {
  baseUrl: string
  apiKey: string
  model: string
  /** request/response shape (default: openai chat completions) */
  api?: ApiShape
  /** extra request headers a provider needs */
  headers?: Record<string, string>
  /** Anthropic requires max_tokens; also used as an OpenAI cap */
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatFn = (
  messages: ChatMessage[],
  settings: AiSettings,
  signal?: AbortSignal,
) => Promise<string>

export interface GenerateOptions {
  chat?: ChatFn
  /** repair turns after the first attempt (default 3) */
  maxRepairs?: number
  signal?: AbortSignal
  /** run the parsed book and return runtime error messages (empty = ok) */
  smoke?: (book: Book) => Promise<string[]>
  /** prior turns, for follow-up refinement */
  history?: ChatMessage[]
}

export interface GenerateResult {
  ok: boolean
  book?: Book
  issues: ValidationIssue[]
  /** normalization + smoke-run notes to surface in the log */
  notes: string[]
  raw: string
  attempts: number
  messages: ChatMessage[]
}

/** A compact design-token block prepended to every request. */
export function styleGuide(style: StyleTokens): string {
  return [
    'Design tokens — apply these to the book unless the request says otherwise:',
    `- page background: ${style.background}`,
    `- surfaces (cards, containers, buttons): ${style.surface}`,
    `- text: ${style.text}`,
    `- accent (primary buttons, highlights): ${style.accent}`,
    `- font family: ${style.fontFamily}`,
    `- corner radius: ${style.radius}px`,
  ].join('\n')
}

/** The factual control/property/API tables, generated from the manifest. */
export function manifestText(): string {
  const lines: string[] = [`Capability version: ${CAPABILITY_VERSION}`]
  for (const kind of CONTROL_KINDS) {
    lines.push(`### ${kind}`)
    const props = CONTROL_PROPS[kind]
    if (!props.length) {
      lines.push('(no properties)')
      continue
    }
    for (const p of props) {
      const type = p.type + (p.enum ? `: ${p.enum.join(' | ')}` : '')
      lines.push(
        `- ${p.name} (${type})${p.scriptable ? ' [scriptable]' : ''} — ${p.doc}`,
      )
    }
  }
  lines.push('### script API')
  for (const ns of SCRIPT_API) {
    lines.push(`- ${ns.name} — ${ns.detail}`)
    for (const m of ns.members) lines.push(`  - ${m.name} — ${m.detail}`)
  }
  return lines.join('\n')
}

/** Pull the JSON object out of a model reply (tolerates markdown fences). */
export function extractJson(text: string): string | null {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1]?.trim() ?? trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return body.slice(start, end + 1)
}

function apiUrl(baseUrl: string, path: string): string {
  const url = baseUrl.trim().replace(/\/+$/, '')
  return url.endsWith(path) ? url : `${url}${path}`
}

function authHeaders(settings: AiSettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...settings.headers }
  const key = settings.apiKey.trim()
  if (settings.api === 'anthropic') {
    if (key) headers['x-api-key'] = key
    headers['anthropic-version'] = '2023-06-01'
    // Anthropic refuses browser calls without this explicit opt-in
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  } else if (key) {
    headers['Authorization'] = `Bearer ${key}`
  }
  return headers
}

function networkError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return new Error(
      'Network request blocked — the provider may not allow browser (CORS) requests. Try the Custom endpoint via a local proxy.',
    )
  }
  return err instanceof Error ? err : new Error(message)
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  } catch (err) {
    throw networkError(err)
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    throw new Error(`Model request failed (${res.status}): ${detail}`)
  }
  return (await res.json()) as Record<string, unknown>
}

async function openAiComplete(
  messages: ChatMessage[],
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const data = await postJson(
    apiUrl(settings.baseUrl, '/chat/completions'),
    authHeaders(settings),
    {
      model: settings.model,
      messages,
      temperature: 0.2,
      ...(settings.maxTokens ? { max_tokens: settings.maxTokens } : {}),
    },
    signal,
  )
  const choices = data['choices'] as Array<{ message?: { content?: string } }> | undefined
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('Model returned no text')
  return content
}

async function anthropicComplete(
  messages: ChatMessage[],
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))
  const data = await postJson(
    apiUrl(settings.baseUrl, '/messages'),
    authHeaders(settings),
    {
      model: settings.model,
      max_tokens: settings.maxTokens ?? 8192,
      ...(system ? { system } : {}),
      messages: rest,
    },
    signal,
  )
  const content = data['content'] as Array<{ type?: string; text?: string }> | undefined
  const text = (content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('')
  if (!text) throw new Error('Model returned no text')
  return text
}

/** Chat call for the provider's API shape (OpenAI-compatible by default). */
export const chatComplete: ChatFn = async (messages, settings, signal) => {
  if (!settings.model.trim()) throw new Error('No model set')
  return settings.api === 'anthropic'
    ? anthropicComplete(messages, settings, signal)
    : openAiComplete(messages, settings, signal)
}

export interface ModelInfo {
  id: string
  /** false for audio/embedding/image/transcription models that can't chat */
  chat: boolean
}

const NON_CHAT_RE = /(whisper|tts|embed|dall-e|moderation|audio|realtime|sora|stable-diffusion|rerank|speech|guard)/i

/** Decide whether a model can do chat, using modalities when the API gives them. */
export function isChatModel(id: string, raw?: Record<string, unknown>): boolean {
  const out = raw?.['output_modalities']
  if (Array.isArray(out)) {
    const outs = out.map(String)
    if (!outs.includes('text')) return false
    if (outs.some((m) => /transcription|speech|audio|image|video/.test(m))) return false
    return true
  }
  const modality = (raw?.['architecture'] as Record<string, unknown> | undefined)?.['modality']
  if (typeof modality === 'string') return modality.endsWith('->text')
  return !NON_CHAT_RE.test(id)
}

/** Best-effort model discovery: GET {base}/models, tolerant of shape. */
export async function fetchModels(settings: AiSettings, signal?: AbortSignal): Promise<ModelInfo[]> {
  let res: Response
  try {
    res = await fetch(apiUrl(settings.baseUrl, '/models'), {
      method: 'GET',
      headers: authHeaders(settings),
      signal,
    })
  } catch (err) {
    throw networkError(err)
  }
  if (!res.ok) {
    throw new Error(`Model list failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { data?: unknown; models?: unknown }
  const list = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []
  const byId = new Map<string, ModelInfo>()
  for (const m of list) {
    if (typeof m === 'string') {
      if (m) byId.set(m, { id: m, chat: isChatModel(m) })
      continue
    }
    if (!m || typeof m !== 'object') continue
    const raw = m as Record<string, unknown>
    const id = raw['id']
    if (typeof id !== 'string' || !id) continue
    byId.set(id, { id, chat: isChatModel(id, raw) })
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Generate a book, validating after every attempt and feeding the issues back
 * for a bounded number of repair turns. The returned `book` only exists when a
 * full book parsed cleanly.
 */
export async function generateBook(
  systemPrompt: string,
  request: string,
  settings: AiSettings,
  options: GenerateOptions = {},
): Promise<GenerateResult> {
  const chat = options.chat ?? chatComplete
  const maxRepairs = options.maxRepairs ?? 3
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(options.history ?? []),
    { role: 'user', content: request },
  ]
  const notes: string[] = []
  let raw = ''
  let issues: ValidationIssue[] = []

  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    raw = await chat(messages, settings, options.signal)
    const json = extractJson(raw)
    if (!json) {
      issues = [
        { path: '(response)', message: 'the reply contained no JSON object', severity: 'error' },
      ]
    } else {
      let parsed: unknown
      let parseable = true
      try {
        parsed = JSON.parse(json)
      } catch (err) {
        parseable = false
        issues = [
          { path: '(json)', message: `invalid JSON: ${String(err)}`, severity: 'error' },
        ]
      }
      if (parseable) {
        const normalized = normalizeBook(parsed)
        for (const note of normalized.notes) if (!notes.includes(note)) notes.push(note)
        const result = validateBook(normalized.book)
        if (result.ok && result.book) {
          const smokeErrors = options.smoke ? await options.smoke(result.book) : []
          if (smokeErrors.length === 0) {
            messages.push({ role: 'assistant', content: raw })
            return {
              ok: true,
              book: result.book,
              issues: result.issues,
              notes,
              raw,
              attempts: attempt,
              messages,
            }
          }
          issues = [
            ...result.issues,
            ...smokeErrors.map((message) => ({
              path: '(runtime)',
              message,
              severity: 'error' as const,
            })),
          ]
        } else {
          issues = result.issues
        }
      }
    }
    messages.push({ role: 'assistant', content: raw })
    messages.push({
      role: 'user',
      content:
        'That book did not validate. Fix every error and return the complete corrected JSON only.\n\n' +
        `Issues:\n${formatIssues(issues)}`,
    })
  }

  return { ok: false, issues, notes, raw, attempts: maxRepairs + 1, messages }
}
