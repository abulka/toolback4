import guide from '../../../docs/llm-authoring.md?raw'
import { manifestText } from './ai'

export const SYSTEM_PROMPT = guide.replace('<!-- CAPABILITY_MANIFEST -->', manifestText())
