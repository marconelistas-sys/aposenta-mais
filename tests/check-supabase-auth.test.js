import test from 'node:test'
import assert from 'node:assert/strict'

import { checkSupabaseAuth } from '../scripts/check-supabase-auth.mjs'

test('valida a configuração real sem expor a chave publicável', async () => {
  let captured
  const result = await checkSupabaseAuth({
    env: {
      SUPABASE_URL: 'https://project.supabase.co/',
      SUPABASE_ANON_KEY: 'publishable-key'
    },
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return {
        ok: true,
        status: 200,
        json: async () => ({ external: { email: true }, mailer_autoconfirm: false })
      }
    }
  })

  assert.deepEqual(result, {
    connected: true,
    emailProviderEnabled: true,
    emailConfirmationRequired: true
  })
  assert.equal(captured.url, 'https://project.supabase.co/auth/v1/settings')
  assert.equal(captured.options.headers.apikey, 'publishable-key')
})

test('falha antes da rede quando faltam variáveis', async () => {
  await assert.rejects(
    () => checkSupabaseAuth({ env: {}, fetchImpl: async () => { throw new Error('não deve chamar') } }),
    /SUPABASE_URL e SUPABASE_ANON_KEY/
  )
})

test('relata erro HTTP sem incluir a chave na mensagem', async () => {
  await assert.rejects(
    () => checkSupabaseAuth({
      env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'secret-value' },
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) })
    }),
    (error) => {
      assert.match(error.message, /HTTP 401/)
      assert.doesNotMatch(error.message, /secret-value/)
      return true
    }
  )
})
