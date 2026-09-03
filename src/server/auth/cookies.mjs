export function authCookieNames(secure) {
  const prefix = secure ? '__Host-' : ''
  return {
    accessCookie: `${prefix}aposenta-access`,
    refreshCookie: `${prefix}aposenta-refresh`
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const separator = part.indexOf('=')
      if (separator < 0) return [part, '']
      return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))]
    })
  )
}

function cookie(name, value, { maxAge, secure }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function sessionCookies(session, secure) {
  const { accessCookie, refreshCookie } = authCookieNames(secure)
  const accessMaxAge = Math.max(60, Number(session.expires_in) || 3600)
  return [
    cookie(accessCookie, session.access_token, { maxAge: accessMaxAge, secure }),
    cookie(refreshCookie, session.refresh_token, { maxAge: 60 * 60 * 24 * 30, secure })
  ]
}

export function clearSessionCookies(secure) {
  const { accessCookie, refreshCookie } = authCookieNames(secure)
  return [
    cookie(accessCookie, '', { maxAge: 0, secure }),
    cookie(refreshCookie, '', { maxAge: 0, secure })
  ]
}
