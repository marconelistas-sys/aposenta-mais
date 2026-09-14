import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalStore } from '../src/server/data/local-store.mjs'

test('SQLite isolates owners, rejects stale writes, persists and restores a consistent backup', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aposenta-db-'))
  let store = createLocalStore({ path: join(dir, 'app.sqlite') })
  try {
    await store.auth.signUp('one@example.com', 'test-password-123')
    await store.auth.signUp('two@example.com', 'test-password-456')
    const a = await store.auth.signIn('one@example.com', 'test-password-123')
    const b = await store.auth.signIn('two@example.com', 'test-password-456')
    await assert.rejects(store.auth.signIn('one@example.com', 'wrong'))
    const saved = await store.data.upsertPlan(a.user.id, { plan: { wealth: 123 } }, 'v1', a.access_token, null)
    await assert.rejects(store.data.getPlan(a.user.id, b.access_token))
    await assert.rejects(store.data.upsertPlan(a.user.id, {}, 'v1', a.access_token, null), { code: 'sync_conflict' })
    assert.equal((await store.data.getPlan(a.user.id, a.access_token)).payload.plan.wealth, 123)
    await store.backup(join(dir, 'backup.sqlite'))
    store.close()
    store = createLocalStore({ path: join(dir, 'backup.sqlite') })
    assert.equal((await store.data.getPlan(a.user.id, a.access_token)).updated_at, saved.updated_at)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('local recovery rotates code and invalidates all sessions', async () => {
  const store = createLocalStore({ path: ':memory:' })
  try {
    const created = await store.auth.signUp('admin@example.com', 'original-password')
    const code = created.message.match(/seguro: ([\w-]+)/)[1]
    const session = await store.auth.signIn('admin@example.com', 'original-password')
    await assert.rejects(store.auth.resetPassword('admin@example.com', 'wrong', 'changed-password'))
    await store.auth.resetPassword('admin@example.com', code, 'changed-password')
    await assert.rejects(store.auth.getUser(session.access_token))
    await assert.rejects(store.auth.refresh(session.refresh_token))
    await assert.rejects(store.auth.signIn('admin@example.com', 'original-password'))
    await assert.rejects(store.auth.resetPassword('admin@example.com', code, 'another-password'))
    assert.ok((await store.auth.signIn('admin@example.com', 'changed-password')).user.id)
  } finally { store.close() }
})
