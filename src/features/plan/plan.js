import { state } from '../../app/state.js'
import { projectRetirement } from '../../domain/retirement.js'
import { formatCurrency, formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

export function renderPlan() {
  const result = projectRetirement(state.plan)

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
            <h2 class="money-value">${privateCurrency(state.plan.targetMonthlyIncome, state.valuesHidden)} <small>por mês</small></h2>
          </div>
          <div class="goal-card__icon">${icon('target', 23)}</div>
        </div>
        <div class="goal-progress-row">
          <span>Renda projetada</span>
          <strong class="money-value">${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden)}</strong>
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
            ${privateCurrency(state.plan.monthlyContribution, state.valuesHidden)}
          </output>
        </div>
        <label class="range-control-label" for="monthly-contribution">Aporte mensal</label>
        <div class="range-label" aria-hidden="true">
          <span>R$ 500</span>
          <span>R$ 4.000</span>
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
          <p>O aporte estimado para atingir sua meta é <strong>${formatCurrency(result.requiredMonthlyContribution)}</strong> por mês.</p>
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
            <div><strong>Primeiro R$ 500 mil</strong><small>Com o aporte e retorno atuais</small></div>
            <time>2036</time>
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
          <div><dt>Taxa de retirada</dt><dd>${formatPercent(state.plan.annualWithdrawalRate)}</dd></div>
          <div><dt>Benefício estimado</dt><dd class="money-value">${privateCurrency(state.plan.expectedMonthlyBenefit, state.valuesHidden)}</dd></div>
          <div><dt>Horizonte</dt><dd>${result.months / 12} anos</dd></div>
        </dl>
        <a class="button button--secondary button--full" href="/simulacoes" data-route>Testar outras premissas</a>
      </article>
    </section>
  `
}
