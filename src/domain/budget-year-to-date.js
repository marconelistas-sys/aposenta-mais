import { buildBudgetYear } from './budget-overview.js'
import { budgetExpenseAccumulated, budgetAnnualQuota } from './budget-expense-overruns.js'

const cents = value => Math.round((Number(value) || 0) * 100)
const types = { expenses: 'expense', income: 'income' }

// Status rules compare cents. Expense quota checks come first so an exhausted
// or exceeded annual quota is never hidden behind the pace comparison.
function expenseStatus(planned, actual, quota, hasActual) {
  if (quota > 0 && actual > quota) return 'quota-exceeded'
  if (quota > 0 && actual > 0 && actual === quota) return 'quota-exhausted'
  if (!hasActual) return 'no-records'
  if (planned === 0 && actual > 0) return 'anticipated'
  return actual > planned ? 'above-pace' : 'on-track'
}

function incomeStatus(planned, actual, quota, hasActual) {
  if (quota > 0 && actual >= quota) return 'annual-reached'
  if (!hasActual) return 'no-records'
  return actual < planned ? 'below-forecast' : actual > planned ? 'above-forecast' : 'on-forecast'
}

function typeModel(yearModel, monthKey, type) {
  const accumulated = budgetExpenseAccumulated(yearModel, monthKey, type)
  const quota = new Map(budgetAnnualQuota(accumulated.categories).categories.map(row => [row.categoryId, row]))
  const categories = [], unplanned = []
  const sum = { plannedToDate: 0, actual: 0, annualPlanned: 0 }
  for (const row of accumulated.categories) {
    const planned = cents(row.planned), actual = cents(row.actual), annual = cents(row.annualPlanned)
    sum.plannedToDate += planned
    sum.actual += actual
    sum.annualPlanned += annual
    if (!planned && !actual && !annual) continue
    const hasActual = row.entries.actual.length > 0
    const base = { categoryId: row.categoryId, category: row.category, type, plannedToDate: planned / 100, actual: actual / 100, annualPlanned: annual / 100, entries: { planned: row.entries.planned, actual: row.entries.actual }, annualPlannedEntries: row.annualPlannedEntries }
    if (annual <= 0) {
      if (hasActual && actual) unplanned.push(base)
      continue
    }
    const annualRow = quota.get(row.categoryId)
    categories.push({
      ...base,
      paceDelta: (actual - planned) / 100,
      pacePercent: planned > 0 ? (actual - planned) / planned : null,
      remaining: annualRow ? annualRow.remaining : (annual - actual) / 100,
      usedPercent: annualRow ? annualRow.usedPercent : null,
      status: (type === 'income' ? incomeStatus : expenseStatus)(planned, actual, annual, hasActual)
    })
  }
  const months = yearModel.months.slice(0, accumulated.monthCount)
  const withActual = new Set(months.flatMap(period => period.entries.actual.filter(entry => entry.type === type).map(entry => entry.month)))
  return {
    categories,
    unplanned: unplanned.sort((a, b) => b.actual - a.actual || a.category.localeCompare(b.category, 'pt-BR')),
    totals: {
      plannedToDate: sum.plannedToDate / 100,
      actual: sum.actual / 100,
      annualPlanned: sum.annualPlanned / 100,
      paceDelta: (sum.actual - sum.plannedToDate) / 100,
      remaining: (sum.annualPlanned - sum.actual) / 100,
      usedPercent: sum.annualPlanned > 0 ? sum.actual / sum.annualPlanned * 100 : null,
      actualMonths: accumulated.actualMonths
    },
    coverage: { monthsWithActual: months.map(period => period.key).filter(key => withActual.has(key)), monthsWithoutActual: months.map(period => period.key).filter(key => !withActual.has(key)) },
    lastMonth: accumulated.lastMonth,
    monthCount: accumulated.monthCount
  }
}

// Year-to-date view of the budget: realized and planned from January to the
// selected month, plus the annual quota (January to December). No extrapolation.
export function buildBudgetYearToDate(state, month = state.cashFlow.referenceMonth) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Mês do acumulado inválido.')
  const year = Number(month.slice(0, 4))
  const yearModel = buildBudgetYear(state, year)
  const models = Object.fromEntries(Object.entries(types).map(([key, type]) => [key, typeModel(yearModel, month.slice(5, 7), type)]))
  const { expenses, income } = models
  const converted = [...new Set(yearModel.annual.entries.planned.concat(yearModel.annual.entries.actual).map(entry => entry.currency).filter(currency => currency && currency !== state.currency))].sort()
  return {
    year,
    month,
    monthCount: expenses.monthCount,
    lastMonth: expenses.lastMonth,
    isDecember: expenses.monthCount === 12,
    totals: {
      expenses: expenses.totals,
      income: income.totals,
      balance: {
        plannedToDate: (cents(income.totals.plannedToDate) - cents(expenses.totals.plannedToDate)) / 100,
        actual: (cents(income.totals.actual) - cents(expenses.totals.actual)) / 100
      }
    },
    coverage: { expenses: expenses.coverage, income: income.coverage },
    categories: { expenses: expenses.categories, income: income.categories },
    unplanned: { expenses: expenses.unplanned, income: income.unplanned },
    convertedCurrencies: converted
  }
}
