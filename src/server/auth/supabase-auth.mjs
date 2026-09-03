export class SupabaseAuthError extends Error {
  constructor(status, code = 'auth_error') {
    super(code)
    this.name = 'SupabaseAuthError'
    this.status = status
    this.code = code
  }
}

export function createSupabaseAuth({ url, anonKey, fetchImpl = fetch }) {
  async function request(path, { method = 'POST', body, accessToken } = {}) {
    const response = await fetchImpl(`${url}/auth/v1${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken || anonKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new SupabaseAuthError(response.status, payload.error_code || payload.code || 'auth_error')
    }
    return payload
  }

  return {
    signUp(email, password, redirectTo) {
      return request(`/signup?redirect_to=${encodeURIComponent(redirectTo)}`, { body: { email, password } })
    },
    signIn(email, password) {
      return request('/token?grant_type=password', { body: { email, password } })
    },
    refresh(refreshToken) {
      return request('/token?grant_type=refresh_token', { body: { refresh_token: refreshToken } })
    },
    getUser(accessToken) {
      return request('/user', { method: 'GET', accessToken })
    },
    signOut(accessToken) {
      return request('/logout', { accessToken })
    },
    recover(email, redirectTo) {
      return request(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { body: { email } })
    },
    verify(tokenHash, type) {
      return request('/verify', { body: { token_hash: tokenHash, type } })
    },
    updatePassword(accessToken, password) {
      return request('/user', { method: 'PUT', accessToken, body: { password } })
    }
  }
}
