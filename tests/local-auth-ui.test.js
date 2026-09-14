import test from 'node:test'
import assert from 'node:assert/strict'
import { authState, loadAuthState, recoverAccount } from '../src/app/auth-state.js'
import { state } from '../src/app/state.js'
import { syncState } from '../src/app/sync-state.js'
import { renderLogin, renderRegister, renderRecovery, renderNewPassword } from '../src/features/auth/auth.js'
import { renderProfile } from '../src/features/profile/profile.js'
import { renderDashboard } from '../src/features/dashboard/dashboard.js'
import { renderPrivacy } from '../src/features/privacy/privacy.js'
import { appLayout } from '../src/app/layout.js'
import { isLocalPlanOpen, openLocalPlan, closeLocalPlan } from '../src/app/local-access.js'

test('cadastro e login locais explicam conta neste computador e código de recuperação', () => {
  const before = { ...authState }
  try {
    Object.assign(authState, { provider: 'local', configured: true, authenticated: false })
    assert.match(renderLogin(), /conta criada neste computador/)
    const html = renderRegister()
    assert.match(html, /Guarde o código de recuperação exibido após o cadastro/)
    assert.match(html, /Cópia no banco deste computador/)
    assert.doesNotMatch(html, /Você receberá um e-mail|Cópia remota|Acesso em outros dispositivos/)
  } finally { Object.assign(authState, before) }
})

test('recuperação local exige código e confirmação da nova senha sem prometer mensagem', () => {
  const before = { ...authState }
  try {
    Object.assign(authState, { provider: 'local', configured: true, authenticated: false })
    const html = renderRecovery()
    for (const name of ['email', 'recoveryCode', 'password', 'passwordConfirmation']) assert.match(html, new RegExp(`name="${name}"`))
    assert.match(html, /Redefinir senha/)
    assert.doesNotMatch(html, /Enviaremos instruções|Enviar instruções/)
    assert.equal(renderNewPassword(), html)
    authState.provider = 'supabase'
    assert.match(renderRecovery(), /Enviar instruções/)
    assert.doesNotMatch(renderRecovery(), /name="recoveryCode"|name="password"/)
  } finally { Object.assign(authState, before) }
})

test('perfil local distingue cópia no banco dos dados do navegador, incluindo estado apagado', () => {
  const before = { auth: { ...authState }, sync: { ...syncState }, deleted: state.dataDeleted }
  try {
    Object.assign(authState, { provider: 'local', authenticated: true, configured: true, user: { email: '<usuario>' } })
    Object.assign(syncState, { available: true, loading: false, exists: true, updatedAt: '2026-09-14T00:00:00Z' })
    state.dataDeleted = false
    let html = renderProfile()
    assert.match(html, /Cópia no banco deste computador/)
    assert.match(html, /A cópia é manual/)
    assert.match(html, /Apagar os dados do navegador não exclui a cópia do banco/)
    assert.match(html, /Autorizo salvar uma cópia completa/)
    assert.match(html, /acceptedSyncConsent/)
    assert.match(html, /Restaurar do banco neste navegador/)
    assert.match(html, /&lt;usuario&gt;/)
    assert.doesNotMatch(html, /<usuario>|na nuvem|cópia remota|Cópia entre dispositivos|acessar sua cópia em outros dispositivos/)
    state.dataDeleted = true
    html = renderProfile()
    assert.match(html, /Restaurar cópia no banco deste computador/)
    assert.match(html, /Excluir cópia no banco deste computador/)
  } finally {
    Object.assign(authState, before.auth)
    Object.assign(syncState, before.sync)
    state.dataDeleted = before.deleted
  }
})

