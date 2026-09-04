import test from 'node:test'
import assert from 'node:assert/strict'

import { authState } from '../src/app/auth-state.js'
import { syncState } from '../src/app/sync-state.js'
import { renderLogin, renderRegister } from '../src/features/auth/auth.js'
import { renderProfile } from '../src/features/profile/profile.js'

test('telas de autenticação oferecem cadastro, login e requisitos de senha', () => {
  Object.assign(authState, { configured: true, authenticated: false, user: null })

  assert.match(renderLogin(), /data-auth-form="login"/)
  assert.match(renderRegister(), /data-auth-form="register"/)
  assert.match(renderRegister(), /minlength="12"/)
  assert.match(renderRegister(), /aviso de privacidade/)
})

test('e-mail da sessão é escapado antes de entrar no HTML', () => {
  Object.assign(authState, { configured: true, authenticated: true, user: { email: '<img src=x>' } })

  const html = renderLogin()
  assert.doesNotMatch(html, /<img src=x>/)
  assert.match(html, /&lt;img src=x&gt;/)
})

test('perfil exige consentimento explícito e informa sincronização manual', () => {
  Object.assign(authState, { configured: true, authenticated: true, user: { email: 'pessoa@example.com' } })
  Object.assign(syncState, { loading: false, available: true, exists: false, updatedAt: null, error: '' })

  const html = renderProfile()

  assert.match(html, /data-sync-consent-form/)
  assert.match(html, /acceptedSyncConsent/)
  assert.match(html, /A sincronização é manual/)
  assert.match(html, /não envia seus dados automaticamente/)
})

test('perfil oferece restauração e exclusão quando há cópia remota', () => {
  Object.assign(authState, { configured: true, authenticated: true, user: { email: 'pessoa@example.com' } })
  Object.assign(syncState, {
    loading: false,
    available: true,
    exists: true,
    updatedAt: '2026-09-04T00:00:00Z',
    error: ''
  })

  const html = renderProfile()

  assert.match(html, /data-sync-pull/)
  assert.match(html, /data-sync-delete/)
})
