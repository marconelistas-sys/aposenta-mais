// Collect the same converted, included events used by the annual recurrence.
// Opt-in presentation data, never a second calculation of the budget.
export function createAnnualBreakdown() {
  return Object.fromEntries(['income', 'costs', 'goals', 'pension', 'releases'].map(key => [key, new Map()]))
}

// contract: optional nominal amounts of a fixed income ({ amount, originalAmount }),
// kept beside the real amounts so the year detail can show the contract value.
export function addAnnualBreakdown(breakdown, group, entry, amount, originalAmount = amount, contract = null) {
  if (!breakdown || amount === 0) return
  const previous = breakdown[group].get(entry.id)
  const next = { ...entry, amount, originalAmount, months: 1, ...(contract ? { contractAmount: contract.amount, contractOriginalAmount: contract.originalAmount } : {}) }
  if (previous) mergeAnnualBreakdownEntry(previous, next)
  else breakdown[group].set(entry.id, next)
}

// Adds one breakdown entry into another with the same id (months of a year).
export function mergeAnnualBreakdownEntry(previous, entry) {
  previous.amount += entry.amount
  previous.originalAmount += entry.originalAmount
  previous.months += entry.months
  if (Number.isFinite(entry.contractAmount)) {
    previous.contractAmount = (previous.contractAmount || 0) + entry.contractAmount
    previous.contractOriginalAmount = (previous.contractOriginalAmount || 0) + entry.contractOriginalAmount
  }
  return previous
}

export function collectAnnualBudget(breakdown, budget, { pensionMode, costMultiplier, retirement }) {
  if (!breakdown) return
  for (const item of budget.convertedItems) {
    if (!item.isIncluded) continue
    const source = item.annualGoalId ? 'Meta anual' : item.commitmentId ? 'Compromisso' : item.consortiumId ? 'Consórcio' : 'Orçamento'
    const id = `${source}:${item.annualGoalId || item.commitmentId || item.consortiumId || item.id}`
    const entry = { id, budgetItemId: source === 'Orçamento' ? item.id : null, budgetGroup: item.category.budgetGroup, name: item.description || item.category.name, category: item.category.name, source,
      currency: item.currency, frequency: item.annualGoalId ? 'Provisão anual' : item.commitmentId || item.consortiumId ? 'Parcela / evento' : item.frequency,
      startDate: item.annualGoalId || item.commitmentId || item.consortiumId ? null : item.startDate,
      endDate: item.annualGoalId || item.commitmentId || item.consortiumId ? null : item.endDate,
      retirement: item.linkedRetirementMonth || (item.endMode === 'retirement' ? retirement : null),
      ...(Number.isFinite(item.indexationFactor) ? { indexation: 'fixed', indexationInflation: item.indexationInflation, indexationInflationSource: item.indexationInflationSource, indexationBaseYear: item.indexationBaseYear } : {}) }
    const divisor = item.frequency === 'annual' ? 12 : 1
    const amount = item.convertedAmount / divisor
    // A fixed income shows its real value in the original currency too; the
    // nominal contract value travels in contractAmount / contractOriginalAmount.
    const originalAmount = item.amount * (Number.isFinite(item.indexationFactor) ? item.indexationFactor : 1) / divisor
    const contract = Number.isFinite(item.indexationFactor) ? { amount: item.convertedContractAmount / divisor, originalAmount: item.contractAmount / divisor } : null
    const pension = item.type === 'expense' && item.frequency === 'monthly' && item.category.budgetGroup === 'pension'
    if (pension && item.pensionCapitalRelease !== false) addAnnualBreakdown(breakdown, 'pension', entry, amount, originalAmount)
    if (pension && pensionMode === 'external') continue
    const group = item.type === 'income' ? 'income' : item.annualGoalId ? 'goals' : 'costs'
    const scale = group === 'costs' ? costMultiplier : 1
    if (item.consortiumId && item.amount > 0) {
      addConsortiumParts(breakdown, entry, item, amount * scale, originalAmount * scale)
      continue
    }
    addAnnualBreakdown(breakdown, group, entry, amount * scale, originalAmount * scale, contract)
  }
}

// Presentation split of a consortium installment: the linked savings part and the cost part.
export function addConsortiumParts(breakdown, entry, item, amount, originalAmount) {
  const savingsShare = Number.isFinite(item.consortiumSavings) && item.amount > 0 ? Math.min(1, Math.max(0, item.consortiumSavings / item.amount)) : 0
  const base = entry.name.replace(/: parcela do consórcio$/, '')
  if (savingsShare > 0) addAnnualBreakdown(breakdown, 'costs', { ...entry, id: `${entry.id}:cota`, name: `${base}: cota, vira patrimônio vinculado`, category: 'Consórcio · cota', consortiumPart: 'savings' }, amount * savingsShare, originalAmount * savingsShare)
  if (savingsShare < 1) addAnnualBreakdown(breakdown, 'costs', { ...entry, id: `${entry.id}:custos`, name: `${base}: taxas e seguro, custo`, category: 'Consórcio · custo', consortiumPart: 'costs' }, amount * (1 - savingsShare), originalAmount * (1 - savingsShare))
}

export function finishAnnualBreakdown(breakdown) {
  return Object.fromEntries(Object.entries(breakdown).map(([key, entries]) => [key, [...entries.values()]]))
}
