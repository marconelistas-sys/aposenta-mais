import { buildBudgetYear, budgetBarBreakdown, budgetOverviewYears } from '../../domain/budget-overview.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

let cachedData = null
export const budgetOverviewView = { year: null, period: 'months', metric: 'expenses', income: true, planned: true, actual: true }
export function resetBudgetOverview() { cachedData = null; Object.assign(budgetOverviewView, { year: null, period: 'months', metric: 'expenses', income: true, planned: true, actual: true }) }
const titles = { income: 'Receitas', expenses: 'Despesas', balance: 'Saldo' }
const kinds = { planned: 'Planejado', actual: 'Realizado' }
const monthName = key => new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`)).replace('.', '')
const periodName = key => key.length === 4 ? key : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-15T12:00:00Z`))
const money = (amount, state) => privateCurrency(amount, false, true, state.currency)

function overviewData(state) {
  const year = budgetOverviewView.year ?? (Number(state.cashFlow.referenceMonth?.slice(0, 4)) || 2026)
  const key = [state.cashFlow, state.plan, state.exchangeRates, state.customCategories, state.currency, year, budgetOverviewView.period]
  if (cachedData && key.every((value, index) => value === cachedData.key[index])) return cachedData.value
  const selected = buildBudgetYear(state, year)
  const periods = budgetOverviewView.period === 'years'
    ? Array.from({ length: 5 }, (_, index) => year + index - 2).filter(year => year >= 1900 && year <= 2200).map(year => year === selected.year ? selected.annual : buildBudgetYear(state, year).annual)
    : selected.months
  const value = { year, selected, periods }
  cachedData = { key, value }
  return value
}

function niceMaximum(value) {
  if (!value) return 1
  const padded = value * 1.04
  const step = 10 ** (Math.floor(Math.log10(padded)) - 1)
  return Math.ceil(padded / step) * step
}

const minus = '−'
const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)
const isZero = value => Math.abs(value) < 0.005
const tone = value => isZero(value) ? 'zero' : value > 0 ? 'positive' : 'negative'
const toneWord = { positive: 'positivo', negative: 'negativo', zero: 'zerado' }
const signedMoney = (value, state) => isZero(value) ? money(0, state) : `${value > 0 ? '+' : minus}${money(Math.abs(value), state)}`
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const compactSmall = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const axisNumber = value => value === 0 ? '0' : `${value < 0 ? minus : ''}${(Math.abs(value) < 10 ? compactSmall : compact).format(Math.abs(value))}`
const signedCompact = value => isZero(value) ? '0' : `${value > 0 ? '+' : minus}${compact.format(Math.abs(value))}`
const entryType = metric => metric === 'income' ? 'income' : 'expense'
const hasType = (period, kind, type) => period.entries[kind].some(entry => entry.type === type)
const seriesName = { income: { planned: 'Receitas planejadas', actual: 'Receitas realizadas' }, expenses: { planned: 'Despesas planejadas', actual: 'Despesas realizadas' }, balance: { planned: 'Saldo planejado', actual: 'Saldo realizado' } }
// Must match the plot height in budget-overview.css (.budget-chart-ticks, .budget-chart-plot).
const plotHeight = 260

// Past, current or future relative to today (UTC, as in Conferir o mês).
function timingOf(key, today) {
  const current = key.length === 4 ? today.toISOString().slice(0, 4) : today.toISOString().slice(0, 7)
  return key < current ? 'past' : key === current ? 'current' : 'future'
}

// Monthly balance shown as a marker in the comparison: the actual one when the period has actual
// income, otherwise the planned one. Without actual income the actual balance reads as a deficit
// that did not happen (same rule as Conferir o mês, "Sem receita lançada").
function netMark(period) {
  if (budgetOverviewView.actual && hasType(period, 'actual', 'income')) return { kind: 'actual', value: period.actual.balance }
  if (budgetOverviewView.planned && period.planned.count > 0) return { kind: 'planned', value: period.planned.balance, noActualIncome: budgetOverviewView.actual && period.actual.count > 0 }
  return null
}

function niceStep(raw) {
  const exponent = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].find(factor => factor * exponent >= raw - 1e-12) * exponent
}

