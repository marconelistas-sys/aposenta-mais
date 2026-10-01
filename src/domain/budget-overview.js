import { summarizeCashFlowItems } from './cash-flow.js'
import { prepareCommitmentSchedules } from './financial-calendar.js'
import { prepareConsortiumEvents } from './consortium.js'

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
  const cashFlow = {
    ...state.cashFlow,
    retirementMonth: state.cashFlow.retirementMonth || state.plan?.retirementMonth,
    spouseRetirementMonth: state.plan?.spouseEnabled ? state.plan.spouseRetirementMonth : null,
    commitmentSchedules: prepareCommitmentSchedules(state.cashFlow.commitments),
    consortiumEvents: prepareConsortiumEvents(state.cashFlow.consortia)
  }
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`
    const period = emptyPeriod(month)
    const { convertedItems } = summarizeCashFlowItems(cashFlow, state.currency, state.exchangeRates, state.customCategories, new Date(`${month}-15T12:00:00Z`), 'all')
    for (const item of convertedItems) {
      if (!item.isIncluded || (item.frequency === 'occasional' && !item.startDate)) continue
      const kind = item.recordKind
      const amount = item.convertedAmount / (item.frequency === 'annual' ? 12 : 1)
      const entry = { id: item.id, month, description: item.transferMatch || item.transferPending || item.transferDecision === 'own' ? `Tarifa: ${item.description || item.category.name}` : item.description || item.category.name, category: item.category.name, categoryId: item.category.id, type: item.type, amount, originalAmount: item.budgetAmount ?? item.amount, currency: item.currency, frequency: item.frequency, date: item.startDate }
      period.entries[kind].push(entry)
      period[kind][item.type === 'income' ? 'income' : 'expenses'] += amount
      period[kind].count++
    }
    for (const kind of ['planned', 'actual']) period[kind].balance = period[kind].income - period[kind].expenses
    period.actualMonths = period.actual.count ? 1 : 0
    return period
  })
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
