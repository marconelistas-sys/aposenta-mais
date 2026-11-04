// Aba "Categorias" do Orçamento: a lista é a tela. Uma linha por categoria de
// despesa (Planejado, Realizado, Diferença e uma barra) que abre os
// lançamentos para editar. O mês vem do seletor global; a aba escolhe só o
// período (o mês, janeiro até o mês ou o ano) e a ordem. Sem matemática nova.
// A leitura do mês fica em Conferir o mês; a do ano, no Panorama.
// Plano: docs/product/categorias.md.
import { entryLink } from '../../shared/budget-category-entries.js'
import { budgetAnnualQuota, budgetExpenseAccumulated } from '../../domain/budget-expense-overruns.js'
import { buildBudgetYear, budgetExpenseCategories } from '../../domain/budget-overview.js'
import { otherExpenseAnalysis } from '../../domain/other-expense-analysis.js'
import { monthTiming } from '../../domain/month-check.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

export const budgetCategoriesView = { period: 'month', sort: 'difference' }
export function resetBudgetCategories() { Object.assign(budgetCategoriesView, { period: 'month', sort: 'difference' }) }

const minus = '−'
const toCents = value => Math.round((Number(value) || 0) * 100)
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)
const monthName = month => formatMonth(month).replace(/ de \d{4}$/, '')
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
const sortLabels = { difference: 'Maior diferença', actual: 'Maior realizado', planned: 'Maior planejado', category: 'Nome (A a Z)' }

// Rows of the period, in cents, from the existing domain functions.
function periodRows(state, today) {
  const reference = state.cashFlow.referenceMonth || '2026-01'
  const year = Number(reference.slice(0, 4))
  const monthNumber = Number(reference.slice(5, 7))
  const period = budgetCategoriesView.period === 'to-date' && monthNumber === 1 ? 'month' : budgetCategoriesView.period
  const model = buildBudgetYear(state, year)
  let source, actualMonths, monthCount, label, timing
  if (period === 'year') {
    const result = budgetExpenseCategories(model.annual)
    source = result.categories
    actualMonths = result.actualMonths
    monthCount = 12
    label = `Ano de ${year}`
    const currentYear = today.getUTCFullYear()
    timing = year < currentYear ? 'past' : year === currentYear ? 'current' : 'future'
  } else if (period === 'to-date') {
    const result = budgetExpenseAccumulated(model, monthNumber)
    // Categories planned only after the month come with no entries: they
    // belong to the rest of the year, not to January–month.
    source = result.categories.filter(row => row.entries.planned.length || row.entries.actual.length)
    actualMonths = result.actualMonths
    monthCount = monthNumber
    label = `Janeiro a ${monthName(reference)} de ${year}`
    timing = monthTiming(reference, today)
  } else {
    const result = budgetExpenseCategories(model.months[monthNumber - 1])
    source = result.categories
    actualMonths = result.actualMonths
    monthCount = 1
    label = capitalize(formatMonth(reference))
    timing = monthTiming(reference, today)
  }
  const rows = source.map(group => {
    const plannedCents = toCents(group.planned)
    const actualCents = toCents(group.actual)
    const hasActual = group.entries.actual.length > 0
    const hasPlanned = group.entries.planned.length > 0
    return {
      categoryId: group.categoryId, category: group.category, entries: group.entries,
      planned: plannedCents / 100, actual: actualCents / 100,
      hasPlanned, hasActual, unplanned: hasActual && !hasPlanned,
      difference: hasActual ? (actualCents - plannedCents) / 100 : null,
      percent: hasActual && plannedCents > 0 ? Math.round((actualCents - plannedCents) / plannedCents * 100) : null
    }
  })
  return { reference, year, monthNumber, period, rows, actualMonths, monthCount, label, timing, usage: period === 'year' && timing === 'current' }
}

function sortRows(rows, sort) {
  const byName = (a, b) => a.category.localeCompare(b.category, 'pt-BR')
  if (sort === 'category') return rows.sort(byName)
  if (sort === 'difference') return rows.sort((a, b) => (a.difference === null) - (b.difference === null) || (a.difference === null ? b.planned - a.planned : b.difference - a.difference) || byName(a, b))
  return rows.sort((a, b) => b[sort] - a[sort] || byName(a, b))
}

function formatters(state) {
  const hidden = state.valuesHidden
  const money = value => privateCurrency(Math.abs(value), hidden, true, state.currency)
  const signed = value => hidden || Math.abs(value) < 0.005 ? money(value) : `${value > 0 ? '+' : minus}${money(value)}`
  const percent = value => `${value > 0 ? '+' : value < 0 ? minus : ''}${Math.abs(value)}%`
  return { hidden, money, signed, percent }
}