function chart(periods, state, today) {
  const comparison = budgetOverviewView.metric !== 'balance'
  if (!budgetOverviewView.planned && !budgetOverviewView.actual) return '<p class="budget-chart-empty" role="status">Selecione Realizado ou Planejado para exibir o gráfico.</p>'
  const metrics = comparison ? (budgetOverviewView.income ? ['income', 'expenses'] : ['expenses']) : ['balance']
  const kindsShown = ['planned', 'actual'].filter(kind => budgetOverviewView[kind])
  // Signed values: income and positive balance above zero, expenses and negative balance below.
  const marks = periods.map(period => {
    const bars = metrics.flatMap(metric => kindsShown
      .filter(kind => metric === 'balance' ? period[kind].count > 0 : hasType(period, kind, entryType(metric)))
      .map(kind => ({ metric, kind, value: metric === 'expenses' ? -period[kind].expenses : period[kind][metric] })))
    return { period, bars, net: comparison && budgetOverviewView.income ? netMark(period) : null }
  })
  const values = marks.flatMap(({ bars, net }) => [...bars.map(bar => bar.value), ...(net ? [net.value] : [])])
  if (!values.length) return `<p class="budget-chart-empty" role="status">Nenhum lançamento ${budgetOverviewView.planned && budgetOverviewView.actual ? 'planejado ou realizado' : budgetOverviewView.planned ? 'planejado' : 'realizado'} ${budgetOverviewView.period === 'years' ? 'nestes anos' : `em ${periods[0].key.slice(0, 4)}`}.</p>`
  const top = Math.max(0, ...values) > 0 ? niceMaximum(Math.max(...values)) : 0
  const bottom = Math.min(0, ...values) < 0 ? -niceMaximum(-Math.min(...values)) : 0
  const span = top - bottom || 1
  const y = value => Math.round((top - value) / span * plotHeight * 100) / 100
  const zero = y(0)
  // One linear scale. Zero and both ends are always labeled; between them, round multiples of a
  // nice step. Labels closer than 16px to one already kept are dropped.
  const step = niceStep(span / 5)
  const multiples = []
  for (let value = step; value < top; value += step) multiples.push(value)
  for (let value = -step; value > bottom; value -= step) multiples.push(value)
  const ticks = []
  for (const value of [0, top, bottom, ...multiples]) {
    if (ticks.some(tick => Math.abs(y(tick) - y(value)) < 16)) continue
    ticks.push(value)
  }
  ticks.sort((a, b) => b - a)
  const axis = ticks.map(value => `<span style="top:${y(value)}px">${escapeHtml(axisNumber(value))}</span>`).join('')
  const lines = ticks.map(value => `<i class="${value === 0 ? 'is-zero' : ''}" style="top:${y(value)}px"></i>`).join('')
  const firstFuture = marks.findIndex(({ period }) => timingOf(period.key, today) === 'future')
  const selectedIndex = marks.findIndex(({ period }) => period.key === state.cashFlow.referenceMonth || period.key === state.cashFlow.referenceMonth?.slice(0, 4))
  const entryIndex = marks.findIndex((mark, index) => index >= Math.max(selectedIndex, 0) && (mark.bars.length || mark.net))
  const columns = marks.map(({ period, bars, net }, index) => {
    const timing = timingOf(period.key, today)
    const name = periodName(period.key)
    const future = timing === 'future' ? `. ${period.key.length === 4 ? 'Ano futuro' : 'Mês futuro'}` : ''
    const entry = index === (entryIndex === -1 ? marks.findIndex(mark => mark.bars.length || mark.net) : entryIndex)
    let tabStop = entry
    const attributes = (kind, metric, label, slot) => {
      const tabindex = tabStop ? '0' : '-1'
      tabStop = false
      return `type="button" data-budget-bar="${escapeHtml(period.key)}:${kind}:${metric}" data-budget-bar-metric="${metric}" data-budget-slot="${slot}" aria-label="${escapeHtml(label)}" aria-expanded="false" aria-controls="budget-bar-detail" tabindex="${tabindex}"`
    }
    const renderBar = ({ metric, kind, value }) => {
      const size = Math.max(Math.abs(y(value) - zero), 2)
      const start = value < 0 ? zero : zero - size
      const amount = metric === 'balance' ? signedMoney(value, state) : money(Math.abs(value), state)
      let label = `${name}, ${seriesName[metric][kind]}: ${amount}${metric === 'balance' ? `, ${toneWord[tone(value)]}` : ''}`
      const other = kind === 'actual' ? 'planned' : 'actual'
      const otherExists = metric === 'balance' ? period[other].count > 0 : hasType(period, other, entryType(metric))
      if (kind === 'actual' && otherExists) {
        const difference = Math.abs(period.actual[metric]) - Math.abs(period.planned[metric])
        if (metric !== 'balance') label += isZero(difference) ? ', igual ao planejado' : `, ${money(Math.abs(difference), state)} ${difference > 0 ? 'acima' : 'abaixo'} do planejado`
      }
      if (metric === 'balance' && kind === 'actual' && !hasType(period, 'actual', 'income')) label += '. Sem receita realizada lançada'
      if (kind === 'planned' && !otherExists && timing !== 'future') label += `. Sem ${metric === 'balance' ? 'registros realizados' : `${titles[metric].toLowerCase()} realizadas`}`
      return `<button ${attributes(kind, metric, `${label}${future}`, `${metric}:${kind}`)} class="budget-bar budget-bar--${kind} budget-bar--${metric}${value < 0 ? ' is-negative' : ''}" data-tone="${tone(value)}" style="top:${start}px;height:${size}px"></button>${kind === 'planned' ? `<i class="budget-target" aria-hidden="true" style="top:${y(value)}px"></i>` : ''}`
    }
    const renderNet = () => net ? `<button ${attributes(net.kind, 'balance', `${name}, ${seriesName.balance[net.kind]}: ${signedMoney(net.value, state)}, ${toneWord[tone(net.value)]}${net.noActualIncome ? '. Sem receita realizada lançada' : ''}${future}`, 'net')} class="budget-net budget-net--${net.kind}" data-tone="${tone(net.value)}" style="top:${y(net.value)}px"></button>` : ''
    // DOM order follows the reading order from top to bottom: income, balance, expenses.
    const markHtml = metrics.map(metric => bars.filter(bar => bar.metric === metric).map(renderBar).join('') + (metric === 'income' ? renderNet() : '')).join('')
    const selected = index === selectedIndex
    const classes = ['budget-chart-column', selected && 'budget-chart-column--selected', timing === 'future' && 'budget-chart-column--future', index === firstFuture && index > 0 && 'budget-chart-column--forecast-start'].filter(Boolean).join(' ')
    const netText = comparison && budgetOverviewView.income ? `<span class="budget-chart-net" ${net ? `data-tone="${tone(net.value)}" data-kind="${net.kind}"` : ''} aria-hidden="true">${net ? escapeHtml(signedCompact(net.value)) : ''}</span>` : ''
    return `<div class="${classes}" ${selected ? 'aria-current="date"' : ''}><div class="budget-chart-plot">${index === firstFuture ? '<span class="budget-chart-forecast" aria-hidden="true">Previsto</span>' : ''}${markHtml}</div><span class="budget-chart-label">${period.key.length === 4 ? period.key : monthName(period.key)}${selected ? `<span class="sr-only">, ${period.key.length === 4 ? 'ano' : 'mês'} selecionado</span>` : ''}</span>${netText}</div>`
  }).join('')
  const netRow = comparison && budgetOverviewView.income ? '<span class="budget-chart-axis-net">Saldo</span>' : ''
  return `<div class="budget-chart" role="group" aria-labelledby="budget-chart-title" aria-describedby="budget-chart-keys"><p id="budget-chart-keys" class="sr-only">Cada ${budgetOverviewView.period === 'years' ? 'ano' : 'mês'} tem um botão por valor. Setas para a esquerda e para a direita mudam de período. Setas para cima e para baixo mudam de valor no mesmo período. A tabela abaixo do gráfico traz todos os valores.</p><div class="budget-chart-grid ${netRow ? 'budget-chart-grid--net' : ''}"><div class="budget-chart-axis" aria-hidden="true"><div class="budget-chart-ticks">${axis}</div>${netRow}</div><div class="budget-chart-scroll"><div class="budget-chart-periods ${comparison ? 'budget-chart-periods--comparison' : ''}" style="--budget-columns:${periods.length}"><div class="budget-chart-lines" aria-hidden="true">${lines}</div>${columns}</div></div></div></div>`
}

