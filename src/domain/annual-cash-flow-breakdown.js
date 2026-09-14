// Collect the same converted, included events used by the annual recurrence.
// Opt-in presentation data, never a second calculation of the budget.
export function createAnnualBreakdown() {
  return Object.fromEntries(['income', 'costs', 'goals', 'pension', 'releases'].map(key => [key, new Map()]))
}

export function addAnnualBreakdown(breakdown, group, entry, amount, originalAmount = amount) {
  if (!breakdown || amount === 0) return
  const previous = breakdown[group].get(entry.id)
  if (previous) {
    previous.amount += amount
    previous.originalAmount += originalAmount
    previous.months += 1
  } else breakdown[group].set(entry.id, { ...entry, amount, originalAmount, months: 1 })
}

export function collectAnnualBudget(breakdown, budget, { pensionMode, costMultiplier, retirement }) {
  if (!breakdown) return
  for (const item of budget.convertedItems) {
    if (!item.isIncluded) continue
    const source = item.annualGoalId ? 'Meta anual' : item.commitmentId ? 'Compromisso' : item.consortiumId ? 'Consórcio' : 'Orçamento'
    const id = `${source}:${item.annualGoalId || item.commitmentId || item.consortiumId || item.id}`
    const entry = { id, name: item.description || item.category.name, category: item.category.name, source,
      currency: item.currency, frequency: item.annualGoalId ? 'Provisão anual' : item.commitmentId || item.consortiumId ? 'Parcela / evento' : item.frequency,
      startDate: item.annualGoalId || item.commitmentId || item.consortiumId ? null : item.startDate,
      endDate: item.annualGoalId || item.commitmentId || item.consortiumId ? null : item.endDate,
      retirement: item.endMode === 'retirement' ? retirement : null }
    const amount = item.convertedAmount / (item.frequency === 'annual' ? 12 : 1)
    const originalAmount = item.amount / (item.frequency === 'annual' ? 12 : 1)
    const pension = item.type === 'expense' && item.frequency === 'monthly' && item.category.budgetGroup === 'pension'
    if (pension) addAnnualBreakdown(breakdown, 'pension', entry, amount, originalAmount)
    if (pension && pensionMode === 'external') continue
    const group = item.type === 'income' ? 'income' : item.annualGoalId ? 'goals' : 'costs'
    const scale = group === 'costs' ? costMultiplier : 1
    addAnnualBreakdown(breakdown, group, entry, amount * scale, originalAmount * scale)
  }
}

export function finishAnnualBreakdown(breakdown) {
  return Object.fromEntries(Object.entries(breakdown).map(([key, entries]) => [key, [...entries.values()]]))
}
