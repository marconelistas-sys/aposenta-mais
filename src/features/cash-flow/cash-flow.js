import { state } from '../../app/state.js'
import { calculateCashFlow } from '../../domain/cash-flow.js'
import { projectRetirement } from '../../domain/retirement.js'
import { formatPercent, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

function moneyField({ label, name, value, hint }) {
  const hintId = hint ? `${name}-hint` : ''
  return `
    <label class="form-field">
      <span class="form-field__label">${label}</span>
      <span class="input-shell">
        <span class="input-prefix">R$</span>
        <input type="number" name="${name}" value="${value}" min="0" max="1000000000" step="50" ${hintId ? `aria-describedby="${hintId}"` : ''} required />
      </span>
      ${hint ? `<small id="${hintId}">${hint}</small>` : ''}
    </label>
  `
}

function retirementScenario(label, contribution, detail, tone) {
  const result = projectRetirement({ ...state.plan, monthlyContribution: contribution })
  return `
    <article class="cash-scenario cash-scenario--${tone}">
      <span>${label}</span>
      <strong class="money-value">${privateCurrency(contribution, state.valuesHidden)}<small>/mês</small></strong>
      <p>${detail}</p>
      <div>
        <span>Renda projetada</span>
        <strong class="money-value">${privateCurrency(result.projectedMonthlyIncome, state.valuesHidden)}</strong>
      </div>
    </article>
  `
}

export function renderCashFlow() {
  const retirement = projectRetirement(state.plan)
  const result = calculateCashFlow(state.cashFlow, retirement.requiredMonthlyContribution)
  const money = (value) => privateCurrency(value, state.valuesHidden)
  const statusTitle = result.isDeficit
    ? 'As despesas recorrentes superam sua renda.'
    : result.contributionGap > 0
      ? 'Existe espaço para investir, mas ainda há uma diferença para a meta.'
      : 'O fluxo atual comporta o aporte necessário.'

  return `
    <section class="page-heading page-heading--inner">
      <div>
        <p class="eyebrow">FLUXO DE CAIXA</p>
        <h1>Descubra quanto cabe no plano todos os meses.</h1>
        <p>Organize receitas, despesas e reserva antes de definir o aporte de aposentadoria.</p>
      </div>
      <div class="privacy-chip">${icon('lock', 16)} Dados mantidos neste dispositivo</div>
    </section>

    <section class="cash-flow-layout">
      <form class="panel cash-flow-form" data-cash-flow-form>
        <div class="panel__header">
          <div>
            <p class="eyebrow">PLANEJADO</p>
            <h2>Seu mês financeiro</h2>
          </div>
          ${icon('wallet', 21, 'panel__header-icon')}
        </div>

        <fieldset class="form-section">
          <legend>Receitas</legend>
          <div class="form-grid form-grid--two">
            ${moneyField({ label: 'Receitas recorrentes mensais', name: 'recurringIncome', value: state.cashFlow.recurringIncome, hint: 'Salário, benefícios e outras entradas previsíveis.' })}
            ${moneyField({ label: 'Receitas eventuais mensais', name: 'occasionalIncome', value: state.cashFlow.occasionalIncome, hint: 'Não entram no cálculo do aporte sustentável.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Despesas</legend>
          <div class="form-grid form-grid--two">
            ${moneyField({ label: 'Despesas essenciais', name: 'essentialExpenses', value: state.cashFlow.essentialExpenses })}
            ${moneyField({ label: 'Despesas variáveis', name: 'variableExpenses', value: state.cashFlow.variableExpenses })}
            ${moneyField({ label: 'Parcelas e dívidas', name: 'debtPayments', value: state.cashFlow.debtPayments })}
            ${moneyField({ label: 'Gastos anuais', name: 'annualExpenses', value: state.cashFlow.annualExpenses, hint: 'IPVA, IPTU, seguros e outros. O sistema divide por 12.' })}
          </div>
        </fieldset>

        <fieldset class="form-section">
          <legend>Reserva de emergência</legend>
          <div class="form-grid form-grid--two">
            ${moneyField({ label: 'Reserva atual', name: 'currentEmergencyReserve', value: state.cashFlow.currentEmergencyReserve })}
            ${moneyField({ label: 'Meta da reserva', name: 'emergencyReserveTarget', value: state.cashFlow.emergencyReserveTarget, hint: 'Fica separada do patrimônio da aposentadoria.' })}
            <label class="form-field">
              <span class="form-field__label">Prazo para completar a reserva</span>
              <span class="input-shell">
                <input type="number" name="reserveBuildMonths" value="${state.cashFlow.reserveBuildMonths}" min="1" max="120" step="1" required />
                <span class="input-suffix">meses</span>
              </span>
            </label>
          </div>
        </fieldset>

        <button class="button button--primary button--full button--large" type="submit">
          Salvar e recalcular ${icon('arrowRight', 18)}
        </button>
      </form>

      <aside class="panel cash-flow-result" aria-live="polite">
        <div class="panel__header">
          <div>
            <p class="eyebrow">DIAGNÓSTICO</p>
            <h2>Quanto você pode aportar</h2>
          </div>
          ${icon(result.isDeficit ? 'alertTriangle' : 'trendUp', 21, 'panel__header-icon')}
        </div>

        <div class="cash-flow-status ${result.isDeficit ? 'is-deficit' : ''}">
          <strong>${statusTitle}</strong>
          <p>Receitas eventuais não foram usadas para sustentar compromissos mensais.</p>
        </div>

        <dl class="cash-flow-metrics">
          <div><dt>Saldo recorrente</dt><dd class="money-value">${money(result.recurringSurplus)}</dd></div>
          <div><dt>Taxa de poupança</dt><dd>${formatPercent(result.savingsRate)}</dd></div>
          <div><dt>Comprometimento da renda</dt><dd>${formatPercent(result.commitmentRate)}</dd></div>
          <div><dt>Provisão para gastos anuais</dt><dd class="money-value">${money(result.monthlyAnnualProvision)}</dd></div>
          <div><dt>Recomposição da reserva</dt><dd class="money-value">${money(result.reserveMonthlyAllocation)}</dd></div>
          <div class="is-highlight"><dt>Aporte sustentável</dt><dd class="money-value">${money(result.sustainableContribution)}</dd></div>
          <div><dt>Aporte necessário para a meta</dt><dd class="money-value">${money(result.requiredMonthlyContribution)}</dd></div>
          <div><dt>Diferença para a meta</dt><dd class="money-value">${money(Math.abs(result.contributionGap))} ${result.contributionGap <= 0 ? 'de margem' : ''}</dd></div>
        </dl>

        <button class="button button--dark button--full" type="button" data-apply-sustainable-contribution ${result.isDeficit ? 'disabled' : ''}>
          Usar ${money(result.sustainableContribution)} como aporte mensal
        </button>
        <p class="result-disclaimer">O aporte atual não foi contado como despesa. Assim, o mesmo valor não é descontado duas vezes.</p>
      </aside>
    </section>

    <section class="cash-scenarios" aria-labelledby="cash-scenarios-title">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">CENÁRIOS</p>
          <h2 id="cash-scenarios-title">Impacto na aposentadoria</h2>
        </div>
        <span>Valores em poder de compra de hoje</span>
      </div>
      <div class="cash-scenarios__grid">
        ${retirementScenario('Atual', state.plan.monthlyContribution, 'O aporte salvo hoje no seu plano.', 'current')}
        ${retirementScenario('Sustentável', result.sustainableContribution, 'O que cabe no fluxo recorrente após a reserva.', 'sustainable')}
        ${retirementScenario('Meta', result.requiredMonthlyContribution, 'O aporte estimado para alcançar a renda desejada.', 'target')}
      </div>
    </section>
  `
}
