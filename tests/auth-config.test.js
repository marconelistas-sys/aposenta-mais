import test from 'node:test'
import assert from 'node:assert/strict'

import { readAuthConfig } from '../src/server/auth/config.mjs'

const supabase = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'publishable-key'
}

test('desenvolvimento permite autenticação sem liberar a beta', () => {
  assert.equal(readAuthConfig(supabase).configured, true)
})

test('produção bloqueia autenticação enquanto o P0 jurídico estiver incompleto', () => {
  assert.equal(readAuthConfig({ ...supabase, NODE_ENV: 'production' }).configured, false)
  assert.equal(readAuthConfig({
    ...supabase,
    NODE_ENV: 'production',
    LEGAL_BETA_APPROVED: 'true',
    LEGAL_CONTROLLER_NAME: 'Controlador definido'
  }).configured, false)
})

test('produção libera autenticação após aprovação, controlador e canal', () => {
  assert.equal(readAuthConfig({
    ...supabase,
    NODE_ENV: 'production',
    LEGAL_BETA_APPROVED: 'true',
    LEGAL_CONTROLLER_NAME: 'Controlador definido',
    LEGAL_PRIVACY_CONTACT: 'privacidade@example.com'
  }).configured, true)
})
