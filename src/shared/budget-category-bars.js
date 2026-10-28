import { escapeHtml, privateCurrency } from './formatters.js'

export function renderBudgetCategoryBars(categories, state, periodLabel, { fullYear = false } = {}) {
  if (state.valuesHidden) return ''
  const divisor = fullYear ? 12 : 1
  const money = value => privateCurrency(value, false, true, state.currency)
  const charts = ['actual', 'planned'].map(kind => {
    const rows = categories.filter(row => Number.isFinite(row[kind]) && row[kind] > 0)
      .map(row => ({ ...row, amount: row[kind] / divisor }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'pt-BR'))
    const maximum = rows[0]?.amount || 1
    return `<article class="budget-category-bars-chart"><h4>${kind === 'actual' ? 'Realizado' : 'Planejado'}</h4>${rows.length ? `<ol class="budget-category-bars-list">${rows.map(row => {
      const share = row.amount / maximum
      const color = share >= .2 ? '#bc382a' : share >= .06 ? '#e77b18' : '#20547f'
      return `<li><button type="button" class="budget-category-bars-row" data-budget-expense-categories="${escapeHtml(JSON.stringify([row.categoryId]))}" aria-label="Ver lançamentos de ${escapeHtml(row.category)}: ${escapeHtml(money(row.amount))} por mês"><span class="budget-category-bars-label">${escapeHtml(row.category)}</span><span class="budget-category-bars-track"><span class="budget-category-bars-fill" style="width:${share * 100}%;background:${color}" aria-hidden="true"></span></span><strong class="money-value">${money(row.amount)}</strong></button></li>`
    }).join('')}</ol>` : `<p>Nenhuma despesa ${kind === 'actual' ? 'realizada' : 'planejada'} neste período.</p>`}</article>`
  }).join('')
  return `<section class="budget-category-bars" aria-labelledby="budget-category-bars-title" data-budget-category-bars><h3 id="budget-category-bars-title">${fullYear ? 'Gasto médio mensal' : 'Gasto mensal'} por categoria</h3><p>${escapeHtml(periodLabel)} · ${escapeHtml(state.currency)} / mês${fullYear ? ' · Total anual dividido por 12, incluindo meses sem registros.' : ''}</p>${charts}<p class="budget-expense-pies-method">Categorias em ordem decrescente em cada base. As cores indicam o valor em relação à maior categoria: vermelho a partir de 20%, laranja a partir de 6% e azul abaixo de 6%. Selecione uma barra para ver os lançamentos. Registros realizados podem estar incompletos.</p></section>`
}
