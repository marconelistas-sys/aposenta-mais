import { budgetExpenseCategories } from './budget-overview.js'

export function budgetExpenseAccumulated(yearModel, month) {
  const monthCount = month === 'all' ? 12 : Number(month)
  if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 12) throw new RangeError('Mês do acumulado inválido.')
  const months = yearModel.months.slice(0, monthCount)
  const entries = Object.fromEntries(['planned', 'actual'].map(kind => [kind, months.flatMap(period => period.entries[kind])]))
  const { categories, actualMonths } = budgetExpenseCategories({ entries })
  const annualPlans = budgetExpenseCategories(yearModel.annual).categories
  const accumulated = new Map(categories.map(row => [row.categoryId, row]))
  const combined = annualPlans.map(annual => {
    const row = accumulated.get(annual.categoryId) || { categoryId: annual.categoryId, category: annual.category, planned: 0, actual: 0, entries: { planned: [], actual: [] } }
    return { ...row, annualPlanned: annual.planned, annualPlannedEntries: annual.entries.planned }
  })
  return { categories: combined, monthCount, actualMonths, lastMonth: months.at(-1).key, year: yearModel.year }
}

export function budgetExpenseComparison(categories, basis = 'to-date') {
  if (basis !== 'annual') return categories
  return categories.map(row => ({ ...row, plannedToDate: row.planned, planned: row.annualPlanned || 0, entries: { ...row.entries, planned: row.annualPlannedEntries || row.entries?.planned || [] } }))
}

export function budgetAnnualQuota(categories) {
  const rows = categories.filter(row => Number.isFinite(row.annualPlanned) && Math.round(row.annualPlanned * 100) > 0).map(row => {
    const annual = Math.round(row.annualPlanned * 100)
    const actual = Number.isFinite(row.actual) ? Math.max(0, Math.round(row.actual * 100)) : 0
    return { ...row, annualPlanned: annual / 100, actual: actual / 100, remaining: (annual - actual) / 100, usedPercent: actual / annual * 100, exceeded: actual > annual }
  }).sort((a, b) => Number(b.exceeded) - Number(a.exceeded) || b.usedPercent - a.usedPercent || a.category.localeCompare(b.category, 'pt-BR'))
  return { categories: rows, exceededCount: rows.filter(row => row.exceeded).length }
}
// Compare monetary values in cents so an exact threshold is not crossed by
// floating point rounding. Categories without a positive plan have no ratio.
export function budgetExpenseOverruns(categories, threshold = 10) {
  const limit = Number.isFinite(threshold) ? Math.min(100, Math.max(0, Math.round(threshold))) : 10
  const exceeded = [], unplanned = []
  for (const category of categories) {
    if (!Number.isFinite(category.actual) || category.actual <= 0) continue
    const actual = Math.round(category.actual * 100)
    const planned = Number.isFinite(category.planned) ? Math.max(0, Math.round(category.planned * 100)) : 0
    if (!actual) continue
    const row = { ...category, actual: actual / 100, planned: planned / 100, excess: (actual - planned) / 100 }
    if (!planned) unplanned.push(row)
    else if ((actual - planned) * 100 > planned * limit) exceeded.push({ ...row, excessPercent: (actual - planned) / planned * 100 })
  }
  const order = (a, b) => b.excess - a.excess || a.category.localeCompare(b.category, 'pt-BR')
  exceeded.sort(order)
  unplanned.sort(order)
  return { threshold: limit, exceeded, unplanned, totalExcess: exceeded.reduce((sum, row) => sum + Math.round(row.excess * 100), 0) / 100 }
}
