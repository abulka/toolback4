import { DEFAULT_PROVIDER_ID, PROVIDER_PRESETS, presetFor } from './providers'

export interface ProviderSettings {
  apiKey: string
  model: string
  /** only for the custom provider (or a migrated non-preset base URL) */
  baseUrl?: string
}

export interface AiConfig {
  lastProvider: string
  providers: Record<string, ProviderSettings>
  /** global design tokens injected into every prompt */
  style?: StyleTokens
}

export interface StyleTokens {
  background: string
  surface: string
  text: string
  accent: string
  fontFamily: string
  radius: number
}

export const DEFAULT_STYLE: StyleTokens = {
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  accent: '#6366f1',
  fontFamily: 'system',
  radius: 8,
}

function normalizeStyle(raw: unknown): StyleTokens | undefined {
  if (!isRecord(raw)) return undefined
  return {
    background: typeof raw['background'] === 'string' ? raw['background'] : DEFAULT_STYLE.background,
    surface: typeof raw['surface'] === 'string' ? raw['surface'] : DEFAULT_STYLE.surface,
    text: typeof raw['text'] === 'string' ? raw['text'] : DEFAULT_STYLE.text,
    accent: typeof raw['accent'] === 'string' ? raw['accent'] : DEFAULT_STYLE.accent,
    fontFamily: typeof raw['fontFamily'] === 'string' ? raw['fontFamily'] : DEFAULT_STYLE.fontFamily,
    radius: typeof raw['radius'] === 'number' ? raw['radius'] : DEFAULT_STYLE.radius,
  }
}

export const AI_CONFIG_KEY = 'toolback.ai.settings.v2'
export const LEGACY_AI_KEY = 'toolback.ai.settings'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Match a saved base URL back to a preset (else the custom endpoint). */
export function providerIdForBaseUrl(baseUrl: string): string {
  const target = normalizeBase(baseUrl)
  if (!target) return 'custom'
  const found = PROVIDER_PRESETS.find(
    (p) => p.baseUrl && normalizeBase(p.baseUrl) === target,
  )
  return found?.id ?? 'custom'
}

/** The shipped DeepSeek default changed; treat the old value as "not chosen". */
const SUPERSEDED_DEFAULTS: Record<string, string> = { deepseek: 'deepseek-chat' }

function upgradeProviderModels(providers: Record<string, ProviderSettings>): void {
  for (const [id, oldDefault] of Object.entries(SUPERSEDED_DEFAULTS)) {
    const saved = providers[id]
    if (saved && saved.model === oldDefault) saved.model = presetFor(id).defaultModel
  }
}

export function defaultAiConfig(): AiConfig {
  return { lastProvider: DEFAULT_PROVIDER_ID, providers: {} }
}

/**
 * Read the saved config, migrating a legacy single-provider settings object:
 * its base URL is matched to a preset (or kept as the custom endpoint), and its
 * key + model are preserved.
 */
export function loadAiConfig(storage: StorageLike): AiConfig {
  const rawV2 = storage.getItem(AI_CONFIG_KEY)
  if (rawV2) {
    try {
      const parsed: unknown = JSON.parse(rawV2)
      if (isRecord(parsed) && typeof parsed['lastProvider'] === 'string' && isRecord(parsed['providers'])) {
        const providers: Record<string, ProviderSettings> = {}
        for (const [id, value] of Object.entries(parsed['providers'] as Record<string, unknown>)) {
          if (!isRecord(value)) continue
          providers[id] = {
            apiKey: typeof value['apiKey'] === 'string' ? value['apiKey'] : '',
            model: typeof value['model'] === 'string' ? value['model'] : '',
            ...(typeof value['baseUrl'] === 'string' ? { baseUrl: value['baseUrl'] } : {}),
          }
        }
        upgradeProviderModels(providers)
        const style = normalizeStyle(parsed['style'])
        return { lastProvider: presetFor(parsed['lastProvider']).id, providers, ...(style ? { style } : {}) }
      }
    } catch {
      /* fall through to legacy */
    }
  }

  const legacy = storage.getItem(LEGACY_AI_KEY)
  if (legacy) {
    try {
      const parsed: unknown = JSON.parse(legacy)
      if (isRecord(parsed)) {
        const baseUrl = typeof parsed['baseUrl'] === 'string' ? parsed['baseUrl'] : ''
        const id = providerIdForBaseUrl(baseUrl)
        const preset = presetFor(id)
        const entry: ProviderSettings = {
          apiKey: typeof parsed['apiKey'] === 'string' ? parsed['apiKey'] : '',
          model: (typeof parsed['model'] === 'string' && parsed['model']) || preset.defaultModel,
        }
        if (id === 'custom' && baseUrl) entry.baseUrl = baseUrl
        const providers = { [id]: entry }
        upgradeProviderModels(providers)
        return { lastProvider: id, providers }
      }
    } catch {
      /* fall through */
    }
  }

  return defaultAiConfig()
}

export function saveAiConfig(config: AiConfig, storage: StorageLike): void {
  storage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
}

/** The effective key/model/base URL for a provider, with preset defaults. */
export function settingsFor(config: AiConfig, presetId: string): ProviderSettings {
  const preset = presetFor(presetId)
  const saved = config.providers[preset.id]
  return {
    apiKey: saved?.apiKey ?? '',
    model: saved?.model || preset.defaultModel,
    baseUrl: saved?.baseUrl || preset.baseUrl,
  }
}

/** Immutably write one provider's settings and mark it as last used. */
export function withProvider(
  config: AiConfig,
  presetId: string,
  patch: Partial<ProviderSettings>,
): AiConfig {
  const preset = presetFor(presetId)
  const current = config.providers[preset.id] ?? { apiKey: '', model: '' }
  return {
    lastProvider: preset.id,
    providers: { ...config.providers, [preset.id]: { ...current, ...patch } },
  }
}

export function clearAllKeys(config: AiConfig): AiConfig {
  const providers: Record<string, ProviderSettings> = {}
  for (const [id, settings] of Object.entries(config.providers)) {
    providers[id] = { ...settings, apiKey: '' }
  }
  return { ...config, providers }
}

export function withStyle(config: AiConfig, style: StyleTokens): AiConfig {
  return { ...config, style }
}
