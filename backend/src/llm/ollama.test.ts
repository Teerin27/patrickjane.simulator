import { describe, expect, it } from 'vitest'
import { OllamaProvider } from './ollama.js'
import { LlmError } from './provider.js'

type Captured = { url: string; body: any; signal?: AbortSignal | null }

/** A fake fetch that records the request and answers with whatever the test hands it. */
function fakeFetch(answer: Response | (() => Response | Promise<Response>)) {
  const calls: Captured[] = []
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)), signal: init?.signal })
    return typeof answer === 'function' ? answer() : answer.clone()
  }) as unknown as typeof fetch
  return { calls, impl }
}

/** A streamed reply the way Ollama sends it: one JSON object per line. `cut` splits the bytes into pieces of that size. */
function stream(lines: object[], cut?: number, init?: ResponseInit) {
  const bytes = new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
  const pieces = cut ? Array.from({ length: Math.ceil(bytes.length / cut) }, (_, i) => bytes.slice(i * cut, (i + 1) * cut)) : [bytes]
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of pieces) controller.enqueue(p)
      controller.close()
    },
  })
  return new Response(body, init)
}

/** The whole answer in a few chunks, then the closing line. */
const reply = (content: string) => stream([{ message: { content }, done: false }, { message: { content: '' }, done: true }])

const provider = (impl: typeof fetch, think?: ConstructorParameters<typeof OllamaProvider>[0]['think']) =>
  new OllamaProvider({
    url: 'http://ollama.test',
    models: { chat: 'small-model', casegen: 'big-model' },
    timeoutMs: { chat: 1000, casegen: 5000 },
    think,
    fetch: impl,
  })

