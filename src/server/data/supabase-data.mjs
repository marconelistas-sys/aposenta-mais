export class SupabaseDataError extends Error {
  constructor(status, code = 'data_error') {
    super(code)
    this.name = 'SupabaseDataError'
    this.status = status
    this.code = code
  }
}

export function createSupabaseData({ url, anonKey, fetchImpl = fetch }) {
  async function request(path, { method = 'GET', body, accessToken, prefer } = {}) {
    const response = await fetchImpl(`${url}/rest/v1${path}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new SupabaseDataError(response.status, payload?.code || 'data_error')
    }
    return payload
  }

  return {
    async getPlan(userId, accessToken) {
      const query = `?user_id=eq.${encodeURIComponent(userId)}&select=payload,schema_version,consent_version,consented_at,updated_at&limit=1`
      const rows = await request(`/financial_plans${query}`, { accessToken })
      return Array.isArray(rows) ? rows[0] || null : null
    },

    async upsertPlan(userId, payload, consentVersion, accessToken) {
      const rows = await request('/financial_plans?on_conflict=user_id', {
        method: 'POST',
        accessToken,
        prefer: 'resolution=merge-duplicates,return=representation',
        body: {
          user_id: userId,
          payload,
          schema_version: payload.version,
          consent_version: consentVersion,
          consented_at: new Date().toISOString()
        }
      })
      return Array.isArray(rows) ? rows[0] || null : null
    },

    deletePlan(userId, accessToken) {
      const query = `?user_id=eq.${encodeURIComponent(userId)}`
      return request(`/financial_plans${query}`, {
        method: 'DELETE',
        accessToken,
        prefer: 'return=minimal'
      })
    }
  }
}
