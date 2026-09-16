export const primaryNavigation = [
  { href: '/', label: 'Visão geral', icon: 'home' },
  { href: '/plano', label: 'Meu plano', icon: 'target' },
  { href: '/carteira', label: 'Carteira', icon: 'wallet' },
  { href: '/fluxo-caixa', label: 'Fluxo de caixa', icon: 'transfer' },
  { href: '/simulacoes', label: 'Simulações', icon: 'calculator' },
  { href: '/conteudos', label: 'Conteúdos', icon: 'book' },
  { href: '/patrimonio', label: 'Patrimônio', icon: 'building' }
]
export const additionalNavigation = [
  { href: '/orcamento', label: 'Orçamento', icon: 'wallet' },
  { href: '/contas', label: 'Contas e movimentos', icon: 'bank' },
  { href: '/extratos', label: 'Extratos bancários', icon: 'document' },
  { href: '/calendario', label: 'Calendário e dívidas', icon: 'calendar' },
  { href: '/consorcios', label: 'Consórcios', icon: 'building' },
  { href: '/viabilidade', label: 'Viabilidade do plano', icon: 'check' },
  { href: '/apos-aposentadoria', label: 'Após aposentadoria', icon: 'clock' },
  { href: '/riscos', label: 'Riscos anuais', icon: 'trendUp' },
  { href: '/riscos-mensais', label: 'Liquidez mensal', icon: 'calendar' },
  { href: '/cambio', label: 'Câmbio', icon: 'transfer' },
  { href: '/perfil', label: 'Perfil e dados', icon: 'user' },
  { href: '/privacidade', label: 'Privacidade', icon: 'shield' }
]

// The full menu groups every screen by the task the person wants to do.
export const navigationGroups = [
  { title: 'Planejar', hrefs: ['/', '/plano', '/simulacoes', '/viabilidade', '/apos-aposentadoria'] },
  { title: 'Patrimônio e investimentos', hrefs: ['/carteira', '/patrimonio', '/consorcios', '/cambio'] },
  { title: 'Dinheiro do dia a dia', hrefs: ['/fluxo-caixa', '/orcamento', '/contas', '/extratos', '/calendario'] },
  { title: 'Riscos', hrefs: ['/riscos', '/riscos-mensais'] },
  { title: 'Conta e aprendizado', hrefs: ['/conteudos', '/perfil', '/privacidade'] }
]

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
