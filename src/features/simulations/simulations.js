import { scenarioEditor, simulationContext, simulationCashFlow } from './scenario-editor.js'
import { state } from '../../app/state.js'
import { projectRetirementWithSchedules } from '../../domain/retirement.js'
import { retirementContributionSchedules } from '../../domain/cash-flow.js'
import { escapeHtml, formatPercent, percentInputValue, privateCurrency } from '../../shared/formatters.js'
import { retirementTargetBasis } from '../../shared/retirement-target.js'
import { prepareScenarioComparison } from '../../domain/scenario-comparison.js'
import { scenarioComparisonView } from './comparison-view.js'
import { icon } from '../../shared/icons.js'
import { currencySymbol } from '../../shared/currencies.js'
import { convertCurrency } from '../../shared/exchange-rates.js'
import { effectiveDefaultReturnSource } from '../../domain/portfolio-return.js'
import { defaultReturnOrigin } from '../../shared/portfolio-return.js'

// Origin of the return of a scenario. The current plan follows the portfolio;
// a saved scenario keeps the rate of the day it was saved (scenarios are not
// derived again).
function scenarioReturnOrigin(plan, { current = false } = {}) {
  if (current) return defaultReturnOrigin(plan).short
  return effectiveDefaultReturnSource(plan) === 'portfolio' ? 'derivado da carteira ao salvar' : 'informado no cenário'
}

function planInDashboardCurrency(plan, sourceCurrency) {
  if (sourceCurrency === state.currency) return plan
  const converted = { ...plan }
  for (const fieldName of ['currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit', 'spouseExpectedMonthlyBenefit']) {
    converted[fieldName] = convertCurrency(plan[fieldName], sourceCurrency, state.currency, state.exchangeRates)
  }
  converted.investments = (plan.investments || []).map((investment) => ({
    ...investment,
    amount: convertCurrency(investment.amount, sourceCurrency, state.currency, state.exchangeRates),
    monthlyContribution: convertCurrency(investment.monthlyContribution, sourceCurrency, state.currency, state.exchangeRates)
  }))
  return converted
}

