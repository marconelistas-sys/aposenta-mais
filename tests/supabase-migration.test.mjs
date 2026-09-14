import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalStore } from '../src/server/data/local-store.mjs'
const snapshot = () => ({ users: [{ id: 'source-user', email: 'person@example.com' }], financial_plans: [{ user_id: 'source-user', payload: { version: 10, plan: { currentAssets: 123456.78 }, cashFlow: { items: [{ id: 'salary', amount: 2500 }] } }, updated_at: '2026-09-01T00:00:00Z', consent_version: 'original' }] })

test('migration preserves identity, exact financial payload and source, then supports local recovery', async () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    const source = snapshot(), original = structuredClone(source)
    let recovery
    assert.deepEqual(store.importSnapshot(source, data => { recovery = data }), { accountsAdded: 1, plansAdded: 1, accountsTotal: 1, plansTotal: 1 })
    assert.deepEqual(source, original)
    await store.auth.resetPassword(recovery[0].email, recovery[0].recoveryCode, 'replacement-password')
    const login = await store.auth.signIn('person@example.com', 'replacement-password')
    assert.equal(login.user.id, 'source-user')
    const plan = await store.data.getPlan(login.user.id, login.access_token)
    assert.deepEqual(plan.payload, original.financial_plans[0].payload)
    assert.equal(plan.updated_at, original.financial_plans[0].updated_at)
    assert.equal(plan.consent_version, 'original')
    assert.equal(store.importSnapshot(source, () => assert.fail('Do not rotate recovery on re-run')).plansAdded, 0)
    assert.ok(await store.auth.signIn('person@example.com', 'replacement-password'))
  } finally { store.close() }
})

test('failure to persist recovery rolls back all accounts and plans', () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    assert.throws(() => store.importSnapshot(snapshot(), () => { throw Error('disk full') }), /disk full/)
    assert.equal(store.auth.needsRegistration(), true)
  } finally { store.close() }
})

test('conflicting local email never merges owners or replaces credentials', async () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    await store.auth.signUp('person@example.com', 'existing-password')
    assert.throws(() => store.importSnapshot(snapshot(), () => {}), /Conflito de identidade/)
    const login = await store.auth.signIn('person@example.com', 'existing-password')
    assert.match(login.user.id, /^local-/)
    assert.equal(await store.data.getPlan(login.user.id, login.access_token), null)
  } finally { store.close() }
})

test('conflicting payload aborts transaction including accounts inserted earlier', () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    store.importSnapshot(snapshot(), () => {})
    const changed = snapshot()
    changed.users.push({ id: 'second', email: 'second@example.com' })
    changed.financial_plans[0].payload.plan.currentAssets = 1
    assert.throws(() => store.importSnapshot(changed, () => assert.fail('No recovery after conflict')), /difere da origem/)
    const newAccount = { users: [changed.users[1]], financial_plans: [] }
    assert.equal(store.importSnapshot(newAccount, () => {}).accountsAdded, 1)
  } finally { store.close() }
})

test('orphan plans, suspended accounts and unsupported versions stop before writes', () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    const orphan = snapshot(); orphan.users = []
    assert.throws(() => store.importSnapshot(orphan, () => {}), /sem proprietário/)
    const banned = snapshot(); banned.users[0].banned_until = '2099-01-01'
    assert.throws(() => store.importSnapshot(banned, () => {}), /suspensa/)
    const future = snapshot(); future.financial_plans[0].payload.version = 999
    assert.throws(() => store.importSnapshot(future, () => {}), /incompatível/)
    assert.equal(store.auth.needsRegistration(), true)
  } finally { store.close() }
})
