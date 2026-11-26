import { scryptSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { totpCounter, verifyOwnerPassword } from './owner-credentials'

describe('owner credentials', () => {
  it('validates a salted password hash and rejects wrong or malformed credentials', () => {
    const salt = 'ab'.repeat(16)
    const hash = `${salt}:${scryptSync('fixture-password', Buffer.from(salt, 'hex'), 64).toString('hex')}`
    expect(verifyOwnerPassword('fixture-password', hash)).toBe(true)
    expect(verifyOwnerPassword('wrong', hash)).toBe(false)
    expect(verifyOwnerPassword('wrong', 'malformed')).toBe(false)
  })
  it('matches the RFC 6238 SHA1 test vector reduced to six digits', () => {
    expect(
      totpCounter('287082', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)
    ).toBe(1)
    expect(
      totpCounter('000000', 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000)
    ).toBeNull()
    expect(totpCounter('287082', 'invalid', 59000)).toBeNull()
  })
})
