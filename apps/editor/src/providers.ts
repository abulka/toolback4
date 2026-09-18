export type ApiShape = 'openai' | 'anthropic'

export interface ProviderPreset {
  id: string
  label: string
  /** request/response shape, not the vendor */
  api: ApiShape
  baseUrl: string
  /** no API key needed (local servers) */
  keyless?: boolean
  /** Anthropic blocks browser calls unless this opt-in header is sent */
  browserAccessHeader?: boolean
  headers?: Record<string, string>
  defaultModel: string
  /** curated suggestions; the live "Fetch models" result is authoritative */
  models: string[]
  supportsModelList?: boolean
  /** user can edit the base URL (proxies, local servers) */
  editableBase?: boolean
  hint?: string
}

export const DEFAULT_PROVIDER_ID = 'deepseek'

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    supportsModelList: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'gpt-5', 'gpt-5-mini'],
    supportsModelList: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    browserAccessHeader: true,
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-7-sonnet-latest',
      'claude-3-5-haiku-latest',
    ],
    supportsModelList: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-20b',
    models: [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'groq/compound',
      'groq/compound-mini',
      'qwen/qwen3.8-27b',
      'qwen/qwen3.6-27b',
    ],
    supportsModelList: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    headers: { 'HTTP-Referer': 'https://toolback.netlify.app', 'X-Title': 'toolback' },
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.0-flash-001',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
      'qwen/qwen-2.5-72b-instruct',
    ],
    supportsModelList: true,
  },
  {
    id: 'xai',
    label: 'Grok (xAI)',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
    models: ['grok-4', 'grok-3', 'grok-3-mini', 'grok-2-1212'],
    supportsModelList: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    api: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-medium-latest',
    models: [
      'mistral-medium-latest',
      'mistral-small-latest',
      'mistral-large-latest',
      'codestral-latest',
      'open-mistral-nemo',
      'magistral-medium-latest',
    ],
    supportsModelList: true,
  },
  {
    id: 'together',
    label: 'Together.ai',
    api: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'openai/gpt-oss-20b',
    models: [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'moonshotai/Kimi-K2-Instruct',
    ],
    supportsModelList: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    api: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    models: [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ],
  },
  {
    id: 'opencode',
    label: 'OpenCode (Zen / Go)',
    api: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'glm-5.3', 'kimi-k2.5', 'minimax-m3'],
    supportsModelList: true,
    hint: 'Only Zen models served over /chat/completions are listed. Others use different APIs not yet supported.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    api: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    keyless: true,
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'llama3.1', 'qwen2.5', 'qwen2.5-coder', 'mistral', 'deepseek-r1', 'gemma3', 'phi4'],
    supportsModelList: true,
    hint: 'Ollama must allow this page’s origin (set OLLAMA_ORIGINS) if the browser blocks it.',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    api: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    keyless: true,
    defaultModel: '',
    models: [],
    supportsModelList: true,
    hint: 'Start the local server in LM Studio, then use Fetch models.',
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    api: 'openai',
    baseUrl: '',
    defaultModel: '',
    models: [],
    supportsModelList: true,
    editableBase: true,
    hint: 'Any OpenAI-compatible endpoint. Set the base URL (e.g. a proxy).',
  },
]

const BY_ID = new Map(PROVIDER_PRESETS.map((p) => [p.id, p]))

export function presetFor(id: string | undefined): ProviderPreset {
  return BY_ID.get(id ?? '') ?? BY_ID.get(DEFAULT_PROVIDER_ID)!
}
