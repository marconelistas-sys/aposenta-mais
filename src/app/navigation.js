export const primaryNavigation = [
  { href: '/', label: 'Visão geral', icon: 'home' },
  { href: '/panorama', label: 'Panorama', icon: 'book', tab: 'resumo' },
  { href: '/orcamento', label: 'Orçamento', mobileLabel: 'Orçamento', icon: 'calendar', tab: 'resumo' },
  { href: '/carteira', label: 'Carteira', icon: 'wallet' },
  { href: '/patrimonio', label: 'Patrimônio', icon: 'building' },
  { href: '/plano', label: 'Meu plano', icon: 'target' },
  { href: '/fluxo-caixa', label: 'Projeção patrimonial', mobileLabel: 'Projeção', icon: 'trendUp', tab: 'anual' }
]
export const additionalNavigation = [
  { href: '/contas', label: 'Contas e movimentos', icon: 'bank' },
  { href: '/extratos', label: 'Extratos bancários', icon: 'document' },
  { href: '/calendario', label: 'Calendário e dívidas', icon: 'calendar' },
  { href: '/consorcios', label: 'Consórcios', icon: 'building' },
  { href: '/objetivos', label: 'Objetivos e confiança', icon: 'target' },
  { href: '/simulacoes', label: 'Simulações', icon: 'calculator' },
  { href: '/viabilidade', label: 'Viabilidade do plano', icon: 'check' },
  { href: '/apos-aposentadoria', label: 'Após aposentadoria', icon: 'clock' },
  { href: '/riscos', label: 'Riscos anuais', icon: 'trendUp' },
  { href: '/riscos-mensais', label: 'Liquidez mensal', icon: 'calendar' },
  { href: '/cambio', label: 'Câmbio', icon: 'transfer' },
  { href: '/perfil', label: 'Perfil e dados', icon: 'user' },
  { href: '/privacidade', label: 'Privacidade', icon: 'shield' }
]

// The full menu separates reading the situation (Entender) from the screens
// that enter and adjust values (docs/product/panorama-financeiro.md).
export const navigationGroups = [
  { title: 'Entender', hrefs: ['/', '/panorama'] },
  { title: 'Lançar e ajustar', hrefs: ['/orcamento', '/contas', '/extratos', '/calendario', '/carteira', '/patrimonio', '/consorcios'] },
  { title: 'Planejar e simular', hrefs: ['/plano', '/objetivos', '/fluxo-caixa', '/simulacoes', '/viabilidade', '/apos-aposentadoria'] },
  { title: 'Riscos', hrefs: ['/riscos', '/riscos-mensais', '/cambio'] },
  { title: 'Conta e privacidade', hrefs: ['/perfil', '/privacidade'] }
]

// Bottom bar on phones: the two reading screens and the two most used entry screens.
export const mobileNavigationHrefs = ['/', '/panorama', '/orcamento', '/carteira']

export function groupedNavigation() {
  const all = [...primaryNavigation, ...additionalNavigation]
  const byHref = new Map(all.map(item => [item.href, item]))
  const groups = navigationGroups.map(group => ({ title: group.title, items: group.hrefs.map(href => byHref.get(href)).filter(Boolean) }))
  const grouped = new Set(navigationGroups.flatMap(group => group.hrefs))
  const rest = all.filter(item => !grouped.has(item.href))
  return rest.length ? [...groups, { title: 'Outras telas', items: rest }] : groups
}

export function bindNavigationMenu(root) {
  const close = focus => {
    const menu = root.querySelector('[data-navigation-menu][open]')
    if (!menu) return
    menu.open = false
    if (focus) menu.querySelector('summary')?.focus()
  }
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.querySelector('[data-navigation-menu][open]')) { close(true); event.preventDefault() }
  })
  root.addEventListener('click', event => {
    const menu = root.querySelector('[data-navigation-menu][open]')
    if (menu && (!menu.contains(event.target) || event.target.closest('[data-route]'))) close(false)
  })
  root.addEventListener('focusin', event => {
    const menu = root.querySelector('[data-navigation-menu][open]')
    if (menu && !menu.contains(event.target)) close(false)
  })
}
