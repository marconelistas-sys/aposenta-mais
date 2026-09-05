import { state } from '../../app/state.js'
import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { summarizeLiquidity } from '../../domain/liquidity.js'
import { privateCurrency } from '../../shared/formatters.js'
export const liquidityLabels = { unknown: 'Não informada', available: 'Disponível para resgate', restricted: 'Restrita ou com prazo' }
export function renderLiquidity() {
  const point = cashFlowTimeline(state, state.cashFlow.referenceMonth, 1)[0]
  const result = summarizeLiquidity(state.plan, point.expenses)
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  return `<section class="panel settings-card"><h2>Liquidez declarada da Carteira</h2><dl><dt>Disponível para resgate</dt><dd>${money(result.available)}</dd><dt>Restrita ou com prazo</dt><dd>${money(result.restricted)}</dd><dt>Não informada</dt><dd>${money(result.unknown)}</dd></dl><p>Cobertura das despesas de ${point.month}: ${state.valuesHidden ? 'valor oculto' : result.coverageMonths === null ? 'não calculável, sem despesas previstas' : `${result.coverageMonths.toFixed(1)} meses`}.</p><p>A classificação é informada por você, não inferida pela classe do ativo. Consulte os prazos, custos e restrições reais de resgate. A cobertura usa apenas saldos declarados disponíveis, sem somar contas ou reserva. Não é projeção de liquidez futura.</p></section>`
}