function schedulesFor(cashFlow, currency = state.currency) {
  if (!cashFlow) return []
  return retirementContributionSchedules(
    cashFlow,
    currency,
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

export function renderSimulationResult(result, plan = state.plan, currency = state.currency) {
  const incomeProgress = plan.targetMonthlyIncome === 0
    ? 1
    : Math.min(Math.max(result.projectedMonthlyIncome / plan.targetMonthlyIncome, 0), 1)
  if (state.valuesHidden) return '<p>Valores e gráficos da simulação ocultos. Mostre os valores para comparar o resultado.</p>'
  const gap = Math.abs(result.monthlyIncomeGap)
  const money = (value) => privateCurrency(value, state.valuesHidden, false, currency)

  return `
    <div class="simulation-result__status ${result.goalReached ? 'is-success' : ''}">
      <span>${icon(result.goalReached ? 'check' : 'trendUp', 20)}</span>
      <div>
        <strong>${result.goalReached ? 'Meta de renda atingida no cálculo complementar' : `O indicador complementar cobre ${formatPercent(incomeProgress)} da renda desejada`}</strong>
        <p>${result.goalReached ? 'Confira abaixo se o orçamento e a liquidez sustentam o plano até o horizonte.' : `A diferença estimada é ${money(gap)} por mês.`}</p>
      </div>
    </div>
    <div class="simulation-result__hero"><div><span>Renda mensal estimada por aporte fixo</span><strong>${money(result.projectedMonthlyIncome)}</strong><small>Indicador complementar, em valores de hoje</small></div></div>
    <div class="simulation-result__metrics">
      <div>${icon('pie', 18, 'metric-glyph')}<span>Patrimônio projetado</span><strong>${money(result.projectedAssets)}</strong></div>
      <div>${icon('target', 18, 'metric-glyph')}<span>Meta de patrimônio</span><strong>${money(result.targetAssets)}</strong></div>
      <div>${icon('calendar', 18, 'metric-glyph')}<span>Aporte sugerido</span><strong>${money(result.requiredMonthlyContribution)}</strong></div>
    </div>
    <p class="annual-chart-basis" data-retirement-target-basis>${escapeHtml(retirementTargetBasis(result, plan))}</p>
    <p class="annual-chart-basis">Este cálculo supõe aporte fixo até a aposentadoria. Não comprova cobertura do orçamento. Receitas, despesas e liquidez são avaliadas na comparação do planejamento completo.</p>
    <p><a href="#scenario-comparison-title">Ver comparação completa</a></p>
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
            <div><dt>Renda complementar por aporte fixo</dt><dd>${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Saldo na aposentadoria, por aporte fixo</dt><dd>${privateCurrency(result.projectedAssets, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Aporte necessário</dt><dd>${privateCurrency(result.requiredMonthlyContribution, state.valuesHidden, false, state.currency)}</dd></div>
            <div><dt>Aposentadoria planejada</dt><dd>${scenario.plan.retirementAge} anos</dd></div>
            <div><dt>Horizonte</dt><dd>${scenario.plan.targetAge} anos</dd></div>
            <div><dt>Retorno real</dt><dd>${formatPercent(scenario.plan.annualRealReturn)} ao ano<small>${scenarioReturnOrigin(scenario.plan)}</small></dd></div>
            <div><dt>Moeda original</dt><dd>${scenario.currency}</dd></div>
          </dl>
          <button class="button button--secondary button--full" type="button" data-edit-scenario="${escapeHtml(scenario.id)}">Editar cenário</button>
          <button class="button button--secondary button--full" type="button" data-load-scenario="${escapeHtml(scenario.id)}">Carregar cenário completo</button>
        </article>
      `
    }).join('')}
  </div>`
}

export function renderScenarioComparison(plan = simulationContext().plan, cashFlow = simulationCashFlow(plan), currency = simulationContext().currency, options = {}) {
  if (state.valuesHidden) return '<section class="panel"><h2>Comparação do planejamento completo</h2><p>Valores e gráficos ocultos.</p></section>'
  const model = prepareScenarioComparison(state, { plan, cashFlow, currency }, options)
  return scenarioComparisonView(model, { metric: options.metric, selectedYear: options.selectedYear, references: state.scenarios, editing: Boolean(scenarioEditor.scenario) })
}

// Hint of the return field: where today's rate comes from and what typing another does.
function returnHint(plan) {
  const current = !scenarioEditor.scenario
  const origin = scenarioReturnOrigin(plan, { current })
  const derived = current ? defaultReturnOrigin(plan).kind === 'portfolio' : effectiveDefaultReturnSource(plan) === 'portfolio'
  return `Hoje, ${origin}. Vale para investimentos sem taxa própria.${derived ? ' Outro valor passa a valer só neste cenário, como taxa informada.' : ''}`
}

export function renderSimulations() {
  const context = simulationContext()
  const plan = context.plan
  if (state.valuesHidden) return `<section class="page-heading page-heading--inner"><h1>Teste decisões antes de mudar seu plano.</h1></section><section class="panel"><p>Valores, premissas e diagnósticos da simulação ocultos. Mostre os valores para comparar.</p></section><section class="panel saved-scenarios"><h2>Cenários salvos</h2>${renderSavedScenarios()}</section>`
  const initialResult = projectRetirementWithSchedules(plan, schedulesFor(context.cashFlow, context.currency))
  const moneySymbol = currencySymbol(context.currency)

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">SIMULADOR</p>
        <h1>Teste decisões antes de mudar seu plano.</h1>
        <p>Compare sua hipótese com o plano atual. Veja o impacto na aposentadoria, no patrimônio e na disponibilidade de dinheiro até o horizonte.</p>
      </div>
      <div class="privacy-chip">${icon('lock', 16)} Cálculo feito no seu dispositivo</div>
    </section>

    <section class="simulator-layout">
      <form class="panel simulation-form" data-simulation-form data-simulation-currency="${context.currency}">
        <div class="panel__header">
          <div>
            <p class="eyebrow">${scenarioEditor.scenario ? 'EDITAR CENÁRIO' : 'NOVO CENÁRIO'}</p>
            <h2>Defina suas premissas</h2>
          </div>
          <span class="step-badge">1 de 1</span>
        </div>

        ${field({ label: 'Nome do cenário', name: 'scenarioName', value: escapeHtml(context.name || `Cenário ${state.scenarios.length + 1}`), type: 'text', maxLength: 40, hint: 'Exemplo: aposentar aos 60' })}

        ${scenarioEditor.scenario ? '<button type="button" class="button button--secondary" data-cancel-scenario-edit>Cancelar edição</button>' : ''}
        <p>Horizonte salvo: até ${plan.targetAge} anos. Valores em ${context.currency}. Alterações de patrimônio e aporte mantêm a distribuição da carteira. Quando não há aportes distribuídos, o novo aporte usa a taxa padrão do plano.</p>
        <fieldset class="form-section">
          <legend>Prazo</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Sua idade hoje', name: 'currentAge', value: plan.currentAge, min: 16, max: 99, suffix: 'anos' })}
            ${field({ label: 'Idade para se aposentar', name: 'retirementAge', value: plan.retirementAge, min: plan.currentAge + 1, max: 100, suffix: 'anos' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Patrimônio e aportes</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Patrimônio atual', name: 'currentAssets', value: plan.currentAssets, min: 0, max: 1000000000, step: 'any', prefix: moneySymbol })}
            ${field({ label: 'Aporte mensal', name: 'monthlyContribution', value: plan.monthlyContribution, min: 0, max: 10000000, step: 'any', prefix: moneySymbol, hint: 'No planejamento completo, distribui a sobra do orçamento. No cálculo complementar, supõe aporte fixo mensal.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Meta de renda, cálculo complementar</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Renda mensal desejada', name: 'targetMonthlyIncome', value: plan.targetMonthlyIncome, min: 0, max: 10000000, step: 'any', prefix: moneySymbol })}
            ${field({ label: 'Benefício mensal esperado', name: 'expectedMonthlyBenefit', value: plan.expectedMonthlyBenefit, min: 0, max: 1000000, step: 'any', prefix: moneySymbol, hint: 'Estimativa para a meta de renda. Para entrar na projeção anual, cadastre o benefício como receita no orçamento.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Premissas financeiras</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Retorno real padrão anual', name: 'annualRealReturn', value: percentInputValue(plan.annualRealReturn), min: -99, max: 100, step: 'any', suffix: '%', hint: returnHint(plan) })}
            ${field({ label: 'Inflação anual esperada', name: 'annualInflation', value: percentInputValue(plan.annualInflation), min: -99, max: 100, step: 'any', suffix: '%', hint: 'Usada para converter taxas nominais e CDI.' })}
            ${field({ label: 'Taxa de retirada anual', name: 'annualWithdrawalRate', value: percentInputValue(plan.annualWithdrawalRate), min: 0.1, max: 100, step: 'any', suffix: '%', hint: 'Prudência da meta. Vale para 30 anos de aposentadoria; a meta usa a duração até a idade-alvo.' })}
          </div>
        </fieldset>

        <button class="button button--primary button--full button--large" type="submit">
          Atualizar projeção ${icon('arrowRight', 18)}
        </button>
      </form>

      <aside class="panel simulation-result" aria-live="polite" aria-atomic="true">
        <div class="panel__header">
          <div>
            <p class="eyebrow">INDICADOR COMPLEMENTAR</p>
            <h2>Meta de renda complementar</h2>
          </div>
          ${icon('calculator', 21, 'panel__header-icon')}
        </div>
        <div id="simulation-result-content">
          ${renderSimulationResult(initialResult, plan, context.currency)}
        </div>
      </aside>
    </section>

    <div id="simulation-comparison-content">${renderScenarioComparison(plan, context.cashFlow, context.currency)}</div>

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

export function simulationSchedules(plan) {
  const context = simulationContext()
  return schedulesFor(simulationCashFlow(plan), context.currency)
}
