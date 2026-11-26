export async function readHermesStream(
  stream: ReadableStream<Uint8Array>,
  onText: (text: string) => void
) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let doneEvent = false
  try {
    while (!doneEvent) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        const data = event
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart())
          .join('\n')
        if (!data) continue
        if (data === '[DONE]') {
          doneEvent = true
          break
        }
        const chunk = JSON.parse(data)
        if (chunk.error) throw new Error('Hermes reported an error')
        const text = chunk.choices?.[0]?.delta?.content
        if (typeof text === 'string') onText(text)
      }
    }
    if (!doneEvent)
      throw new Error(
        'Hermes stream ended before completion; execution status is uncertain'
      )
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
