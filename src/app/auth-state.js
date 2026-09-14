export const authState = {
  configured: null,
  provider: null,
  storageProvider: null,
  localAvailable: false,
  localEnabled: false,
  loginProvider: 'supabase',
  registrationRequired: false,
  authenticated: false,
  user: null
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
  return payload
}

export async function loadAuthState() {
  try {
    const payload = await request('/api/auth/status')
    Object.assign(authState, payload, { provider: payload.provider || null, storageProvider: payload.storageProvider || payload.provider || null, localAvailable: payload.localAvailable === true, localEnabled: payload.localEnabled === true, registrationRequired: payload.registrationRequired === true })
  } catch {
    Object.assign(authState, { configured: false, provider: null, registrationRequired: false, authenticated: false, user: null })
  }
  return authState
}

export async function registerAccount(data) {
  const result = await request('/api/auth/register', { method: 'POST', body: data })
  if (authState.provider === 'local') authState.registrationRequired = false
  return result
}

export async function login(data) {
  const payload = await request('/api/auth/login', { method: 'POST', body: data, headers: { 'X-Auth-Provider': data.provider || 'supabase' } })
  Object.assign(authState, payload, { configured: true })
  return payload
}

export async function recoverAccount(data) {
  return request('/api/auth/recover', { method: 'POST', body: data, headers: { 'X-Auth-Provider': data.provider || authState.loginProvider || 'supabase' } })
}

export async function updatePassword(data) {
  return request('/api/auth/password', { method: 'POST', body: data })
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' })
  Object.assign(authState, { authenticated: false, user: null, provider: 'supabase', loginProvider: 'supabase', storageProvider: null, localEnabled: false })
}

export async function configureLocalAccess(data, owner) {
  return request('/api/auth/local-enable', { method: 'POST', body: data, headers: { 'X-Plan-Owner': owner } })
}
export async function selectStorageProvider(provider, owner) {
  return request('/api/auth/storage', { method: 'POST', body: { provider }, headers: { 'X-Plan-Owner': owner } })
}
