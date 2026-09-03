import { clearSessionCookies, parseCookies, sessionCookies, authCookieNames } from './cookies.mjs'
import { readAuthConfig } from './config.mjs'
import { createRateLimiter } from './rate-limiter.mjs'
import { createSupabaseAuth } from './supabase-auth.mjs'

const genericAuthMessage = 'Se os dados estiverem corretos, você receberá as próximas instruções.'
const loginMessage = 'Não foi possível entrar com essas credenciais.'
const jsonLimit = 16 * 1024

function json(response, status, payload, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > jsonLimit) throw new RangeError('payload_too_large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128
}

function requestOrigin(request) {
  return String(request.headers.origin || '').replace(/\/$/, '')
}

function clientAddress(request) {
  return request.socket?.remoteAddress || 'unknown'
}

function sessionPayload(user) {
  return { authenticated: true, user: { id: user.id, email: user.email || '' } }
}

export function createAuthHandler({ env = process.env, fetchImpl = fetch, limiter = createRateLimiter() } = {}) {
  const config = readAuthConfig(env)
  const auth = config.configured ? createSupabaseAuth({ ...config, fetchImpl }) : null

  async function requireUser(request, response) {
    const cookies = parseCookies(request.headers.cookie)
    const cookieNames = authCookieNames(config.secureCookies)
    const accessToken = cookies[cookieNames.accessCookie]
    const refreshToken = cookies[cookieNames.refreshCookie]

    if (accessToken) {
      try {
        const user = await auth.getUser(accessToken)
        return { user, accessToken }
      } catch {
        // Tenta renovar abaixo.
      }
    }

    if (refreshToken) {
      try {
        const session = await auth.refresh(refreshToken)
        const user = session.user || await auth.getUser(session.access_token)
        response.setHeader('Set-Cookie', sessionCookies(session, config.secureCookies))
        return { user, accessToken: session.access_token }
      } catch {
        response.setHeader('Set-Cookie', clearSessionCookies(config.secureCookies))
      }
    }
    return null
  }

  return async function handleAuth(request, response, url) {
    if (!url.pathname.startsWith('/api/auth/')) return false

    if (request.method === 'GET' && url.pathname === '/api/auth/status') {
      if (!config.configured) {
        json(response, 200, { configured: false, authenticated: false })
        return true
      }
      const session = await requireUser(request, response)
      json(response, 200, session ? { configured: true, ...sessionPayload(session.user) } : { configured: true, authenticated: false })
      return true
    }

    if (!config.configured) {
      json(response, 503, { error: 'A autenticação ainda não foi configurada.' })
      return true
    }

    if (request.method !== 'GET' && requestOrigin(request) !== config.appOrigin) {
      json(response, 403, { error: 'Origem da requisição não permitida.' })
      return true
    }

    const sensitiveRoutes = new Set(['/api/auth/register', '/api/auth/login', '/api/auth/recover'])
    if (sensitiveRoutes.has(url.pathname)) {
      const rate = limiter.consume(`${clientAddress(request)}:${url.pathname}`)
      response.setHeader('RateLimit-Remaining', String(rate.remaining))
      if (!rate.allowed) {
        json(response, 429, { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' }, { 'Retry-After': String(rate.retryAfter) })
        return true
      }
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/auth/register') {
        const { email, password, acceptedTerms } = await readJson(request)
        if (!validEmail(email) || !validPassword(password) || acceptedTerms !== true) {
          json(response, 400, { error: 'Revise o e-mail, a senha e a aceitação dos termos.' })
          return true
        }
        await auth.signUp(email.trim().toLowerCase(), password, `${config.appOrigin}/api/auth/confirm`)
        json(response, 202, { message: genericAuthMessage })
        return true
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const { email, password } = await readJson(request)
        if (!validEmail(email) || typeof password !== 'string') {
          json(response, 401, { error: loginMessage })
          return true
        }
        const session = await auth.signIn(email.trim().toLowerCase(), password)
        response.setHeader('Set-Cookie', sessionCookies(session, config.secureCookies))
        json(response, 200, sessionPayload(session.user))
        return true
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/recover') {
        const { email } = await readJson(request)
        if (validEmail(email)) await auth.recover(email.trim().toLowerCase(), `${config.appOrigin}/api/auth/confirm?next=/nova-senha`)
        json(response, 202, { message: genericAuthMessage })
        return true
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        const session = await requireUser(request, response)
        if (session) await auth.signOut(session.accessToken).catch(() => {})
        response.setHeader('Set-Cookie', clearSessionCookies(config.secureCookies))
        json(response, 200, { authenticated: false })
        return true
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/password') {
        const session = await requireUser(request, response)
        if (!session) {
          json(response, 401, { error: 'Sua sessão expirou.' })
          return true
        }
        const { password } = await readJson(request)
        if (!validPassword(password)) {
          json(response, 400, { error: 'Use uma senha com 12 a 128 caracteres.' })
          return true
        }
        await auth.updatePassword(session.accessToken, password)
        json(response, 200, { message: 'Senha atualizada.' })
        return true
      }

      if (request.method === 'GET' && url.pathname === '/api/auth/confirm') {
        const tokenHash = url.searchParams.get('token_hash')
        const type = url.searchParams.get('type')
        const next = url.searchParams.get('next') === '/nova-senha' ? '/nova-senha' : '/perfil'
        if (!tokenHash || !['signup', 'email', 'recovery'].includes(type)) {
          response.writeHead(302, { Location: '/entrar?erro=confirmacao' })
          response.end()
          return true
        }
        const session = await auth.verify(tokenHash, type)
        response.writeHead(302, { Location: next, 'Set-Cookie': sessionCookies(session, config.secureCookies), 'Cache-Control': 'no-store' })
        response.end()
        return true
      }

      json(response, 404, { error: 'Rota de autenticação não encontrada.' })
      return true
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof RangeError) {
        json(response, 400, { error: 'Requisição inválida.' })
      } else if (url.pathname === '/api/auth/login') {
        json(response, 401, { error: loginMessage })
      } else if (sensitiveRoutes.has(url.pathname)) {
        json(response, 202, { message: genericAuthMessage })
      } else {
        json(response, 502, { error: 'O serviço de autenticação não respondeu.' })
      }
      return true
    }
  }
}