// One bar per row: actual within plan, the part above plan in alert colour,
// planned without actual in a light tone, and a mark at the plan.
function bar(row, scale) {
  const at = value => `${Math.min(100, value / scale * 100).toFixed(3)}%`
  const within = Math.min(row.actual, row.planned)
  const over = Math.max(0, row.actual - row.planned)
  return `<span class="category-bar" aria-hidden="true">${row.planned > 0 ? `<span class="category-bar__planned" style="width:${at(row.planned)}"></span>` : ''}${within > 0 ? `<span class="category-bar__actual" style="width:${at(within)}"></span>` : ''}${over > 0 ? `<span class="category-bar__over" style="left:${at(row.planned)};width:${at(over)}"></span>` : ''}${row.planned > 0 ? `<span class="category-bar__mark" style="left:${at(row.planned)}"></span>` : ''}</span>`
}

function differenceCell(row, f, usage, quota) {
  if (f.hidden) return `<span class="category-row__diff"><span class="sr-only">Diferença: </span>${row.difference === null ? '<span aria-hidden="true">—</span><span class="sr-only">sem comparação</span>' : f.money(0)}</span>`
  if (usage && row.planned > 0) {
    const used = Math.round(quota.get(row.categoryId) ?? 0)
    return `<span class="category-row__diff" data-tone="${used > 100 ? 'unfavorable' : 'neutral'}"><span class="sr-only">Usado do planejado do ano: </span>Usado: ${used}%</span>`
  }
  if (row.difference === null) return '<span class="category-row__diff" data-tone="neutral"><span class="sr-only">Diferença: </span><span aria-hidden="true">—</span><span class="sr-only">sem comparação</span></span>'
  const over = row.difference >= 0.005
  const word = over ? ' acima do planejado' : row.difference <= -0.005 ? ' abaixo do planejado' : ''
  return `<span class="category-row__diff" data-tone="${over ? 'unfavorable' : 'neutral'}"><span class="sr-only">Diferença: </span>${f.signed(row.difference)}${word ? `<span class="sr-only">${word}</span>` : ''}${row.percent !== null && row.difference !== 0 ? `<small>${f.percent(row.percent)}</small>` : ''}</span>`
}

function entryDate(entry, period) {
  if (period === 'month' && entry.frequency === 'occasional' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) return `${entry.date.slice(8, 10)}/${entry.date.slice(5, 7)}`
  if (period === 'month' && entry.frequency === 'annual') return 'anual ÷ 12'
  if (period === 'month' && entry.frequency === 'monthly') return 'mensal'
  return formatMonth(entry.month)
}

function entryList(entries, kind, state, f, period) {
  if (!entries.length) return ''
  const sorted = [...entries].sort((a, b) => b.amount - a.amount || String(a.description).localeCompare(String(b.description), 'pt-BR'))
  const notes = entry => `${entry.plannedExpenseLink ? ` · Vinculado automaticamente ao planejado: ${escapeHtml(entry.plannedExpenseLink.description)}` : entry.plannedExpenseLinkStatus === 'ambiguous' ? ' · Mais de um planejamento compatível, sem vínculo automático' : ''}${entry.frequency === 'annual' && period !== 'month' ? ' · Proporção mensal do valor anual' : ''}${entry.currency !== state.currency ? ` · Convertido de ${escapeHtml(entry.currency)}` : ''}`
  return `<div class="category-entries__group"><h4>${kind === 'actual' ? 'Realizado' : 'Planejado'} (${entries.length})</h4><ul>${sorted.map(entry => `<li><span class="category-entries__name">${f.hidden ? escapeHtml(entry.description) : entryLink(entry, state)}<small>${escapeHtml(entryDate(entry, period))}${notes(entry)}</small></span><span class="category-entries__value">${f.money(entry.amount)}</span></li>`).join('')}</ul></div>`
}

// Outras despesas: groups suggested by the description, to recategorize.
function otherSuggestions(rows, state, f, period) {
  const groups = otherExpenseAnalysis(rows, { existingItems: state.cashFlow?.items || [], customCategories: state.customCategories || [] })
  if (!groups.length) return ''
  return `<section class="category-suggestions" data-other-expense-analysis><h4>Sugestões pela descrição</h4><p>Agrupado pela descrição. A categoria só muda quando você edita o lançamento.</p>${groups.map(group => `<details class="budget-category-details category-suggestion" data-budget-category-details="${escapeHtml(group.categoryId)}"><summary><span>${escapeHtml(group.category)}</span><span class="category-entries__value">${f.money(group.actual || group.planned)}</span></summary><div class="category-entries">${entryList(group.entries.actual, 'actual', state, f, period)}${entryList(group.entries.planned, 'planned', state, f, period)}</div></details>`).join('')}</section>`
}

