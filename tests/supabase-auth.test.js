import test from 'node:test'
import assert from 'node:assert/strict'

import { createSupabaseAuth, SupabaseAuthError } from '../src/server/auth/supabase-auth.mjs'

test('envia cadastro ao endpoint oficial sem registrar senha no cliente', async () => {
  let captured
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return { ok: true, json: async () => ({ id: 'user-1' }) }
    }
  })

  await auth.signUp('pessoa@example.com', 'senha-segura-123', 'https://app.example.com/api/auth/confirm')

  assert.match(captured.url, /\/auth\/v1\/signup\?redirect_to=/)
  assert.equal(captured.options.headers.apikey, 'anon-key')
  assert.deepEqual(JSON.parse(captured.options.body), {
    email: 'pessoa@example.com',
    password: 'senha-segura-123'
  })
})

test('traduz falhas do Supabase sem carregar sua mensagem para a interface', async () => {
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error_code: 'invalid_credentials' }) })
  })

  await assert.rejects(() => auth.signIn('x@example.com', 'errada'), (error) => {
    assert.ok(error instanceof SupabaseAuthError)
    assert.equal(error.code, 'invalid_credentials')
    return true
  })
})
