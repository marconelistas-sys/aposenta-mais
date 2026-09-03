import test from 'node:test'
import assert from 'node:assert/strict'

import { authState } from '../src/app/auth-state.js'
import { renderLogin, renderRegister } from '../src/features/auth/auth.js'

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
