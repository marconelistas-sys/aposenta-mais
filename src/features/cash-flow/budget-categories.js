import { entryDetails } from '../../shared/budget-category-entries.js'
import { budgetExpenseAccumulated } from '../../domain/budget-expense-overruns.js'
import { renderBudgetExpensePies, resetBudgetExpensePieView } from '../../shared/budget-expense-pies.js'
import { buildBudgetYear, budgetExpenseCategories, budgetOverviewYears } from '../../domain/budget-overview.js'
import { escapeHtml, formatMonth, formatPercent, privateCurrency } from '../../shared/formatters.js'

export const budgetCategoriesView = { year: null, month: null, sort: 'difference' }
export function resetBudgetCategories() { resetBudgetExpensePieView(); Object.assign(budgetCategoriesView, { year: null, month: null, sort: 'difference' }) }
const monthName = month => formatMonth(`2026-${month}`).replace(' de 2026', '')
const signed = (value, format) => `${value > 0 ? '+' : ''}${format(value)}`

export function budgetCategoryPieData(state) {
  const reference = state.cashFlow.referenceMonth || '2026-01'
  const year = budgetCategoriesView.year ?? Number(reference.slice(0, 4))
  const month = budgetCategoriesView.month ?? reference.slice(5, 7)
  const model = buildBudgetYear(state, year)
  const period = month === 'all' ? model.annual : model.months[Number(month) - 1]
  return { categories: budgetExpenseCategories(period).categories, periodLabel: month === 'all' ? `Ano de ${year}` : formatMonth(period.key), accumulated: budgetExpenseAccumulated(model, month), fullYear: month === 'all' }
}