function categoryRow(row, context) {
  const { state, f, scale, usage, quota, info, rows } = context
  const planMonth = info.period === 'month' ? info.reference : row.entries.actual[0]?.month || info.reference
  const addPlan = row.unplanned && !f.hidden ? `<p class="category-row__actions"><button type="button" class="button button--secondary" data-plan-budget-category="${escapeHtml(row.categoryId)}" data-plan-budget-month="${escapeHtml(planMonth)}" aria-label="Adicionar planejado: ${escapeHtml(row.category)}">Adicionar planejado</button></p>` : ''
  const suggestions = row.categoryId === 'other-expense' && !f.hidden ? otherSuggestions(rows, state, f, info.period) : ''
  return `<details class="budget-category-details category-row" data-budget-category-details="${escapeHtml(row.categoryId)}"><summary class="category-row__summary">
    <span class="category-row__name"><span class="category-row__chevron" aria-hidden="true">›</span><span>${escapeHtml(row.category)}</span>${row.unplanned ? '<small class="category-row__tag">sem planejado</small>' : ''}</span>
    <span class="category-row__planned${row.hasPlanned ? '' : ' is-empty'}" data-label="planejado"><span class="sr-only">Planejado: </span>${row.hasPlanned ? f.money(row.planned) : 'Sem planejado'}</span>
    <span class="category-row__actual${row.hasActual ? '' : ' is-empty'}" data-label="realizado"><span class="sr-only">Realizado: </span>${row.hasActual ? f.money(row.actual) : 'Nada lançado'}</span>
    ${differenceCell(row, f, usage, quota)}
    ${f.hidden ? '' : bar(row, scale)}
  </summary><div class="category-entries">${entryList(row.entries.actual, 'actual', state, f, info.period)}${entryList(row.entries.planned, 'planned', state, f, info.period)}${addPlan}${suggestions}</div></details>`
}

function header(state, info, f) {
  const monthLabel = capitalize(monthName(info.reference))
  const periods = [['month', monthLabel], ...(info.monthNumber > 1 ? [['to-date', `Janeiro a ${monthName(info.reference)}`]] : []), ['year', `Ano de ${info.year}`]]
  const sort = f.hidden ? 'category' : budgetCategoriesView.sort
  const select = (key, label, options, selected, disabled = false) => `<label class="form-field"><span>${label}</span><select data-budget-category-control="${key}" ${disabled ? 'disabled aria-describedby="budget-categories-sort-hidden"' : ''}>${options.map(([value, text]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`
  const when = `${info.label} · ${escapeHtml(state.currency)}${info.timing === 'current' ? ' · em andamento' : ''}`
  return `<header class="budget-category-heading"><div><h2 id="budget-categories-title" tabindex="-1">Despesas por categoria</h2><p class="budget-category-period">${when}</p></div><div class="budget-category-controls">${select('period', 'Período', periods, info.period)}${select('sort', 'Ordenar por', Object.entries(sortLabels), sort, f.hidden)}${f.hidden ? '<p id="budget-categories-sort-hidden" class="sr-only">Com os valores ocultos, a lista fica em ordem alfabética.</p>' : ''}</div></header>${f.hidden ? `<div class="budget-categories-hidden"><p>Valores ocultos.</p><button type="button" class="button button--secondary" data-budget-categories-show-values>${icon('eye', 18)} Mostrar valores</button></div>` : ''}`
}

function footer(state, info) {
  const notes = ['Diferença = realizado menos planejado.']
  if (info.usage) notes.push(`${info.year} ainda não terminou. Usado é o realizado até agora sobre o planejado do ano. <a href="/panorama?aba=gastos" data-route>Ver o ritmo do ano no Panorama</a>`)
  else if (info.timing === 'future') notes.push(`${info.period === 'year' ? info.year : capitalize(monthName(info.reference))} ainda não começou. Mostrando só o planejado.`)
  else if (!info.rows.some(row => row.hasActual)) notes.push(`Nada lançado como realizado ${info.period === 'month' ? `em ${monthName(info.reference)}` : info.period === 'year' ? `em ${info.year}` : `de janeiro a ${monthName(info.reference)}`}.`)
  else if (info.monthCount > 1) notes.push(`Realizados lançados em ${info.actualMonths} de ${info.monthCount} meses.`)
  const rules = `<details class="disclosure budget-categories-rules"><summary>Como os valores são calculados</summary><ul>
    <li>A diferença é o realizado menos o planejado.</li>
    <li>Valores anuais entram como 1/12 em cada mês. Eventuais entram no mês da data.</li>
    <li>Metas anuais, calendário e consórcios entram como despesa planejada.</li>
    <li>Aplicações, resgates e transferências próprias ficam fora das despesas, exceto tarifas identificadas.</li>
    <li>Valores em outras moedas usam o câmbio da visão, em ${escapeHtml(state.currency)}.</li>
    <li>“Janeiro a ${escapeHtml(monthName(info.reference))}” compara só esses meses. “Ano de ${info.year}” usa o planejado do ano inteiro.</li>
  </ul></details>`
  return `<footer class="budget-categories-footer"><p>${notes.join(' ')}</p>${rules}</footer>`
}

