import assert from 'node:assert/strict'

import { createSupabaseAuth } from '../src/server/auth/supabase-auth.mjs'
import { syncConsentVersion } from '../src/shared/sync-contract.js'

const requiredNames = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'TEST_USER_A_EMAIL',
  'TEST_USER_A_PASSWORD',
  'TEST_USER_B_EMAIL',
  'TEST_USER_B_PASSWORD'
]

function readConfig(env = process.env) {
  const missing = requiredNames.filter((name) => !String(env[name] || '').trim())
  if (missing.length) {
    throw new Error(`Variáveis ausentes para o teste hospedado: ${missing.join(', ')}`)
  }
  return {
    url: env.SUPABASE_URL.replace(/\/$/, ''),
    anonKey: env.SUPABASE_ANON_KEY,
    accountA: { email: env.TEST_USER_A_EMAIL, password: env.TEST_USER_A_PASSWORD },
    accountB: { email: env.TEST_USER_B_EMAIL, password: env.TEST_USER_B_PASSWORD }
  }
}

async function rest(config, token, path, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token || config.anonKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch { payload = null }
  return { status: response.status, ok: response.ok, payload }
}

function expectOk(result, operation) {
  assert.equal(
    result.ok,
    true,
    `${operation} falhou com HTTP ${result.status} e código ${result.payload?.code || 'desconhecido'}`
  )
  return result.payload
}

function testRow(userId, owner) {
  return {
    user_id: userId,
    payload: { version: 3, rls_test_owner: owner },
    schema_version: 3,
    consent_version: syncConsentVersion,
    consented_at: new Date().toISOString()
  }
}

async function deleteOwn(config, session) {
  return rest(config, session.access_token, `financial_plans?user_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: 'DELETE',
    prefer: 'return=representation'
  })
}

export async function runSupabaseRlsTest(env = process.env) {
  const config = readConfig(env)
  const auth = createSupabaseAuth(config)
  const sessionA = await auth.signIn(config.accountA.email, config.accountA.password)
  const sessionB = await auth.signIn(config.accountB.email, config.accountB.password)
  assert.notEqual(sessionA.user.id, sessionB.user.id, 'As credenciais devem pertencer a contas distintas.')

  try {
    expectOk(await deleteOwn(config, sessionA), 'limpeza inicial da conta A')
    expectOk(await deleteOwn(config, sessionB), 'limpeza inicial da conta B')

    const anonymousRead = await rest(config, null, 'financial_plans?select=user_id')
    assert.ok([401, 403].includes(anonymousRead.status), `O papel anon respondeu com HTTP ${anonymousRead.status}.`)

    const insertA = await rest(config, sessionA.access_token, 'financial_plans?on_conflict=user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: testRow(sessionA.user.id, 'A')
    })
    assert.equal(expectOk(insertA, 'criação da cópia A').length, 1)

    const insertB = await rest(config, sessionB.access_token, 'financial_plans?on_conflict=user_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: testRow(sessionB.user.id, 'B')
    })
    assert.equal(expectOk(insertB, 'criação da cópia B').length, 1)

    const ownA = expectOk(await rest(
      config,
      sessionA.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionA.user.id)}&select=user_id,payload`
    ), 'restauração da conta A')
    assert.deepEqual(ownA, [{ user_id: sessionA.user.id, payload: { version: 3, rls_test_owner: 'A' } }])

    const crossRead = expectOk(await rest(
      config,
      sessionA.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionB.user.id)}&select=user_id`
    ), 'leitura cruzada')
    assert.deepEqual(crossRead, [])

    const crossUpdate = expectOk(await rest(
      config,
      sessionA.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionB.user.id)}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { payload: { version: 3, rls_test_owner: 'alterado-por-A' } }
      }
    ), 'atualização cruzada')
    assert.deepEqual(crossUpdate, [])

    const crossDelete = expectOk(await rest(
      config,
      sessionA.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionB.user.id)}`,
      { method: 'DELETE', prefer: 'return=representation' }
    ), 'exclusão cruzada')
    assert.deepEqual(crossDelete, [])

    const intactB = expectOk(await rest(
      config,
      sessionB.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionB.user.id)}&select=payload`
    ), 'verificação da conta B')
    assert.deepEqual(intactB, [{ payload: { version: 3, rls_test_owner: 'B' } }])

    const deletedA = expectOk(await deleteOwn(config, sessionA), 'exclusão da cópia A')
    assert.equal(deletedA.length, 1)
    const afterDeleteA = expectOk(await rest(
      config,
      sessionA.access_token,
      `financial_plans?user_id=eq.${encodeURIComponent(sessionA.user.id)}&select=user_id`
    ), 'verificação da exclusão A')
    assert.deepEqual(afterDeleteA, [])

    console.log('RLS, restauração e exclusão validadas com duas contas distintas.')
  } finally {
    await deleteOwn(config, sessionA).catch(() => {})
    await deleteOwn(config, sessionB).catch(() => {})
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSupabaseRlsTest().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
