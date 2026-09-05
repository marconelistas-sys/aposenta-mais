import test from 'node:test'
import assert from 'node:assert/strict'
import { resetSyncState, saveRemoteState, syncState } from '../src/app/sync-state.js'
import { ownedStorage } from '../src/app/owned-storage.js'
import { loadRemoteState } from '../src/app/sync-state.js'

test('cliente envia a revisão consultada e não avança revisão após conflito', async () => {
  const originalFetch = globalThis.fetch
  try {
    resetSyncState()
    await assert.rejects(() => saveRemoteState({ plan: {} }), /Consulte/)
    Object.assign(syncState, { available: true, exists: true, updatedAt: '2026-09-05T00:00:00Z' })
    ownedStorage.select('user-a')
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.expectedUpdatedAt, syncState.updatedAt)
      assert.equal('valuesHidden' in body.state, false)
      return { ok: false, json: async () => ({ error: 'Conflito' }) }
    }
    await assert.rejects(() => saveRemoteState({ plan: {} }), /Conflito/)
    assert.equal(syncState.updatedAt, '2026-09-05T00:00:00Z')
  } finally { globalThis.fetch = originalFetch; resetSyncState(); ownedStorage.select(null) }
})

test('resposta remota em trânsito não pode restaurar dados após troca do proprietário', async () => {
  const originalFetch = globalThis.fetch
  try {
    ownedStorage.select('user-a')
    globalThis.fetch = async (url, options) => {
      assert.equal(options.headers['X-Plan-Owner'], 'user-a')
      ownedStorage.select('user-b')
      return { ok: true, json: async () => ({ state: { plan: { currentAssets: 123 } } }) }
    }
    await assert.rejects(loadRemoteState, /sessão mudou/)
  } finally { globalThis.fetch = originalFetch; ownedStorage.select(null) }
})
