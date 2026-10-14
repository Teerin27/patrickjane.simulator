import { env } from '../config/env.js'
import { OllamaProvider } from './ollama.js'
import { DummyProvider, type LlmProvider } from './provider.js'

const think = (v: string) => (v === 'default' ? undefined : v === 'true' ? true : v === 'false' ? false : (v as 'low' | 'medium' | 'high'))

/** The one provider the app uses, chosen by LLM_PROVIDER. Swap models here, nowhere else. */
export const llm: LlmProvider =
  env.LLM_PROVIDER === 'ollama'
    ? new OllamaProvider({
        url: env.OLLAMA_URL,
        models: { chat: env.OLLAMA_CHAT_MODEL, casegen: env.OLLAMA_CASEGEN_MODEL },
        timeoutMs: { chat: env.LLM_CHAT_TIMEOUT_MS, casegen: env.LLM_CASEGEN_TIMEOUT_MS },
        think: { chat: think(env.OLLAMA_CHAT_THINK), casegen: think(env.OLLAMA_CASEGEN_THINK) },
      })
    : new DummyProvider()