describe('OllamaProvider', () => {
  it('sends the system prompt first, then the conversation, to the chat model', async () => {
    const { calls, impl } = fakeFetch(() => reply('  Nothing to say.  '))
    const out = await provider(impl).generate({ system: 'You are a barman.', messages: [{ role: 'user', content: 'Where were you?' }] })

    expect(out).toBe('Nothing to say.')
    expect(calls[0]?.url).toBe('http://ollama.test/api/chat')
    expect(calls[0]?.body.model).toBe('small-model')
    expect(calls[0]?.body.messages).toEqual([
      { role: 'system', content: 'You are a barman.' },
      { role: 'user', content: 'Where were you?' },
    ])
  })

  it('uses the big model for case generation', async () => {
    const { calls, impl } = fakeFetch(() => reply('{}'))
    await provider(impl).generate({ system: '', messages: [{ role: 'user', content: 'x' }], task: 'casegen' })
    expect(calls[0]?.body.model).toBe('big-model')
  })

  it('leaves out an empty system prompt', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    await provider(impl).generate({ system: '', messages: [{ role: 'user', content: 'hi' }] })
    expect(calls[0]?.body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('caps the reply length', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    await provider(impl).generate({ system: 's', messages: [], maxTokens: 50 })
    expect(calls[0]?.body).toMatchObject({ options: { num_predict: 50 } })
  })

  it('asks for a streamed reply, so a slow model does not trip the 5-minute silent-response timeout', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    await provider(impl).generate({ system: 's', messages: [] })
    expect(calls[0]?.body.stream).toBe(true)
  })

  it('leaves the thinking switch to the model unless configured', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    await provider(impl).generate({ system: 's', messages: [] })
    expect(calls[0]?.body).not.toHaveProperty('think')
  })

  it('sends the configured thinking switch for that task only', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    const p = provider(impl, { casegen: false })
    await p.generate({ system: 's', messages: [], task: 'casegen' })
    await p.generate({ system: 's', messages: [], task: 'chat' })
    expect(calls[0]?.body.think).toBe(false)
    expect(calls[1]?.body).not.toHaveProperty('think')
  })

  it('passes a JSON Schema through as `format`, and `true` as "json"', async () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } }
    const withSchema = fakeFetch(() => reply('{}'))
    await provider(withSchema.impl).generate({ system: 's', messages: [], json: schema })
    expect(withSchema.calls[0]?.body.format).toEqual(schema)

    const plain = fakeFetch(() => reply('{}'))
    await provider(plain.impl).generate({ system: 's', messages: [], json: true })
    expect(plain.calls[0]?.body.format).toBe('json')

    const none = fakeFetch(() => reply('x'))
    await provider(none.impl).generate({ system: 's', messages: [] })
    expect(none.calls[0]?.body).not.toHaveProperty('format')
  })

  it('applies the per-task timeout', async () => {
    const { calls, impl } = fakeFetch(() => reply('ok'))
    await provider(impl).generate({ system: 's', messages: [] })
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('OllamaProvider: reading the stream', () => {
  const chunk = (content: string, extra: object = {}) => ({ message: { content }, done: false, ...extra })
  const done = { message: { content: '' }, done: true }

  it('joins the pieces of the answer', async () => {
    const { impl } = fakeFetch(() => stream([chunk('I was '), chunk('behind '), chunk('the bar.'), done]))
    expect(await provider(impl).generate({ system: 's', messages: [] })).toBe('I was behind the bar.')
  })

  it('copes with lines split across network packets, even in the middle of a multi-byte character', async () => {
    const text = 'Café — “quoted” 日本'
    const { impl } = fakeFetch(() => stream([chunk(text), done], 7))
    expect(await provider(impl).generate({ system: 's', messages: [] })).toBe(text)
  })

  it('drops a thinking model’s reasoning and keeps only the answer', async () => {
    const lines = [{ message: { thinking: 'Let me think about this...', content: '' }, done: false }, chunk('Not once.'), done]
    const { impl } = fakeFetch(() => stream(lines))
    expect(await provider(impl).generate({ system: 's', messages: [] })).toBe('Not once.')
  })

  it('throws LlmError when Ollama reports an error in the stream', async () => {
    const { impl } = fakeFetch(() => stream([{ error: 'model requires more system memory' }]))
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('model requires more system memory')
  })

  it('throws LlmError when the stream just stops: what was said so far is not an answer', async () => {
    const { impl } = fakeFetch(() => stream([chunk('I was behi')]))
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('stopped mid-reply')
  })

  it('throws LlmError when the connection breaks while reading', async () => {
    const broken = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk('I was')) + '\n'))
        controller.error(new TypeError('terminated'))
      },
    })
    const { impl } = fakeFetch(() => new Response(broken))
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('broke mid-reply')
  })

  it('says so when the timeout hits while the answer is still coming in', async () => {
    const slow = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
      },
    })
    const { impl } = fakeFetch(() => new Response(slow))
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('did not finish within 1000 ms')
  })

  it.each([
    ['an empty answer', () => reply('')],
    ['an all-whitespace answer', () => reply('   ')],
    ['text that is not JSON', () => new Response('not json\n')],
  ])('throws LlmError for %s', async (_name, make) => {
    const { impl } = fakeFetch(make)
    await expect(provider(impl).generate({ system: 's', messages: [] })).rejects.toBeInstanceOf(LlmError)
  })
})

describe('OllamaProvider: failures before the reply starts', () => {
  it('throws LlmError when the server answers with an error status', async () => {
    const { impl } = fakeFetch(() => new Response('model not found', { status: 404 }))
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('404')
    expect(err.message).toContain('model not found')
  })

  it('throws LlmError when Ollama cannot be reached', async () => {
    const impl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('Cannot reach Ollama')
  })

  it('says so when the call timed out before any reply', async () => {
    const impl = (async () => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    }) as unknown as typeof fetch
    const err = await provider(impl).generate({ system: 's', messages: [] }).catch((e) => e)
    expect(err).toBeInstanceOf(LlmError)
    expect(err.message).toContain('did not answer within 1000 ms')
  })
})
