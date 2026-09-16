import { state } from '../../app/state.js'
import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { summarizeLiquidity } from '../../domain/liquidity.js'
import { privateCurrency } from '../../shared/formatters.js'
import { liquidityGauge } from '../../shared/liquidity-gauge.js'
export const liquidityLabels = { unknown: 'Não informada', available: 'Disponível para resgate', restricted: 'Restrita ou com prazo' }
function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? month : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function renderLiquidity() {
  const point = cashFlowTimeline(state, state.cashFlow.referenceMonth, 1)[0]
  const result = summarizeLiquidity(state.plan, point.expenses)
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const coverage = state.valuesHidden
    ? 'Valor oculto'
    : result.coverageMonths === null
      ? 'Sem despesas previstas'
      : `${result.coverageMonths.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`
  return `<section class="panel investment-liquidity" aria-labelledby="investment-liquidity-title">
    <div class="panel__header"><div><p class="eyebrow">RESGATE</p><h2 id="investment-liquidity-title">Liquidez declarada</h2></div></div>
    ${liquidityGauge({ available: result.available, restricted: result.restricted, unknown: result.unknown, hidden: state.valuesHidden })}
    <dl class="investment-liquidity__values">
      <div><dt>Disponível para resgate</dt><dd>${money(result.available)}</dd></div>
      <div><dt>Restrita ou com prazo</dt><dd>${money(result.restricted)}</dd></div>
      <div><dt>Não informada</dt><dd>${money(result.unknown)}</dd></div>
      <div class="is-highlight"><dt>Cobertura das despesas de ${monthLabel(point.month)}</dt><dd>${coverage}</dd></div>
    </dl>
    <details class="disclosure"><summary>Como a cobertura é calculada</summary><p>A classificação é informada por você, não inferida pela classe do ativo. A cobertura usa apenas saldos declarados disponíveis, sem somar contas ou reserva. Não é projeção de liquidez futura. Consulte prazos, custos e restrições reais de resgate.</p></details>
  </section>`
}
