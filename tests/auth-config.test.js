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

test('origens aceitas começam por APP_ORIGIN e incluem as extras sem duplicar', () => {
  assert.deepEqual(readAuthConfig({}).allowedOrigins, ['http://127.0.0.1:4173'])
  assert.deepEqual(readAuthConfig({
    APP_ORIGIN: 'http://192.168.1.21:4173/',
    APP_ALLOWED_ORIGINS: ' http://127.0.0.1:4173/ , ,http://192.168.1.21:4173'
  }).allowedOrigins, ['http://192.168.1.21:4173', 'http://127.0.0.1:4173'])
})
