export function readAuthConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = String(env.SUPABASE_ANON_KEY || '')
  const appOrigin = String(env.APP_ORIGIN || 'http://127.0.0.1:4173').replace(/\/$/, '')

  return {
    url,
    anonKey,
    appOrigin,
    secureCookies: env.NODE_ENV === 'production' || env.COOKIE_SECURE === 'true',
    configured: Boolean(url && anonKey)
  }
}