test('status mantém provedor local e recuperação transporta os campos sem persistir segredo', async () => {
  const before = { auth: { ...authState }, fetch: globalThis.fetch }
  const sent = []
  try {
    globalThis.fetch = async (path, options) => {
      sent.push({ path, options })
      return { ok: true, json: async () => path.endsWith('/status') ? { provider: 'local', configured: true, authenticated: false, user: null } : { message: 'Senha redefinida.' } }
    }
    await loadAuthState()
    assert.equal(authState.provider, 'local')
    await recoverAccount({ email: 'user@example.test', recoveryCode: 'secret-code', password: 'nova-senha-longa' })
    assert.deepEqual(JSON.parse(sent[1].options.body), { email: 'user@example.test', recoveryCode: 'secret-code', password: 'nova-senha-longa' })
    assert.equal(sent[1].options.credentials, 'same-origin')
    assert.doesNotMatch(JSON.stringify(authState), /secret-code|nova-senha-longa/)
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ configured: true, authenticated: false }) })
    await loadAuthState()
    assert.equal(authState.provider, null)
    globalThis.fetch = async () => { throw new Error('offline') }
    await loadAuthState()
    assert.equal(authState.provider, null)
    assert.equal(authState.configured, false)
  } finally { globalThis.fetch = before.fetch; Object.assign(authState, before.auth) }
})

test('Dashboard, rodapé e privacidade descrevem cópia manual neste computador', () => {
  const before = { auth: { ...authState }, sync: { ...syncState }, opened: isLocalPlanOpen() }
  try {
    Object.assign(authState, { provider: 'local', authenticated: true, configured: true, user: { email: 'user@example.test' } })
    syncState.exists = true
    openLocalPlan()
    const dashboard = renderDashboard()
    const footer = appLayout('', '/')
    const privacy = renderPrivacy()
    assert.match(dashboard, /Cópia salva no banco deste computador/)
    assert.match(dashboard, /A cópia é manual/)
    assert.match(dashboard, /href="\/extratos" data-route/)
    assert.match(dashboard, /sobra média dos meses completos com o aporte planejado/)
    assert.match(footer, /Cópia no banco deste computador\. Atualize, restaure ou exclua/)
    assert.match(privacy, /Apagar os dados do navegador não exclui a cópia do banco/)
    assert.match(privacy, /exige login, ação manual e consentimento/)
    assert.match(privacy, /TXT, CSV e OFX são lidos neste navegador/)
    assert.match(privacy, /novo código e descarte o anterior/)
    for (const html of [dashboard, footer, privacy]) assert.doesNotMatch(html, /Cópia remota ativa|permanece na nuvem|configuração hospedada/)
  } finally {
    Object.assign(authState, before.auth)
    Object.assign(syncState, before.sync)
    if (!before.opened) closeLocalPlan()
  }
})

test('empty local database guides first registration instead of requesting a nonexistent password', () => {
  const previous = { ...authState }
  try {
    Object.assign(authState, { provider: 'local', authenticated: false, registrationRequired: true })
    const html = renderLogin()
    assert.match(html, /Criar conta local/)
    assert.match(html, /Contas do Supabase não são transferidas automaticamente/)
    assert.doesNotMatch(html, /data-auth-form="login"/)
  } finally { Object.assign(authState, previous) }
})

test('Supabase profile offers explicit local activation and separate storage selection', () => {
  const previous = { ...authState }
  try {
    Object.assign(authState, { provider: 'supabase', storageProvider: 'supabase', authenticated: true, localEnabled: false, user: { id: 'cloud-user', email: 'pessoa@example.com' } })
    assert.match(renderProfile(), /data-enable-local-form/)
    assert.match(renderProfile(), /Ativar banco e login locais/)
    Object.assign(authState, { localEnabled: true, storageProvider: 'local' })
    assert.match(renderProfile(), /data-storage-provider-form/)
    assert.match(renderProfile(), /Cópia no banco deste computador/)
    assert.doesNotMatch(renderProfile(), /data-enable-local-form/)
    Object.assign(authState, { authenticated: false, localAvailable: true, loginProvider: 'supabase' })
    assert.match(renderLogin(), /value="supabase" selected/)
    assert.match(renderLogin(), /Login local/)
  } finally { Object.assign(authState, previous) }
})
