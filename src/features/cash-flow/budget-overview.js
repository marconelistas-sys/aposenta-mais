import { buildBudgetYear, budgetBarBreakdown, budgetOverviewYears } from '../../domain/budget-overview.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

let cachedData = null
export const budgetOverviewView = { year: null, period: 'months', metric: 'expenses' }
export function resetBudgetOverview() { cachedData = null; Object.assign(budgetOverviewView, { year: null, period: 'months', metric: 'expenses' }) }
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

function chart(periods, state) {
  const metric = budgetOverviewView.metric
  const max = niceMaximum(Math.max(...periods.flatMap(period => ['planned', 'actual'].map(kind => Math.abs(period[kind][metric])))))
  const negative = metric === 'balance' && periods.some(period => period.planned.balance < 0 || period.actual.balance < 0)
  const minimum = negative ? -max : 0
  const height = 248
  const y = value => (max - value) / (max - minimum) * height
  const zero = y(0)
  const ticks = Array.from({ length: 5 }, (_, index) => max - index * (max - minimum) / 4)
  const number = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  const axis = ticks.map(value => `<span style="top:${y(value)}px">${escapeHtml(number(value))}</span>`).join('')
  const columns = periods.map(period => {
    const bars = ['planned', 'actual'].map(kind => {
      const value = period[kind][metric]
      const exists = metric === 'balance' ? period[kind].count > 0 : period.entries[kind].some(entry => entry.type === (metric === 'income' ? 'income' : 'expense'))
      const top = value >= 0 ? y(value) : zero
      const size = Math.max(Math.abs(y(value) - zero), 3)
      const label = `${periodName(period.key)}, ${kinds[kind]}, ${titles[metric]}: ${exists ? money(value, state) : 'Sem registros'}`
      return `<button type="button" class="budget-bar budget-bar--${kind} ${exists ? '' : 'budget-bar--empty'}" data-budget-bar="${escapeHtml(period.key)}:${kind}" aria-label="${escapeHtml(label)}" aria-expanded="false" aria-controls="budget-bar-detail" style="top:${Math.min(top, height - 3)}px;height:${size}px"><span class="sr-only">${escapeHtml(label)}</span></button>`
    }).join('')
    return `<div class="budget-chart-column"><div class="budget-chart-pair">${bars}</div><span class="budget-chart-label">${period.key.length === 4 ? period.key : monthName(period.key)}</span></div>`
  }).join('')
  return `<div class="budget-chart-grid"><div class="budget-chart-axis" aria-hidden="true">${axis}</div><div class="budget-chart-scroll"><div class="budget-chart-periods" style="--budget-columns:${periods.length}"><div class="budget-chart-lines" aria-hidden="true">${ticks.map(value => `<i class="${value === 0 ? 'is-zero' : ''}" style="top:${y(value)}px"></i>`).join('')}</div>${columns}</div></div></div>`
}

export function renderBudgetOverview(state) {
  const year = budgetOverviewView.year ?? (Number(state.cashFlow.referenceMonth?.slice(0, 4)) || 2026)
  const years = [...new Set([...budgetOverviewYears(state), year])].sort((a, b) => a - b)
  const controls = `<div class="budget-overview-controls"><label>${budgetOverviewView.period === 'years' ? 'Ano central' : 'Ano'}<select data-budget-overview-year>${years.map(value => `<option value="${value}" ${value === year ? 'selected' : ''}>${value}</option>`).join('')}</select></label><div class="budget-view-switch" role="group" aria-label="Período do gráfico"><button type="button" data-budget-overview-period="months" aria-pressed="${budgetOverviewView.period === 'months'}">Meses</button><button type="button" data-budget-overview-period="years" aria-pressed="${budgetOverviewView.period === 'years'}">Anos</button></div></div>`
  const header = `<header class="budget-overview-heading"><div><p class="eyebrow">PLANEJADO E REALIZADO</p><h2>Seu orçamento, ${budgetOverviewView.period === 'years' ? 'ano a ano' : 'mês a mês'}</h2><p>Compare os valores e veja o que compõe cada barra.</p></div>${controls}</header>`
  if (state.valuesHidden) return `<section class="budget-overview" data-budget-overview>${header}<div class="panel budget-overview-hidden"><h3>Valores ocultos</h3><p>Exiba os valores para consultar o gráfico e sua composição.</p></div></section>`
  const { selected, periods } = overviewData(state)
  const cards = Object.entries(titles).map(([key, title]) => `<button type="button" class="budget-overview-card" data-budget-overview-metric="${key}" aria-pressed="${budgetOverviewView.metric === key}"><span>${title} <small>${year}</small></span><dl><div><dt>Planejado</dt><dd>${selected.annual.planned.count ? money(selected.annual.planned[key], state) : 'Sem registros'}</dd></div><div><dt>Realizado</dt><dd>${selected.annual.actual.count ? money(selected.annual.actual[key], state) : 'Sem registros'}</dd></div></dl></button>`).join('')
  return `<section class="budget-overview" data-budget-overview>${header}<div class="budget-overview-cards" aria-label="Totais do ano. Selecione o indicador do gráfico">${cards}</div><section class="panel budget-overview-chart" aria-labelledby="budget-chart-title"><div class="budget-chart-heading"><div><h3 id="budget-chart-title">${titles[budgetOverviewView.metric]} ${budgetOverviewView.period === 'years' ? 'por ano' : `em ${year}`}</h3><p>${escapeHtml(state.currency)} · ${budgetOverviewView.period === 'years' ? 'Totais de cada ano' : 'Valores mensais'}</p></div><div class="budget-chart-legend"><span><i class="is-planned"></i>Planejado</span><span><i class="is-actual"></i>Realizado</span></div></div>${chart(periods, state)}<div class="budget-chart-footer"><span>Passe o cursor sobre uma barra ou selecione para ver os detalhes.</span><span>Realizado em ${selected.annual.actualMonths} de 12 meses de ${year}.</span></div></section><details class="budget-overview-method"><summary>Como os valores são calculados</summary><p>O planejado segue a vigência dos lançamentos, das provisões anuais, do calendário e dos consórcios. Valores anuais são distribuídos por 12. Eventuais entram no mês informado. O realizado considera os registros cadastrados e importados, inclusive os vinculados em Contas. Meses sem registros não indicam ausência de gastos. Todos os valores usam a moeda e as taxas de câmbio atuais do aplicativo. O saldo é receitas menos despesas.</p></details><aside id="budget-bar-detail" class="budget-bar-detail" data-budget-bar-detail hidden role="region" aria-label="Composição da barra"></aside></section>`
}

