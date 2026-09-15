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
