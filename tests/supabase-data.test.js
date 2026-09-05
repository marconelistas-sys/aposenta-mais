import test from 'node:test'
import assert from 'node:assert/strict'

import { createSupabaseData, SupabaseDataError } from '../src/server/data/supabase-data.mjs'

test('escrita concorrente rejeita revisão antiga sem substituir a nova', async () => {
  let revision = '2026-09-05T10:00:00Z'
  let saved
  const data = createSupabaseData({ url: 'https://project.supabase.co', anonKey: 'key',
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'PATCH')
      const expected = new URL(url).searchParams.get('updated_at')
      if (expected !== `eq.${revision}`) return { ok: true, json: async () => [] }
      saved = JSON.parse(options.body).payload
      revision = '2026-09-05T10:01:00Z'
      return { ok: true, json: async () => [{ updated_at: revision }] }
    }
  })
  const base = revision
  await data.upsertPlan('user-1', { version: 9, winner: true }, 'v6', 'token', base)
  await assert.rejects(() => data.upsertPlan('user-1', { version: 9, winner: false }, 'v6', 'token', base), error => error.code === 'sync_conflict')
  assert.equal(saved.winner, true)
})

test('criação concorrente e ausência de revisão não executam upsert destrutivo', async () => {
  let calls = 0
  const data = createSupabaseData({ url: 'https://project.supabase.co', anonKey: 'key', fetchImpl: async () => {
    calls++
    return { ok: false, status: 409, json: async () => ({ code: '23505' }) }
  } })
  await assert.rejects(() => data.upsertPlan('user', {}, 'v6', 'token'), error => error.code === 'revision_required')
  assert.equal(calls, 0)
  await assert.rejects(() => data.upsertPlan('user', {}, 'v6', 'token', null), error => error.code === 'sync_conflict')
})

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

  await data.upsertPlan('user-1', { version: 3, plan: {} }, '2026-09-04-v1', 'access-secret', null)
  const body = JSON.parse(captured.options.body)

  assert.equal(captured.options.method, 'POST')
  assert.doesNotMatch(captured.options.headers.Prefer, /merge-duplicates/)
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
