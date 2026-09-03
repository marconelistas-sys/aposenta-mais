export const authState = {
  configured: null,
  authenticated: false,
  user: null
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload
}

export async function loadAuthState() {
  try {
    const payload = await request('/api/auth/status')
    Object.assign(authState, payload)
  } catch {
    Object.assign(authState, { configured: false, authenticated: false, user: null })
  }
  return authState
}

export async function registerAccount(data) {
  return request('/api/auth/register', { method: 'POST', body: data })
}

export async function login(data) {
  const payload = await request('/api/auth/login', { method: 'POST', body: data })
  Object.assign(authState, payload, { configured: true })
  return payload
}

export async function recoverAccount(data) {
  return request('/api/auth/recover', { method: 'POST', body: data })
}

export async function updatePassword(data) {
  return request('/api/auth/password', { method: 'POST', body: data })
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' })
  Object.assign(authState, { authenticated: false, user: null })
}
