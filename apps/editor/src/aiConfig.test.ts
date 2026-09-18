import { describe, expect, it } from 'vitest'
import {
  AI_CONFIG_KEY,
  LEGACY_AI_KEY,
  clearAllKeys,
  loadAiConfig,
  saveAiConfig,
  settingsFor,
  withProvider,
} from './aiConfig'
import { DEFAULT_PROVIDER_ID } from './providers'

function fakeStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

describe('aiConfig', () => {
  it('starts from defaults when nothing is stored', () => {
    const config = loadAiConfig(fakeStorage())
    expect(config.lastProvider).toBe(DEFAULT_PROVIDER_ID)
    expect(config.providers).toEqual({})
  })

  it('round-trips the v2 shape', () => {
    const storage = fakeStorage()
    const config = withProvider(
      { lastProvider: 'groq', providers: {} },
      'groq',
      { apiKey: 'k', model: 'llama-3.3-70b-versatile' },
    )
    saveAiConfig(config, storage)
    expect(loadAiConfig(storage)).toEqual(config)
  })

  it('migrates a legacy settings object that matches a preset', () => {
    const storage = fakeStorage({
      [LEGACY_AI_KEY]: JSON.stringify({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-old',
        model: 'gpt-4o',
      }),
    })
    const config = loadAiConfig(storage)
    expect(config.lastProvider).toBe('openai')
    expect(config.providers['openai']).toEqual({ apiKey: 'sk-old', model: 'gpt-4o' })
  })

  it('migrates a legacy custom endpoint, preserving its base URL', () => {
    const storage = fakeStorage({
      [LEGACY_AI_KEY]: JSON.stringify({
        baseUrl: 'http://localhost:9999/v1',
        apiKey: '',
        model: 'local',
      }),
    })
    const config = loadAiConfig(storage)
    expect(config.lastProvider).toBe('custom')
    expect(config.providers['custom']).toEqual({
      apiKey: '',
      model: 'local',
      baseUrl: 'http://localhost:9999/v1',
    })
  })

  it('prefers v2 over a stale legacy object', () => {
    const storage = fakeStorage({
      [LEGACY_AI_KEY]: JSON.stringify({ baseUrl: 'https://api.openai.com/v1', apiKey: 'old' }),
      [AI_CONFIG_KEY]: JSON.stringify({ lastProvider: 'deepseek', providers: { deepseek: { apiKey: 'new', model: 'deepseek-chat' } } }),
    })
    expect(loadAiConfig(storage).providers['deepseek']?.apiKey).toBe('new')
  })

  it('falls back to the default provider when the saved id is unknown', () => {
    const storage = fakeStorage({
      [AI_CONFIG_KEY]: JSON.stringify({ lastProvider: 'gone', providers: {} }),
    })
    expect(loadAiConfig(storage).lastProvider).toBe(DEFAULT_PROVIDER_ID)
  })

  it('resolves effective settings with preset defaults', () => {
    const config = withProvider({ lastProvider: 'deepseek', providers: {} }, 'deepseek', { apiKey: 'k' })
    const effective = settingsFor(config, 'deepseek')
    expect(effective.apiKey).toBe('k')
    expect(effective.model).toBe('deepseek-flash')
    expect(effective.baseUrl).toBe('https://api.deepseek.com')
  })

  it('upgrades the superseded DeepSeek default model to flash', () => {
    const storage = fakeStorage({
      [AI_CONFIG_KEY]: JSON.stringify({
        lastProvider: 'deepseek',
        providers: { deepseek: { apiKey: 'k', model: 'deepseek-chat' } },
      }),
    })
    expect(loadAiConfig(storage).providers['deepseek']?.model).toBe('deepseek-flash')
  })

  it('clears every stored key but keeps models and base URLs', () => {
    const config = clearAllKeys({
      lastProvider: 'custom',
      providers: {
        custom: { apiKey: 'a', model: 'm', baseUrl: 'http://x/v1' },
        groq: { apiKey: 'b', model: 'g' },
      },
    })
    expect(config.providers['custom']).toEqual({ apiKey: '', model: 'm', baseUrl: 'http://x/v1' })
    expect(config.providers['groq']).toEqual({ apiKey: '', model: 'g' })
  })
})
