import { authState } from '../../app/auth-state.js'
import { icon } from '../../shared/icons.js'

const benefits = [
  { icon: 'wallet', title: 'Orçamento da casa e saldos individuais' },
  { icon: 'target', title: 'Metas conjuntas e cenários lado a lado' },
  { icon: 'shield', title: 'Convites e permissões por pessoa' }
]

function benefitsMarkup(className = 'premium-benefits') {
  return `
    <ul class="${className}">
      ${benefits.map((benefit) => `
        <li>${icon(benefit.icon, 18)}<span>${benefit.title}</span></li>
      `).join('')}
    </ul>
  `
}

function householdPreview() {
  return `
    <div class="household-preview" aria-label="Prévia ilustrativa do painel financeiro da casa">
      <div class="household-preview__header">
        <div>
          <span>PAINEL DA CASA</span>
          <strong>Uma visão compartilhada</strong>
        </div>
        <div class="household-preview__people" aria-label="Dois acessos individuais">
          <span>V</span><span>P</span>
        </div>
      </div>
      <div class="household-preview__metrics" aria-hidden="true">
        <div><span>Orçamento mensal</span><strong>Organizado</strong></div>
        <div><span>Meta do casal</span><strong>Em construção</strong></div>
        <div><span>Decisões</span><strong>Compartilhadas</strong></div>
      </div>
      <div class="household-preview__progress" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <p>${icon('lock', 15)} Conceito em desenvolvimento. Nenhum compartilhamento está ativo.</p>
    </div>
  `
}

function unavailableRegistration() {
  return `
    <p class="premium-unavailable" role="status">
      O cadastro está temporariamente indisponível. Você pode continuar seu planejamento neste dispositivo.
    </p>
  `
}

export function renderPremiumPromo({ compact = false } = {}) {
  if (authState.authenticated || authState.configured === false) return ''

  return `
    <section
      class="premium-promo${compact ? ' premium-promo--compact' : ''}"
      aria-labelledby="premium-promo-title"
      data-premium-promo
      data-product-impression="couple_promo_view"
    >
      <div class="premium-promo__content">
        <div class="premium-label-row">
          <p class="eyebrow">PLANEJAMENTO A DOIS</p>
          <span class="premium-badge">Premium em breve</span>
        </div>
        <h2 id="premium-promo-title">Uma visão da casa para decisões dos dois.</h2>
        <p>A proposta reúne orçamento e metas em um painel compartilhado. Cada pessoa terá acesso separado e escolherá o que compartilhar.</p>
        ${compact ? '' : benefitsMarkup()}
        <div class="premium-actions">
          <a class="button button--primary" href="/premium" data-route data-product-event="premium_view">Ver prévia do painel do casal</a>
        </div>
        <p class="premium-trust">${icon('shield', 16)} Premium em planejamento. Nenhum compartilhamento está ativo nesta versão.</p>
      </div>
      ${householdPreview()}
    </section>
  `
}

export function renderPremium() {
  const canRegister = authState.configured !== false
  const primaryAction = authState.authenticated
    ? '<a class="button button--primary button--large" href="/perfil" data-route>Voltar ao meu perfil</a>'
    : canRegister
      ? '<a class="button button--primary button--large" href="/cadastro" data-route data-product-event="create_account_click">Criar conta grátis</a>'
      : unavailableRegistration()

  return `
    <section class="premium-page" data-product-impression="premium_view">
      <div class="premium-hero">
        <div class="premium-hero__content">
          <span class="premium-badge">Prévia do Aposenta+ Premium</span>
          <p class="eyebrow">FINANÇAS DA CASA</p>
          <h1>Finanças da casa, decisões dos dois.</h1>
          <p>A proposta prevê uma visão compartilhada do orçamento e das metas, com acesso separado para cada pessoa.</p>
          <div class="premium-actions">
            ${primaryAction}
            ${!authState.authenticated && canRegister ? '<a class="button button--secondary button--large" href="/entrar" data-route>Já tenho uma conta</a>' : ''}
          </div>
          <p class="premium-trust">${icon('shield', 16)} Criar a conta envia dados de acesso ao Supabase, mas não envia seu plano financeiro.</p>
        </div>
        ${householdPreview()}
      </div>

      <section class="premium-feature-section" aria-labelledby="premium-benefits-title">
        <div class="section-title-row">
          <div>
            <p class="eyebrow">PROPOSTA PREMIUM</p>
            <h2 id="premium-benefits-title">Planejamento conjunto, com limites claros.</h2>
          </div>
          <span>Recursos planejados</span>
        </div>
        <div class="premium-feature-grid">
          ${benefits.map((benefit) => `
            <article class="panel premium-feature-card">
              <span>${icon(benefit.icon, 22)}</span>
              <h3>${benefit.title}</h3>
              <p>${benefit.icon === 'wallet'
                ? 'A proposta permitirá acompanhar o que é da casa sem perder a leitura individual.'
                : benefit.icon === 'target'
                  ? 'Será possível comparar objetivos e impactos no futuro financeiro dos dois.'
                  : 'As regras de convite, permissão e revogação ainda serão definidas.'}</p>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="premium-plans" aria-labelledby="premium-plans-title">
        <div>
          <p class="eyebrow">CONTA E ASSINATURA</p>
          <h2 id="premium-plans-title">Comece grátis. Avalie o Premium quando estiver disponível.</h2>
          <p>Preço, cobrança e período de teste ainda não foram definidos. Nenhuma assinatura será iniciada nesta versão.</p>
        </div>
        <div class="premium-plan-grid">
          <article class="panel premium-plan-card">
            <span class="premium-plan-card__status">Disponível agora</span>
            <h3>Conta gratuita</h3>
            <ul>
              <li>${icon('check', 17)} Plano individual e orçamento mensal</li>
              <li>${icon('check', 17)} Simulações e cenários</li>
              <li>${icon('check', 17)} Cópia remota manual e consentida</li>
            </ul>
          </article>
          <article class="panel premium-plan-card premium-plan-card--featured">
            <span class="premium-plan-card__status">Em breve</span>
            <h3>Premium familiar</h3>
            <ul>
              <li>${icon('check', 17)} Dashboard financeiro da casa</li>
              <li>${icon('check', 17)} Metas e cenários do casal</li>
              <li>${icon('check', 17)} Convites e permissões por pessoa</li>
            </ul>
          </article>
        </div>
      </section>
    </section>
  `
}
