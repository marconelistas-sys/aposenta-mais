import { budgetPressure } from '../domain/budget-pressure.js'
import { escapeHtml, privateCurrency } from './formatters.js'
import { moneyWithMonthly, moneyWithMonthlyText } from './monthly-equivalent.js'

function sortedItems(list) {
  return [...(list || [])]
    .filter(item => Number.isFinite(item.amount) && item.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'pt-BR'))
}

function renderComposition(entries, money) {
  if (!entries.length) return '<p>Nenhum lançamento neste período.</p>'
  return `<dl class="wealth-callout-components">${entries.map(item => `<div><dt>${escapeHtml(item.name)}${item.category ? `<small>${escapeHtml(item.category)}</small>` : ''}</dt><dd class="money-value">${item.frequency === 'occasional' ? money(item.amount) : moneyWithMonthly(money, item.amount, item.months)}</dd></div>`).join('')}</dl>`
}

function bar(key, label, total, entries, maxValue, year, money, months) {
  const filled = maxValue > 0 ? Math.min(100, Math.max(0, total) / maxValue * 100) : 0
  return `<div class="remaining-wealth-row" data-wealth-row data-negative="${total < 0}">
    <button type="button" class="remaining-wealth-label" data-wealth-trigger aria-expanded="false" aria-label="Ver composição: ${label} em ${escapeHtml(year)}"><span>${label} <span class="wealth-info-icon" aria-hidden="true">ⓘ</span></span><strong class="money-value">${moneyWithMonthly(money, total, months)}</strong></button>
    <div class="remaining-wealth-track" role="meter" aria-label="${label} em ${escapeHtml(year)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${filled.toFixed(4)}" aria-valuetext="${escapeHtml(money(total))}"><span class="remaining-wealth-bar remaining-wealth-bar--${key}" style="width:${filled.toFixed(4)}%"></span></div>
    <div class="wealth-callout" data-wealth-callout hidden role="region" aria-label="Composição: ${label} em ${escapeHtml(year)}"><div class="wealth-callout-header"><strong>O que compõe este valor em ${escapeHtml(year)}</strong><button type="button" data-wealth-close aria-label="Fechar composição">×</button></div>${renderComposition(entries, money)}</div>
  </div>`
}

// Same bar-with-hover-callout pattern as renderRemainingWealth, applied to the
// income/outflows totals of a single year, for a quick glance at what composes them.
export function renderIncomeCostBars(row, currency) {
  const model = budgetPressure(row)
  if (!model.reconciled) return ''
  const money = value => privateCurrency(value, false, true, currency)
  const incomeItems = sortedItems(row.breakdown?.income)
  const costItems = sortedItems(model.entries)
  const maxValue = Math.max(model.income, model.outflows)
  return `<section class="remaining-wealth" aria-label="Receitas e despesas em ${escapeHtml(row.year)}">
    <h4>Receitas e despesas de ${escapeHtml(row.year)}</h4>
    <p class="remaining-wealth-basis">Passe o mouse, foque ou toque no nome para ver os lançamentos que compõem o total.</p>
    ${bar('income', 'Receitas', model.income, incomeItems, maxValue, row.year, money, model.months)}
    ${bar('costs', 'Despesas e metas', model.outflows, costItems, maxValue, row.year, money, model.months)}
  </section>`
}
