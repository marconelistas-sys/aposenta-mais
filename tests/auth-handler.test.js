import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

import { createAuthHandler } from '../src/server/auth/auth-handler.mjs'
import { createRateLimiter } from '../src/server/auth/rate-limiter.mjs'

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  APP_ORIGIN: 'http://127.0.0.1:4173',
  COOKIE_SECURE: 'false'
}

function request(method, body, headers = {}, remoteAddress = '127.0.0.1') {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  stream.method = method
  stream.headers = headers
  stream.socket = { remoteAddress }
  return stream
}

function response() {
  return {
    headers: {},
    status: null,
    body: '',
    setHeader(name, value) { this.headers[name] = value },
    writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers) },
    end(body = '') { this.body = String(body) }
  }
}

async function call(handler, path, { method = 'GET', body, headers = {}, remoteAddress } = {}) {
  const req = request(method, body, headers, remoteAddress)
  const res = response()
  const handled = await handler(req, res, new URL(path, 'http://127.0.0.1:4173'))
  return { handled, status: res.status, headers: res.headers, body: JSON.parse(res.body) }
}

test('informa quando Supabase ainda não está configurado', async () => {
  const handler = createAuthHandler({ env: {} })
  const result = await call(handler, '/api/auth/status')

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { configured: false, authenticated: false })
})

test('bloqueia requisição mutável de outra origem', async () => {
  const handler = createAuthHandler({ env, fetchImpl: async () => { throw new Error('não deve chamar') } })
  const result = await call(handler, '/api/auth/login', {
    method: 'POST',
    body: { email: 'pessoa@example.com', password: 'senha' },
    headers: { origin: 'https://malicioso.example' }
  })

  assert.equal(result.status, 403)
})

test('login cria cookies HttpOnly e não devolve tokens no JSON', async () => {
  const handler = createAuthHandler({
    env,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        expires_in: 3600,
        user: { id: 'user-1', email: 'pessoa@example.com' }
      })
    })
  })
  const result = await call(handler, '/api/auth/login', {
    method: 'POST',
    body: { email: 'PESSOA@example.com', password: 'senha-segura-123' },
    headers: { origin: env.APP_ORIGIN }
  })

  assert.equal(result.status, 200)
  assert.equal(result.body.authenticated, true)
  assert.equal('access_token' in result.body, false)
  assert.ok(result.headers['Set-Cookie'].every((value) => value.includes('HttpOnly')))
})

test('falha de login usa mensagem genérica', async () => {
  const handler = createAuthHandler({
    env,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error_code: 'invalid_credentials' }) })
  })
  const result = await call(handler, '/api/auth/login', {
    method: 'POST',
    body: { email: 'pessoa@example.com', password: 'incorreta' },
    headers: { origin: env.APP_ORIGIN }
  })

  assert.equal(result.status, 401)
  assert.equal(result.body.error, 'Não foi possível entrar com essas credenciais.')
})

test('cadastro exige termos e senha com pelo menos doze caracteres', async () => {
  const handler = createAuthHandler({ env, fetchImpl: async () => { throw new Error('não deve chamar') } })
  const result = await call(handler, '/api/auth/register', {
    method: 'POST',
    body: { email: 'pessoa@example.com', password: 'curta', acceptedTerms: false },
    headers: { origin: env.APP_ORIGIN }
  })

  assert.equal(result.status, 400)
})

test('recuperação não revela se o e-mail existe', async () => {
  const successHandler = createAuthHandler({
    env,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) })
  })
  const failureHandler = createAuthHandler({
    env,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error_code: 'user_not_found' }) })
  })
  const options = {
    method: 'POST',
    body: { email: 'pessoa@example.com' },
    headers: { origin: env.APP_ORIGIN }
  }

  const success = await call(successHandler, '/api/auth/recover', options)
  const failure = await call(failureHandler, '/api/auth/recover', options)

  assert.equal(success.status, 202)
  assert.equal(failure.status, 202)
  assert.equal(success.body.message, failure.body.message)
})

