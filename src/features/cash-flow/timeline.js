import { state } from '../../app/state.js'
import { cashFlowTimeline, retirementMonth } from '../../domain/cash-flow-timeline.js'
import { privateCurrency } from '../../shared/formatters.js'
import { renderBudgetInsights } from './budget-insights.js'

export const timelineView = { period: '12' }

export function renderCashFlowTimeline() {
  const retirement = state.cashFlow.retirementMonth || retirementMonth(state.plan)
  const start = state.cashFlow.referenceMonth
  const distance = (Number(retirement.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(retirement.slice(5)) - Number(start.slice(5))
  const months = timelineView.period === 'retirement' ? Math.min(1200, Math.max(12, distance + 24)) : timelineView.period === '60' ? 60 : 12
  const points = cashFlowTimeline(state, start, months)
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const deficit = points.find(point => point.balance < 0)
  const max = Math.max(1, ...points.flatMap(point => [point.income, point.expenses]))
  const x = index => 30 + index / Math.max(1, points.length - 1) * 740
  const path = key => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${(170 - point[key] / max * 140).toFixed(1)}`).join(' ')
  const marker = points.findIndex(point => point.month === retirement)
  const undated = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency === 'occasional' && !item.startDate).length
  const openSalaries = state.cashFlow.items.filter(item => item.categoryId === 'salary' && item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency !== 'occasional' && !item.endDate && item.endMode !== 'retirement').length
  return `<section class="panel settings-card" aria-labelledby="timeline-title">
    <h2 id="timeline-title">Receitas e despesas ao longo do tempo</h2>
    <label>Período <select data-timeline-period><option value="12" ${timelineView.period === '12' ? 'selected' : ''}>12 meses</option><option value="60" ${timelineView.period === '60' ? 'selected' : ''}>5 anos</option><option value="retirement" ${timelineView.period === 'retirement' ? 'selected' : ''}>Até 2 anos após a aposentadoria</option></select></label>
    <form data-budget-retirement-form><label>Mês da aposentadoria no orçamento <input type="month" name="retirementMonth" min="2000-01" max="2199-12" value="${retirement}" required /></label><button type="submit" class="button button--secondary">Confirmar mês e recalcular vínculos</button></form>
    <p>${state.cashFlow.retirementMonth ? 'Mês confirmado' : 'Sugestão pelas idades do plano, ainda não confirmada'}: ${retirement}. Receitas vinculadas terminam no mês anterior. Datas manuais não mudam. Este mês confirmado controla o orçamento e a projeção patrimonial. Alterar as idades gera uma nova estimativa de mês, que você pode revisar.</p>
    ${!state.cashFlow.retirementMonth && state.cashFlow.items.some(item => item.endMode === 'retirement') ? '<p>Há receitas vinculadas sem mês confirmado. Elas ficam fora dos cálculos até você confirmar o mês.</p>' : ''}
    <p>De ${start} a ${points.at(-1).month}.</p>
    ${openSalaries ? `<p>Revise ${openSalaries} receita(s) de salário sem data final. Elas continuam na previsão após o marco da aposentadoria até você definir o término.</p>` : ''}
    ${undated ? `<p>${undated} lançamento(s) eventual(is) sem data foram excluídos desta série. Informe uma data no cadastro para incluí-los.</p>` : ''}
    <p>${deficit ? `Primeiro mês com despesas acima das receitas neste período: ${deficit.month}.` : 'Não há déficit no orçamento previsto deste período.'} Confira os prazos dos lançamentos antes de interpretar o resultado.</p>
    ${state.valuesHidden ? '<p>Valores ocultos. Gráfico oculto.</p>' : `<svg viewBox="0 0 800 200" role="img" aria-label="Comparação de receitas e despesas previstas. Valores detalhados na tabela abaixo."><line x1="30" y1="170" x2="770" y2="170" stroke="currentColor"/><text x="5" y="175">0</text><path d="${path('income')}" fill="none" stroke="#167354" stroke-width="3"/><path d="${path('expenses')}" fill="none" stroke="#b44326" stroke-width="3" stroke-dasharray="7 4"/>${marker >= 0 ? `<line x1="${x(marker)}" y1="20" x2="${x(marker)}" y2="170" stroke="currentColor" stroke-dasharray="2 4"/><text x="30" y="15">Marco pontilhado: aposentadoria</text>` : ''}<text x="30" y="195">${start}</text><text x="700" y="195">${points.at(-1).month}</text></svg>`}
    <p>Receitas: linha contínua. Despesas: linha tracejada. Saldo mensal na tabela.</p>
    <details><summary>Ver valores por mês</summary><div class="currency-table"><table><caption>Orçamento mensal previsto em ${state.currency}</caption><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Saldo</th></tr></thead><tbody>${points.map(point => `<tr><th scope="row">${point.month}${point.month === retirement ? ' · Aposentadoria' : ''}</th><td>${money(point.income)}</td><td>${money(point.expenses)}</td><td>${money(point.balance)}</td></tr>`).join('')}</tbody></table></div></details>
    <p>Orçamento mensal equivalente, não saldo bancário: valores anuais divididos por 12, meses de início e fim incluídos integralmente. Câmbio e valores constantes, sem inflação ou rendimentos. Realizados e eventuais sem data não entram. Benefícios de aposentadoria só entram se cadastrados como receita, com início definido. Esta série não ajusta os aportes constantes da projeção patrimonial.</p>
  </section>${renderBudgetInsights(state, points)}`
}
