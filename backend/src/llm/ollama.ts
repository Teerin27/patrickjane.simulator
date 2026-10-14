import { LlmError, type LlmProvider, type LlmRequest, type LlmTask } from './provider.js'

export type OllamaConfig = {
  /** Base URL of the Ollama server, e.g. http://localhost:11434 */
  url: string
  models: Record<LlmTask, string>
  /** Give up on a single call after this long. Chat must answer a player; generation may take many minutes. */
  timeoutMs: Record<LlmTask, number>
  /**
   * Per-task thinking switch, passed to Ollama as `think`. Leave a task out to use the model's own default.
   * This matters: a model that thinks by default (Qwen3 Thinking) IGNORES `false` and leaks its reasoning into
   * the reply, while with the default Ollama splits the reasoning off into a separate field we discard.
   * A model that never thinks must not be sent `true` (Ollama rejects it).
   */
  think?: Partial<Record<LlmTask, boolean | 'low' | 'medium' | 'high'>>
  /** Injected in tests. */
  fetch?: typeof fetch
}

// Context window (prompt + reply, in tokens). Ollama allocates memory for all of it up front, so keep
// chat small: the prompt builder only sends what the suspect may say, which fits easily.
const CONTEXT: Record<LlmTask, number> = { chat: 4096, casegen: 8192 }
// num_predict counts hidden reasoning tokens too, so a thinking model needs room for both
const MAX_TOKENS: Record<LlmTask, number> = { chat: 3000, casegen: 8000 }
const TEMPERATURE: Record<LlmTask, number> = { chat: 0.8, casegen: 0.6 }

/** Talks to a local Ollama server (https://ollama.com) over its /api/chat endpoint. */
export class OllamaProvider implements LlmProvider {
  constructor(private cfg: OllamaConfig) {}

  async generate(req: LlmRequest): Promise<string> {
    const task = req.task ?? 'chat'
    const model = this.cfg.models[task]
    const messages = [...(req.system ? [{ role: 'system', content: req.system }] : []), ...req.messages]

    const body = {
      model,
      messages,
      // Streamed, although the caller gets the whole text at once. A non-streamed reply sends no headers until the
      // model has finished, and Node's fetch gives up on a response that stays silent for 5 minutes, which a
      // big model on a laptop can easily exceed. A stream sends headers at once and keeps the connection busy.
      stream: true,
      ...(this.cfg.think?.[task] !== undefined ? { think: this.cfg.think[task] } : {}),
      // Keep the model in memory between turns; loading a model is the slowest part of a cold call.
      keep_alive: '10m',
      ...(req.json ? { format: req.json === true ? 'json' : req.json } : {}),
      options: {
        temperature: req.temperature ?? TEMPERATURE[task],
        num_predict: req.maxTokens ?? MAX_TOKENS[task],
        num_ctx: CONTEXT[task],
      },
    }

    let res: Response
    try {
      res = await (this.cfg.fetch ?? fetch)(`${this.cfg.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.cfg.timeoutMs[task]),
      })
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'TimeoutError'
      throw new LlmError(
        timedOut ? `Ollama did not answer within ${this.cfg.timeoutMs[task]} ms (model ${model})` : `Cannot reach Ollama at ${this.cfg.url}`,
        err,
      )
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300)
      throw new LlmError(`Ollama answered ${res.status} for model ${model}: ${detail}`)
    }

    let content: string
    try {
      content = await readStream(res, model)
    } catch (err) {
      if (err instanceof LlmError) throw err
      const timedOut = err instanceof Error && err.name === 'TimeoutError'
      throw new LlmError(
        timedOut ? `Ollama did not finish within ${this.cfg.timeoutMs[task]} ms (model ${model})` : `The connection to Ollama broke mid-reply (model ${model})`,
        err,
      )
    }
    if (!content.trim()) throw new LlmError(`Ollama returned an empty reply (model ${model})`)
    return content.trim()
  }
}

/**
 * Ollama streams one JSON object per line: `{"message":{"content":"par"},"done":false}` ... `{"done":true}`.
 * Collect the answer text. `message.thinking` (a thinking model's reasoning) is deliberately dropped.
 */
async function readStream(res: Response, model: string): Promise<string> {
  if (!res.body) throw new LlmError(`Ollama sent no body (model ${model})`)
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let done = false

  const take = (line: string) => {
    if (!line.trim()) return
    let chunk: { message?: { content?: unknown }; error?: unknown; done?: boolean }
    try {
      chunk = JSON.parse(line)
    } catch {
      throw new LlmError(`Ollama sent something that is not JSON (model ${model})`)
    }
    if (typeof chunk.error === 'string') throw new LlmError(`Ollama reported an error for model ${model}: ${chunk.error}`)
    if (typeof chunk.message?.content === 'string') content += chunk.message.content
    if (chunk.done) done = true
  }

  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    lines.forEach(take)
  }
  take(buffer + decoder.decode())
  // A stream that just stops is a crashed or killed model, and what it said so far is not an answer
  if (!done) throw new LlmError(`Ollama stopped mid-reply (model ${model})`)
  return content
}
