import { analyzeBudget } from '../../domain/budget-insights.js'
import { privateCurrency } from '../../shared/formatters.js'

export function renderBudgetInsights(state, points) {
  const insight = analyzeBudget(points, state.cashFlow.currentEmergencyReserve, state.cashFlow.retirementMonth)
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const coverage = state.valuesHidden ? 'Valor oculto' : insight.coverageMonths === null ? 'Não calculável: sem despesas previstas no primeiro mês' : `${insight.coverageMonths.toFixed(1)} meses`
  return `<details class="panel settings-card"><summary>Explorar reserva, despesas e transição para aposentadoria</summary>
    <h3>Quanto a reserva atual cobre?</h3><p>${coverage}</p>
    <p>Reserva cadastrada dividida pelas despesas previstas de ${points[0].month}. Considera todas as despesas do orçamento, incluindo provisões anuais. É uma relação estática, sem entradas de renda, resgates, rendimentos ou evolução futura da reserva. Não soma investimentos à reserva.</p>
    <h3>E se as despesas mudarem?</h3>
    <div class="currency-table"><table><caption>Sensibilidade no período ${points[0].month} a ${points.at(-1).month}</caption><thead><tr><th scope="col">Despesas</th><th scope="col">Primeiro déficit</th><th scope="col">Meses com déficit</th><th scope="col">Menor saldo mensal</th></tr></thead><tbody>${insight.sensitivity.map(row => `<tr><th scope="row">${row.multiplier === 1 ? 'Orçamento cadastrado' : row.multiplier < 1 ? '10% menores' : `${Math.round((row.multiplier - 1) * 100)}% maiores`}</th><td>${state.valuesHidden ? 'Oculto' : row.firstDeficit || 'Nenhum no período'}</td><td>${state.valuesHidden ? 'Oculto' : row.deficitMonths}</td><td>${money(row.worstBalance)}</td></tr>`).join('')}</tbody></table></div>
    <p>Variação uniforme de todas as despesas previstas, inclusive contribuições previdenciárias. Receitas, prazos e rendimentos cadastrados não mudam. Resultado restrito ao período selecionado, sem probabilidade de sucesso ou recomendação de gasto.</p>
    <h3>Momentos da aposentadoria</h3>
    ${insight.checkpoints.length ? `<div class="currency-table"><table><caption>Comparação do orçamento em ${state.currency}</caption><thead><tr><th scope="col">Momento</th><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Saldo</th></tr></thead><tbody>${insight.checkpoints.map(row => `<tr><th scope="row">${row.label}</th><td>${row.month}</td>${row.point ? `<td>${money(row.point.income)}</td><td>${money(row.point.expenses)}</td><td>${money(row.point.balance)}</td>` : '<td colspan="3">Fora do período selecionado. Amplie o período ou ajuste o mês inicial.</td>'}</tr>`).join('')}</tbody></table></div>` : '<p>Confirme o mês de aposentadoria acima para comparar a transição.</p>'}
  </details>`
}
