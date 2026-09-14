import { projectRetirementWithSchedules } from '../../domain/retirement.js'
import { calculateMultiCurrencyCashFlow, retirementContributionSchedules } from '../../domain/cash-flow.js'
import { state } from '../../app/state.js'
import { renderVariableContributions } from './variable-contributions.js'
import { renderPlanningOverview } from './planning-overview.js'
import { renderPlanChecks } from './plan-checks.js'
import { authState } from '../../app/auth-state.js'
import { syncState } from '../../app/sync-state.js'
import {
  formatCurrency,
  formatPercent,
  formatUpdateTime,
  privateCurrency
} from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { currencies } from '../../shared/currencies.js'
import { renderPremiumPromo } from '../premium/premium.js'
import { exchangeRate } from '../../shared/exchange-rates.js'
import { readinessGauge } from '../../shared/readiness-gauge.js'

function privacyLabel(value) {
  return state.valuesHidden ? 'Valor oculto' : formatCurrency(value, false, state.currency)
}

function currencySelector() {
  return `
    <label class="currency-selector">
      <span>Moeda do plano</span>
      <select data-currency aria-describedby="currency-help">
        ${Object.values(currencies).map((currency) => `
          <option value="${currency.code}" ${state.currency === currency.code ? 'selected' : ''}>${currency.code} · ${currency.symbol}</option>
        `).join('')}
      </select>
      <small id="currency-help">Totais convertidos para esta moeda</small>
    </label>
  `
}

function exchangeRatePanel() {
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })
    .format(new Date(`${state.exchangeRates.date}T00:00:00Z`))
  const otherCurrencies = Object.keys(currencies).filter((code) => code !== state.currency)
  return `
    <aside class="exchange-rate-panel" aria-label="Cotações usadas na conversão">
      <div>
        <span class="exchange-rate-panel__icon">${icon('refresh', 18)}</span>
        <div>
          <strong>Cotação de referência · ${date}</strong>
          <span>${state.exchangeRates.source}${state.exchangeRates.stale ? ' · última disponível' : ' · atualizada'}</span>
        </div>
      </div>
      <dl>
        ${otherCurrencies.map((code) => `
          <div><dt>1 ${code}</dt><dd>${exchangeRate(code, state.currency, state.exchangeRates).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${state.currency}</dd></div>
        `).join('')}
      </dl>
      <a href="${state.exchangeRates.sourceUrl}" target="_blank" rel="noreferrer">Consultar fonte</a>
    </aside>
  `
}

function privacyStatus() {
  const message = authState.authenticated && syncState.exists
    ? 'Cópia remota ativa, vinculada à sua conta.'
    : authState.authenticated
      ? 'Conta conectada. Seu plano continua somente neste dispositivo.'
      : 'Dados financeiros somente neste dispositivo.'
  const detail = authState.authenticated
    ? 'Criar ou entrar na conta não envia o plano financeiro.'
    : 'Use sem informar nome, CPF ou e-mail.'

  return `
    <aside class="privacy-status" aria-label="Estado de privacidade dos seus dados">
      <span class="privacy-status__icon">${icon('shield', 20)}</span>
      <div><strong>${message}</strong><span>${detail}</span></div>
      <a href="/privacidade" data-route>Como seus dados são protegidos</a>
    </aside>
  `
}

