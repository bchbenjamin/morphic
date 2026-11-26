// Never relay upstream error bodies or exception strings to the browser.
export function hermesUpstreamFailure(status: number) {
  if (status === 401 || status === 403)
    return { status: 502, error: 'Hermes rejected the server credential or permission. Check the backend configuration.' }
  if (status === 503)
    return { status: 503, error: 'Hermes is offline, starting, or its relay is busy.' }
  if (status === 504 || status === 408)
    return { status: 504, error: 'Hermes timed out before returning a response.' }
  if (status === 429)
    return { status: 429, error: 'Hermes or its inference provider is rate limited.' }
  return { status: 502, error: 'Hermes returned an unsuccessful or non-streaming response.' }
}
