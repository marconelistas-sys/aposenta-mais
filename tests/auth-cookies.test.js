import test from 'node:test'
import assert from 'node:assert/strict'

import {
  authCookieNames,
  clearSessionCookies,
  parseCookies,
  sessionCookies
} from '../src/server/auth/cookies.mjs'

const session = {
  access_token: 'access-secret',
  refresh_token: 'refresh-secret',
  expires_in: 3600
}

test('cookies de produção usam prefixo seguro e não expõem tokens ao JavaScript', () => {
  const cookies = sessionCookies(session, true)

  assert.match(cookies[0], /^__Host-aposenta-access=/)
  assert.match(cookies[0], /HttpOnly/)
  assert.match(cookies[0], /SameSite=Lax/)
  assert.match(cookies[0], /Secure/)
  assert.match(cookies[0], /Path=\//)
})

test('cookies locais funcionam por HTTP sem usar prefixo reservado', () => {
  const names = authCookieNames(false)
  const cookies = sessionCookies(session, false)

  assert.equal(names.accessCookie, 'aposenta-access')
  assert.doesNotMatch(cookies[0], /Secure/)
  assert.equal(parseCookies('aposenta-access=abc; tema=claro')['aposenta-access'], 'abc')
})

test('logout expira os dois cookies', () => {
  const cookies = clearSessionCookies(true)

  assert.equal(cookies.length, 2)
  assert.ok(cookies.every((value) => value.includes('Max-Age=0')))
})
