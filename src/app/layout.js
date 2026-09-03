import { state } from './state.js'
import { icon } from '../shared/icons.js'

const navigation = [
  { href: '/', label: 'Visão geral', icon: 'home' },
  { href: '/plano', label: 'Meu plano', icon: 'target' },
  { href: '/simulacoes', label: 'Simulações', icon: 'calculator' },
  { href: '/conteudos', label: 'Conteúdos', icon: 'book' }
]

const mobileNavigation = [
  ...navigation.slice(0, 3),
  { href: '/perfil', label: 'Perfil', icon: 'user' }
]

function navigationLink(item, pathname, mobile = false) {
  const active = pathname === item.href
  return `
    <a
      class="${mobile ? 'mobile-nav__link' : 'main-nav__link'}${active ? ' is-active' : ''}"
      href="${item.href}"
      data-route
      ${active ? 'aria-current="page"' : ''}
    >
      ${mobile ? icon(item.icon, 21) : ''}
      <span>${item.label}</span>
    </a>
  `
}

export function logo() {
  return `
    <a class="brand" href="/" data-route aria-label="Aposenta+, página inicial">
      <span class="brand__mark" aria-hidden="true">
        <span class="brand__letter">A</span><span class="brand__plus">+</span>
      </span>
      <span class="brand__name">Aposenta<span>+</span></span>
    </a>
  `
}

export function appLayout(content, pathname) {
  const visibilityLabel = state.valuesHidden ? 'Mostrar valores' : 'Ocultar valores'
  const visibilityIcon = state.valuesHidden ? 'eyeOff' : 'eye'

  return `
    <header class="app-header">
      <div class="app-header__inner">
        ${logo()}

        <nav class="main-nav" aria-label="Navegação principal">
          ${navigation.map((item) => navigationLink(item, pathname)).join('')}
        </nav>

        <div class="header-actions">
          <button
            class="icon-button values-toggle"
            type="button"
            data-toggle-values
            aria-label="${visibilityLabel}"
            title="${visibilityLabel}"
            aria-pressed="${state.valuesHidden}"
          >
            ${icon(visibilityIcon, 20)}
          </button>
          <button
            class="icon-button notification-button"
            type="button"
            data-notifications
            aria-label="Ver notificações"
          >
            ${icon('bell', 20)}
            <span class="notification-dot" aria-hidden="true"></span>
          </button>
          <a class="avatar" href="/perfil" data-route aria-label="Abrir perfil do plano">
            AP
          </a>
        </div>
      </div>
    </header>

    ${state.isDemo ? `
      <aside class="demo-banner" aria-label="Modo de demonstração">
        ${icon('info', 18)}
        <span>Você está vendo dados de demonstração.</span>
        <a href="/simulacoes" data-route>Inserir meus dados</a>
      </aside>
    ` : ''}

    <main id="conteudo" class="page-shell" tabindex="-1">
      ${content}
    </main>

    <footer class="app-footer">
      <div class="app-footer__inner">
        <div class="footer-trust">
          ${icon('shield', 17)}
          <span>Seus dados ficam neste dispositivo.</span>
        </div>
        <p>Estimativas para planejamento. Valores futuros não são garantidos.</p>
        <a href="/perfil" data-route>Privacidade e dados</a>
      </div>
    </footer>

    <nav class="mobile-nav" aria-label="Navegação no celular">
      ${mobileNavigation.map((item) => navigationLink(item, pathname, true)).join('')}
    </nav>
  `
}
