import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'

export function equalSecret(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function verifyOwnerPassword(password: string, stored: string): boolean {
  const [salt, digest, extra] = stored.split(':')
  if (
    extra ||
    !/^[a-f0-9]{32}$/i.test(salt || '') ||
    !/^[a-f0-9]{128}$/i.test(digest || '') ||
    password.length > 1024
  )
    return false
  return equalSecret(
    scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex'),
    digest.toLowerCase()
  )
}

export function totpCounter(
  code: string,
  seed: string,
  now = Date.now()
): number | null {
  if (!/^\d{6}$/.test(code) || !/^[A-Z2-7]{16,128}$/.test(seed)) return null
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0,
    value = 0
  const bytes: number[] = []
  for (const char of seed) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 255)
    }
  }
  const counter = Math.floor(now / 30000)
  for (const candidate of [counter, counter - 1, counter + 1]) {
    if (candidate < 0) continue
    const buffer = Buffer.alloc(8)
    buffer.writeBigUInt64BE(BigInt(candidate))
    const hash = createHmac('sha1', Buffer.from(bytes)).update(buffer).digest()
    const offset = hash[hash.length - 1] & 15
    const expected = String(
      (hash.readUInt32BE(offset) & 0x7fffffff) % 1000000
    ).padStart(6, '0')
    if (equalSecret(code, expected)) return candidate
  }
  return null
}
