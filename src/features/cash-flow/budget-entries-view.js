import { budgetOwnerView, filterByHouseholdOwner } from '../../shared/household-owner.js'

export const budgetEntriesView = { search: '', period: 'active', type: 'all', recordKind: 'all' }
export function resetBudgetEntriesView() {
  Object.assign(budgetEntriesView, { search: '', period: 'active', type: 'all', recordKind: 'all' })
  budgetOwnerView.selected = 'all'
}
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
export function filterBudgetEntries(items, filters = budgetEntriesView, owner = budgetOwnerView.selected) {
  const query = normalize(filters.search).trim()
  return filterByHouseholdOwner(items, owner).filter(item => {
    const active = item.isActive && !(item.frequency === 'occasional' && !item.startDate)
    return (filters.period === 'all' || active)
      && (filters.type === 'all' || item.type === filters.type)
      && (filters.recordKind === 'all' || item.recordKind === filters.recordKind)
      && (!query || normalize(`${item.description || ''} ${item.category?.name || ''}`).includes(query))
  })
}

export function readBudgetFilters(form) {
  const field = name => form.elements.namedItem(name)?.value || ''
  budgetEntriesView.search = field('search').slice(0, 100)
  for (const [key, allowed] of Object.entries({ period: ['active', 'all'], type: ['all', 'income', 'expense'], recordKind: ['all', 'planned', 'actual'] })) {
    if (allowed.includes(field(key))) budgetEntriesView[key] = field(key)
  }
  budgetOwnerView.selected = field('owner') || 'all'
}
