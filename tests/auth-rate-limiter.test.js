import test from 'node:test'
import assert from 'node:assert/strict'

import { createRateLimiter } from '../src/server/auth/rate-limiter.mjs'

test('limita tentativas dentro da janela e libera após o prazo', () => {
  let timestamp = 1000
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => timestamp })

  assert.equal(limiter.consume('ip:login').allowed, true)
  assert.equal(limiter.consume('ip:login').allowed, true)
  assert.equal(limiter.consume('ip:login').allowed, false)

  timestamp = 2000
  assert.equal(limiter.consume('ip:login').allowed, true)
})
