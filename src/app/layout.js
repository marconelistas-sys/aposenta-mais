import { state } from './state.js'
import { icon } from '../shared/icons.js'
import { authState } from './auth-state.js'
import { escapeHtml } from '../shared/formatters.js'
import { syncState } from './sync-state.js'
import { isLocalPlanOpen } from './local-access.js'

import { primaryNavigation as navigation, additionalNavigation, groupedNavigation } from './navigation.js'

const mobileNavigation = [
  navigation[0],
  navigation[2],
  navigation[3],
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
      ${icon(item.icon, mobile ? 21 : 18)}
      <span>${item.label}</span>
    </a>
  `
}

function fullNavigation(pathname) {
  const current = [...navigation, ...additionalNavigation].find(item => item.href === pathname)
  const group = (title, items) => `<section><h2>${title}</h2>${items.map(item => `<a href="${item.href}" data-route ${item.href === pathname ? 'aria-current="page"' : ''}>${icon(item.icon, 20)}<span>${item.label}</span>${item.href === pathname ? '<small>Atual</small>' : ''}</a>`).join('')}</section>`
  return `<details class="navigation-menu" data-navigation-menu><summary aria-label="Menu de navegação">${icon('menu', 22)}<span>Menu</span></summary><nav class="navigation-menu-panel" aria-label="Todas as telas"><p>Você está em: <strong>${current?.label || 'Planejamento'}</strong></p><div class="navigation-menu-groups">${groupedNavigation().map(item => group(item.title, item.items)).join('')}</div></nav></details>`
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
  if (!isLocalPlanOpen() || pathname === '/inicio') return `<header class="app-header"><div class="app-header__inner">${logo()}<nav aria-label="Acesso"><a href="/inicio" data-route>Início</a> · ${authState.authenticated ? '<button type="button" class="button button--secondary" data-auth-logout>Sair da conta</button>' : '<a href="/entrar" data-route>Entrar</a>'} · <a href="/privacidade" data-route>Privacidade</a></nav></div></header><main id="conteudo" class="page-shell" tabindex="-1">${content}</main>`
  const visibilityLabel = state.valuesHidden ? 'Mostrar valores' : 'Ocultar valores'
  const visibilityIcon = state.valuesHidden ? 'eyeOff' : 'eye'
  const accountLabel = authState.authenticated
    ? escapeHtml(authState.user?.email || 'Conta conectada')
    : 'Entrar'
  const footerDataMessage = authState.authenticated && syncState.exists
    ? (authState.storageProvider || authState.provider) === 'local' ? 'Cópia no banco deste computador. Atualize, restaure ou exclua em Perfil e dados.' : 'Cópia remota ativa. Gerencie ou exclua em Perfil e dados.'
    : 'Plano salvo neste navegador. Sem envio financeiro automático.'

  return `
    <header class="app-header">
      <div class="app-header__inner">
        ${logo()}

        <nav class="main-nav" aria-label="Navegação principal">
          ${navigation.map((item) => navigationLink(item, pathname)).join('')}
        </nav>

        <div class="header-actions">
          ${fullNavigation(pathname)}
          <button type="button" class="icon-button" data-close-local aria-label="Fechar plano local" title="Fechar plano local">${icon('lock', 20)}</button>
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
          ${authState.authenticated ? `
            <button class="icon-button" type="button" data-auth-logout aria-label="Sair da conta" title="Sair da conta">${icon('logout', 19)}</button>
            <a class="avatar" href="/perfil" data-route aria-label="Abrir perfil de ${accountLabel}">AP</a>
          ` : `
            <a class="auth-entry" href="/entrar" data-route>${accountLabel}</a>
            ${authState.configured === false ? '' : '<a class="account-cta" href="/cadastro" data-route data-product-event="create_account_click">Criar conta</a>'}
          `}
        </div>
      </div>
    </header>

    ${state.isDemo && !state.dataDeleted ? `
      <aside class="demo-banner" aria-label="Modo de demonstração">
        ${icon('info', 18)}
        <span>Demonstração ativa. Use sem informar nome, CPF ou e-mail.</span>
        <a href="/simulacoes" data-route>Montar meu plano</a>
      </aside>
    ` : ''}

    <main id="conteudo" class="page-shell" tabindex="-1">
      ${content}
    </main>

    <footer class="app-footer">
      <div class="app-footer__inner">
        <div class="footer-trust">
          ${icon('shield', 17)}
          <span>${footerDataMessage}</span>
        </div>
        <p>Estimativas para planejamento. Valores futuros não são garantidos.</p>
        <a href="/privacidade" data-route>Privacidade e dados</a>
      </div>
    </footer>

    <nav class="mobile-nav" aria-label="Navegação no celular">
      ${mobileNavigation.map((item) => navigationLink(item, pathname, true)).join('')}
    </nav>
  `
}
