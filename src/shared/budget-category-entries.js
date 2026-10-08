import { escapeHtml, formatMonth, privateCurrency } from './formatters.js'

function entryLink(entry, state) {
  const description = escapeHtml(entry.description)
  const source = entry.consortiumId ? 'consortium' : entry.annualGoalId ? 'annualGoals' : entry.commitmentId ? 'commitments' : 'item'
  const id = entry.consortiumId || entry.annualGoalId || entry.commitmentId || entry.id
  if (source === 'item' && !state.cashFlow.items.some(item => item.id === id)) return description
  return `<button type="button" class="budget-category-entry-link" data-edit-budget-category="${source}" data-category-item-id="${escapeHtml(id)}" data-category-entry-month="${escapeHtml(entry.month)}" aria-label="Editar lançamento ${description}" title="Editar lançamento">${description}</button>`
}

export function entryDetails(group, state, { accumulated = false } = {}) {
  const attribute = accumulated ? 'data-budget-overrun-category-details' : 'data-budget-category-details'
  const money = value => privateCurrency(value, false, true, state.currency)
  return `<details class="budget-category-details" ${attribute}="${escapeHtml(group.categoryId)}"><summary>${escapeHtml(group.category)}<small>Ver lançamentos</small></summary><div class="budget-category-entries">${['planned', 'actual'].map(kind => `<div><h4>${kind === 'planned' ? 'Planejado' : 'Realizado'}</h4>${group.entries[kind].length ? `<ul>${group.entries[kind].map(entry => `<li><span>${entryLink(entry, state)}<small>${escapeHtml(formatMonth(entry.month))}${entry.plannedExpenseLink ? ` · Vinculado automaticamente ao planejado: ${escapeHtml(entry.plannedExpenseLink.description)}` : entry.plannedExpenseLinkStatus === 'ambiguous' ? ' · Mais de um planejamento compatível, sem vínculo automático' : ''}${entry.frequency === 'annual' ? ' · Proporção mensal do valor anual' : ''}${entry.currency !== state.currency ? ` · Convertido de ${escapeHtml(entry.currency)}` : ''}</small></span><span>${money(entry.amount)}</span></li>`).join('')}</ul>` : '<p>Sem registros</p>'}</div>`).join('')}</div></details>`
}
