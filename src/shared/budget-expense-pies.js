import { budgetExpenseDistribution } from '../domain/budget-expense-distribution.js'
import { otherExpenseAnalysis } from '../domain/other-expense-analysis.js'
import { entryDetails } from './budget-category-entries.js'
import { escapeHtml, privateCurrency } from './formatters.js'
import { budgetExpenseOverrunView, renderBudgetExpenseOverruns, updateBudgetExpenseOverruns } from './budget-expense-overruns.js'

export const budgetExpensePieView = { primaryCount: null }
export function resetBudgetExpensePieView() { budgetExpensePieView.primaryCount = null; budgetExpenseOverrunView.threshold = 10; budgetExpenseOverrunView.period = 'month'; budgetExpenseOverrunView.basis = 'to-date' }

const colors = { housing: '#2855c7', groceries: '#228567', transport: '#c56538', health: '#7c69a8', insurance: '#5562a4', shopping: '#aa7a22', subscriptions: '#ad4671', 'other-expense': '#52746d', __remaining: '#64748b' }
export function expenseCategoryColor(id) {
  if (id.startsWith('other-analysis:category:')) return expenseCategoryColor(id.slice('other-analysis:category:'.length))
  if (id === 'other-analysis:fees') return '#64748b'
  if (colors[id]) return colors[id]
  const hash = [...id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
  return `hsl(${hash % 360} 55% 40%)`
}
const percent = share => share < .001 ? 'Menos de 0,1%' : `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const action = segment => `data-budget-expense-categories="${escapeHtml(JSON.stringify(segment.categoryIds))}"`

function pieSvg(segments, kind, money, ariaLabel = null) {
  let angle = -Math.PI / 2
  const slices = segments.map(segment => {
    const end = angle + segment.share * Math.PI * 2
    const point = value => `${(110 + 96 * Math.cos(value)).toFixed(6)} ${(110 + 96 * Math.sin(value)).toFixed(6)}`
    const attributes = `class="budget-expense-slice" fill="${expenseCategoryColor(segment.key)}" tabindex="0" role="button" ${action(segment)} aria-label="Ver ${escapeHtml(segment.label)}: ${percent(segment.share)}, ${escapeHtml(money(segment.amount))}"`
    const single = segment.share === 1
    const shape = single ? `<circle cx="110" cy="110" r="96" ${attributes}>` : `<path d="M110 110 L${point(angle)} A96 96 0 ${segment.share > .5 ? 1 : 0} 1 ${point(end)} Z" ${attributes}>`
    angle = end
    return `${shape}<title>${escapeHtml(segment.label)} · ${percent(segment.share)} · ${escapeHtml(money(segment.amount))}</title>${single ? '</circle>' : '</path>'}`
  }).join('')
  const label = ariaLabel || `Distribuição das despesas ${kind === 'planned' ? 'planejadas' : 'realizadas'} por categoria`
  return `<svg viewBox="0 0 220 220" width="220" height="220" role="group" aria-label="${escapeHtml(label)}">${slices}</svg>`
}

export function renderOtherExpenseAnalysis(categories, state) {
  if (state.valuesHidden) return ''
  const groups = otherExpenseAnalysis(categories, { existingItems: state.cashFlow?.items || [], customCategories: state.customCategories || [] })
  if (!groups.length) return ''
  const model = budgetExpenseDistribution(groups)
  const money = value => privateCurrency(value, false, true, state.currency)
  const cards = ['planned', 'actual'].filter(kind => model[kind].total > 0).map(kind => {
    const total = model[kind].total
    const segments = model[kind].segments.map(segment => segment.key === '__remaining' ? { ...segment, label: 'Demais grupos' } : segment)
    return `<article class="budget-expense-pie-card"><header><h4>Outras despesas ${kind === 'actual' ? 'realizadas' : 'planejadas'}</h4><strong class="money-value">${money(total)}</strong></header><div class="budget-expense-pie-body"><figure>${pieSvg(segments, kind, money, `Distribuição de Outras despesas ${kind === 'actual' ? 'realizadas' : 'planejadas'} por descrição e categoria sugerida`)}<figcaption>100% de Outras despesas ${kind === 'actual' ? 'realizadas' : 'planejadas'}</figcaption></figure><ul class="budget-expense-legend">${segments.map(segment => `<li><button type="button" ${action(segment)}><span class="budget-expense-swatch" style="background:${expenseCategoryColor(segment.key)}" aria-hidden="true"></span><span class="budget-expense-label">${escapeHtml(segment.label)}<small>${money(segment.amount)}</small></span><strong>${percent(segment.share)}</strong></button></li>`).join('')}</ul></div></article>`
  }).join('')
  return `<details class="budget-other-expenses disclosure" data-other-expense-analysis><summary>Analisar Outras despesas <small>${model.actual.total > 0 ? `${money(model.actual.total)} realizados` : `${money(model.planned.total)} planejados`}</small></summary><p>Grupos sugeridos pela descrição e pelo histórico de categorias confirmadas. Descrições sem classificação segura são agrupadas pelo nome reconhecido. As categorias dos lançamentos continuam iguais. Percentuais calculados somente sobre Outras despesas de cada base, no período selecionado.</p><div class="budget-expense-pies-grid">${cards}</div><p>Selecione uma fatia ou grupo para conferir os lançamentos. Clique no lançamento para editar e confirmar sua categoria.</p><div class="budget-other-expense-entries">${groups.map(group => entryDetails(group, state)).join('')}</div></details>`
}

export function renderBudgetExpensePies(categories, state, periodLabel, comparison = {}) {
  if (state.valuesHidden) return ''
  const count = categories.filter(row => (Number.isFinite(row.planned) && row.planned > 0) || (Number.isFinite(row.actual) && row.actual > 0)).length
  const limit = Math.min(count, budgetExpensePieView.primaryCount ?? (count > 6 ? 5 : 6))
  const model = budgetExpenseDistribution(categories, limit)
  const detailLabel = count > limit ? `${limit} categorias individuais e ${count - limit} em Demais categorias` : `Todas as ${count} categorias individualmente`
  const slider = count > 1 ? `<div class="budget-expense-detail-control"><label><span>Detalhamento das categorias</span><input type="range" min="1" max="${count}" step="1" value="${limit}" data-budget-expense-detail aria-label="Quantidade de categorias individuais" aria-valuetext="${detailLabel}" /></label><output data-budget-expense-detail-output aria-live="polite">${detailLabel}</output><p>Menos detalhe agrupa mais categorias. Mais detalhe separa as categorias em fatias individuais nos dois gráficos.</p></div>` : '' 
  const money = value => privateCurrency(value, false, true, state.currency)
  const cards = ['planned', 'actual'].map(kind => {
    const { total, segments } = model[kind]
    return `<article class="budget-expense-pie-card" data-budget-expense-pie="${kind}"><header><h4>Despesas ${kind === 'planned' ? 'planejadas' : 'realizadas'}</h4>${total > 0 ? `<strong class="money-value" data-budget-expense-total>${money(total)}</strong>` : ''}</header>${total > 0 ? `<div class="budget-expense-pie-body"><figure>${pieSvg(segments, kind, money)}<figcaption>100% das despesas ${kind === 'planned' ? 'previstas' : 'registradas'}</figcaption></figure><ul class="budget-expense-legend">${segments.map(segment => `<li><button type="button" ${action(segment)}><span class="budget-expense-swatch" style="background:${expenseCategoryColor(segment.key)}" aria-hidden="true"></span><span class="budget-expense-label">${escapeHtml(segment.label)}<small>${money(segment.amount)}</small></span><strong>${percent(segment.share)}</strong></button></li>`).join('')}</ul></div>` : `<div class="budget-expense-empty"><p>${kind === 'planned' ? 'Nenhuma despesa planejada neste período.' : 'Nenhuma despesa realizada registrada neste período.'}</p>${kind === 'actual' ? '<small>A ausência de registros não confirma ausência de gastos.</small>' : ''}</div>`}</article>`
  }).join('')
  return `<section class="panel budget-expense-pies" data-budget-expense-pies aria-labelledby="budget-expense-pies-title"><header class="budget-expense-pies-heading"><div><h3 id="budget-expense-pies-title" tabindex="-1">Para onde vai o dinheiro</h3><p>${escapeHtml(periodLabel)} · ${escapeHtml(state.currency)}</p></div><span>Selecione uma fatia ou categoria para ver os lançamentos.</span></header>${renderBudgetExpenseOverruns(categories, state, { ...comparison, periodLabel })}${slider}<div class="budget-expense-pies-grid">${cards}</div>${renderOtherExpenseAnalysis(categories, state)}<p class="budget-expense-pies-method">Percentuais sobre as despesas de cada base. Realizados consideram os registros cadastrados e podem estar incompletos.</p><details class="disclosure budget-expense-method"><summary>Como calculamos os gráficos</summary><p> As categorias principais consideram os maiores valores entre planejado e realizado e são as mesmas nos dois gráficos. O controle de detalhamento define quantas categorias aparecem individualmente. Demais categorias reúne as restantes. O agrupamento mantém os totais e os percentuais sobre cada base. Inclui compromissos, provisões e contribuições classificados como despesas. Valores anuais são divididos por 12. Aplicações, resgates e transferências próprias ficam fora, exceto tarifas identificadas. Valores convertidos na moeda da visão. Percentuais arredondados podem não somar exatamente 100%.</p></details></section>`
}

export function bindBudgetExpensePies(root, onDetailChange = null) {
  root.addEventListener('change', event => {
    const basis = event.target.closest?.('[data-budget-overrun-basis]')
    if (basis && onDetailChange && ['to-date', 'annual'].includes(basis.value)) {
      budgetExpenseOverrunView.basis = basis.value
      onDetailChange(basis.closest('[data-budget-expense-pies]'))
      return
    }
    const control = event.target.closest?.('[data-budget-overrun-period]')
    if (!control || !onDetailChange || !['month', 'year-to-date'].includes(control.value)) return
    budgetExpenseOverrunView.period = control.value
    onDetailChange(control.closest('[data-budget-expense-pies]'))
  })
  root.addEventListener('input', event => {
    const threshold = event.target.closest?.('[data-budget-overrun-threshold]')
    if (threshold && onDetailChange) {
      const value = Number(threshold.value)
      if (!Number.isInteger(value) || value < 0 || value > 100) return
      budgetExpenseOverrunView.threshold = value
      onDetailChange(threshold.closest('[data-budget-expense-pies]'))
      return
    }
    const slider = event.target.closest?.('[data-budget-expense-detail]')
    if (!slider || !onDetailChange) return
    const count = Number(slider.value)
    if (!Number.isInteger(count)) return
    budgetExpensePieView.primaryCount = count
    onDetailChange(slider.closest('[data-budget-expense-pies]'))
  })
  const open = target => {
    const trigger = target.closest?.('[data-budget-expense-categories]')
    if (!trigger) return false
    const categories = trigger.closest('[data-budget-categories]')
    if (!categories) return false
    const ids = JSON.parse(trigger.dataset.budgetExpenseCategories)
    const accumulated = trigger.closest('[data-budget-overruns]')?.querySelector('[data-budget-overrun-category-details]')
    const selector = accumulated ? '[data-budget-overrun-category-details]' : '[data-budget-category-details]'
    const details = [...categories.querySelectorAll(selector)].filter(item => ids.includes(accumulated ? item.dataset.budgetOverrunCategoryDetails : item.dataset.budgetCategoryDetails))
    if (!details.length) return false
    categories.querySelectorAll(selector).forEach(item => { item.open = details.includes(item) })
    details[0].querySelector('summary').focus({ preventScroll: true })
    details[0].scrollIntoView({ block: 'center' })
    return true
  }
  root.addEventListener('click', event => open(event.target))
  root.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key) && event.target.matches?.('.budget-expense-slice')) {
      event.preventDefault()
      open(event.target)
    }
  })
}

// Keep the slider node so dragging and keyboard focus continue uninterrupted.
export function updateBudgetExpensePieDetail(section, markup) {
  const template = section.ownerDocument.createElement('template')
  template.innerHTML = markup
  const next = template.content.querySelector('[data-budget-expense-pies]')
  if (!next) return
  updateBudgetExpenseOverruns(section, next)
  section.querySelector('.budget-expense-pies-grid').replaceChildren(...next.querySelector('.budget-expense-pies-grid').childNodes)
  const slider = section.querySelector('[data-budget-expense-detail]')
  const replacement = next.querySelector('[data-budget-expense-detail]')
  if (slider && replacement) {
    slider.max = replacement.max
    slider.value = replacement.value
    slider.setAttribute('aria-valuetext', replacement.getAttribute('aria-valuetext'))
    section.querySelector('[data-budget-expense-detail-output]').textContent = next.querySelector('[data-budget-expense-detail-output]').textContent
  }
}
