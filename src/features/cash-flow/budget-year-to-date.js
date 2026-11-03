import { buildBudgetYearToDate } from '../../domain/budget-year-to-date.js'
import { entryDetails } from '../../shared/budget-category-entries.js'
import { escapeHtml, formatMonth, privateCurrency } from '../../shared/formatters.js'
import { icon } from '../../shared/icons.js'

let cachedData = null
export const budgetYearToDateView = { type: 'expense', sort: 'attention' }
export function resetBudgetYearToDate() { cachedData = null; Object.assign(budgetYearToDateView, { type: 'expense', sort: 'attention' }) }

const sorts = { attention: 'Precisam de atenção primeiro', quota: 'Maior cota anual', actual: 'Maior realizado', category: 'Categoria (A–Z)' }
const statuses = {
  'quota-exceeded': ['Cota anual ultrapassada', 'danger', 'alertTriangle'],
  'quota-exhausted': ['Cota anual esgotada', 'warning', 'alertTriangle'],
  'above-pace': ['Acima do ritmo', 'warning', 'trendUp'],
  anticipated: ['Gasto antecipado', 'info', 'clock'],
  'no-records': ['Sem registros', 'neutral', 'info'],
  'on-track': ['Dentro do planejado', 'success', 'check'],
  'below-forecast': ['Abaixo do previsto', 'warning', 'alertTriangle'],
  'on-forecast': ['Dentro do previsto', 'success', 'check'],
  'above-forecast': ['Acima do previsto', 'success', 'trendUp'],
  'annual-reached': ['Previsão anual atingida', 'success', 'check']
}
const severity = {
  expense: ['quota-exceeded', 'quota-exhausted', 'above-pace', 'anticipated', 'no-records', 'on-track'],
  income: ['below-forecast', 'no-records', 'on-forecast', 'above-forecast', 'annual-reached']
}
const monthOnly = key => formatMonth(key).replace(/ de \d{4}$/, '')
const monthShort = key => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`)).replace('.', '')
const percent = value => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const localMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

function yearToDateData(state) {
  const month = state.cashFlow.referenceMonth
  const key = [state.cashFlow, state.plan, state.exchangeRates, state.customCategories, state.currency, state.lastUpdatedAt, month]
  if (cachedData && key.every((value, index) => value === cachedData.key[index])) return cachedData.value
  const value = buildBudgetYearToDate(state, month)
  cachedData = { key, value }
  return value
}

function sortRows(rows, type, sort) {
  const name = (a, b) => a.category.localeCompare(b.category, 'pt-BR')
  const order = severity[type]
  const compare = {
    attention: (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (type === 'income' ? a.paceDelta - b.paceDelta : b.paceDelta - a.paceDelta) || name(a, b),
    quota: (a, b) => b.annualPlanned - a.annualPlanned || name(a, b),
    actual: (a, b) => b.actual - a.actual || name(a, b),
    category: name
  }[sort] || name
  return [...rows].sort(compare)
}

function chip([label, tone, glyph]) {
  return `<span class="budget-ytd-chip budget-ytd-chip--${tone}">${icon(glyph, 14)}${label}</span>`
}

// Each row is scaled to its own annual quota. Above the quota, the quota ends at
// 85% of the track and the excess fills the 85–100% zone, with a cap when it is cut.
function bullet(row) {
  const quota = row.annualPlanned
  const actual = Math.max(0, row.actual)
  const exceeded = actual > quota
  const scale = exceeded ? 85 : 100
  const over = exceeded ? (actual - quota) / quota * scale : 0
  const fill = Math.min(actual, quota) / quota * scale
  const tick = Math.min(Math.max(0, row.plannedToDate) / quota * scale, scale)
  return `<span class="budget-ytd-bullet" aria-hidden="true"><span class="budget-ytd-track" style="width:${scale}%"></span><span class="budget-ytd-fill" style="width:${fill}%"></span>${exceeded ? `<span class="budget-ytd-over" style="left:${scale}%;width:${Math.min(over, 15)}%"></span>${over > 15 ? '<span class="budget-ytd-cap">›</span>' : ''}` : ''}<span class="budget-ytd-tick" style="left:${tick}%"></span></span>`
}

function reading(row, data, money) {
  const until = monthShort(data.lastMonth)
  const income = row.type === 'income'
  const reference = income ? 'previsto' : 'planejado'
  const pace = !row.entries.actual.length ? `Sem realizado registrado até ${until}`
    : row.status === 'anticipated' ? `Gasto antecipado: nada planejado até ${until}`
      : row.paceDelta > 0 ? `${money(row.paceDelta)} acima do ${reference} até ${until}`
        : row.paceDelta < 0 ? `${money(-row.paceDelta)} abaixo do ${reference} até ${until}`
          : `Igual ao ${reference} até ${until}`
  const quota = income
    ? row.remaining > 0 ? `Falta receber ${money(row.remaining)} no ano` : row.remaining < 0 ? `${money(-row.remaining)} acima da previsão anual` : 'Previsão anual atingida'
    : row.remaining > 0 ? `Restam ${money(row.remaining)} da cota anual` : row.remaining < 0 ? `${money(-row.remaining)} acima da cota anual` : 'Cota anual totalmente utilizada'
  return `${pace} · ${quota}`
}

function categoryRow(row, data, state, money) {
  const month = monthShort(data.lastMonth)
  const quotaLabel = row.type === 'income' ? 'Previsão anual' : 'Cota anual'
  const realized = row.entries.actual.length ? money(row.actual) : 'Sem registros'
  const line = reading(row, data, money)
  const sentence = `Realizado até ${monthOnly(data.lastMonth)}: ${realized}. ${row.type === 'income' ? 'Previsto' : 'Planejado'} até ${monthOnly(data.lastMonth)}: ${money(row.plannedToDate)}. ${quotaLabel}: ${money(row.annualPlanned)}. ${line.replace(' · ', '. ')}.`
  const summary = `<span class="budget-ytd-row-head"><span class="budget-ytd-name">${escapeHtml(row.category)}</span>${chip(statuses[row.status])}</span>${bullet(row)}<span class="budget-ytd-values" aria-hidden="true"><span><small>Realizado até ${month}</small><strong>${realized}</strong></span><span><small>${row.type === 'income' ? 'Previsto' : 'Planejado'} até ${month}</small><strong>${money(row.plannedToDate)}</strong></span><span><small>${quotaLabel}</small><strong>${money(row.annualPlanned)}</strong></span></span><span class="budget-ytd-reading" aria-hidden="true">${line}</span><span class="sr-only">${escapeHtml(sentence)}</span><small class="budget-ytd-more">Ver lançamentos</small>`
  const group = { categoryId: row.categoryId, category: row.category, entries: { planned: row.annualPlannedEntries, actual: row.entries.actual } }
  return `<li data-budget-ytd-category="${escapeHtml(row.categoryId)}" data-budget-ytd-row-status="${row.status}">${entryDetails(group, state, { attribute: 'data-budget-ytd-category-details', lastMonth: data.lastMonth, summary, className: 'budget-ytd-row' })}</li>`
}

function delta(value, type, reference, money) {
  if (!value) return `<dd class="budget-ytd-delta">${money(0)}<small>Igual ao ${reference}</small></dd>`
  const favorable = type === 'income' || type === 'balance' ? value > 0 : value < 0
  return `<dd class="budget-ytd-delta ${favorable ? 'is-favorable' : 'is-unfavorable'}">${value > 0 ? '+' : '−'}${money(Math.abs(value))}<small>${value > 0 ? 'acima' : 'abaixo'} do ${reference}</small></dd>`
}

function card(type, totals, hasActual, data, money) {
  const month = monthShort(data.lastMonth)
  const income = type === 'income'
  const reference = income ? 'previsto' : 'planejado'
  const quotaLabel = income ? 'Previsão anual' : 'Cota anual'
  const remainingLabel = income ? totals.remaining >= 0 ? 'Falta receber no ano' : 'Acima da previsão anual' : totals.remaining >= 0 ? 'Saldo da cota anual' : 'Excesso sobre a cota anual'
  const used = totals.usedPercent
  const meter = used === null ? `<p class="budget-ytd-meter-label">Sem ${income ? 'previsão' : 'cota'} anual cadastrada</p>` : `<div class="budget-ytd-meter"><p class="budget-ytd-meter-label"><span>${income ? 'Previsão recebida' : 'Cota utilizada'}</span><strong>${percent(used)}</strong></p><span class="budget-ytd-meter-track" aria-hidden="true"><span class="budget-ytd-meter-fill ${used > 100 ? 'is-over' : ''}" style="width:${Math.min(100, Math.max(0, used))}%"></span></span></div>`
  return `<article class="budget-overview-card budget-ytd-card budget-ytd-card--${type}"><h3>${income ? 'Receitas' : 'Despesas'}</h3><dl><div><dt>Realizado até ${month}</dt><dd>${hasActual ? money(totals.actual) : 'Sem registros'}</dd></div><div><dt>${income ? 'Previsto' : 'Planejado'} até ${month}</dt><dd>${money(totals.plannedToDate)}</dd></div><div><dt>Diferença</dt>${hasActual ? delta(totals.paceDelta, type, reference, money) : '<dd>Sem realizado</dd>'}</div><div><dt>${quotaLabel} (jan–dez)</dt><dd>${money(totals.annualPlanned)}</dd></div>${used === null ? '' : `<div><dt>${remainingLabel}</dt>${remainingValue(totals.remaining, type, money)}</div>`}</dl>${meter}</article>`
}

// Sinal explícito: positivo com "+", negativo com "−", zero sem sinal.
const signed = (amount, money) => amount > 0 ? `+${money(amount)}` : amount < 0 ? `−${money(-amount)}` : money(0)

// Excesso sobre a cota (despesa) é desfavorável; receita acima da previsão anual é favorável.
// Ainda restar cota ou receita a receber é a situação esperada no meio do ano: fica neutro.
function remainingValue(remaining, type, money) {
  if (remaining >= 0) return `<dd>${money(remaining)}</dd>`
  const tone = type === 'income' ? 'is-favorable' : 'is-unfavorable'
  return `<dd class="${tone}">+${money(-remaining)}</dd>`
}

const balanceStates = {
  surplus: ['Superávit acumulado', 'success', 'trendUp'],
  deficit: ['Déficit acumulado', 'danger', 'alertTriangle'],
  even: ['Saldo zerado', 'neutral', 'info']
}

function balanceCard(data, hasActual, money) {
  const { balance } = data.totals
  const month = monthShort(data.lastMonth)
  const outcome = !hasActual ? '' : balance.actual > 0 ? 'surplus' : balance.actual < 0 ? 'deficit' : 'even'
  const tone = { surplus: 'is-favorable', deficit: 'is-unfavorable' }[outcome] || ''
  const badge = outcome ? chip(balanceStates[outcome]) : ''
  return `<article class="budget-overview-card budget-ytd-card budget-ytd-card--balance"${outcome ? ` data-budget-ytd-balance="${outcome}"` : ''}><header class="budget-ytd-card-head"><h3>Saldo</h3>${badge}</header><dl><div><dt>Saldo acumulado até ${month}</dt><dd class="${`budget-ytd-balance-value ${tone}`.trim()}">${hasActual ? signed(balance.actual, money) : 'Sem registros'}</dd></div><div><dt>Planejado até ${month}</dt><dd>${signed(balance.plannedToDate, money)}</dd></div><div><dt>Diferença</dt>${hasActual ? delta((Math.round(balance.actual * 100) - Math.round(balance.plannedToDate * 100)) / 100, 'balance', 'planejado', money) : '<dd>Sem realizado</dd>'}</div></dl><p class="budget-ytd-meter-label">Receitas menos despesas, de janeiro a ${month}.</p></article>`
}

function unplannedList(rows, type, data, state, money) {
  if (!rows.length) return ''
  return `<details class="disclosure budget-ytd-unplanned" data-budget-ytd-unplanned="${type}"><summary>Sem planejamento no ano: ${rows.length} categoria(s)${type === 'income' ? ' de receita' : ''}</summary><p>Estas categorias têm realizado até ${escapeHtml(monthOnly(data.lastMonth))}, mas nenhum valor planejado de janeiro a dezembro. Por isso não têm cota para comparar.</p><ul>${rows.map(row => `<li><div><span>${escapeHtml(row.category)}</span><strong class="money-value">${money(row.actual)}</strong>${type === 'expense' ? `<button type="button" class="budget-category-entry-link" data-plan-budget-category="${escapeHtml(row.categoryId)}" data-plan-budget-month="${escapeHtml(data.month)}" aria-label="Planejar despesa de ${escapeHtml(row.category)}">Adicionar planejado</button>` : ''}</div>${entryDetails({ ...row, entries: { planned: [], actual: row.entries.actual } }, state, { attribute: 'data-budget-ytd-unplanned-details' })}</li>`).join('')}</ul></details>`
}

function coverageChip(coverage, monthCount, type) {
  const missing = coverage.monthsWithoutActual
  return `<p class="budget-ytd-coverage">${icon('calendar', 14)}<span>Realizado registrado em ${coverage.monthsWithActual.length} de ${monthCount} ${monthCount === 1 ? 'mês' : 'meses'}.${missing.length ? ` Sem registros: ${missing.map(monthShort).join(', ')}. Ausência de registros não confirma ausência de ${type === 'income' ? 'receitas' : 'gastos'}.` : ''}</span></p>`
}

const method = '<details class="budget-overview-method budget-ytd-method"><summary>Como calculamos</summary><p>O planejado segue a vigência dos lançamentos. Valores anuais são divididos por 12 e eventuais entram no mês informado. Não há projeção dos gastos para os meses restantes.</p><p>Realizado até o mês: registros de janeiro até o mês selecionado. Registros posteriores ficam fora da comparação. Cota anual: todo o planejado de janeiro a dezembro. Saldo da cota anual: cota anual menos o realizado até o mês.</p></details>'

export function renderBudgetYearToDate(state, { today = new Date() } = {}) {
  const month = state.cashFlow.referenceMonth
  const year = month.slice(0, 4)
  const title = month.endsWith('-01') ? `Acumulado de janeiro de ${year}` : `Acumulado de janeiro a ${monthOnly(month)} de ${year}`
  const heading = extra => `<header class="budget-ytd-heading"><div><p class="eyebrow">ACUMULADO DO ANO</p><h2 id="budget-ytd-title" tabindex="-1">${escapeHtml(title)}</h2><p>Compare o que foi planejado e realizado no ano, por categoria, até o mês selecionado.</p></div>${extra}</header>`
  const wrap = content => `<section class="budget-ytd" data-budget-ytd aria-labelledby="budget-ytd-title"><div class="sr-only" role="status" aria-live="polite" data-budget-ytd-status></div><div class="budget-ytd-content" data-budget-ytd-content>${content}</div></section>`
  if (state.valuesHidden) return wrap(`${heading('')}<div class="panel budget-overview-hidden"><p>Valores ocultos. Exiba os valores para consultar o acumulado.</p></div>`)
  const data = yearToDateData(state)
  const money = value => privateCurrency(value, false, true, state.currency)
  const type = budgetYearToDateView.type
  const key = type === 'income' ? 'income' : 'expenses'
  const coverage = data.coverage[key]
  const hasActual = { expense: data.coverage.expenses.monthsWithActual.length > 0, income: data.coverage.income.monthsWithActual.length > 0 }
  const notices = [
    month > localMonth(today) ? `${monthOnly(month).replace(/^./, letter => letter.toUpperCase())} de ${year} ainda não chegou. O realizado mostra apenas o que já foi registrado.` : '',
    data.isDecember ? 'Em dezembro, o planejado até o mês é igual à cota anual.' : '',
    data.convertedCurrencies.length ? `Valores em ${state.currency} com as taxas de câmbio atuais. Convertidos de ${data.convertedCurrencies.join(', ')}.` : ''
  ].filter(Boolean).map(text => `<p class="budget-ytd-notice">${icon('info', 16)}<span>${escapeHtml(text)}</span></p>`).join('')
  if (!data.totals.expenses.annualPlanned && !data.totals.income.annualPlanned) {
    return wrap(`${heading('')}<div class="panel budget-empty budget-ytd-empty"><h3>Nenhum planejamento cadastrado para ${year}.</h3><p>Cadastre receitas e despesas planejadas para comparar o realizado com o ano.</p><button type="button" class="button button--primary" data-new-cash-item>Adicionar lançamento</button></div>${unplannedList(data.unplanned.expenses, 'expense', data, state, money)}${unplannedList(data.unplanned.income, 'income', data, state, money)}`)
  }
  const rows = sortRows(data.categories[key], type, budgetYearToDateView.sort)
  const income = type === 'income'
  const legend = `<ul class="budget-ytd-legend" aria-label="Legenda das barras"><li><i class="budget-ytd-key budget-ytd-key--fill budget-ytd-key--${type}"></i>Barra: realizado até o mês</li><li><i class="budget-ytd-key budget-ytd-key--tick"></i>Marca: ${income ? 'previsto' : 'planejado'} até o mês</li><li><i class="budget-ytd-key budget-ytd-key--track"></i>Fim da trilha: ${income ? 'previsão anual' : 'cota anual'} (jan–dez)</li><li><i class="budget-ytd-key budget-ytd-key--over"></i>Hachurado: acima da ${income ? 'previsão anual' : 'cota anual'}</li></ul>`
  const controls = `<div class="budget-ytd-controls"><div class="budget-view-switch" role="group" aria-label="Tipo de lançamento exibido"><button type="button" data-budget-ytd-type="expense" aria-pressed="${!income}">Despesas</button><button type="button" data-budget-ytd-type="income" aria-pressed="${income}">Receitas</button></div><label class="form-field budget-ytd-sort"><span>Ordenar por</span><select data-budget-ytd-sort>${Object.entries(sorts).map(([value, label]) => `<option value="${value}" ${value === budgetYearToDateView.sort ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>`
  const list = rows.length
    ? `${legend}<ul class="budget-ytd-rows budget-ytd-rows--${type}" aria-label="${income ? 'Receitas' : 'Despesas'} por categoria">${rows.map(row => categoryRow(row, data, state, money)).join('')}</ul>`
    : `<p class="budget-ytd-none">Nenhuma categoria de ${income ? 'receita' : 'despesa'} com planejamento em ${year}.</p>`
  const noActual = hasActual[type] ? '' : `<p class="budget-ytd-notice">${icon('info', 16)}<span>Nenhum realizado registrado de janeiro a ${escapeHtml(monthOnly(month))}.</span></p>`
  return wrap(`${heading(coverageChip(coverage, data.monthCount, type))}${notices}<div class="budget-overview-cards budget-ytd-cards">${card('expense', data.totals.expenses, hasActual.expense, data, money)}${card('income', data.totals.income, hasActual.income, data, money)}${balanceCard(data, hasActual.expense || hasActual.income, money)}</div><section class="panel budget-ytd-panel" aria-labelledby="budget-ytd-list-title"><div class="budget-ytd-panel-heading"><h3 id="budget-ytd-list-title">${income ? 'Receitas' : 'Despesas'} por categoria</h3><p>${escapeHtml(state.currency)} · janeiro a ${escapeHtml(monthOnly(month))} de ${year}. Abra uma categoria para ver e editar os lançamentos.</p></div>${controls}${noActual}${list}${unplannedList(data.unplanned[key], type, data, state, money)}${method}<p class="budget-ytd-footer"><a href="/orcamento?aba=visao" data-route>Ver mês a mês</a></p></section>`)
}

export function bindBudgetYearToDateInteractions(root, getState) {
  const refresh = focusSelector => {
    const content = root.querySelector('[data-budget-ytd-content]')
    if (!content) return
    const template = document.createElement('template')
    template.innerHTML = renderBudgetYearToDate(getState())
    content.replaceWith(template.content.querySelector('[data-budget-ytd-content]'))
    root.querySelector(focusSelector)?.focus({ preventScroll: true })
    const status = root.querySelector('[data-budget-ytd-status]')
    const count = root.querySelectorAll('[data-budget-ytd-category]').length
    if (status) status.textContent = `${budgetYearToDateView.type === 'income' ? 'Receitas' : 'Despesas'}: ${count} categoria(s), ordenadas por ${sorts[budgetYearToDateView.sort].toLocaleLowerCase('pt-BR')}.`
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-budget-ytd-type]')
    if (!button) return
    const type = button.dataset.budgetYtdType
    if (!['expense', 'income'].includes(type) || type === budgetYearToDateView.type) return
    budgetYearToDateView.type = type
    refresh(`[data-budget-ytd-type="${type}"]`)
  })
  root.addEventListener('change', event => {
    const select = event.target.closest('[data-budget-ytd-sort]')
    if (!select || !Object.hasOwn(sorts, select.value)) return
    budgetYearToDateView.sort = select.value
    refresh('[data-budget-ytd-sort]')
  })
}
