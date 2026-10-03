// All LLM access goes through this interface. Never call an LLM SDK directly elsewhere.

export type LlmRequest = {
  /** Built by promptBuilder; contains only what this suspect may reveal right now. */
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

export interface LlmProvider {
  generate(req: LlmRequest): Promise<string>
}

/** (DUMMY) Placeholder until a hosted model is wired up. */
class DummyProvider implements LlmProvider {
  async generate(): Promise<string> {
    return 'I have said my piece. Ask something with a little more teeth.'
  }
}

export const llm: LlmProvider = new DummyProvider()
