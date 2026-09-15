import { budgetGauge } from './budget-gauge.js'
import { budgetPressure } from '../domain/budget-pressure.js'
import { escapeHtml, privateCurrency } from './formatters.js'

export function expenseImpactAction(item, row, targetAge) {
  if (!Number.isFinite(row.financialReturn) || !Number.isInteger(targetAge) || item.source !== 'Orçamento' || !item.budgetItemId || !['essential', 'variable'].includes(item.budgetGroup)) return ''
  return `<button type="button" class="button button--secondary" data-expense-impact="${escapeHtml(item.budgetItemId)}" data-impact-year="${row.year}" data-impact-age="${targetAge}">Simular redução</button>`
}

export function renderBudgetPressure(row, currency, { limit = 5, monthly = false, targetAge = null, showSummary = true } = {}) {
  const model = budgetPressure(row)
  if (!model.reconciled) return '<p>Não foi possível conciliar a composição das saídas deste período.</p>'
  const money = value => privateCurrency(value, false, true, currency)
  const percent = value => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const top = model.entries.slice(0, limit)
  const rest = model.entries.slice(limit).reduce((sum, item) => sum + item.amount, 0)
  const canSimulate = !monthly && Number.isFinite(row.financialReturn) && Number.isInteger(targetAge)
  return `<section class="budget-pressure" aria-label="Pressão dos gastos no orçamento">${showSummary ? `<div class="pressure-totals"><div><span>Receitas previstas</span><strong class="money-value">${money(model.income)}</strong></div><div><span>Saídas, despesas e metas</span><strong class="money-value">${money(model.outflows)}</strong></div><div data-tone="${model.balance < -0.005 ? 'negative' : 'neutral'}"><span>Saldo antes dos rendimentos</span><strong class="money-value">${money(model.balance)}</strong></div></div>` : ''}
    ${showSummary ? budgetGauge({ income: model.income, expenses: model.outflows, label: 'das receitas em saídas' }) : ''}
    <h4>O que mais pesa ${monthly ? 'neste mês' : 'neste período'}</h4>
    ${showSummary ? `<p class="pressure-reading">${model.income <= 0 ? 'Sem receitas previstas neste período. As saídas dependem de outras fontes, como patrimônio disponível.' : `As saídas consomem ${percent(model.coverage)} das receitas previstas.${model.balance < -0.005 ? ' A diferença precisa de cobertura pelo patrimônio ou de ajustes no orçamento.' : model.balance > 0.005 ? ' O saldo positivo pode contribuir para o patrimônio, conforme as demais premissas.' : ' As receitas e saídas estão equilibradas neste período.'}`}</p>` : ''}
    <p class="pressure-basis">${monthly ? 'Planejado da família inteira, independente dos filtros da lista. Valores mensais equivalentes. Anuais provisionados e previdência conforme a origem configurada.' : `Totais de ${row.year}, ${model.months} meses incluídos. Média mensal = total dividido por ${model.months}, inclusive meses sem ocorrência.`} Valores em ${escapeHtml(currency)}${row.priceBasis === 'nominal' ? ', nominais do ano selecionado' : ', em poder de compra atual'}. Barras e percentuais do ranking representam participação nas saídas.</p>
    ${top.length ? `<ol class="pressure-ranking">${top.map((item, index) => `<li><div class="pressure-rank-heading"><span class="pressure-rank-number">${index + 1}</span><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.kind)} · ${escapeHtml(item.category)}</span></div><strong class="money-value">${money(item.amount)}</strong></div><div class="pressure-bar" aria-hidden="true"><span style="width:${Math.min(100, item.share * 100).toFixed(2)}%"></span></div><div class="pressure-rank-details"><span>${percent(item.share)} das saídas</span>${monthly ? '' : `<span>Média mensal: <span class="money-value">${money(item.monthly)}</span></span>`}${canSimulate && item.adjustable ? `<button type="button" class="button button--secondary" data-expense-impact="${escapeHtml(item.budgetItemId)}" data-impact-year="${row.year}" data-impact-age="${targetAge}">Simular redução</button>` : ''}</div></li>`).join('')}</ol>` : '<p>Nenhuma saída prevista. Confira se o cadastro está completo antes de avaliar a sustentabilidade.</p>'}
    ${rest > 0 ? `<p class="pressure-rest">Demais saídas: <span class="money-value">${money(rest)}</span> · ${percent(rest / model.outflows)} das saídas.${monthly ? ' O cadastro abaixo pode estar filtrado e incluir realizados.' : ' Consulte a lista completa abaixo.'}</p>` : ''}
    ${!monthly && top.length ? '<p class="pressure-basis">Maior valor não significa gasto dispensável. Compromissos, previdência e metas exigem revisão própria.</p>' : ''}</section>`
}