test('logout revoga a sessão e expira os cookies', async () => {
  const calls = []
  const handler = createAuthHandler({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/user')) {
        return { ok: true, json: async () => ({ id: 'user-1', email: 'pessoa@example.com' }) }
      }
      return { ok: true, json: async () => ({}) }
    }
  })
  const result = await call(handler, '/api/auth/logout', {
    method: 'POST',
    headers: {
      origin: env.APP_ORIGIN,
      cookie: 'aposenta-access=access-secret; aposenta-refresh=refresh-secret'
    }
  })

  assert.equal(result.status, 200)
  assert.equal(result.body.authenticated, false)
  assert.ok(result.headers['Set-Cookie'].every((value) => value.includes('Max-Age=0')))
  assert.ok(calls.some(({ url }) => url.endsWith('/logout?scope=local')))
})

test('limita tentativas da mesma conta mesmo quando o endereço muda', async () => {
  const accountLimiter = createRateLimiter({ limit: 1 })
  const handler = createAuthHandler({
    env,
    accountLimiter,
    fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error_code: 'invalid_credentials' }) })
  })
  const options = {
    method: 'POST',
    body: { email: 'PESSOA@example.com', password: 'incorreta' },
    headers: { origin: env.APP_ORIGIN }
  }

  const first = await call(handler, '/api/auth/login', { ...options, remoteAddress: '10.0.0.1' })
  const second = await call(handler, '/api/auth/login', { ...options, remoteAddress: '10.0.0.2' })
  const differentAccount = await call(handler, '/api/auth/login', {
    ...options,
    body: { ...options.body, email: 'outra@example.com' },
    remoteAddress: '10.0.0.3'
  })

  assert.equal(first.status, 401)
  assert.equal(second.status, 429)
  assert.equal(differentAccount.status, 401)
})

test('troca de senha revoga todas as sessões e exige novo login', async () => {
  const calls = []
  const handler = createAuthHandler({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/user') && options.method === 'GET') {
        return { ok: true, json: async () => ({ id: 'user-1', email: 'pessoa@example.com' }) }
      }
      return { ok: true, json: async () => ({}) }
    }
  })
  const result = await call(handler, '/api/auth/password', {
    method: 'POST',
    body: { password: 'nova-senha-segura-123' },
    headers: { origin: env.APP_ORIGIN, cookie: 'aposenta-access=access-secret' }
  })

  assert.equal(result.status, 200)
  assert.equal(result.body.authenticated, false)
  assert.ok(result.headers['Set-Cookie'].every((value) => value.includes('Max-Age=0')))
  assert.ok(calls.some(({ url }) => url.endsWith('/logout?scope=global')))
})

test('troca de senha remove cookies mesmo quando a revogação global falha', async () => {
  const handler = createAuthHandler({
    env,
    fetchImpl: async (url, options) => {
      if (url.endsWith('/user') && options.method === 'GET') {
        return { ok: true, json: async () => ({ id: 'user-1', email: 'pessoa@example.com' }) }
      }
      if (url.endsWith('/logout?scope=global')) {
        return { ok: false, status: 503, json: async () => ({ error_code: 'temporarily_unavailable' }) }
      }
      return { ok: true, json: async () => ({}) }
    }
  })
  const result = await call(handler, '/api/auth/password', {
    method: 'POST',
    body: { password: 'nova-senha-segura-123' },
    headers: { origin: env.APP_ORIGIN, cookie: 'aposenta-access=access-secret' }
  })

  assert.equal(result.status, 502)
  assert.match(result.body.error, /senha foi atualizada/)
  assert.ok(result.headers['Set-Cookie'].every((value) => value.includes('Max-Age=0')))
})

test('cookie malformado não derruba a consulta de sessão', async () => {
  const handler = createAuthHandler({ env, fetchImpl: async () => { throw new Error('não deve chamar') } })
  const result = await call(handler, '/api/auth/status', {
    headers: { cookie: 'aposenta-access=%E0%A4%A' }
  })

  assert.equal(result.status, 200)
  assert.equal(result.body.authenticated, false)
})
