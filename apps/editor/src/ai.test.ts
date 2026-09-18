import { afterEach, describe, expect, it, vi } from 'vitest'
import { sampleBook } from '@toolback/format/src/sample'
import {
  chatComplete,
  extractJson,
  fetchModels,
  generateBook,
  isChatModel,
  manifestText,
  type AiSettings,
  type ChatMessage,
} from './ai'

const settings: AiSettings = { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' }

describe('extractJson', () => {
  it('reads a bare object', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })

  it('unwraps a markdown fence and surrounding prose', () => {
    expect(extractJson('Here you go:\n```json\n{"a": { "b": 2 }}\n```\nEnjoy')).toBe(
      '{"a": { "b": 2 }}',
    )
  })

  it('returns null when there is no object', () => {
    expect(extractJson('sorry, I cannot')).toBeNull()
  })
})

describe('manifestText', () => {
  it('lists control kinds and the script API', () => {
    const text = manifestText()
    expect(text).toContain('### button')
    expect(text).toContain('### group')
    expect(text).toContain('script API')
    expect(text).toContain('store.get')
  })
})

describe('generateBook', () => {
  it('returns the book once a reply validates', async () => {
    const replies = ['not json at all', JSON.stringify(sampleBook())]
    const seen: ChatMessage[][] = []
    const chat = async (messages: ChatMessage[]): Promise<string> => {
      seen.push(messages.map((m) => ({ ...m })))
      return replies[Math.min(seen.length - 1, replies.length - 1)]!
    }
    const result = await generateBook('sys', 'build a counter', settings, { chat })
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(result.book?.title).toBe('Hello Toolbook')
    expect(seen[1]!.some((m) => m.content.includes('did not validate'))).toBe(true)
  })

  it('gives up after the repair budget', async () => {
    const chat = async (): Promise<string> => 'still not json'
    const result = await generateBook('sys', 'x', settings, { chat, maxRepairs: 2 })
    expect(result.ok).toBe(false)
    expect(result.attempts).toBe(3)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('chatComplete adapters', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts OpenAI-compatible chat completions with a bearer token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'hi' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await chatComplete(
      [{ role: 'user', content: 'x' }],
      { baseUrl: 'https://api.deepseek.com', apiKey: 'k', model: 'deepseek-chat' },
    )
    expect(out).toBe('hi')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer k')
  })

  it('uses the Anthropic messages shape with the browser opt-in header', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ content: [{ type: 'text', text: 'claude says hi' }] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const settings: AiSettings = {
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant',
      model: 'claude-sonnet-4-20250514',
      api: 'anthropic',
      maxTokens: 111,
    }
    const out = await chatComplete(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hello' },
      ],
      settings,
    )
    expect(out).toBe('claude says hi')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('sk-ant')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(String(init.body))
    expect(body.system).toBe('sys')
    expect(body.max_tokens).toBe(111)
    expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('does not require a key for local providers', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const out = await chatComplete(
      [{ role: 'user', content: 'x' }],
      { baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'llama3.2' },
    )
    expect(out).toBe('ok')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined()
  })
})

describe('fetchModels', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads, de-duplicates and sorts ids from the data array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] })),
    )
    const infos = await fetchModels({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k', model: '' })
    expect(infos.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('marks non-chat models using output modalities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [
            { id: 'openai/gpt-oss-20b', output_modalities: ['text'] },
            { id: 'whisper-large-v3', output_modalities: ['transcription'] },
            { id: 'canopylabs/orpheus', output_modalities: ['speech'] },
          ],
        }),
      ),
    )
    const infos = await fetchModels({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k', model: '' })
    const byId = Object.fromEntries(infos.map((m) => [m.id, m.chat]))
    expect(byId['openai/gpt-oss-20b']).toBe(true)
    expect(byId['whisper-large-v3']).toBe(false)
    expect(byId['canopylabs/orpheus']).toBe(false)
  })

  it('throws a readable error when the provider refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, false, 401)))
    await expect(
      fetchModels({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '' }),
    ).rejects.toThrow(/401/)
  })

  it('explains a blocked browser request (CORS)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(
      fetchModels({ baseUrl: 'https://api.deepseek.com', apiKey: 'k', model: '' }),
    ).rejects.toThrow(/CORS/)
  })
})

describe('isChatModel', () => {
  it('uses OpenRouter architecture modality', () => {
    expect(isChatModel('x', { architecture: { modality: 'text->text' } })).toBe(true)
    expect(isChatModel('x', { architecture: { modality: 'text->image' } })).toBe(false)
  })

  it('falls back to id heuristics', () => {
    expect(isChatModel('gpt-4o-mini')).toBe(true)
    expect(isChatModel('whisper-large-v3')).toBe(false)
    expect(isChatModel('text-embedding-3-small')).toBe(false)
  })
})

describe('generateBook enhancements', () => {
  it('repairs on smoke-run script errors', async () => {
    let smokeCalls = 0
    const chat = async (): Promise<string> => JSON.stringify(sampleBook())
    const smoke = async (): Promise<string[]> => {
      smokeCalls += 1
      return smokeCalls === 1 ? ['pageEnter: Error: boom'] : []
    }
    const result = await generateBook('sys', 'build', settings, { chat, smoke })
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(2)
    expect(smokeCalls).toBe(2)
  })

  it('includes prior history before the new user turn', async () => {
    let seen: ChatMessage[] = []
    const chat = async (messages: ChatMessage[]): Promise<string> => {
      seen = messages.map((m) => ({ ...m }))
      return JSON.stringify(sampleBook())
    }
    await generateBook('sys', 'more', settings, {
      chat,
      history: [
        { role: 'user', content: 'earlier request' },
        { role: 'assistant', content: 'earlier reply' },
      ],
    })
    expect(seen.map((m) => m.content)).toEqual([
      'sys',
      'earlier request',
      'earlier reply',
      'more',
    ])
  })

  it('normalizes a near-miss book instead of repairing', async () => {
    const nearMiss = {
      pages: [{ name: 'Home', objects: [{ name: 'hi', control: 'label', props: { text: 'Hi' } }] }],
    }
    const chat = async (): Promise<string> => JSON.stringify(nearMiss)
    const result = await generateBook('sys', 'x', settings, { chat })
    expect(result.ok).toBe(true)
    expect(result.notes.length).toBeGreaterThan(0)
    expect(result.attempts).toBe(1)
  })
})