function detail(period, kind, state) {
  const metric = budgetOverviewView.metric
  const groups = budgetBarBreakdown(period, kind, metric)
  const rows = groups.map(group => `<details class="budget-detail-category"><summary><span>${escapeHtml(group.category)}</span><strong>${money(group.amount, state)}</strong></summary><ul>${group.entries.map(entry => `<li><span>${escapeHtml(entry.description)}<small>${escapeHtml(period.key.length === 4 ? `${monthName(entry.month)} · ` : '')}${entry.frequency === 'annual' ? 'Proporção mensal do valor anual' : entry.currency !== state.currency ? `Convertido de ${escapeHtml(entry.currency)}` : entry.type === 'income' ? 'Receita' : 'Despesa'}</small></span><strong>${money(entry.amount, state)}</strong></li>`).join('')}</ul></details>`).join('')
  return `<div class="budget-detail-heading"><div><small>${kinds[kind]} · ${titles[metric]}</small><h4>${escapeHtml(periodName(period.key))}</h4></div><button type="button" data-close-budget-detail aria-label="Fechar composição">×</button></div><strong class="budget-detail-total">${money(period[kind][metric], state)}</strong>${groups.length ? `<div class="budget-detail-categories">${rows}</div><p class="budget-detail-hint">Selecione uma categoria para ver os lançamentos.${metric === 'balance' ? ' Despesas aparecem com sinal negativo.' : ''}</p>` : '<p>Sem registros para este indicador e período.</p>'}`
}

export function bindBudgetOverviewInteractions(root, getState) {
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
    const attribute = ['data-budget-overview-year', 'data-budget-overview-period', 'data-budget-overview-metric'].find(name => control.hasAttribute(name))
    const value = control.getAttribute(attribute)
    container.outerHTML = renderBudgetOverview(getState())
    root.querySelector(attribute === 'data-budget-overview-year' ? `[${attribute}]` : `[${attribute}="${value}"]`)?.focus({ preventScroll: true })
  }
  const show = (bar, pin = false) => {
    clearTimeout(closeTimer)
    if (getState().valuesHidden) return close()
    const panel = root.querySelector('[data-budget-bar-detail]')
    if (!panel) return
    if (activeBar === bar && !panel.hidden) { pinned ||= pin; return }
    pinned = pin
    const [key, kind] = bar.dataset.budgetBar.split(':')
    const period = overviewData(getState()).periods.find(period => period.key === key)
    if (!period) return
    activeBar?.setAttribute('aria-expanded', 'false')
    activeBar = bar
    bar.setAttribute('aria-expanded', 'true')
    panel.innerHTML = detail(period, kind, getState())
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
    const control = event.target.closest('[data-budget-overview-year]')
    if (!control) return
    const year = Number(control.value)
    if (!Number.isInteger(year) || year < 1900 || year > 2200) return
    budgetOverviewView.year = year
    refresh(control)
  })
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
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && activeBar) { event.preventDefault(); dismiss() } })
  window.addEventListener('resize', close)
  document.addEventListener('scroll', event => {
    if (event.target.closest?.('[data-budget-bar-detail]') || pinned) return
    if (activeBar?.isConnected && (activeBar.matches(':hover') || document.activeElement === activeBar)) show(activeBar)
    else close()
  }, true)
}
