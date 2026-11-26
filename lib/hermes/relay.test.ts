import { describe, expect, it } from 'vitest'

import { buildHermesRequest, hermesUpstreamUrl, isHermesOwner } from './relay'
import { readHermesStream } from './sse'

const env = {
  HERMES_CHAT_ENABLED: 'true',
  HERMES_OWNER_USER_ID: 'owner',
  HERMES_API_BASE_URL: 'http://127.0.0.1:8642/v1',
  HERMES_API_KEY: 'fixture'
}
const input = {
  conversationId: '01234567-0123-4567-89ab-0123456789ab',
  message: 'hello'
}

describe('private Hermes relay', () => {
  it('only authorizes the explicit owner in authenticated mode', () => {
    expect(isHermesOwner('owner', false, env)).toBe(true)
    expect(isHermesOwner('owner', true, env)).toBe(false)
    expect(isHermesOwner('other', false, env)).toBe(false)
    expect(isHermesOwner(undefined, false, env)).toBe(false)
    expect(isHermesOwner('owner', false, {})).toBe(false)
  })
  it('sends only a user message and isolates conversation identity', () => {
    const request = buildHermesRequest(
      {
        ...input,
        tools: ['untrusted'],
        model: 'fake',
        url: 'https://wrong.invalid'
      },
      'owner',
      env
    )
    expect(request.url).toBe('http://127.0.0.1:8642/v1/chat/completions')
    expect(JSON.parse(request.body)).toEqual({
      model: 'hermes',
      stream: true,
      messages: [{ role: 'user', content: 'hello' }]
    })
    expect(request.headers['X-Hermes-Session-Id']).toBe(
      buildHermesRequest(input, 'owner', env).headers['X-Hermes-Session-Id']
    )
    expect(request.headers['X-Hermes-Session-Id']).not.toBe(
      buildHermesRequest(input, 'other', env).headers['X-Hermes-Session-Id']
    )
  })
  it('preserves the single-service gateway prefix for both chat and history', () => {
    const gateway = {
      ...env,
      HERMES_API_BASE_URL: 'https://ai.bchbenjamin.in/_ingress/http/api/v1'
    }
    expect(buildHermesRequest(input, 'owner', gateway).url).toBe(
      'https://ai.bchbenjamin.in/_ingress/http/api/v1/chat/completions'
    )
    expect(hermesUpstreamUrl('/api/sessions?limit=50&offset=0', gateway).href).toBe(
      'https://ai.bchbenjamin.in/_ingress/http/api/api/sessions?limit=50&offset=0'
    )
    expect(hermesUpstreamUrl('/api/sessions', env).href).toBe(
      'http://127.0.0.1:8642/api/sessions'
    )
  })
  it('rejects unencrypted remote transport, malformed input and missing credentials', () => {
    expect(() =>
      buildHermesRequest(input, 'owner', {
        ...env,
        HERMES_API_BASE_URL: 'http://remote.example/v1'
      })
    ).toThrow()
    expect(() =>
      buildHermesRequest(
        { ...input, conversationId: '../unsafe' },
        'owner',
        env
      )
    ).toThrow()
    expect(() =>
      buildHermesRequest(input, 'owner', { ...env, HERMES_API_KEY: '' })
    ).toThrow()
  })
  it('parses fragmented SSE and rejects incomplete streams', async () => {
    const stream = (chunks: string[]) =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(new TextEncoder().encode(chunk))
          controller.close()
        }
      })
    const texts: string[] = []
    await readHermesStream(
      stream([
        'data: {"choices":[{"delta":{"content":"he',
        'llo"}}]}\r\n\r\ndata: [DONE]\n\n'
      ]),
      text => texts.push(text)
    )
    expect(texts).toEqual(['hello'])
    await expect(
      readHermesStream(stream(['data: {"choices":[]}\n\n']), () => {})
    ).rejects.toThrow('before completion')
  })
})
