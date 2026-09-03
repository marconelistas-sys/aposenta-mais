import test from 'node:test'
import assert from 'node:assert/strict'

import { securityHeaders } from '../scripts/security-headers.mjs'

test('define políticas mínimas de segurança para o servidor local', () => {
  assert.match(securityHeaders['Content-Security-Policy'], /default-src 'self'/)
  assert.match(securityHeaders['Content-Security-Policy'], /object-src 'none'/)
  assert.match(securityHeaders['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.equal(securityHeaders['X-Content-Type-Options'], 'nosniff')
  assert.equal(securityHeaders['Referrer-Policy'], 'no-referrer')
  assert.equal(securityHeaders['X-Frame-Options'], 'DENY')
})
