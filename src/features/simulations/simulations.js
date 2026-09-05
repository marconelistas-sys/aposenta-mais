import { state } from '../../app/state.js'
import { projectAssetSeriesWithSchedules, projectRetirementWithSchedules } from '../../domain/retirement.js'
import { retirementContributionSchedules } from '../../domain/cash-flow.js'
import { escapeHtml, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'
import { currencySymbol } from '../../shared/currencies.js'
import { convertCurrency } from '../../shared/exchange-rates.js'

const comparisonColors = ['#2f785e', '#3d6cb4', '#b46b3d', '#7864a6']

function planInDashboardCurrency(plan, sourceCurrency) {
  if (sourceCurrency === state.currency) return plan
  const converted = { ...plan }
  for (const fieldName of ['currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit']) {
    converted[fieldName] = convertCurrency(plan[fieldName], sourceCurrency, state.currency, state.exchangeRates)
  }
  converted.investments = (plan.investments || []).map((investment) => ({
    ...investment,
    amount: convertCurrency(investment.amount, sourceCurrency, state.currency, state.exchangeRates),
    monthlyContribution: convertCurrency(investment.monthlyContribution, sourceCurrency, state.currency, state.exchangeRates)
  }))
  return converted
}

function schedulesFor(cashFlow) {
  if (!cashFlow) return []
  return retirementContributionSchedules(
    cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
}

function field({ label, name, value, min, max, step = 1, prefix, suffix, hint, type = 'number', maxLength }) {
  const hintId = hint ? `${name}-hint` : ''
  return `
    <label class="form-field">
      <span class="form-field__label">${label}</span>
      <span class="input-shell">
        ${prefix ? `<span class="input-prefix">${prefix}</span>` : ''}
        <input
          type="${type}"
          name="${name}"
          value="${value}"
          ${min !== undefined ? `min="${min}"` : ''}
          ${max !== undefined ? `max="${max}"` : ''}
          ${type === 'number' ? `step="${step}"` : ''}
          ${maxLength ? `maxlength="${maxLength}"` : ''}
          ${hintId ? `aria-describedby="${hintId}"` : ''}
          required
        />
        ${suffix ? `<span class="input-suffix">${suffix}</span>` : ''}
      </span>
      ${hint ? `<small id="${hintId}">${hint}</small>` : ''}
    </label>
  `
}

export function renderSimulationResult(result, plan = state.plan) {
  const incomeProgress = plan.targetMonthlyIncome === 0
    ? 1
    : Math.min(Math.max(result.projectedMonthlyIncome / plan.targetMonthlyIncome, 0), 1)
  const gap = Math.abs(result.monthlyIncomeGap)
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)

  return `
    <div class="simulation-result__status ${result.goalReached ? 'is-success' : ''}">
      <span>${icon(result.goalReached ? 'check' : 'trendUp', 20)}</span>
      <div>
        <strong>${result.goalReached ? 'Meta alcançada neste cenário' : `Este cenário cobre ${formatPercent(incomeProgress)} da renda desejada`}</strong>
        <p>${result.goalReached ? 'Você criou uma margem para o plano.' : `A diferença estimada é ${money(gap)} por mês.`}</p>
      </div>
    </div>
    <div class="simulation-result__hero">
      <span>Renda mensal projetada</span>
      <strong>${money(result.projectedMonthlyIncome)}</strong>
      <small>em valores de hoje</small>
    </div>
    <div class="progress-track" role="progressbar" aria-label="Progresso da simulação" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(incomeProgress * 100)}">
      <span style="width: ${incomeProgress * 100}%"></span>
    </div>
    <div class="simulation-result__metrics">
      <div><span>Patrimônio projetado</span><strong>${money(result.projectedAssets)}</strong></div>
      <div><span>Meta de patrimônio</span><strong>${money(result.targetAssets)}</strong></div>
      <div><span>Aporte sugerido</span><strong>${money(result.requiredMonthlyContribution)}</strong></div>
      <div><span>Progresso da renda</span><strong>${formatPercent(incomeProgress)}</strong></div>
    </div>
    <div class="simulation-result__actions">
      <button class="button button--primary button--full" type="button" data-apply-simulation>
        Usar como plano principal
      </button>
      <button class="button button--secondary button--full" type="button" data-save-scenario>
        Salvar para comparar
      </button>
    </div>
    <p class="result-disclaimer">Projeção educacional. Ela não substitui uma análise previdenciária ou financeira individual.</p>
  `
}

function renderSavedScenarios() {
  if (state.scenarios.length === 0) {
    return '<p class="scenario-empty">Salve uma simulação para comparar decisões sem alterar seu plano principal.</p>'
  }

  return `<div class="scenario-grid">
    ${state.scenarios.map((scenario) => {
      const comparablePlan = planInDashboardCurrency(scenario.plan, scenario.currency)
      const result = projectRetirementWithSchedules(comparablePlan, schedulesFor(scenario.cashFlow))
      return `
        <article class="scenario-card">
          <div class="scenario-card__header">
            <h3>${escapeHtml(scenario.name)}</h3>
            <button class="icon-button" type="button" data-remove-scenario="${escapeHtml(scenario.id)}" aria-label="Excluir cenário ${escapeHtml(scenario.name)}">×</button>
          </div>
          <dl>
            <div><dt>Renda projetada</dt><dd>${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Patrimônio</dt><dd>${privateCurrency(result.projectedAssets, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Aporte necessário</dt><dd>${privateCurrency(result.requiredMonthlyContribution, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Idade planejada</dt><dd>${scenario.plan.retirementAge} anos</dd></div>
            <div><dt>Retorno real</dt><dd>${formatPercent(scenario.plan.annualRealReturn)} ao ano</dd></div>
            <div><dt>Moeda original</dt><dd>${scenario.currency}</dd></div>
          </dl>
          <button class="button button--secondary button--full" type="button" data-load-scenario="${escapeHtml(scenario.id)}">Carregar cenário completo</button>
        </article>
      `
    }).join('')}
  </div>`
}

function scenarioComparisonChart() {
  const scenarios = [
    { name: 'Plano atual', plan: state.plan, currency: state.currency, cashFlow: state.cashFlow },
    ...state.scenarios
  ]
  const prepared = scenarios.map((scenario, index) => {
    const plan = planInDashboardCurrency(scenario.plan, scenario.currency)
    return {
      ...scenario,
      plan,
      color: comparisonColors[index],
      series: projectAssetSeriesWithSchedules(
        plan,
        schedulesFor(scenario.cashFlow),
        undefined
      )
    }
  })
  const maximumYears = Math.max(...prepared.map((scenario) => scenario.series.at(-1).year), 1)
  const rawMaximumAssets = Math.max(...prepared.flatMap((scenario) => scenario.series.map((point) => point.assets)), 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawMaximumAssets))
  const maximumAssets = Math.ceil(rawMaximumAssets / magnitude) * magnitude
  const plot = { left: 100, right: 620, top: 24, bottom: 212 }
  const paths = prepared.map((scenario) => {
    const points = scenario.series.map((point) => {
      const x = plot.left + ((plot.right - plot.left) * point.year) / maximumYears
      const ratio = Math.min(Math.max(point.assets / maximumAssets, 0), 1)
      const y = plot.bottom - (plot.bottom - plot.top) * ratio
      return `${x.toFixed(2)},${y.toFixed(2)}`
    }).join(' ')
    return `<polyline points="${points}" fill="none" stroke="${scenario.color}" stroke-width="3" vector-effect="non-scaling-stroke" clip-path="url(#comparison-plot-clip)" />`
  }).join('')
  const currentYear = new Date().getFullYear()

  return `
    <section class="panel scenario-comparison" aria-labelledby="scenario-comparison-title">
      <div class="panel__header">
        <div>
          <p class="eyebrow">PROJEÇÃO COMPOSTA</p>
          <h2 id="scenario-comparison-title">Saldo projetado por cenário</h2>
        </div>
        <span class="step-badge">Valores reais em ${state.currency}</span>
      </div>
      <p class="scenario-comparison__intro">Cada linha aplica capitalização mensal equivalente à taxa anual acima da inflação definida no cenário.</p>
      <div class="comparison-chart" role="img" aria-label="Comparação dos saldos projetados de ${prepared.length} cenários">
        <svg viewBox="0 0 640 260" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs><clipPath id="comparison-plot-clip"><rect x="98" y="21" width="524" height="194" /></clipPath></defs>
          <g class="chart__grid"><line x1="100" y1="24" x2="620" y2="24"/><line x1="100" y1="118" x2="620" y2="118"/><line x1="100" y1="212" x2="620" y2="212"/></g>
          <g class="chart__labels">
            <text x="90" y="28" text-anchor="end">${state.valuesHidden ? '•••' : privateCurrency(maximumAssets, false, false, state.currency)}</text>
            <text x="90" y="122" text-anchor="end">${state.valuesHidden ? '•••' : privateCurrency(maximumAssets / 2, false, false, state.currency)}</text>
            <text x="90" y="216" text-anchor="end">${currencySymbol(state.currency)} 0</text>
            <text x="100" y="244" text-anchor="start">Hoje</text>
            <text x="360" y="244" text-anchor="middle">${currentYear + Math.round(maximumYears / 2)}</text>
            <text x="620" y="244" text-anchor="end">${currentYear + maximumYears}</text>
          </g>
          ${paths}
        </svg>
      </div>
      <div class="comparison-legend">
        ${prepared.map((scenario) => {
          const last = scenario.series.at(-1)
          return `<div>
            <span style="--scenario-color:${scenario.color}"></span>
            <p><strong>${escapeHtml(scenario.name)}</strong><small>${formatPercent(scenario.plan.annualRealReturn)} real ao ano · ${privateCurrency(last.assets, state.valuesHidden, false, state.currency)}</small></p>
          </div>`
        }).join('')}
      </div>
      <p class="result-disclaimer">As curvas mostram o saldo total projetado. O cálculo considera capital, aportes e rendimento composto. Impostos, taxas e variação cambial futura não são previstos.</p>
    </section>
  `
}

export function renderSimulations() {
  const initialResult = projectRetirementWithSchedules(state.plan, schedulesFor(state.cashFlow))
  const moneySymbol = currencySymbol(state.currency)

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">SIMULADOR</p>
        <h1>Teste decisões antes de mudar seu plano.</h1>
        <p>Compare idade, aporte e retorno usando valores de hoje.</p>
      </div>
      <div class="privacy-chip">${icon('lock', 16)} Cálculo feito no seu dispositivo</div>
    </section>

    <section class="simulator-layout">
      <form class="panel simulation-form" data-simulation-form>
        <div class="panel__header">
          <div>
            <p class="eyebrow">NOVO CENÁRIO</p>
            <h2>Defina suas premissas</h2>
          </div>
          <span class="step-badge">1 de 1</span>
        </div>

        ${field({ label: 'Nome do cenário', name: 'scenarioName', value: `Cenário ${state.scenarios.length + 1}`, type: 'text', maxLength: 40, hint: 'Exemplo: aposentar aos 60' })}

        <fieldset class="form-section">
          <legend>Prazo</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Sua idade hoje', name: 'currentAge', value: state.plan.currentAge, min: 16, max: 99, suffix: 'anos' })}
            ${field({ label: 'Idade para se aposentar', name: 'retirementAge', value: state.plan.retirementAge, min: state.plan.currentAge + 1, max: 100, suffix: 'anos' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Patrimônio e aportes</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Patrimônio atual', name: 'currentAssets', value: state.plan.currentAssets, min: 0, max: 100000000, step: 1000, prefix: moneySymbol })}
            ${field({ label: 'Aporte mensal', name: 'monthlyContribution', value: state.plan.monthlyContribution, min: 0, max: 1000000, step: 50, prefix: moneySymbol })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Renda desejada</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Renda mensal desejada', name: 'targetMonthlyIncome', value: state.plan.targetMonthlyIncome, min: 0, max: 1000000, step: 100, prefix: moneySymbol })}
            ${field({ label: 'Benefício mensal esperado', name: 'expectedMonthlyBenefit', value: state.plan.expectedMonthlyBenefit, min: 0, max: 100000, step: 100, prefix: moneySymbol, hint: 'Use uma estimativa conservadora.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Premissas financeiras</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Retorno real anual', name: 'annualRealReturn', value: state.plan.annualRealReturn * 100, min: -99, max: 100, step: 0.1, suffix: '%' })}
            ${field({ label: 'Inflação anual esperada', name: 'annualInflation', value: state.plan.annualInflation * 100, min: -99, max: 100, step: 0.1, suffix: '%', hint: 'Usada para converter taxas nominais e CDI.' })}
            ${field({ label: 'Taxa de retirada anual', name: 'annualWithdrawalRate', value: state.plan.annualWithdrawalRate * 100, min: 0.1, max: 100, step: 0.1, suffix: '%' })}
          </div>
        </fieldset>

        <button class="button button--primary button--full button--large" type="submit">
          Atualizar projeção ${icon('arrowRight', 18)}
        </button>
      </form>

      <aside class="panel simulation-result" aria-live="polite" aria-atomic="true">
        <div class="panel__header">
          <div>
            <p class="eyebrow">RESULTADO</p>
            <h2>Sua projeção</h2>
          </div>
          ${icon('calculator', 21, 'panel__header-icon')}
        </div>
        <div id="simulation-result-content">
          ${renderSimulationResult(initialResult)}
        </div>
      </aside>
    </section>

    ${scenarioComparisonChart()}

    <section class="panel saved-scenarios" aria-labelledby="saved-scenarios-title">
      <div class="panel__header">
        <div>
          <p class="eyebrow">COMPARAÇÃO</p>
          <h2 id="saved-scenarios-title">Cenários salvos</h2>
        </div>
        <span class="step-badge">${state.scenarios.length}/3</span>
      </div>
      ${renderSavedScenarios()}
    </section>
  `
}
