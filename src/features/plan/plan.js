import { state } from '../../app/state.js'
import { projectRetirementWithSchedules } from '../../domain/retirement.js'
import { retirementContributionSchedules } from '../../domain/cash-flow.js'
import { formatCurrency, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

export function renderPlan() {
  const schedules = retirementContributionSchedules(
    state.cashFlow,
    state.currency,
    state.exchangeRates,
    state.customCategories
  )
  const result = projectRetirementWithSchedules(state.plan, schedules)
  const money = (value) => privateCurrency(value, state.valuesHidden, false, state.currency)

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">MEU PLANO</p>
        <h1>Transforme sua meta em um plano mensal.</h1>
        <p>Ajuste seu aporte e acompanhe o efeito na projeção.</p>
      </div>
      <a class="button button--primary" href="/simulacoes" data-route>
        Nova simulação ${icon('arrowRight', 18)}
      </a>
    </section>

    <section class="plan-overview">
      <article class="panel goal-card">
        <div class="panel__header">
          <div>
            <p class="eyebrow">META DE RENDA</p>
            <h2 class="money-value">${money(state.plan.targetMonthlyIncome)} <small>por mês</small></h2>
          </div>
          <div class="goal-card__icon">${icon('target', 23)}</div>
        </div>
        <div class="goal-progress-row">
          <span>Renda projetada</span>
          <strong class="money-value">${money(result.projectedMonthlyIncome)}</strong>
        </div>
        <div class="progress-track" role="progressbar" aria-label="Progresso da meta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(Math.round(result.progress * 100), 0), 100)}">
          <span style="width: ${Math.min(result.progress * 100, 100)}%"></span>
        </div>
        <p class="goal-card__caption">Você construiu ${formatPercent(result.progress)} do patrimônio necessário para essa renda.</p>
      </article>

      <article class="panel contribution-card">
        <div class="panel__header">
          <div>
            <p class="eyebrow">APORTE MENSAL</p>
            <h2>Ajuste o seu ritmo</h2>
          </div>
          <output class="contribution-output money-value" for="monthly-contribution">
            ${money(state.plan.monthlyContribution)}
          </output>
        </div>
        <label class="range-control-label" for="monthly-contribution">Aporte mensal</label>
        <div class="range-label" aria-hidden="true">
          <span>${formatCurrency(500, false, state.currency)}</span>
          <span>${formatCurrency(4000, false, state.currency)}</span>
        </div>
        <input
          id="monthly-contribution"
          class="range-input"
          type="range"
          min="500"
          max="4000"
          step="50"
          value="${state.plan.monthlyContribution}"
          data-plan-contribution
          style="--range-progress: ${((state.plan.monthlyContribution - 500) / 3500) * 100}%"
        />
        <div class="contribution-recommendation">
          ${icon('sparkles', 18)}
          <p>Para atingir a meta, o aporte mensal estimado é <strong>${formatCurrency(result.requiredMonthlyContribution, false, state.currency)}</strong>. Hoje, sua carteira usa <strong>${formatCurrency(state.plan.monthlyContribution, false, state.currency)}</strong>, além de <strong>${formatCurrency(result.currentScheduledMonthlyContribution, false, state.currency)}</strong> em previdência programada.</p>
        </div>
      </article>
    </section>

    <section class="plan-details-grid">
      <article class="panel timeline-card">
        <div class="panel__header">
          <div>
            <p class="eyebrow">JORNADA</p>
            <h2>Marcos do seu plano</h2>
          </div>
          ${icon('calendar', 21, 'panel__header-icon')}
        </div>
        <ol class="timeline">
          <li class="is-complete">
            <span>${icon('check', 16)}</span>
            <div><strong>Plano criado</strong><small>Patrimônio e renda inicial registrados</small></div>
            <time>2026</time>
          </li>
          <li>
            <span></span>
            <div><strong>Revisão anual do plano</strong><small>Confira saldos, aportes e rendimentos cadastrados</small></div>
            <time>${new Date().getFullYear() + 1}</time>
          </li>
          <li>
            <span></span>
            <div><strong>Meta de aposentadoria</strong><small>Previsão aos ${state.plan.retirementAge} anos</small></div>
            <time>${new Date().getFullYear() + state.plan.retirementAge - state.plan.currentAge}</time>
          </li>
        </ol>
      </article>

      <article class="panel assumptions-card">
        <div class="panel__header">
          <div>
            <p class="eyebrow">PREMISSAS</p>
            <h2>Base da projeção</h2>
          </div>
          ${icon('info', 21, 'panel__header-icon')}
        </div>
        <dl class="assumptions-list">
          <div><dt>Retorno real anual</dt><dd>${formatPercent(state.plan.annualRealReturn)}</dd></div>
          <div><dt>Inflação anual esperada</dt><dd>${formatPercent(state.plan.annualInflation)}</dd></div>
          <div><dt>Taxa de retirada</dt><dd>${formatPercent(state.plan.annualWithdrawalRate)}</dd></div>
          <div><dt>Benefício estimado</dt><dd class="money-value">${money(state.plan.expectedMonthlyBenefit)}</dd></div>
          <div><dt>Horizonte</dt><dd>${result.months / 12} anos</dd></div>
        </dl>
        <a class="button button--secondary button--full" href="/simulacoes" data-route>Testar outras premissas</a>
        <a class="text-link" href="/carteira" data-route>Revisar investimentos e rendimentos</a>
      </article>
    </section>
  `
}
