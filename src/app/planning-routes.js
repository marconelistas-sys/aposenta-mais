// Keep bookmarks and review links working when the monthly summary moves to Budget.
export function normalizePlanningHref(href, base = typeof window === 'undefined' ? 'http://localhost/' : window.location.href || 'http://localhost/') {
  const url = new URL(href, base)
  if (url.origin !== new URL(base).origin) return href
  const tab = url.searchParams.get('aba')
  if (url.pathname === '/fluxo-caixa' && tab === 'resumo') {
    url.pathname = '/orcamento'
  } else if (url.pathname === '/orcamento' && tab === 'mes') {
    url.searchParams.set('aba', 'resumo')
  } else {
    return href
  }
  return `${url.pathname}${url.search}${url.hash}`
}
