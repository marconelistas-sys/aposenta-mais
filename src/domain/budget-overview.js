import { buildBudgetMonths } from './monthly-budget.js'

function emptyPeriod(key) {
  return { key, planned: { income: 0, expenses: 0, balance: 0, count: 0 }, actual: { income: 0, expenses: 0, balance: 0, count: 0 }, entries: { planned: [], actual: [] }, actualMonths: 0 }
}

export function budgetOverviewYears(state) {
  const anchor = Number(state.cashFlow.referenceMonth?.slice(0, 4)) || 2026
  const years = new Set([anchor - 2, anchor - 1, anchor, anchor + 1, anchor + 2])
  for (const item of [...(state.cashFlow.items || []), ...(state.cashFlow.annualGoals || []), ...(state.cashFlow.commitments || []), ...(state.cashFlow.consortia || [])]) {
    for (const date of [item.startDate, item.endDate, item.date, item.referenceMonth, String(item.startYear || ''), String(item.endYear || '')]) {
      const year = Number(date?.slice(0, 4))
      if (Number.isInteger(year) && year >= 1900 && year <= 2200) years.add(year)
    }
  }
  return [...years].filter(year => year >= 1900 && year <= 2200).sort((a, b) => a - b)
}

export function buildBudgetYear(state, year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new RangeError('Ano do orçamento inválido.')
  const months = buildBudgetMonths(state, Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`))
  const annual = emptyPeriod(String(year))
  for (const month of months) {
    annual.actualMonths += month.actualMonths
    for (const kind of ['planned', 'actual']) {
      for (const field of ['income', 'expenses', 'balance', 'count']) annual[kind][field] += month[kind][field]
      annual.entries[kind].push(...month.entries[kind])
    }
  }
  return { year, months, annual }
}

export function budgetBarBreakdown(period, kind, metric) {
  const entries = period.entries[kind].filter(entry => metric === 'balance' || entry.type === (metric === 'income' ? 'income' : 'expense'))
  const grouped = new Map()
  for (const entry of entries) {
    const key = `${entry.type}:${entry.categoryId}`
    if (!grouped.has(key)) grouped.set(key, { category: entry.category, type: entry.type, amount: 0, entries: [] })
    const group = grouped.get(key)
    const amount = entry.amount * (metric === 'balance' && entry.type === 'expense' ? -1 : 1)
    group.amount += amount
    group.entries.push({ ...entry, amount })
  }
  return [...grouped.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

export function budgetExpenseCategories(period) {
  const groups = new Map()
  const totals = { planned: 0, actual: 0, plannedCount: 0, actualCount: 0 }
  for (const kind of ['planned', 'actual']) {
    for (const entry of period.entries[kind]) {
      if (entry.type !== 'expense') continue
      if (!groups.has(entry.categoryId)) groups.set(entry.categoryId, { categoryId: entry.categoryId, category: entry.category, planned: 0, actual: 0, entries: { planned: [], actual: [] } })
      const group = groups.get(entry.categoryId)
      group[kind] += entry.amount
      group.entries[kind].push(entry)
      totals[kind] += entry.amount
      totals[`${kind}Count`]++
    }
  }
  const categories = [...groups.values()].map(group => ({
    ...group,
    difference: group.entries.actual.length ? group.actual - group.planned : null,
    differencePercent: group.entries.actual.length && group.planned > 0 ? (group.actual - group.planned) / group.planned : null,
    unplanned: group.entries.actual.length > 0 && group.entries.planned.length === 0
  }))
  return { categories, totals, actualMonths: new Set(period.entries.actual.filter(entry => entry.type === 'expense').map(entry => entry.month)).size }
}