export function renderDashboard() {
  const schedules = retirementContributionSchedules(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
  const result = projectRetirementWithSchedules(state.plan, schedules)
  const cashFlow = calculateMultiCurrencyCashFlow(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    result.requiredMonthlyContribution,
    state.customCategories
  )
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)
  const heading = state.isDemo
    ? 'Veja se seu plano de aposentadoria cabe na sua vida.'
    : 'Seu plano familiar até a idade-alvo.'
  const budgetBalance = cashFlow.monthlyIncome - cashFlow.monthlyExpenses
  const investmentCount = state.plan.investments.length

  return `
    <section class="page-heading page-heading--dashboard">
      <div>
        <p class="eyebrow">VISÃO GERAL</p>
        <h1>${heading}</h1>
        <p>${state.isDemo ? 'Faça uma simulação gratuita e ajuste o orçamento sem criar conta.' : 'Confira se os recursos sustentam sua família até a data-alvo.'}</p>
      </div>
      <div class="dashboard-tools">
        ${currencySelector()}
        <div class="last-update">
          <span class="status-dot" aria-hidden="true"></span>
          Atualização: ${formatUpdateTime(state.lastUpdatedAt)}
        </div>
      </div>
    </section>

    <section class="metrics-grid" aria-label="Como você chegou aqui">
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--green">${icon('wallet', 21)}</div>
        <div>
          <p>Receitas e despesas hoje</p>
          <strong class="money-value" aria-label="${privacyLabel(budgetBalance)}">${money(budgetBalance)}</strong>
          <span>Saldo mensal do orçamento</span>
        </div>
        <a href="/fluxo-caixa" data-route aria-label="Ver receitas e despesas">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--blue">${icon('trendUp', 21)}</div>
        <div>
          <p>Investimentos hoje</p>
          <strong class="money-value" aria-label="${privacyLabel(state.plan.currentAssets)}">${money(state.plan.currentAssets)}</strong>
          <span>${investmentCount} ${investmentCount === 1 ? 'investimento cadastrado' : 'investimentos cadastrados'}</span>
        </div>
        <a href="/carteira" data-route aria-label="Ver investimentos">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--sand">${icon('calendar', 21)}</div>
        <div>
          <p>Meta de aposentadoria</p>
          <strong>${state.plan.retirementAge} anos</strong>
          <span>Renda desejada: <span class="money-value">${money(state.plan.targetMonthlyIncome)}</span></span>
        </div>
        <a href="/plano" data-route aria-label="Ver meta de aposentadoria">${icon('chevronRight', 19)}</a>
      </article>
    </section>

    <section class="dashboard-grid" aria-label="Impacto de longo prazo">
      ${renderPlanningOverview({ compact: true })}
      <div class="dashboard-side">
        ${readinessGauge({ progress: result.progress, hidden: state.valuesHidden })}
        <article class="panel confidence-card">
          <div class="confidence-card__icon">${icon('shield', 22)}</div>
          <div>
            <h3>Premissas visíveis e ajustáveis</h3>
            <p>Retorno real de ${formatPercent(state.plan.annualRealReturn)}, inflação de ${formatPercent(state.plan.annualInflation)} e retirada de ${formatPercent(state.plan.annualWithdrawalRate)} ao ano.</p>
          </div>
          <a href="/simulacoes" data-route aria-label="Ver premissas">${icon('chevronRight', 19)}</a>
        </article>
        <a class="button button--primary button--full" href="${state.isDemo ? '/fluxo-caixa' : '/plano'}" data-route>
          ${state.isDemo ? 'Calcular com meus dados' : 'Ajustar meu plano'} ${icon('arrowRight', 17)}
        </a>
      </div>
    </section>

    ${renderPlanChecks()}
    ${privacyStatus()}
    ${exchangeRatePanel()}
    <details class="panel settings-card"><summary>Revisar passo a passo e cadastros</summary><section aria-labelledby="start-guide"><h2 id="start-guide">Comece aqui</h2>
      <a class="button button--primary" href="/construir/objetivo" data-route>Continuar plano passo a passo</a>
      <p>${state.isDemo ? 'Os valores de demonstração são exemplos. Revise cada etapa com seus dados.' : 'Revise estas três etapas sempre que sua situação mudar.'}</p>
      <ol><li><a href="/simulacoes" data-route>Defina sua aposentadoria</a>: confira as idades e a renda desejada.</li><li><a href="/fluxo-caixa" data-route>Organize seu orçamento</a>: cadastre receitas, despesas e seus prazos. Veja a evolução mensal.</li><li><a href="/carteira" data-route>Revise seu patrimônio</a>: informe investimentos, aportes e rendimentos.</li></ol>
      <p>Carteira reúne investimentos. Fluxo de caixa reúne o orçamento. <a href="/contas" data-route>Contas e movimentos</a> acompanha saldos manuais sem somá-los automaticamente ao patrimônio.</p>
      <div class="wizard-actions"><a class="button button--secondary" href="/calendario" data-route>Vencimentos, dívidas e metas</a><a class="button button--secondary" href="/apos-aposentadoria" data-route>Projetar vida após aposentadoria</a></div>
      <div class="wizard-actions"><a class="button button--secondary" href="/consorcios" data-route>Consórcios e posição vinculada</a><a class="button button--secondary" href="/riscos" data-route>Patrimônio líquido, Monte Carlo e matriz de risco</a></div>
      <div class="wizard-actions"><a class="button button--secondary" href="/patrimonio" data-route>Ver patrimônio consolidado (contas, imóveis e dívidas)</a></div>
    </section>
    </details>

    ${renderPremiumPromo({ compact: true })}
    ${renderVariableContributions()}
  `
}
