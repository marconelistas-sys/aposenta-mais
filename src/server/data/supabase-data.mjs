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

    async upsertPlan(userId, payload, consentVersion, accessToken, expectedUpdatedAt) {
      if (expectedUpdatedAt === undefined) throw new SupabaseDataError(428, 'revision_required')
      const updating = expectedUpdatedAt !== null
      const path = updating
        ? `/financial_plans?user_id=eq.${encodeURIComponent(userId)}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`
        : '/financial_plans'
      let rows
      try {
        rows = await request(path, {
        method: updating ? 'PATCH' : 'POST',
        accessToken,
        prefer: 'return=representation',
        body: {
          user_id: userId,
          payload,
          schema_version: payload.version,
          consent_version: consentVersion,
          consented_at: new Date().toISOString()
        }
        })
      } catch (error) {
        if (error.code === '23505') throw new SupabaseDataError(409, 'sync_conflict')
        throw error
      }
      if (!Array.isArray(rows) || rows.length !== 1) throw new SupabaseDataError(409, 'sync_conflict')
      return rows[0]
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