export function renderBudgetCategories(state) {
  const reference = state.cashFlow.referenceMonth || '2026-01'
  const year = budgetCategoriesView.year ?? Number(reference.slice(0, 4))
  const month = budgetCategoriesView.month ?? reference.slice(5, 7)
  const years = [...new Set([...budgetOverviewYears(state), year])].sort((a, b) => a - b)
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
  const control = (key, label, values, selected) => `<label class="form-field"><span>${label}</span><select data-budget-category-control="${key}">${values.map(([value, text]) => `<option value="${value}" ${String(selected) === String(value) ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`
  const header = `<header class="budget-category-heading"><div><h2>Despesas por categoria</h2><p>Compare o planejado com o realizado. Abra uma categoria e selecione um lançamento para editar suas informações.</p></div><div class="budget-category-controls">${control('year', 'Ano', years.map(value => [value, value]), year)}${control('month', 'Período', [['all', 'Ano completo'], ...months.map(value => [value, monthName(value)])], month)}${control('sort', 'Ordenar por', [['actual', 'Maior realizado'], ['planned', 'Maior planejado'], ['difference', 'Maior excesso'], ['category', 'Categoria']], budgetCategoriesView.sort)}</div></header>`
  if (state.valuesHidden) return `<section class="budget-categories" data-budget-categories>${header}<div class="panel budget-overview-hidden"><h3>Valores ocultos</h3><p>Exiba os valores para consultar as despesas por categoria.</p></div></section>`
  const model = buildBudgetYear(state, year)
  const period = month === 'all' ? model.annual : model.months[Number(month) - 1]
  const { categories, totals, actualMonths } = budgetExpenseCategories(period)
  categories.sort((a, b) => budgetCategoriesView.sort === 'category' ? a.category.localeCompare(b.category, 'pt-BR') : (b[budgetCategoriesView.sort] ?? -Infinity) - (a[budgetCategoriesView.sort] ?? -Infinity) || a.category.localeCompare(b.category, 'pt-BR'))
  const money = value => privateCurrency(value, false, true, state.currency)
  const maximum = Math.max(1, ...categories.flatMap(group => [group.planned, group.actual]))
  const valueCell = (group, kind) => `<td><span>${group.entries[kind].length ? money(group[kind]) : 'Sem registros'}</span>${kind === 'planned' && group.unplanned ? `<button type="button" class="budget-category-entry-link" data-plan-budget-category="${escapeHtml(group.categoryId)}" data-plan-budget-month="${escapeHtml(month === 'all' ? group.entries.actual[0].month : period.key)}" aria-label="Planejar despesa de ${escapeHtml(group.category)}">Adicionar planejado</button>` : ''}<i class="budget-category-bar budget-category-bar--${kind}" style="width:${group[kind] / maximum * 100}%" aria-hidden="true"></i></td>`
  const rows = categories.map(group => `<tr><th scope="row">${entryDetails(group, state)}</th>${valueCell(group, 'planned')}${valueCell(group, 'actual')}<td class="${group.difference > 0.005 ? 'budget-category-over' : ''}">${group.difference === null ? 'Sem realizado' : signed(group.difference, money)}${group.unplanned ? '<small>Sem planejamento</small>' : ''}</td><td>${group.differencePercent === null ? 'Não calculado' : signed(group.differencePercent, formatPercent)}</td></tr>`).join('')
  const totalDifference = totals.actualCount ? signed(totals.actual - totals.planned, money) : 'Sem realizado'
  return `<section class="budget-categories" data-budget-categories>${header}${renderBudgetExpensePies(categories, state, month === 'all' ? `Ano de ${year}` : formatMonth(period.key), { accumulated: budgetExpenseAccumulated(model, month), fullYear: month === 'all' })}<section class="panel budget-category-panel"><p class="budget-category-period">${escapeHtml(month === 'all' ? `Ano de ${year}` : formatMonth(period.key))} · ${escapeHtml(state.currency)}</p>${categories.length ? `<div class="budget-category-table-scroll" tabindex="0" role="region" aria-label="Comparação de despesas por categoria"><table class="budget-category-table"><caption class="sr-only">Despesas planejadas e realizadas por categoria. Diferença igual ao realizado menos o planejado.</caption><thead><tr><th scope="col">Categoria</th><th scope="col">Planejado</th><th scope="col">Realizado</th><th scope="col">Diferença</th><th scope="col">Variação</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th scope="row">Total de despesas</th><td>${totals.plannedCount ? money(totals.planned) : 'Sem registros'}</td><td>${totals.actualCount ? money(totals.actual) : 'Sem registros'}</td><td>${totalDifference}</td><td>${totals.actualCount && totals.planned > 0 ? signed((totals.actual - totals.planned) / totals.planned, formatPercent) : 'Não calculado'}</td></tr></tfoot></table></div>` : '<p>Nenhuma despesa planejada ou realizada neste período.</p>'}<p class="budget-category-method">Diferença = realizado menos planejado. Valores positivos indicam gasto acima do planejado. Sem planejamento, a variação percentual não é calculada. Ausência de registros realizados não confirma ausência de gastos.${month === 'all' ? ` Há despesas realizadas em ${actualMonths} de 12 meses. A comparação anual inclui todo o planejado, mesmo em meses sem realizado.` : ''}</p><details class="budget-overview-method"><summary>Como as despesas são calculadas</summary><p>A análise segue a vigência dos lançamentos e inclui categorias personalizadas, provisões, calendário e consórcios. Valores anuais são distribuídos por 12. Despesas eventuais entram no mês informado. Valores em outras moedas usam as taxas de câmbio atuais. Aplicações, resgates e transferências próprias ficam fora das despesas, exceto tarifas identificadas.</p></details></section></section>`
}

export function bindBudgetCategoriesInteractions(root, getState, onReferenceMonthChange) {
  root.addEventListener('change', event => {
    const control = event.target.closest('[data-budget-category-control]')
    if (!control) return
    const key = control.dataset.budgetCategoryControl
    const value = control.value
    if (key === 'year' && /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2200) budgetCategoriesView.year = Number(value)
    else if (key === 'month' && /^(all|0[1-9]|1[0-2])$/.test(value)) budgetCategoriesView.month = value
    else if (key === 'sort' && ['actual', 'planned', 'difference', 'category'].includes(value)) budgetCategoriesView.sort = value
    else return
    if (onReferenceMonthChange && (key === 'year' || (key === 'month' && value !== 'all'))) {
      const reference = getState().cashFlow.referenceMonth
      const year = budgetCategoriesView.year ?? Number(reference.slice(0, 4))
      const month = budgetCategoriesView.month === 'all' ? reference.slice(5, 7) : budgetCategoriesView.month ?? reference.slice(5, 7)
      onReferenceMonthChange(`${year}-${month}`, `[data-budget-category-control="${key}"]`)
      return
    }
    const container = root.querySelector('[data-budget-categories]')
    if (!container) return
    container.outerHTML = renderBudgetCategories(getState())
    root.querySelector(`[data-budget-category-control="${key}"]`)?.focus({ preventScroll: true })
  })
}
