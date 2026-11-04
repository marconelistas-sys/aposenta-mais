// Keep bookmarks and review links working when screens move: the monthly
// summary to Budget, the report to Panorama, the year to date to Panorama.
export function normalizePlanningHref(href, base = typeof window === 'undefined' ? 'http://localhost/' : window.location.href || 'http://localhost/') {
  const url = new URL(href, base)
  if (url.origin !== new URL(base).origin) return href
  const tab = url.searchParams.get('aba')
  if (url.pathname === '/fluxo-caixa' && tab === 'resumo') {
    url.pathname = '/orcamento'
  } else if (url.pathname === '/orcamento' && tab === 'mes') {
    url.searchParams.set('aba', 'resumo')
  } else if (url.pathname === '/relatorio') {
    // The PDF report became the Panorama screen; old links open its summary.
    url.pathname = '/panorama'
    url.search = ''
  } else if (url.pathname === '/orcamento' && tab === 'acumulado') {
    // The year-to-date analysis moved to the Panorama spending tab.
    url.pathname = '/panorama'
    url.searchParams.set('aba', 'gastos')
  } else {
    return href
  }
  return `${url.pathname}${url.search}${url.hash}`
}
