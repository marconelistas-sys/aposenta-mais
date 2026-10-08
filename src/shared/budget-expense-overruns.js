import { budgetExpenseOverruns, budgetExpenseComparison, budgetAnnualQuota } from '../domain/budget-expense-overruns.js'
import { escapeHtml, formatMonth, privateCurrency } from './formatters.js'
import { entryDetails } from './budget-category-entries.js'

export const budgetExpenseOverrunView = { threshold: 10, period: 'month', basis: 'to-date' }

export function renderBudgetExpenseOverruns(categories, state, { accumulated, fullYear = false, periodLabel = '' } = {}) {
  if (state.valuesHidden) return ''
  const yearly = Boolean(accumulated && (fullYear || budgetExpenseOverrunView.period === 'year-to-date'))
  const annualBasis = yearly && (fullYear || budgetExpenseOverrunView.basis === 'annual')
  const comparisonRows = yearly ? budgetExpenseComparison(accumulated.categories, annualBasis ? 'annual' : 'to-date') : categories
  const model = budgetExpenseOverruns(comparisonRows, budgetExpenseOverrunView.threshold)
  const comparisonLabel = annualBasis ? 'da cota anual' : yearly ? 'do planejado até o mês' : 'do planejado'
  const money = value => privateCurrency(value, false, true, state.currency)
  const details = row => yearly ? entryDetails(row, state, { accumulated: true }) : ''
  const period = yearly ? `Janeiro até ${formatMonth(accumulated.lastMonth)} · ${accumulated.monthCount} mês(es)` : periodLabel
  const control = accumulated && !fullYear ? `<label class="form-field budget-overrun-period"><span>Período analisado</span><select data-budget-overrun-period aria-label="Base da comparação de excessos"><option value="month" ${!yearly ? 'selected' : ''}>Mês selecionado</option><option value="year-to-date" ${yearly ? 'selected' : ''}>Acumulado de janeiro até o mês selecionado</option></select></label>` : ''
  const categoryLink = row => `<button type="button" class="budget-category-entry-link" data-budget-expense-categories="${escapeHtml(JSON.stringify([row.categoryId]))}">${escapeHtml(row.category)}<small>Ver e editar lançamentos</small></button>`
  const baseControl = `<div data-budget-overrun-base-controls>${yearly && !fullYear ? `<label class="form-field budget-overrun-period"><span>Comparar o realizado acumulado com</span><select data-budget-overrun-basis aria-label="Planejamento usado na comparação acumulada"><option value="to-date" ${!annualBasis ? 'selected' : ''}>Planejado até o mês selecionado</option><option value="annual" ${annualBasis ? 'selected' : ''}>Cota anual inteira</option></select></label>` : ''}</div>`
  const quota = yearly ? budgetAnnualQuota(accumulated.categories) : null
  const shownIds = new Set([...model.exceeded, ...model.unplanned].map(row => row.categoryId))
  const annualOverview = quota?.categories.length ? `<details class="disclosure budget-annual-quota" open data-budget-annual-quota><summary>Consumo da cota anual · ${quota.exceededCount} categoria(s) ultrapassada(s)</summary><p>Realizado somente de janeiro até o mês selecionado. A cota inclui todo o planejamento de janeiro a dezembro, inclusive despesas previstas para meses seguintes. Ultrapassagem da cota é indicada mesmo abaixo do filtro de excesso.</p><ul>${quota.categories.map(row => `<li data-budget-annual-quota-category="${escapeHtml(row.categoryId)}"><header>${categoryLink(row)}<strong>${row.exceeded ? 'Cota anual ultrapassada' : row.remaining === 0 ? 'Cota anual esgotada' : 'Dentro da cota anual'}</strong></header><dl><div><dt>Cota anual</dt><dd>${money(row.annualPlanned)}</dd></div><div><dt>Realizado até o mês</dt><dd>${money(row.actual)}</dd></div><div><dt>${row.exceeded ? 'Excesso sobre a cota anual' : 'Saldo da cota anual'}</dt><dd>${money(Math.abs(row.remaining))}</dd></div><div><dt>Cota utilizada</dt><dd>${row.usedPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</dd></div></dl><div class="month-tracking-track" aria-hidden="true"><span class="month-tracking-fill month-tracking-fill--actual" style="width:${Math.min(100, row.usedPercent)}%"></span></div>${shownIds.has(row.categoryId) ? '' : details(comparisonRows.find(category => category.categoryId === row.categoryId) || row)}</li>`).join('')}</ul></details>` : ''
  const rows = model.exceeded.map(row => {
    const scale = Math.max(row.planned, row.actual)
    const bar = (kind, label) => `<div class="budget-overrun-bar"><div><span>${label}</span><strong class="money-value">${money(row[kind])}</strong></div><div class="month-tracking-track" aria-hidden="true"><span class="month-tracking-fill month-tracking-fill--${kind}" style="width:${row[kind] / scale * 100}%"></span></div></div>`
    return `<article class="budget-overrun-row" data-budget-overrun-category="${escapeHtml(row.categoryId)}"><header>${categoryLink(row)}<span class="budget-overrun-excess">+${row.excessPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%<small>+${money(row.excess)} acima ${comparisonLabel}</small></span></header>${bar('planned', annualBasis ? 'Cota anual inteira' : yearly ? 'Planejado até o mês' : 'Planejado')}${bar('actual', yearly ? 'Realizado até o mês' : 'Realizado')}${yearly ? `<p class="budget-overrun-average">Cota anual planejada: <strong class="money-value">${money(row.annualPlanned)}</strong><br>Médias mensais até o mês selecionado, em ${accumulated.monthCount} mês(es):<br>Planejado <strong class="money-value">${money((annualBasis ? row.plannedToDate : row.planned) / accumulated.monthCount)}</strong> · Realizado <strong class="money-value">${money(row.actual / accumulated.monthCount)}</strong><br>Realizados registrados em ${new Set(row.entries.actual.map(entry => entry.month)).size} de ${accumulated.monthCount} mês(es).</p>${details(row)}` : ''}</article>`
  }).join('')
  const results = `<div data-budget-overrun-results>${yearly ? `<p class="budget-overrun-coverage">Despesas realizadas registradas em ${accumulated.actualMonths} de ${accumulated.monthCount} mês(es). Confira se os meses sem registros estão completos. A média usa todos os meses de janeiro até o mês selecionado.</p>` : ''}<p class="budget-overrun-summary" data-budget-overrun-summary>${model.exceeded.length ? `${model.exceeded.length} categoria(s) acima de ${model.threshold}% ${comparisonLabel}. Excesso nas categorias exibidas: <strong class="money-value">${money(model.totalExcess)}</strong>.` : `Nenhuma categoria com gasto realizado acima de ${model.threshold}% ${comparisonLabel}.`}</p><div class="budget-overrun-rows">${rows}</div>${annualOverview}${model.unplanned.length ? `<details class="disclosure budget-overrun-unplanned" data-budget-overrun-unplanned><summary>${yearly ? annualBasis ? 'Sem planejamento anual' : 'Sem planejamento até o mês' : 'Sem planejamento'}: ${model.unplanned.length} categoria(s)</summary><p>Estas despesas não entram no filtro percentual porque não têm valor planejado positivo para comparar.</p><ul>${model.unplanned.map(row => `<li>${categoryLink(row)}<span class="money-value">${money(row.actual)}</span>${details(row)}</li>`).join('')}</ul></details>` : ''}</div>`
  return `<section class="budget-overruns" data-budget-overruns aria-label="Gastos acima do planejado"><h4>Gastos acima do planejado</h4><p>Veja as categorias que ultrapassaram seu orçamento, da maior diferença em valor para a menor.</p>${control}${baseControl}<p data-budget-overrun-period-label>${escapeHtml(period)}</p><div class="budget-expense-detail-control"><label><span>Excesso mínimo: <output data-budget-overrun-threshold-output>${model.threshold}%</output></span><input type="range" min="0" max="100" step="1" value="${model.threshold}" data-budget-overrun-threshold aria-label="Excesso mínimo sobre o planejado" aria-valuetext="Acima de ${model.threshold}%" /></label><p>Exibe somente excessos maiores que o limite. Arraste para ajustar de 0% a 100%.</p></div><div role="status" aria-live="polite" class="sr-only" data-budget-overrun-status>${model.exceeded.length} categoria(s) acima de ${model.threshold}%.</div>${results}<p class="budget-overrun-method" data-budget-overrun-method>Base: ${annualBasis ? 'cota anual inteira' : yearly ? 'planejado de janeiro até o mês selecionado' : 'planejado do mês selecionado'}. Excesso = (realizado − planejado) ÷ planejado. Compara cada categoria individualmente, independentemente do agrupamento nos gráficos. Os realizados podem estar incompletos.</p></section>`
}

export function updateBudgetExpenseOverruns(section, next) {
  const current = section.querySelector('[data-budget-overruns]')
  const replacement = next.querySelector('[data-budget-overruns]')
  if (!current || !replacement) return
  current.querySelector('[data-budget-overrun-results]').replaceWith(replacement.querySelector('[data-budget-overrun-results]'))
  for (const selector of ['[data-budget-overrun-threshold-output]', '[data-budget-overrun-status]', '[data-budget-overrun-period-label]', '[data-budget-overrun-method]']) {
    current.querySelector(selector).textContent = replacement.querySelector(selector).textContent
  }
  const basis = current.querySelector('[data-budget-overrun-basis]')
  const nextBasis = replacement.querySelector('[data-budget-overrun-basis]')
  if (basis && nextBasis) basis.value = nextBasis.value
  else current.querySelector('[data-budget-overrun-base-controls]').replaceChildren(...replacement.querySelector('[data-budget-overrun-base-controls]').childNodes)
  const slider = current.querySelector('[data-budget-overrun-threshold]')
  const nextSlider = replacement.querySelector('[data-budget-overrun-threshold]')
  slider.value = nextSlider.value
  slider.setAttribute('aria-valuetext', nextSlider.getAttribute('aria-valuetext'))
  const periodControl = current.querySelector('[data-budget-overrun-period]')
  if (periodControl) periodControl.value = replacement.querySelector('[data-budget-overrun-period]').value
}
