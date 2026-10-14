import { z } from 'zod'

// Fail fast on startup if .env is missing or malformed
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see .env.example)'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // LLM. `dummy` answers every message with one canned line and needs no model.
  LLM_PROVIDER: z.enum(['ollama', 'dummy']).default('ollama'),
  OLLAMA_URL: z.string().default('http://localhost:11434'),
  // Fast model for suspect chat, bigger and slower one for generating whole cases
  OLLAMA_CHAT_MODEL: z.string().default('qwen3:4b-instruct-2507-q4_K_M'),
  OLLAMA_CASEGEN_MODEL: z.string().default('qwen3.6:latest'),
  // Thinking switch per task: `default` leaves it to the model. Qwen3 Thinking ignores `false`, so chat keeps the default.
  OLLAMA_CHAT_THINK: z.enum(['default', 'true', 'false', 'low', 'medium', 'high']).default('default'),
  OLLAMA_CASEGEN_THINK: z.enum(['default', 'true', 'false', 'low', 'medium', 'high']).default('false'),
  LLM_CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  LLM_CASEGEN_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
})

export const env = schema.parse(process.env)
