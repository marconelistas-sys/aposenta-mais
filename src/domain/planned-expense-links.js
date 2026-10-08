const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const key = item => JSON.stringify([item.categoryId, item.currency, item.householdOwner || 'unspecified'])
const eligible = item => item.type === 'expense' && item.isActive && item.budgetAmount > 0 && !(item.frequency === 'occasional' && !item.startDate) && !item.transferMatch && !item.transferPending && item.transferDecision !== 'own'

// These associations compare a month's budget, without marking a bill as paid.
export function linkActualExpensesToPlans(items) {
  const plans = new Map()
  for (const item of items) {
    if (item.recordKind !== 'planned' || !eligible(item)) continue
    const group = key(item)
    if (!plans.has(group)) plans.set(group, [])
    plans.get(group).push(item)
  }
  return items.map(item => {
    const { plannedExpenseLink: previous, plannedExpenseLinkStatus: previousStatus, ...clean } = item
    if (item.recordKind !== 'actual' || !eligible(item) || !item.startDate) return clean
    const candidates = plans.get(key(item)) || []
    const exact = candidates.filter(plan => normalized(plan.description) && normalized(plan.description) === normalized(item.description))
    const match = candidates.length === 1 ? candidates[0] : exact.length === 1 ? exact[0] : null
    if (!match) return { ...clean, plannedExpenseLinkStatus: candidates.length ? 'ambiguous' : 'unplanned' }
    return { ...clean, plannedExpenseLinkStatus: 'linked', plannedExpenseLink: {
      id: match.id,
      description: match.description || match.category?.name || '',
      ...(match.annualGoalId ? { annualGoalId: match.annualGoalId } : {}),
      ...(match.commitmentId ? { commitmentId: match.commitmentId } : {}),
      ...(match.consortiumId ? { consortiumId: match.consortiumId } : {})
    } }
  })
}
