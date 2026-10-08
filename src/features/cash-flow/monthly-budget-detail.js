import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { cashFlowProjectionState } from '../../domain/planning-horizon.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'

export const monthlyBudgetDialog = `<dialog class="cash-edit-dialog monthly-budget-dialog" data-monthly-budget-dialog aria-labelledby="monthly-budget-detail-title"><div data-monthly-budget-content></div></dialog>`

export function monthlyBudgetComposition(state, month, period = 'target') {
  return cashFlowTimeline(cashFlowProjectionState(state, period), month, 1, { includeBreakdown: true })[0]
}

export function renderMonthlyBudgetComposition(state, month, period = 'target') {
  if (state.valuesHidden) return ''
  const point = monthlyBudgetComposition(state, month, period)
  const money = value => privateCurrency(value, false, true, state.currency)
  const frequencies = { monthly: 'Mensal', annual: 'Valor anual dividido por 12', occasional: 'Eventual' }
  const costs = [...point.breakdown.costs, ...point.breakdown.goals]
  const group = (title, entries, total) => `<section class="monthly-budget-group"><h3>${title} <span class="money-value">${money(total)}</span></h3>${entries.length ? `<ul class="monthly-budget-entries">${[...entries].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR')).map(item => `<li><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.source)}</small><small>${escapeHtml(frequencies[item.frequency] || item.frequency)}${item.currency !== state.currency ? ` · ${privateCurrency(item.originalAmount, false, true, item.currency)} na moeda original` : ''}</small>${item.startDate || item.endDate || item.retirement ? `<small>Início: ${escapeHtml(item.startDate || 'Sem data inicial')}. Fim: ${escapeHtml(item.retirement ? `Antes da aposentadoria em ${item.retirement}` : item.endDate || 'Sem data final')}.</small>` : ''}</div><span class="money-value">${money(item.amount)}</span></li>`).join('')}</ul>` : '<p>Sem lançamentos previstos neste mês.</p>'}</section>`
  return `<div class="cash-edit-dialog__header"><h2 id="monthly-budget-detail-title">Composição de ${escapeHtml(formatMonth(month))}</h2><button type="button" class="icon-button" data-close-monthly-budget aria-label="Fechar composição">×</button></div><dl class="metric-row"><div><dt>Receitas previstas</dt><dd class="money-value">${money(point.income)}</dd></div><div><dt>Despesas e metas previstas</dt><dd class="money-value">${money(point.expenses)}</dd></div><div data-tone="${point.balance < 0 ? 'negative' : 'positive'}"><dt>Saldo previsto</dt><dd class="money-value">${money(point.balance)}</dd></div></dl><p>${point.balance < 0 ? `Despesas e metas superam as receitas em ${money(-point.balance)}.` : 'As receitas previstas cobrem as despesas e metas deste mês.'} Despesas listadas do maior para o menor valor.</p>${group('Receitas', point.breakdown.income, point.income)}${group('Despesas e metas', costs, point.expenses)}${point.breakdown.pension.length ? `${group('Previdência', point.breakdown.pension, point.pension)}<p>${point.pensionInExpenses ? 'A previdência já está incluída nas despesas acima.' : 'A previdência externa fica fora do saldo do orçamento.'}</p>` : ''}<p>Valores mensais equivalentes na moeda da visão, com a mesma vigência, câmbio e origem da previdência usados na tabela. Realizados não entram nesta previsão.</p><div class="cash-edit-dialog__actions"><button type="button" class="button button--secondary" data-close-monthly-budget>Voltar à tabela</button></div>`
}
