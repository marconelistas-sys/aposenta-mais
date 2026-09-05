import { projectAssetSeriesWithSchedules, projectRetirementWithSchedules, retirementMonths } from '../../domain/retirement.js'
import { calculateMultiCurrencyCashFlow, retirementContributionSchedules } from '../../domain/cash-flow.js'
import { state } from '../../app/state.js'
import { renderVariableContributions } from './variable-contributions.js'
import { renderPlanChecks } from './plan-checks.js'
import { authState } from '../../app/auth-state.js'
import { syncState } from '../../app/sync-state.js'
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatUpdateTime,
  privateCurrency
} from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { currencies, currencySymbol } from '../../shared/currencies.js'
import { renderPremiumPromo } from '../premium/premium.js'
import { exchangeRate } from '../../shared/exchange-rates.js'

const chartRanges = {
  five: { label: '5 anos', years: 5 },
  ten: { label: '10 anos', years: 10 },
  retirement: { label: 'Até a aposentadoria', years: null }
}

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

function niceMaximum(value) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  return Math.ceil(value / magnitude) * magnitude
}

function chartMarkup(plan, schedules) {
  const selected = chartRanges[state.activeChartRange] || chartRanges.retirement
  const totalYears = retirementMonths(plan) / 12
  const years = selected.years ? Math.min(selected.years, totalYears) : totalYears
  const series = projectAssetSeriesWithSchedules(plan, schedules, years)
  const maximum = niceMaximum(Math.max(...series.map((point) => point.assets), 1))
  const points = series.map((point, index) => {
    const x = 88 + 512 * point.year / Math.max(years, 1 / 12)
    const y = 198 - (176 * point.assets) / maximum
    return { ...point, x, y }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const lastPoint = points.at(-1)
  const endValue = lastPoint.assets
  const currentYear = new Date().getFullYear()

  return `
    <div class="chart chart--patrimony" role="img" aria-label="${state.valuesHidden ? `Projeção calculada de patrimônio em ${years} anos. Valores ocultos.` : `Projeção calculada de patrimônio de ${formatCurrency(plan.currentAssets, false, state.currency)} até ${formatCurrency(endValue, false, state.currency)} em ${years} anos.`}">
      <svg class="chart__svg" viewBox="0 0 620 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#58a481" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#58a481" stop-opacity="0.01" />
          </linearGradient>
        </defs>
        <g class="chart__grid">
          <line x1="88" y1="22" x2="600" y2="22" />
          <line x1="88" y1="80.7" x2="600" y2="80.7" />
          <line x1="88" y1="139.3" x2="600" y2="139.3" />
          <line x1="88" y1="198" x2="600" y2="198" />
        </g>
        <g class="chart__labels">
          <text x="78" y="25">${state.valuesHidden ? '•••' : formatCompactCurrency(maximum, state.currency)}</text>
          <text x="78" y="84">${state.valuesHidden ? '•••' : formatCompactCurrency(maximum * 0.66, state.currency)}</text>
          <text x="78" y="143">${state.valuesHidden ? '•••' : formatCompactCurrency(maximum * 0.33, state.currency)}</text>
          <text x="78" y="202">${currencySymbol(state.currency)} 0</text>
          <text x="88" y="226" text-anchor="start">Hoje</text>
          <text x="344" y="226" text-anchor="middle">${currentYear + Math.round(years / 2)}</text>
          <text x="600" y="226" text-anchor="end">${currentYear + years}</text>
        </g>
        <path class="chart__area" vector-effect="non-scaling-stroke" d="${path} L${lastPoint.x.toFixed(2)} 198 L88 198 Z" />
        <path class="chart__line" vector-effect="non-scaling-stroke" d="${path}" />
        <circle class="chart__point" vector-effect="non-scaling-stroke" cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="5" />
        <circle class="chart__point-ring" vector-effect="non-scaling-stroke" cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="9" />
      </svg>
    </div>
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
  const incomeProgress = state.plan.targetMonthlyIncome === 0
    ? 1
    : Math.min(Math.max(result.projectedMonthlyIncome / state.plan.targetMonthlyIncome, 0), 1)
  const investmentIncome = result.projectedInvestmentIncome
  const expectedYear = state.plan.retirementMonth ? Number(state.plan.retirementMonth.slice(0, 4)) : new Date().getFullYear() + (state.plan.retirementAge - state.plan.currentAge)
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)
  const visibleMoney = (value) => formatCurrency(value, false, state.currency)
  const heading = state.isDemo
    ? 'Veja se seu plano de aposentadoria cabe na sua vida.'
    : `Seu plano cobre ${formatPercent(incomeProgress)} da renda desejada.`

  return `
    <section class="page-heading page-heading--dashboard">
      <div>
        <p class="eyebrow">VISÃO GERAL</p>
        <h1>${heading}</h1>
        <p>${state.isDemo ? 'Faça uma simulação gratuita e ajuste o orçamento sem criar conta.' : 'Veja o ajuste com maior impacto no seu objetivo.'}</p>
      </div>
      <div class="dashboard-tools">
        ${currencySelector()}
        <div class="last-update">
          <span class="status-dot" aria-hidden="true"></span>
          Atualização: ${formatUpdateTime(state.lastUpdatedAt)}
        </div>
      </div>
    </section>

    <section class="panel settings-card" aria-labelledby="start-guide"><h2 id="start-guide">Comece aqui</h2>
      <a class="button button--primary" href="/construir/objetivo" data-route>Continuar plano passo a passo</a>
      <p>${state.isDemo ? 'Os valores de demonstração são exemplos. Revise cada etapa com seus dados.' : 'Revise estas três etapas sempre que sua situação mudar.'}</p>
      <ol><li><a href="/simulacoes" data-route>Defina sua aposentadoria</a>: confira as idades e a renda desejada.</li><li><a href="/fluxo-caixa" data-route>Organize seu orçamento</a>: cadastre receitas, despesas e seus prazos. Veja a evolução mensal.</li><li><a href="/carteira" data-route>Revise seu patrimônio</a>: informe investimentos, aportes e rendimentos.</li></ol>
      <p>Carteira reúne investimentos. Fluxo de caixa reúne o orçamento. <a href="/contas" data-route>Contas e movimentos</a> acompanha saldos manuais sem somá-los automaticamente ao patrimônio.</p>
    </section>
    <section class="dashboard-top" aria-label="Resumo do plano">
      <article class="income-card">
        <div class="income-card__topline">
          <span>Renda mensal estimada</span>
          <span class="income-card__badge">Em valores de hoje</span>
        </div>
        <div class="income-card__amount money-value" aria-label="${privacyLabel(result.projectedMonthlyIncome)}">
          ${money(result.projectedMonthlyIncome)}
          <small>por mês</small>
        </div>
        <div class="income-card__goal-row">
          <span>Meta: <strong class="money-value">${money(state.plan.targetMonthlyIncome)}</strong></span>
          <strong>${formatPercent(incomeProgress)} alcançado</strong>
        </div>
        <div
          class="progress-track progress-track--light"
          role="progressbar"
          aria-label="Progresso da renda mensal"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${Math.round(incomeProgress * 100)}"
        >
          <span style="width: ${incomeProgress * 100}%"></span>
        </div>
        <div class="income-card__footer">
          <span>${icon(result.goalReached ? 'check' : 'trendUp', 18)} ${result.goalReached ? 'Meta coberta pelas premissas atuais' : `Lacuna mensal de ${visibleMoney(Math.max(result.monthlyIncomeGap, 0))}`}</span>
          <div class="income-card__actions">
            <a class="button button--light" href="${state.isDemo ? '/fluxo-caixa' : '/plano'}" data-route>
              ${state.isDemo ? 'Calcular com meus dados' : 'Ajustar meu plano'} ${icon('arrowRight', 17)}
            </a>
            <a class="text-link text-link--light" href="/simulacoes" data-route>Ver como calculamos</a>
          </div>
        </div>
      </article>
    </section>

    ${privacyStatus()}

    ${exchangeRatePanel()}

    <section class="metrics-grid" aria-label="Indicadores do plano">
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--green">${icon('calendar', 21)}</div>
        <div>
          <p>Previsão de aposentadoria</p>
          <strong>Setembro de ${expectedYear}</strong>
          <span>${state.plan.retirementMonth ? `Em ${state.plan.retirementMonth}` : `Aos ${state.plan.retirementAge} anos`}</span>
        </div>
        <a href="/plano" data-route aria-label="Ver previsão de aposentadoria">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--blue">${icon('wallet', 21)}</div>
        <div>
          <p>Patrimônio projetado</p>
          <strong class="money-value">${money(result.projectedAssets)}</strong>
          <span>Em valores de hoje</span>
        </div>
        <a href="/plano" data-route aria-label="Ver patrimônio projetado">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--green">${icon('wallet', 21)}</div>
        <div>
          <p>Aporte sustentável</p>
          <strong class="money-value">${money(cashFlow.sustainableContribution)}</strong>
          <span>${cashFlow.isDeficit ? 'Revise o déficit mensal' : 'Após despesas e reserva'}</span>
        </div>
        <a href="/fluxo-caixa" data-route aria-label="Ver fluxo de caixa">${icon('chevronRight', 19)}</a>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel projection-panel">
        <div class="panel__header panel__header--responsive">
          <div>
            <p class="eyebrow">SUA EVOLUÇÃO</p>
            <h2>Patrimônio ao longo do tempo</h2>
          </div>
          <div class="segmented-control" aria-label="Período do gráfico">
            ${Object.entries(chartRanges).map(([key, range]) => `
              <button
                type="button"
                data-chart-range="${key}"
                class="${state.activeChartRange === key ? 'is-active' : ''}"
                aria-pressed="${state.activeChartRange === key}"
              >${range.label}</button>
            `).join('')}
          </div>
        </div>
        ${chartMarkup(state.plan, schedules)}
        <div class="chart-insight">
          <span class="chart-insight__icon">${icon('trendUp', 18)}</span>
          <p>Mantendo seu plano e as contribuições previdenciárias, você pode chegar a <strong class="money-value">${money(result.projectedAssets)}</strong> em valores de hoje.</p>
        </div>
      </article>

      <div class="dashboard-side">
        <article class="panel income-sources">
          <div class="panel__header">
            <div>
              <p class="eyebrow">COMPOSIÇÃO</p>
              <h2>De onde virá sua renda</h2>
            </div>
            ${icon('pie', 20, 'panel__header-icon')}
          </div>
          <div class="income-sources__content">
            <div class="donut" style="--first-share: ${result.projectedMonthlyIncome > 0 ? Math.min(Math.round((state.plan.expectedMonthlyBenefit / result.projectedMonthlyIncome) * 100), 100) : 0}%" role="img" aria-label="Distribuição entre benefício e investimentos">
              <div>
                <span>Total</span>
                <strong class="money-value">${money(result.projectedMonthlyIncome)}</strong>
              </div>
            </div>
            <ul class="source-list">
              <li>
                <span class="source-dot source-dot--inss"></span>
                <div><span>Benefício estimado</span><strong class="money-value">${money(state.plan.expectedMonthlyBenefit)}</strong></div>
              </li>
              <li>
                <span class="source-dot source-dot--investments"></span>
                <div><span>Renda mensal retirada do patrimônio</span><strong class="money-value">${money(investmentIncome)}</strong></div>
              </li>
            </ul>
          </div>
          <a class="button button--secondary button--full" href="/plano" data-route>Revisar fontes de renda</a>
        </article>

        <article class="panel confidence-card">
          <div class="confidence-card__icon">${icon('shield', 22)}</div>
          <div>
            <h3>Premissas visíveis e ajustáveis</h3>
            <p>Retorno real de ${formatPercent(state.plan.annualRealReturn)}, inflação de ${formatPercent(state.plan.annualInflation)} e retirada de ${formatPercent(state.plan.annualWithdrawalRate)} ao ano.</p>
          </div>
          <a href="/simulacoes" data-route aria-label="Ver premissas">${icon('chevronRight', 19)}</a>
        </article>
      </div>
    </section>

    ${renderPremiumPromo({ compact: true })}
    ${renderPlanChecks()}
    ${renderVariableContributions()}
  `
}
