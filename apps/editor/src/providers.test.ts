import { describe, expect, it } from 'vitest'
import { DEFAULT_PROVIDER_ID, PROVIDER_PRESETS, presetFor } from './providers'

describe('provider presets', () => {
  it('has unique ids', () => {
    const ids = PROVIDER_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every preset a valid api shape and (except custom) a base URL', () => {
    for (const p of PROVIDER_PRESETS) {
      expect(['openai', 'anthropic']).toContain(p.api)
      if (p.id !== 'custom') expect(p.baseUrl, p.id).toMatch(/^https?:\/\//)
    }
  })

  it('flags the local providers as keyless', () => {
    expect(presetFor('ollama').keyless).toBe(true)
    expect(presetFor('lmstudio').keyless).toBe(true)
  })

  it('uses the anthropic shape with the browser opt-in for Anthropic', () => {
    const anthropic = presetFor('anthropic')
    expect(anthropic.api).toBe('anthropic')
    expect(anthropic.browserAccessHeader).toBe(true)
    expect(anthropic.baseUrl).toBe('https://api.anthropic.com/v1')
  })

  it('suggests and defaults to deepseek-flash for DeepSeek', () => {
    expect(presetFor('deepseek').models).toContain('deepseek-flash')
    expect(presetFor('deepseek').defaultModel).toBe('deepseek-flash')
  })

  it('falls back to the default preset for an unknown id', () => {
    expect(presetFor('nope').id).toBe(DEFAULT_PROVIDER_ID)
    expect(presetFor(undefined).id).toBe(DEFAULT_PROVIDER_ID)
  })
})
