import { projectAssetSeries, projectRetirement } from '../../domain/retirement.js'
import { state } from '../../app/state.js'
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatUpdateTime,
  privateCurrency
} from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

const chartRanges = {
  five: { label: '5 anos', years: 5 },
  ten: { label: '10 anos', years: 10 },
  retirement: { label: 'Até a aposentadoria', years: null }
}

function privacyLabel(value) {
  return state.valuesHidden ? 'Valor oculto' : formatCurrency(value)
}

function chartMarkup(plan) {
  const selected = chartRanges[state.activeChartRange] || chartRanges.retirement
  const totalYears = plan.retirementAge - plan.currentAge
  const years = selected.years ? Math.min(selected.years, totalYears) : totalYears
  const series = projectAssetSeries(plan, years)
  const maximum = Math.max(...series.map((point) => point.assets), 1)
  const points = series.map((point, index) => {
    const x = 18 + (556 * index) / Math.max(series.length - 1, 1)
    const y = 194 - (174 * point.assets) / maximum
    return { ...point, x, y }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const lastPoint = points.at(-1)
  const endValue = lastPoint.assets
  const currentYear = new Date().getFullYear()

  return `
    <div class="chart" role="img" aria-label="${state.valuesHidden ? `Projeção calculada de patrimônio em ${years} anos. Valores ocultos.` : `Projeção calculada de patrimônio de ${formatCurrency(plan.currentAssets)} até ${formatCurrency(endValue)} em ${years} anos.`}">
      <div class="chart__y-axis" aria-hidden="true">
        <span>${formatCompactCurrency(maximum)}</span>
        <span>${formatCompactCurrency(maximum * 0.66)}</span>
        <span>${formatCompactCurrency(maximum * 0.33)}</span>
        <span>R$ 0</span>
      </div>
      <svg class="chart__svg" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#58a481" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#58a481" stop-opacity="0.01" />
          </linearGradient>
        </defs>
        <g class="chart__grid">
          <line x1="18" y1="20" x2="580" y2="20" />
          <line x1="18" y1="78" x2="580" y2="78" />
          <line x1="18" y1="136" x2="580" y2="136" />
          <line x1="18" y1="194" x2="580" y2="194" />
        </g>
        <path class="chart__area" d="${path} L${lastPoint.x.toFixed(2)} 194 L18 194 Z" />
        <path class="chart__line" d="${path}" />
        <circle class="chart__point" cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="5" />
        <circle class="chart__point-ring" cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="9" />
      </svg>
      <div class="chart__x-axis" aria-hidden="true">
        <span>Hoje</span>
        <span>${currentYear + Math.round(years / 2)}</span>
        <span>${currentYear + years}</span>
      </div>
    </div>
  `
}

export function renderDashboard() {
  const result = projectRetirement(state.plan)
  const incomeProgress = state.plan.targetMonthlyIncome === 0
    ? 1
    : Math.min(Math.max(result.projectedMonthlyIncome / state.plan.targetMonthlyIncome, 0), 1)
  const investmentIncome = result.projectedInvestmentIncome
  const expectedYear = new Date().getFullYear() +
    (state.plan.retirementAge - state.plan.currentAge)
  const increase = Math.max(0, Math.min(200, 4000 - state.plan.monthlyContribution))
  const canUseQuickAdjustment = increase > 0

  return `
    <section class="page-heading page-heading--dashboard">
      <div>
        <p class="eyebrow">SEU FUTURO FINANCEIRO</p>
        <h1>${result.goalReached ? 'Sua meta está coberta neste cenário.' : 'Seu plano mostra o próximo ajuste.'}</h1>
        <p>Veja o que mudou e qual é o próximo passo para a sua meta.</p>
      </div>
      <div class="last-update">
        <span class="status-dot" aria-hidden="true"></span>
        Atualização: ${formatUpdateTime(state.lastUpdatedAt)}
      </div>
    </section>

    <section class="dashboard-top" aria-label="Resumo do plano">
      <article class="income-card">
        <div class="income-card__topline">
          <span>Renda mensal estimada</span>
          <span class="income-card__badge">Em valores de hoje</span>
        </div>
        <div class="income-card__amount money-value" aria-label="${privacyLabel(result.projectedMonthlyIncome)}">
          ${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden)}
          <small>por mês</small>
        </div>
        <div class="income-card__goal-row">
          <span>Meta: <strong class="money-value">${privateCurrency(state.plan.targetMonthlyIncome, state.valuesHidden)}</strong></span>
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
          <span>${icon(result.goalReached ? 'check' : 'trendUp', 18)} ${result.goalReached ? 'Meta coberta pelas premissas atuais' : `Lacuna mensal de ${formatCurrency(Math.max(result.monthlyIncomeGap, 0))}`}</span>
          <a class="text-link text-link--light" href="/plano" data-route>
            Ver meu plano ${icon('arrowRight', 17)}
          </a>
        </div>
      </article>

      <article class="next-action-card">
        <div class="next-action-card__icon">${icon('sparkles', 22)}</div>
        <p class="eyebrow eyebrow--dark">PRÓXIMA MELHOR AÇÃO</p>
        <h2>${canUseQuickAdjustment ? 'Chegue mais perto com um pequeno ajuste.' : 'Compare uma nova combinação.'}</h2>
        <p>${canUseQuickAdjustment ? `Ao aumentar seu aporte em <strong>${formatCurrency(increase)}</strong>, você pode reduzir o caminho até sua meta.` : 'Use o simulador para testar idade, renda desejada e outras premissas.'}</p>
        ${canUseQuickAdjustment ? `
          <button class="button button--dark button--full" type="button" data-apply-adjustment>
            Aplicar aporte de ${formatCurrency(state.plan.monthlyContribution + increase)}
            ${icon('arrowRight', 18)}
          </button>
        ` : `
          <a class="button button--dark button--full" href="/simulacoes" data-route>
            Abrir simulador ${icon('arrowRight', 18)}
          </a>
        `}
        <a class="text-link" href="/simulacoes" data-route>Ver como calculamos</a>
      </article>
    </section>

    <section class="metrics-grid" aria-label="Indicadores do plano">
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--green">${icon('calendar', 21)}</div>
        <div>
          <p>Previsão de aposentadoria</p>
          <strong>Setembro de ${expectedYear}</strong>
          <span>Aos ${state.plan.retirementAge} anos</span>
        </div>
        <a href="/plano" data-route aria-label="Ver previsão de aposentadoria">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--blue">${icon('wallet', 21)}</div>
        <div>
          <p>Patrimônio projetado</p>
          <strong class="money-value">${privateCurrency(result.projectedAssets, state.valuesHidden)}</strong>
          <span>Em valores de hoje</span>
        </div>
        <a href="/plano" data-route aria-label="Ver patrimônio projetado">${icon('chevronRight', 19)}</a>
      </article>
      <article class="metric-card">
        <div class="metric-card__icon metric-card__icon--sand">${icon('trendUp', 21)}</div>
        <div>
          <p>Aporte mensal atual</p>
          <strong class="money-value">${privateCurrency(state.plan.monthlyContribution, state.valuesHidden)}</strong>
          <span>${state.isDemo ? 'Valor de demonstração' : 'Valor salvo no dispositivo'}</span>
        </div>
        <a href="/plano" data-route aria-label="Ver aporte mensal">${icon('chevronRight', 19)}</a>
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
        ${chartMarkup(state.plan)}
        <div class="chart-insight">
          <span class="chart-insight__icon">${icon('trendUp', 18)}</span>
          <p>Mantendo seu plano, você pode chegar a <strong class="money-value">${privateCurrency(result.projectedAssets, state.valuesHidden)}</strong> em valores de hoje.</p>
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
                <strong class="money-value">${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden)}</strong>
              </div>
            </div>
            <ul class="source-list">
              <li>
                <span class="source-dot source-dot--inss"></span>
                <div><span>Benefício estimado</span><strong class="money-value">${privateCurrency(state.plan.expectedMonthlyBenefit, state.valuesHidden)}</strong></div>
              </li>
              <li>
                <span class="source-dot source-dot--investments"></span>
                <div><span>Investimentos</span><strong class="money-value">${privateCurrency(investmentIncome, state.valuesHidden)}</strong></div>
              </li>
            </ul>
          </div>
          <a class="button button--secondary button--full" href="/plano" data-route>Revisar fontes de renda</a>
        </article>

        <article class="panel confidence-card">
          <div class="confidence-card__icon">${icon('shield', 22)}</div>
          <div>
            <h3>Premissas visíveis e ajustáveis</h3>
            <p>Retorno real de ${formatPercent(state.plan.annualRealReturn)} ao ano e retirada de ${formatPercent(state.plan.annualWithdrawalRate)}.</p>
          </div>
          <a href="/simulacoes" data-route aria-label="Ver premissas">${icon('chevronRight', 19)}</a>
        </article>
      </div>
    </section>
  `
}
