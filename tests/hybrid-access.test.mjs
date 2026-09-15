import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createAuthHandler } from '../src/server/auth/auth-handler.mjs'
import { createLocalStore } from '../src/server/data/local-store.mjs'
import { syncConsentVersion } from '../src/shared/sync-contract.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { paymentCalendarEvents, paymentEventKey, linkCalendarPayment, paymentMatchStatus } from '../src/domain/calendar-payments.js'

function fixture() {
  const localStore = createLocalStore({ path: ':memory:' })
  const user = { id: 'supabase-user', email: 'person@example.com' }
  const remote = { payload: { version: 10, plan: { currentAssets: 75000 }, cashFlow: { items: [] } }, updated_at: '2026-09-01T00:00:00Z', consent_version: 'original' }
  let offline = false, reads = 0
  const auth = {
    async getUser(token) { if (offline || token !== 'remote-access') throw Error('offline'); return user },
    async refresh() { throw Error('no refresh') },
    async signIn() { if (offline) throw Error('offline'); return { user, access_token: 'remote-access', refresh_token: 'remote-refresh', expires_in: 3600 } },
    async signOut() {}
  }
  const data = { async getPlan() { if (offline) throw Error('offline'); reads++; return structuredClone(remote) } }
  const handler = createAuthHandler({ localStore, services: { auth, data, config: { configured: true, appOrigin: 'http://127.0.0.1:4173', secureCookies: false } } })
  let cookie = ''
  const call = async (path, body, headers = {}, method = body ? 'POST' : 'GET') => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : [])
    Object.assign(req, { method, headers: { cookie, origin: 'http://127.0.0.1:4173', 'x-plan-owner': user.id, ...headers }, socket: { remoteAddress: '127.0.0.1' } })
    const response = { headers: {}, setHeader(k, v) { this.headers[k] = v }, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers) }, end(body) { this.body = JSON.parse(body) } }
    await handler(req, response, new URL(path, 'http://127.0.0.1:4173'))
    if (response.headers['Set-Cookie']) cookie = response.headers['Set-Cookie'].map(c => c.split(';')[0]).join('; ')
    return response
  }
  return { localStore, call, user, remote, offline: () => { offline = true }, reads: () => reads }
}
const credentials = { email: 'person@example.com', password: 'local-password-123' }
const activation = { password: credentials.password, acceptedSyncConsent: true, consentVersion: syncConsentVersion, state: { plan: { currentAssets: 1 } } }

test('SQLite API preserves split payment portions and rejects obsolete writers without changing the stored copy', async () => {
  const f = fixture()
  try {
    await f.call('/api/auth/login', credentials)
    assert.equal((await f.call('/api/auth/local-enable', activation)).status, 200)
    const current = await f.call('/api/sync/data')
    const value = sanitizeStoredState({ currency: 'BRL', cashFlow: {
      items: [600, 400].map((amount, index) => ({ id: `bill${index}`, description: `Conta ${index}`, categoryId: 'housing', type: 'expense', recordKind: 'planned', frequency: 'occasional', amount, currency: 'BRL', startDate: index ? '2026-10-05' : '2026-09-05' })),
      ledger: { accounts: [{ id: 'bank', name: 'Conta', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 2000 }], movements: [{ id: 'payment', accountId: 'bank', type: 'expense', date: '2026-09-10', amount: 1000 }] }
    } })
    for (const [month, amount] of [['2026-09', 600], ['2026-10', 400]]) {
      const event = paymentCalendarEvents(value.cashFlow, month).events[0]
      value.cashFlow.paymentMatches = linkCalendarPayment(value.cashFlow, { month, eventKey: paymentEventKey(event), movementId: 'payment', amount }, new Date('2026-09-14T12:00:00Z'))
    }
    const body = { state: value, acceptedSyncConsent: true, consentVersion: syncConsentVersion, expectedUpdatedAt: current.body.updatedAt }
    assert.equal((await f.call('/api/sync/data', body)).status, 200)
    const stored = await f.call('/api/sync/data')
    assert.deepEqual(stored.body.state.cashFlow.paymentMatches, value.cashFlow.paymentMatches)
    for (const month of ['2026-09', '2026-10']) {
      const flow = stored.body.state.cashFlow
      assert.equal(paymentMatchStatus(paymentCalendarEvents(flow, month).events[0], flow).status, 'linked')
    }
    assert.equal((await f.call('/api/sync/data', { ...body, consentVersion: '2026-09-14-v15', expectedUpdatedAt: stored.body.updatedAt })).status, 400)
    assert.deepEqual((await f.call('/api/sync/data')).body, stored.body)
  } finally { f.localStore.close() }
})

