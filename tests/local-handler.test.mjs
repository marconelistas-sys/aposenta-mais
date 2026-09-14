import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createAuthHandler } from '../src/server/auth/auth-handler.mjs'
import { createLocalStore } from '../src/server/data/local-store.mjs'
import { syncConsentVersion } from '../src/shared/sync-contract.js'

test('local HTTP contract supports registration, cookies, consented save, restore and recovery without network', async () => {
  const store = createLocalStore({ path: ':memory:' })
  const origin = 'http://127.0.0.1:4173'
  const handler = createAuthHandler({ services: { ...store, config: { configured: true, provider: 'local', appOrigin: origin, secureCookies: false } }, fetchImpl: () => { throw Error('No network permitted') } })
  let cookie = '', owner = ''
  const call = async (path, body, method = body ? 'POST' : 'GET', requestOrigin = origin) => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : [])
    Object.assign(req, { method, headers: { origin: requestOrigin, cookie, 'x-plan-owner': owner }, socket: { remoteAddress: '127.0.0.1' } })
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers) }, end(body) { this.body = JSON.parse(body) } }
    await handler(req, res, new URL(path, origin))
    if (res.headers['Set-Cookie']) cookie = res.headers['Set-Cookie'].map(c => c.split(';')[0]).join('; ')
    return res
  }
  try {
    assert.equal((await call('/api/auth/status')).body.provider, 'local')
    assert.equal((await call('/api/auth/status')).body.registrationRequired, true)
    const firstLogin = await call('/api/auth/login', { email: 'local@example.com', password: 'test-password-123' })
    assert.match(firstLogin.body.error, /Nenhuma conta foi criada/)
    const registration = await call('/api/auth/register', { email: 'local@example.com', password: 'test-password-123', acceptedTerms: true })
    assert.equal(registration.status, 202)
    assert.equal((await call('/api/auth/status')).body.registrationRequired, false)
    const code = registration.body.message.match(/seguro: ([\w-]+)/)[1]
    const login = await call('/api/auth/login', { email: 'local@example.com', password: 'test-password-123' })
    assert.equal(login.status, 200)
    assert.equal(login.body.access_token, undefined)
    owner = login.body.user.id
    assert.equal((await call('/api/auth/status')).body.user.id, owner)
    const payload = { state: { plan: { currentAge: 40 } }, acceptedSyncConsent: true, consentVersion: syncConsentVersion, expectedUpdatedAt: null }
    assert.equal((await call('/api/sync/data', payload, 'POST', 'https://other.example')).status, 403)
    assert.equal((await call('/api/sync/data', payload)).status, 200)
    assert.equal((await call('/api/sync/data')).body.state.plan.currentAge, 40)
    assert.equal((await call('/api/sync/data', payload)).status, 409)
    assert.equal((await call('/api/auth/recover', { email: 'local@example.com', recoveryCode: code, password: 'replacement-password' })).status, 200)
    assert.equal((await call('/api/auth/status')).body.authenticated, false)
    assert.equal((await call('/api/auth/login', { email: 'local@example.com', password: 'replacement-password' })).status, 200)
  } finally { store.close() }
})