function legend(periods, today) {
  const comparison = budgetOverviewView.metric !== 'balance'
  const { planned, actual, income } = budgetOverviewView
  const items = comparison
    ? [
        income && actual && ['actual-income', 'Receitas realizadas'],
        actual && ['actual-expenses', 'Despesas realizadas'],
        planned && ['planned', 'Planejado: o traço marca o valor'],
        income && (planned || actual) && ['net', `Saldo do ${budgetOverviewView.period === 'years' ? 'ano' : 'mês'}: cheio realizado, vazado planejado`]
      ]
    : [
        actual && ['actual-balance', 'Saldo realizado'],
        planned && ['planned', 'Saldo planejado: o traço marca o valor']
      ]
  if ((planned || actual) && periods.some(period => timingOf(period.key, today) === 'future')) items.push(['future', budgetOverviewView.period === 'years' ? 'Anos futuros' : 'Meses futuros'])
  return `<ul class="budget-chart-legend" aria-label="Legenda">${items.filter(Boolean).map(([key, label]) => `<li><i class="budget-key budget-key--${key}" aria-hidden="true"></i>${label}</li>`).join('')}</ul>`
}

function valuesTable(periods, state) {
  const cell = (period, kind, metric) => {
    if (metric === 'balance' ? period[kind].count === 0 : !hasType(period, kind, entryType(metric))) return '<td><span aria-hidden="true">—</span><span class="sr-only">Sem registros</span></td>'
    const value = period[kind][metric]
    if (metric !== 'balance') return `<td>${money(value, state)}</td>`
    const note = kind === 'actual' && !hasType(period, 'actual', 'income') ? '<small>sem receita lançada</small>' : ''
    return `<td data-tone="${tone(value)}">${signedMoney(value, state)}${note}</td>`
  }
  const head = ['income', 'expenses', 'balance'].flatMap(metric => ['planned', 'actual'].map(kind => `<th scope="col">${seriesName[metric][kind]}</th>`)).join('')
  const reference = state.cashFlow.referenceMonth || ''
  const rows = periods.map(period => `<tr${period.key === reference || period.key === reference.slice(0, 4) ? ' aria-current="date"' : ''}><th scope="row">${escapeHtml(capitalize(periodName(period.key)))}</th>${['income', 'expenses', 'balance'].flatMap(metric => ['planned', 'actual'].map(kind => cell(period, kind, metric))).join('')}</tr>`).join('')
  return `<details class="budget-chart-table"><summary>Ver todos os valores em tabela</summary><div class="budget-chart-table-scroll"><table><caption class="sr-only">Valores planejados e realizados ${budgetOverviewView.period === 'years' ? 'por ano' : 'por mês'}, em ${escapeHtml(state.currency)}</caption><thead><tr><th scope="col">${budgetOverviewView.period === 'years' ? 'Ano' : 'Mês'}</th>${head}</tr></thead><tbody>${rows}</tbody></table></div></details>`
}

