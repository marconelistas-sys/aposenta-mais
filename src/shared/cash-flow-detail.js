import { renderBudgetPressure, expenseImpactAction } from './budget-pressure.js'
import { escapeHtml, privateCurrency } from './formatters.js'
import { renderBudgetComparison } from './budget-comparison.js'
import { renderRemainingWealth, remainingWealthPeaks } from './remaining-wealth.js'
import { renderCashFlowResult } from './cash-flow-result.js'

const frequencies = { monthly: 'Mensal', annual: 'Anual, provisionada por mês', occasional: 'Eventual' }

export function cashFlowDetailPanels(rows, plan, currency, hidden = false, { wealthTargetAge = plan.targetAge } = {}) {
  if (hidden) return []
  const referenceYear = Number((plan.horizonReferenceMonth || new Date().toISOString().slice(0, 7)).slice(0, 4))
  const money = value => privateCurrency(value, false, true, currency)
  const targetYear = Number.isInteger(wealthTargetAge) && Number.isInteger(plan.currentAge) ? referenceYear + wealthTargetAge - plan.currentAge : null
  const wealthPeaks = remainingWealthPeaks(rows, targetYear)
  return rows.map(row => {
    if (!row.breakdown) return null
    const age = plan.currentAge + Number(row.year) - referenceYear
    const label = `${row.year}, idade estimada ${age}`
    const group = (key, title, total, empty) => `<section class="cash-flow-detail-group"><h4>${title} <span class="money-value">${money(total)}</span></h4>${row.breakdown[key].length ? `<div class="table-scroll" role="region" tabindex="0" aria-label="${title} de ${escapeHtml(row.year)}"><table><thead><tr><th scope="col">Lançamento e origem</th><th scope="col">Total no período</th></tr></thead><tbody>${[...row.breakdown[key]].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR')).map(item => `<tr><th scope="row"><details><summary>${escapeHtml(item.name)}</summary><p>${escapeHtml(item.category)} · ${escapeHtml(item.source)}. ${escapeHtml(frequencies[item.frequency] || item.frequency)}. Incluído em ${item.months} mês(es).</p><p>Total na moeda original: ${privateCurrency(item.originalAmount, false, true, item.currency)}.</p>${item.startDate || item.endDate || item.retirement ? `<p>Início: ${escapeHtml(item.startDate || 'Sem data inicial')}. Fim: ${escapeHtml(item.retirement ? `Antes da aposentadoria em ${item.retirement}` : item.endDate || 'Sem data final')}.</p>` : ''}${key === 'costs' ? expenseImpactAction(item, row, plan.targetAge) : ''}</details></th><td><span class="money-value">${money(item.amount)}</span></td></tr>`).join('')}</tbody></table></div>` : `<p>${empty}</p>`}</section>`
    const income = row.income, costs = row.costs, goals = row.goals, pension = row.pensionCredits
    const html = `<h3>Composição de ${escapeHtml(label)}</h3>${renderRemainingWealth(row, currency, wealthPeaks)}${renderBudgetComparison(row, currency)}${renderBudgetPressure(row, currency, { targetAge: plan.targetAge, showSummary: false })}<details class="disclosure"><summary>Como o saldo afeta o patrimônio neste período</summary>${renderCashFlowResult(row, currency)}<p>Receitas ${money(income)} menos custos ${money(costs)} e metas ${money(goals)} = saldo do orçamento ${money(row.freeCashFlow)}. Totais em ${escapeHtml(currency)}, pelos mesmos lançamentos do gráfico. ${row.priceBasis ? `Valores ${row.priceBasis === 'nominal' ? 'nominais de cada ano' : `reais de ${row.priceBaseYear}`}. Totais na moeda original abaixo permanecem na base real do cadastro.` : ''}</p></details>
      <h4>Composição completa, do maior para o menor valor</h4><div class="cash-flow-detail-grid">${group('income', 'Receitas', income, 'Nenhuma receita prevista neste período.')}${group('costs', 'Despesas, sem metas', costs, 'Nenhuma despesa prevista neste período. Confira se essa ausência é intencional.')}${group('goals', 'Metas', goals, 'Nenhuma meta prevista neste período.')}</div>
      <details class="disclosure"><summary>Previdência e liberações, informações complementares</summary><p>Previdência externa não é despesa do saldo do orçamento. No modo financiado, a contribuição também aparece em Despesas, mas é descontada apenas uma vez. Liberações transferem saldo já existente, não são receita.</p>${group('pension', 'Créditos previdenciários', pension, 'Nenhum crédito previdenciário neste período.')}${group('releases', 'Liberações', row.releases || 0, 'Nenhuma liberação calculada neste período.')}</details>
      ${Number.isFinite(row.financialReturn) ? `<p>Resultado do retorno ${row.priceBasis === 'nominal' ? 'nominal implícito' : 'real'}: ${money(row.financialReturn)}. Variação dos ativos financeiros: ${money(row.financialChange)}. O rendimento capitalizado não entra novamente nas receitas.</p>` : '<p>Recorte do orçamento mensal, sem projeção de rendimentos ou liberações. Use o horizonte até a idade-alvo ou até 100 anos para avaliar o patrimônio.</p>'}
      <p>Valores anuais são provisionados nos meses ativos. Ampliar o horizonte não renova lançamentos encerrados. <a href="/orcamento" data-route>Revisar lançamentos no orçamento</a>.</p>`
    return { label, html }
  })
}

export function cashFlowDetailIndex(details, selectedYear) {
  if (!/^\d{4}$/.test(String(selectedYear ?? ''))) return 0
  let closest = 0, distance = Infinity
  for (let index = 0; index < (details?.length || 0); index++) {
    const year = String(details[index]?.label || '').match(/^\d{4}(?=\D|$)/)?.[0]
    if (!year) continue
    const difference = Math.abs(Number(year) - Number(selectedYear))
    if (difference < distance) { closest = index; distance = difference }
  }
  return closest
}

export function renderCashFlowDetailNavigation(details, initialIndex = 0) {
  if (!details?.length || details.some(detail => !detail)) return ''
  const selected = Number.isInteger(initialIndex) ? Math.max(0, Math.min(details.length - 1, initialIndex)) : 0
  return `<div class="chart-detail-navigation"><p>Clique ou toque no gráfico para fixar um ano. Use as setas e Enter, ou os controles abaixo. A composição permanece aberta ao mover o ponteiro.</p><div class="chart-year-controls"><button type="button" data-chart-step="-1" ${selected === 0 ? 'disabled' : ''}>Ano anterior</button><label>Ano da composição <select data-chart-year>${details.map((detail, index) => `<option value="${index}"${index === selected ? ' selected' : ''}>${escapeHtml(detail.label)}</option>`).join('')}</select></label><button type="button" data-chart-step="1" ${selected === details.length - 1 ? 'disabled' : ''}>Próximo ano</button></div><p data-chart-selection-status role="status">Ano ${escapeHtml(details[selected].label)} selecionado</p></div>
    <section class="cash-flow-detail-panel" data-chart-detail-panel aria-label="Composição do período selecionado"><div data-chart-detail-content>${details[selected].html}</div></section>
    ${details.map((detail, index) => `<template data-chart-detail-template="${index}">${detail.html}</template>`).join('')}`
}