export function renderBudgetCategories(state, { today = new Date() } = {}) {
  const info = periodRows(state, today)
  const f = formatters(state)
  const rows = sortRows(info.rows, f.hidden ? 'category' : budgetCategoriesView.sort)
  const head = header(state, info, f)
  if (!rows.length) {
    const subject = info.period === 'year' ? String(info.year) : info.label
    return `<section class="budget-categories panel" data-budget-categories>${head}<div class="budget-categories-empty"><p><strong>${escapeHtml(subject)} não tem despesas planejadas nem realizadas.</strong></p><p>Planeje o mês ou importe um extrato.</p><button type="button" class="button button--primary" data-new-cash-item data-new-cash-item-kind="planned">${icon('plus', 18)} Planejar o mês</button></div></section>`
  }
  const scale = Math.max(1, ...rows.flatMap(row => [row.planned, row.actual]))
  const quota = new Map(info.usage ? budgetAnnualQuota(rows.map(row => ({ ...row, annualPlanned: row.planned }))).categories.map(row => [row.categoryId, row.usedPercent]) : [])
  const context = { state, f, scale, usage: info.usage, quota, info, rows }
  const plannedCents = rows.reduce((sum, row) => sum + toCents(row.planned), 0)
  const actualCents = rows.reduce((sum, row) => sum + toCents(row.actual), 0)
  const anyActual = rows.some(row => row.hasActual)
  const total = { categoryId: 'total', category: 'Total', planned: plannedCents / 100, actual: actualCents / 100, hasPlanned: plannedCents > 0, hasActual: anyActual, difference: anyActual ? (actualCents - plannedCents) / 100 : null, percent: anyActual && plannedCents > 0 ? Math.round((actualCents - plannedCents) / plannedCents * 100) : null }
  const totalQuota = info.usage ? new Map([['total', budgetAnnualQuota([{ ...total, annualPlanned: total.planned }]).categories[0]?.usedPercent ?? 0]]) : quota
  const missing = rows.filter(row => !row.hasActual && row.planned > 0)
  const missingNote = !f.hidden && !info.usage && anyActual && missing.length ? `<p class="category-total__note">Inclui ${f.money(missing.reduce((sum, row) => sum + toCents(row.planned), 0) / 100)} planejados sem realizado em ${plural(missing.length, 'categoria', 'categorias')}.</p>` : ''
  const columns = `<div class="category-list__head" aria-hidden="true"><span>Categoria</span><span>Planejado</span><span>Realizado</span><span>${info.usage ? 'Usado' : 'Diferença'}</span><span></span></div>`
  const totalRow = `<div class="category-total" data-budget-category-total><span class="category-row__name">Total de despesas</span><span class="category-row__planned" data-label="planejado"><span class="sr-only">Planejado: </span>${f.money(total.planned)}</span><span class="category-row__actual" data-label="realizado"><span class="sr-only">Realizado: </span>${anyActual ? f.money(total.actual) : 'Nada lançado'}</span>${differenceCell(total, f, info.usage, totalQuota)}<span></span></div>`
  return `<section class="budget-categories panel" data-budget-categories>${head}<div class="category-list" role="list" aria-label="Despesas por categoria">${columns}${rows.map(row => `<div role="listitem">${categoryRow(row, context)}</div>`).join('')}${totalRow}${missingNote}</div>${footer(state, info)}</section>`
}

export function bindBudgetCategoriesInteractions(root, getState) {
  root.addEventListener('change', event => {
    const control = event.target.closest('[data-budget-category-control]')
    if (!control) return
    const key = control.dataset.budgetCategoryControl
    const value = control.value
    if (key === 'period' && ['month', 'to-date', 'year'].includes(value)) budgetCategoriesView.period = value
    else if (key === 'sort' && Object.hasOwn(sortLabels, value)) budgetCategoriesView.sort = value
    else return
    const container = root.querySelector('[data-budget-categories]')
    if (!container) return
    // Re-render the tab only; the categories that were open stay open.
    const open = new Set([...container.querySelectorAll('[data-budget-category-details][open]')].map(node => node.dataset.budgetCategoryDetails))
    container.outerHTML = renderBudgetCategories(getState())
    for (const node of root.querySelectorAll('[data-budget-categories] [data-budget-category-details]')) if (open.has(node.dataset.budgetCategoryDetails)) node.open = true
    root.querySelector(`[data-budget-category-control="${key}"]`)?.focus({ preventScroll: true })
  })
}