export function renderBudgetOverview(state, { today = new Date() } = {}) {
  const year = budgetOverviewView.year ?? (Number(state.cashFlow.referenceMonth?.slice(0, 4)) || 2026)
  const years = [...new Set([...budgetOverviewYears(state), year])].sort((a, b) => a - b)
  const controls = `<div class="budget-overview-controls"><label>${budgetOverviewView.period === 'years' ? 'Ano central' : 'Ano'}<select data-budget-overview-year>${years.map(value => `<option value="${value}" ${value === year ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="budget-view-switch" role="group" aria-label="Período do gráfico"><button type="button" data-budget-overview-period="months" aria-pressed="${budgetOverviewView.period === 'months'}">Meses</button><button type="button" data-budget-overview-period="years" aria-pressed="${budgetOverviewView.period === 'years'}">Anos</button></div></div>`
  const header = `<header class="budget-overview-heading"><div><p class="eyebrow">PLANEJADO E REALIZADO</p><h2>Seu orçamento, ${budgetOverviewView.period === 'years' ? 'ano a ano' : 'mês a mês'}</h2><p>Compare os valores e veja o que compõe cada barra. O gráfico mostra ${budgetOverviewView.period === 'years' ? 'os anos ao redor do' : 'o ano do'} mês selecionado.</p></div>${controls}</header>`
  if (state.valuesHidden) return `<section class="budget-overview" data-budget-overview>${header}<div class="panel budget-overview-hidden"><h3>Valores ocultos</h3><p>Exiba os valores para consultar o gráfico e sua composição.</p></div></section>`
  const { selected, periods } = overviewData(state)
  const comparison = budgetOverviewView.metric !== 'balance'
  const chartTitle = comparison ? (budgetOverviewView.income ? 'Receitas e despesas' : 'Despesas') : 'Saldo'
  const filters = `<fieldset class="budget-chart-filters"><legend>Exibir no gráfico</legend>${[['income', 'Receita'], ['actual', 'Realizado'], ['planned', 'Planejado']].filter(([key]) => comparison || key !== 'income').map(([key, label]) => `<label><input type="checkbox" data-budget-chart-filter="${key}" ${budgetOverviewView[key] ? 'checked' : ''}>${label}</label>`).join('')}</fieldset>`
  const cards = Object.entries(titles).map(([key, title]) => `<button type="button" class="budget-overview-card" data-budget-overview-metric="${key}" aria-pressed="${key === 'balance' ? !comparison : key === 'income' ? comparison && (budgetOverviewView.income) : comparison}"><span>${title} <small>${year}</small></span><dl><div><dt>Planejado</dt><dd>${selected.annual.planned.count ? money(selected.annual.planned[key], state) : 'Sem registros'}</dd></div><div><dt>Realizado</dt><dd>${selected.annual.actual.count ? money(selected.annual.actual[key], state) : 'Sem registros'}</dd></div></dl></button>`).join('')
  return `<section class="budget-overview" data-budget-overview>${header}<div class="budget-overview-cards" aria-label="Totais do ano. Receitas e despesas abrem a comparação. Saldo abre sua própria visão">${cards}</div><section class="panel budget-overview-chart" aria-labelledby="budget-chart-title"><div class="budget-chart-heading"><div><h3 id="budget-chart-title">${chartTitle} ${budgetOverviewView.period === 'years' ? 'por ano' : `em ${year}`}</h3><p>${escapeHtml(state.currency)} · ${budgetOverviewView.period === 'years' ? 'Totais de cada ano' : 'Valores mensais'} · ${comparison ? (budgetOverviewView.income ? 'Receitas acima de zero, despesas abaixo' : 'Despesas abaixo de zero') : 'Positivo acima de zero, negativo abaixo'}</p></div>${legend(periods, today)}</div>${filters}${chart(periods, state, today)}${valuesTable(periods, state)}<div class="budget-chart-footer"><span>Passe o cursor ou selecione uma barra${comparison && budgetOverviewView.income ? ' ou um ponto de saldo' : ''} para ver a composição. No teclado, use as setas dentro do gráfico.</span><span>Realizado em ${selected.annual.actualMonths} de 12 meses de ${year}.</span></div></section><details class="budget-overview-method"><summary>Como os valores são calculados</summary><p>O planejado segue a vigência dos lançamentos, das provisões anuais, do calendário e dos consórcios. Valores anuais são distribuídos por 12. Eventuais entram no mês informado. O realizado considera os registros cadastrados e importados, inclusive os vinculados em Contas. Meses sem registros não indicam ausência de gastos. Todos os valores usam a moeda e as taxas de câmbio atuais do aplicativo. O saldo é receitas menos despesas.</p></details><aside id="budget-bar-detail" class="budget-bar-detail" data-budget-bar-detail hidden role="region" aria-label="Composição do valor selecionado"></aside></section>`
}

function detail(period, kind, metric, state) {
  const groups = budgetBarBreakdown(period, kind, metric)
  const rows = groups.map(group => `<details class="budget-detail-category"><summary><span>${escapeHtml(group.category)}</span><strong>${money(group.amount, state)}</strong></summary><ul>${group.entries.map(entry => `<li><span>${escapeHtml(entry.description)}<small>${escapeHtml(period.key.length === 4 ? `${monthName(entry.month)} · ` : '')}${entry.frequency === 'annual' ? 'Proporção mensal do valor anual' : entry.currency !== state.currency ? `Convertido de ${escapeHtml(entry.currency)}` : entry.type === 'income' ? 'Receita' : 'Despesa'}</small></span><strong>${money(entry.amount, state)}</strong></li>`).join('')}</ul></details>`).join('')
  return `<div class="budget-detail-heading"><div><small>${kinds[kind]} · ${titles[metric]}</small><h4>${escapeHtml(periodName(period.key))}</h4></div><button type="button" data-close-budget-detail aria-label="Fechar composição">×</button></div><strong class="budget-detail-total">${money(period[kind][metric], state)}</strong>${groups.length ? `<div class="budget-detail-categories">${rows}</div><p class="budget-detail-hint">Selecione uma categoria para ver os lançamentos.${metric === 'balance' ? ' Despesas aparecem com sinal negativo.' : ''}</p>` : '<p>Sem registros para este indicador e período.</p>'}`
}

// On narrow screens the chart scrolls inside its own box: bring the selected period into view.
// No-op while the tab is hidden or when everything fits.
export function revealSelectedBudgetPeriod(root) {
  const scroller = root.querySelector('[data-budget-overview] .budget-chart-scroll')
  const column = scroller?.querySelector('.budget-chart-column--selected')
  if (!column || scroller.scrollWidth <= scroller.clientWidth + 1) return
  scroller.scrollLeft = Math.max(0, column.offsetLeft - (scroller.clientWidth - column.offsetWidth) / 2)
}

export function bindBudgetOverviewInteractions(root, getState, onReferenceMonthChange) {
  let activeBar = null, closeTimer = null, suppressFocus = false, pinned = false
  const close = () => {
    clearTimeout(closeTimer)
    root.querySelector('[data-budget-bar-detail]')?.setAttribute('hidden', '')
    activeBar?.setAttribute('aria-expanded', 'false')
    activeBar = null
    pinned = false
  }
  const dismiss = () => {
    const previous = activeBar
    close()
    suppressFocus = true
    previous?.focus({ preventScroll: true })
    suppressFocus = false
  }
  const refresh = control => {
    close()
    const container = root.querySelector('[data-budget-overview]')
    if (!container) return
    const attribute = ['data-budget-overview-year', 'data-budget-overview-period', 'data-budget-overview-metric', 'data-budget-chart-filter'].find(name => control.hasAttribute(name))
    const value = control.getAttribute(attribute)
    container.outerHTML = renderBudgetOverview(getState())
    revealSelectedBudgetPeriod(root)
    root.querySelector(attribute === 'data-budget-overview-year' ? `[${attribute}]` : `[${attribute}="${value}"]`)?.focus({ preventScroll: true })
  }
  const show = (bar, pin = false) => {
    clearTimeout(closeTimer)
    if (getState().valuesHidden) return close()
    const panel = root.querySelector('[data-budget-bar-detail]')
    if (!panel) return
    if (activeBar === bar && !panel.hidden) { pinned ||= pin; return }
    pinned = pin
    const [key, kind, metric] = bar.dataset.budgetBar.split(':')
    const period = overviewData(getState()).periods.find(period => period.key === key)
    if (!period) return
    activeBar?.setAttribute('aria-expanded', 'false')
    activeBar = bar
    bar.setAttribute('aria-expanded', 'true')
    panel.innerHTML = detail(period, kind, metric, getState())
    panel.hidden = false
    const rect = bar.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 24)
    panel.style.width = `${width}px`
    panel.style.maxHeight = `${Math.min(420, window.innerHeight - 24)}px`
    const panelHeight = panel.getBoundingClientRect().height
    panel.style.left = `${Math.max(12, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 12))}px`
    panel.style.top = `${Math.max(12, Math.min(rect.top - panelHeight - 10, window.innerHeight - panelHeight - 12))}px`
  }
  root.addEventListener('change', event => {
    const filter = event.target.closest('[data-budget-chart-filter]')
    if (filter) {
      budgetOverviewView[filter.dataset.budgetChartFilter] = filter.checked
      refresh(filter)
      return
    }
    const control = event.target.closest('[data-budget-overview-year]')
    if (!control) return
    const year = Number(control.value)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return
    if (onReferenceMonthChange) {
      onReferenceMonthChange(`${year}-${getState().cashFlow.referenceMonth.slice(5, 7)}`, '[data-budget-overview-year]')
      return
    }
    budgetOverviewView.year = year
    refresh(control)
  })
  const revealAfterTab = event => { if (event.target.closest?.('[data-page-tab^="orcamento:"]')) requestAnimationFrame(() => revealSelectedBudgetPeriod(root)) }
  root.addEventListener('click', revealAfterTab)
  root.addEventListener('keyup', revealAfterTab)
  root.addEventListener('click', event => {
    const period = event.target.closest('[data-budget-overview-period]')
    const metric = event.target.closest('[data-budget-overview-metric]')
    if (period) { budgetOverviewView.period = period.dataset.budgetOverviewPeriod; refresh(period); return }
    if (metric) { budgetOverviewView.metric = metric.dataset.budgetOverviewMetric; refresh(metric); return }
    const bar = event.target.closest('[data-budget-bar]')
    if (bar) { show(bar, true); if (event.detail === 0) root.querySelector('[data-close-budget-detail]')?.focus({ preventScroll: true }); return }
    if (event.target.closest('[data-close-budget-detail]')) { dismiss(); return }
    if (event.target.closest('[data-budget-bar-detail]')) pinned = true
    else close()
  })
  root.addEventListener('pointerover', event => {
    const bar = event.target.closest('[data-budget-bar]')
    if (bar && !bar.contains(event.relatedTarget)) show(bar)
    if (event.target.closest('[data-budget-bar-detail]')) clearTimeout(closeTimer)
  })
  root.addEventListener('pointerout', event => {
    if (pinned || !event.target.closest('[data-budget-bar], [data-budget-bar-detail]')) return
    if (event.relatedTarget?.closest?.('[data-budget-bar], [data-budget-bar-detail]')) return
    closeTimer = setTimeout(close, 180)
  })
  root.addEventListener('focusin', event => { const bar = event.target.closest('[data-budget-bar]'); if (bar && !suppressFocus) show(bar, true) })
  root.addEventListener('focusout', event => {
    if (event.target.closest('[data-budget-bar], [data-budget-bar-detail]') && !event.relatedTarget?.closest?.('[data-budget-bar], [data-budget-bar-detail]')) close()
  })
  // One tab stop inside the chart (roving tabindex). Left/Right change period keeping the same
  // series, Up/Down change value inside the period, Home/End jump to the first and last period.
  const move = (bar, key) => {
    const columns = [...root.querySelectorAll('[data-budget-overview] .budget-chart-column')].filter(column => column.querySelector('[data-budget-bar]'))
    const column = bar.closest('.budget-chart-column')
    const index = columns.indexOf(column)
    if (index === -1) return null
    const within = [...column.querySelectorAll('[data-budget-bar]')]
    if (key === 'ArrowUp' || key === 'ArrowDown') return within[within.indexOf(bar) + (key === 'ArrowUp' ? -1 : 1)] || null
    const target = columns[key === 'Home' ? 0 : key === 'End' ? columns.length - 1 : index + (key === 'ArrowLeft' ? -1 : 1)]
    if (!target || target === column) return null
    const marks = [...target.querySelectorAll('[data-budget-bar]')]
    return marks.find(mark => mark.dataset.budgetSlot === bar.dataset.budgetSlot) || marks[Math.min(within.indexOf(bar), marks.length - 1)]
  }
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeBar) { event.preventDefault(); dismiss(); return }
    const bar = event.target.closest?.('[data-budget-bar]')
    if (!bar || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = move(bar, event.key)
    if (!next) return
    next.focus()
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  })
  root.addEventListener('focusin', event => {
    const bar = event.target.closest('[data-budget-bar]')
    if (!bar) return
    for (const mark of root.querySelectorAll('[data-budget-overview] [data-budget-bar]')) mark.tabIndex = mark === bar ? 0 : -1
  })
  window.addEventListener('resize', close)
  document.addEventListener('scroll', event => {
    if (event.target.closest?.('[data-budget-bar-detail]') || pinned) return
    if (activeBar?.isConnected && (activeBar.matches(':hover') || document.activeElement === activeBar)) show(activeBar)
    else close()
  }, true)
}
