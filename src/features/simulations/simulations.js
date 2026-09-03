import { state } from '../../app/state.js'
import { projectRetirement } from '../../domain/retirement.js'
import { formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

function field({ label, name, value, min, max, step = 1, prefix, suffix, hint }) {
  return `
    <label class="form-field">
      <span class="form-field__label">${label}</span>
      <span class="input-shell">
        ${prefix ? `<span class="input-prefix">${prefix}</span>` : ''}
        <input
          type="number"
          name="${name}"
          value="${value}"
          min="${min}"
          max="${max}"
          step="${step}"
          required
        />
        ${suffix ? `<span class="input-suffix">${suffix}</span>` : ''}
      </span>
      ${hint ? `<small>${hint}</small>` : ''}
    </label>
  `
}

export function renderSimulationResult(result, plan = state.plan) {
  const incomeProgress = Math.min(result.projectedMonthlyIncome / plan.targetMonthlyIncome, 1)
  const gap = Math.abs(result.monthlyIncomeGap)
  const money = (value) => privateCurrency(value, state.valuesHidden)

  return `
    <div class="simulation-result__status ${result.goalReached ? 'is-success' : ''}">
      <span>${icon(result.goalReached ? 'check' : 'trendUp', 20)}</span>
      <div>
        <strong>${result.goalReached ? 'Meta alcançada neste cenário' : 'Este cenário chegou perto da meta'}</strong>
        <p>${result.goalReached ? 'Você criou uma margem para o plano.' : `Faltam ${money(gap)} por mês para a renda desejada.`}</p>
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
    <p class="result-disclaimer">Projeção educacional. Ela não substitui uma análise previdenciária ou financeira individual.</p>
  `
}

export function renderSimulations() {
  const initialResult = projectRetirement(state.plan)

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
            ${field({ label: 'Patrimônio atual', name: 'currentAssets', value: state.plan.currentAssets, min: 0, max: 100000000, step: 1000, prefix: 'R$' })}
            ${field({ label: 'Aporte mensal', name: 'monthlyContribution', value: state.plan.monthlyContribution, min: 0, max: 1000000, step: 50, prefix: 'R$' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Renda desejada</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Renda mensal desejada', name: 'targetMonthlyIncome', value: state.plan.targetMonthlyIncome, min: 0, max: 1000000, step: 100, prefix: 'R$' })}
            ${field({ label: 'Benefício mensal esperado', name: 'expectedMonthlyBenefit', value: state.plan.expectedMonthlyBenefit, min: 0, max: 100000, step: 100, prefix: 'R$', hint: 'Use uma estimativa conservadora.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Premissas financeiras</legend>
          <div class="form-grid form-grid--two">
            ${field({ label: 'Retorno real anual', name: 'annualRealReturn', value: state.plan.annualRealReturn * 100, min: -99, max: 100, step: 0.1, suffix: '%' })}
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
  `
}