test('Supabase first, explicit profile activation copies cloud plan and offline local login works with same owner', async () => {
  const f = fixture()
  try {
    const initial = await f.call('/api/auth/status')
    assert.equal(initial.body.provider, 'supabase')
    assert.equal(initial.body.localAvailable, false)
    assert.equal((await f.call('/api/auth/register', credentials, { 'x-auth-provider': 'local' })).status, 403)
    assert.equal((await f.call('/api/auth/local-enable', activation)).status, 401)
    await f.call('/api/auth/login', credentials)
    const enabled = await f.call('/api/auth/local-enable', activation)
    assert.equal(enabled.status, 200)
    assert.equal(enabled.body.localEnabled, true)
    assert.match(enabled.body.message, /código de recuperação/)
    assert.equal((await f.call('/api/auth/status')).body.storageProvider, 'local')
    assert.equal((await f.call('/api/sync/data', undefined, { 'x-storage-provider': 'local' })).body.state.plan.currentAssets, 75000)
    const reads = f.reads()
    await f.call('/api/auth/logout', {})
    f.offline()
    const localLogin = await f.call('/api/auth/login', credentials, { 'x-auth-provider': 'local' })
    assert.equal(localLogin.status, 200)
    assert.equal(localLogin.body.provider, 'local')
    assert.equal(localLogin.body.user.id, f.user.id)
    assert.equal((await f.call('/api/auth/status')).body.authenticated, true)
    assert.equal((await f.call('/api/sync/data')).body.state.plan.currentAssets, 75000)
    assert.equal(f.reads(), reads)
    assert.equal((await f.call('/api/auth/storage', { provider: 'supabase' })).status, 403)
    assert.equal(f.remote.payload.plan.currentAssets, 75000)
  } finally { f.localStore.close() }
})

test('consent, owner, cloud failures and concurrent destination changes cannot silently switch or overwrite plans', async () => {
  const f = fixture()
  try {
    await f.call('/api/auth/login', credentials)
    assert.equal((await f.call('/api/auth/local-enable', activation, { 'x-plan-owner': 'another-user' })).status, 409)
    assert.equal((await f.call('/api/auth/local-enable', { ...activation, acceptedSyncConsent: false })).status, 400)
    assert.equal((await f.call('/api/auth/local-enable', activation)).status, 200)
    assert.equal((await f.call('/api/auth/storage', { provider: 'supabase' })).status, 200)
    assert.equal((await f.call('/api/sync/data', undefined, { 'x-storage-provider': 'local' })).status, 409)
    assert.equal((await f.call('/api/sync/data', undefined, { 'x-storage-provider': 'supabase' })).body.state.plan.currentAssets, 75000)
    assert.equal((await f.call('/api/auth/local-enable', activation)).status, 409)
  } finally { f.localStore.close() }
})

test('failed cloud reads never activate an empty local account', async () => {
  const f = fixture()
  try {
    await f.call('/api/auth/login', credentials)
    f.offline()
    assert.equal((await f.call('/api/auth/local-enable', activation)).status, 401)
    assert.equal(f.localStore.auth.needsRegistration(), true)
  } finally { f.localStore.close() }
})

test('local recovery resets local credentials and signs in without using Supabase recovery', async () => {
  const f = fixture()
  try {
    await f.call('/api/auth/login', credentials)
    const enabled = await f.call('/api/auth/local-enable', activation)
    const recoveryCode = enabled.body.message.match(/recuperação: ([\w-]+)/)[1]
    await f.call('/api/auth/logout', {})
    f.offline()
    assert.equal((await f.call('/api/auth/recover', { email: credentials.email, recoveryCode, password: 'changed-local-password' }, { 'x-auth-provider': 'local' })).status, 200)
    assert.equal((await f.call('/api/auth/login', { ...credentials, password: 'changed-local-password' }, { 'x-auth-provider': 'local' })).status, 200)
  } finally { f.localStore.close() }
})
