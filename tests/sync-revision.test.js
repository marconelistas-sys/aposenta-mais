import test from 'node:test'
import assert from 'node:assert/strict'
import { resetSyncState, saveRemoteState, syncState } from '../src/app/sync-state.js'

test('cliente envia a revisão consultada e não avança revisão após conflito', async () => {
  const originalFetch = globalThis.fetch
  try {
    resetSyncState()
    await assert.rejects(() => saveRemoteState({ plan: {} }), /Consulte/)
    Object.assign(syncState, { available: true, exists: true, updatedAt: '2026-09-05T00:00:00Z' })
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.expectedUpdatedAt, syncState.updatedAt)
      assert.equal('valuesHidden' in body.state, false)
      return { ok: false, json: async () => ({ error: 'Conflito' }) }
    }
    await assert.rejects(() => saveRemoteState({ plan: {} }), /Conflito/)
    assert.equal(syncState.updatedAt, '2026-09-05T00:00:00Z')
  } finally { globalThis.fetch = originalFetch; resetSyncState() }
})
