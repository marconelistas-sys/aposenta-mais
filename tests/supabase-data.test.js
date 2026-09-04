import test from 'node:test'
import assert from 'node:assert/strict'

import { createSupabaseData, SupabaseDataError } from '../src/server/data/supabase-data.mjs'

test('consulta somente a linha do usuário com o token da sessão', async () => {
  let captured
  const data = createSupabaseData({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return { ok: true, json: async () => [] }
    }
  })

  const result = await data.getPlan('user-1', 'access-secret')

  assert.equal(result, null)
  assert.match(captured.url, /user_id=eq.user-1/)
  assert.equal(captured.options.headers.Authorization, 'Bearer access-secret')
  assert.equal(captured.options.headers.apikey, 'anon-key')
})

test('grava plano com consentimento e resolução por usuário', async () => {
  let captured
  const data = createSupabaseData({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return { ok: true, json: async () => [{ updated_at: '2026-09-04T00:00:00Z' }] }
    }
  })

  await data.upsertPlan('user-1', { version: 3, plan: {} }, '2026-09-04-v1', 'access-secret')
  const body = JSON.parse(captured.options.body)

  assert.match(captured.url, /on_conflict=user_id/)
  assert.match(captured.options.headers.Prefer, /resolution=merge-duplicates/)
  assert.equal(body.user_id, 'user-1')
  assert.equal(body.consent_version, '2026-09-04-v1')
})

test('não expõe a mensagem interna de falha do PostgREST', async () => {
  const data = createSupabaseData({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      json: async () => ({ code: '42501', message: 'detalhe interno' })
    })
  })

  await assert.rejects(() => data.getPlan('user-1', 'access-secret'), (error) => {
    assert.ok(error instanceof SupabaseDataError)
    assert.equal(error.code, '42501')
    assert.doesNotMatch(error.message, /detalhe interno/)
    return true
  })
})
