'use client'
import { useState } from 'react'
export default function OwnerLogin() {
  const [method, setMethod] = useState('totp'),
    [email, setEmail] = useState(''),
    [credential, setCredential] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  return (
    <main className="mx-auto w-full max-w-sm p-6 pt-24">
      <h1 className="text-3xl font-semibold">Hermes</h1>
      <p className="mb-6 text-muted-foreground">Private owner access</p>
      <div className="flex gap-3 mb-4">
        <button
          className="border rounded p-2"
          onClick={() => {
            setMethod('totp')
            setCredential('')
          }}
        >
          Authenticator code
        </button>
        <button
          className="border rounded p-2"
          onClick={() => {
            setMethod('password')
            setCredential('')
          }}
        >
          Email and password
        </button>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={async e => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            const r = await fetch('/api/hermes/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ method, email, credential })
            })
            if (!r.ok) {
              const result = await r.json()
              throw new Error(result.error || 'Sign in failed')
            }
            window.location.replace('/hermes')
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Sign in failed')
          } finally {
            setBusy(false)
          }
        }}
      >
        {method === 'password' && (
          <input
            className="border rounded p-3"
            aria-label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        )}
        <input
          className="border rounded p-3"
          aria-label={method === 'totp' ? 'Authenticator code' : 'Password'}
          type={method === 'totp' ? 'text' : 'password'}
          inputMode={method === 'totp' ? 'numeric' : undefined}
          autoComplete={
            method === 'totp' ? 'one-time-code' : 'current-password'
          }
          placeholder={method === 'totp' ? '6-digit code' : 'Password'}
          value={credential}
          onChange={e => setCredential(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-red-500">
            {error}
          </p>
        )}
        <button
          className="bg-primary text-primary-foreground rounded p-3"
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
