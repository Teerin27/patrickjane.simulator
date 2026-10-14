// All LLM access goes through this interface. Never call an LLM SDK or an LLM HTTP API directly elsewhere.

/**
 * Which job the call is for. Each task can use a different model: chat needs to be fast,
 * case generation runs rarely and offline, so it can use a bigger, slower model.
 */
export type LlmTask = 'chat' | 'casegen'

export type LlmRequest = {
  /** Built by promptBuilder; contains only what this suspect may reveal right now. */
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  task?: LlmTask
  /**
   * Ask for JSON. A JSON Schema object forces the exact shape (the model cannot emit anything else);
   * `true` only forces syntactically valid JSON.
   */
  json?: object | true
  /** Higher = more varied. Chat wants some variety, generation wants steadier output. */
  temperature?: number
  /** Cap on generated tokens, so a rambling model cannot run forever. */
  maxTokens?: number
}

export interface LlmProvider {
  generate(req: LlmRequest): Promise<string>
}

/** The model could not be reached, answered with an error, or returned nothing usable. */
export class LlmError extends Error {
  constructor(
    message: string,
    public override cause?: unknown,
  ) {
    super(message)
  }
}

/** Placeholder for tests and for running the server without a model (LLM_PROVIDER=dummy). */
export class DummyProvider implements LlmProvider {
  async generate(): Promise<string> {
    return 'I have said my piece. Ask something with a little more teeth.'
  }
}
