export function readAuthConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = String(env.SUPABASE_ANON_KEY || '')
  const appOrigin = String(env.APP_ORIGIN || 'http://127.0.0.1:4173').replace(/\/$/, '')
  const isProduction = env.NODE_ENV === 'production'
  const legalReleaseApproved = env.LEGAL_BETA_APPROVED === 'true'
    && Boolean(String(env.LEGAL_CONTROLLER_NAME || '').trim())
    && Boolean(String(env.LEGAL_PRIVACY_CONTACT || '').trim())
  const legalReady = !isProduction || legalReleaseApproved

  return {
    url,
    anonKey,
    appOrigin,
    secureCookies: isProduction || env.COOKIE_SECURE === 'true',
    configured: Boolean(url && anonKey && legalReady)
  }
}
