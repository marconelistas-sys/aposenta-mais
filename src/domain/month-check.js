// Conferir o mês: o que a pessoa precisa ao fechar um mês do orçamento.
// Responde, nesta ordem: estou dentro do planejado? Onde passei do planejado?
// O que ainda não tem realizado? Em que lançamentos a conta se baseia?
// Sem matemática financeira nova: só buildMonthlyBudget (uma vez),
// budgetExpenseCategories e budgetExpenseOverruns, mais somas em centavos.
// Toda diferença é realizado menos planejado (não usa variance.expenses).
// Plano: docs/product/conferir-mes.md.
import { buildMonthlyBudget } from './monthly-budget.js'
import { budgetExpenseCategories } from './budget-overview.js'
import { budgetExpenseOverruns } from './budget-expense-overruns.js'

const toCents = value => Math.round((Number(value) || 0) * 100)
const fromCents = cents => cents / 100
const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0)

// One category of one type, in cents, so the visible sums close exactly.
function categoryRows(period, type) {
  return budgetExpenseCategories(period, type).categories.map(group => {
    const plannedCents = toCents(group.planned)
    const actualCents = toCents(group.actual)
    const hasPlanned = group.entries.planned.length > 0
    const hasActual = group.entries.actual.length > 0
    return {
      categoryId: group.categoryId, category: group.category, type,
      planned: fromCents(plannedCents), actual: fromCents(actualCents),
      plannedCents, actualCents, hasPlanned, hasActual,
      differenceCents: hasActual ? actualCents - plannedCents : null
    }
  })
}

function line(plannedCents, actualCents, hasPlanned, hasActual) {
  return { planned: fromCents(plannedCents), actual: fromCents(actualCents), difference: fromCents(actualCents - plannedCents), hasPlanned, hasActual }
}

export function monthTiming(month, today = new Date()) {
  const current = today.toISOString().slice(0, 7)
  return month < current ? 'past' : month === current ? 'current' : 'future'
}

export function buildMonthCheck(state, month = state.cashFlow.referenceMonth, today = new Date()) {
  const period = buildMonthlyBudget(state, month)
  const timing = monthTiming(month, today)
  const todayKey = today.toISOString().slice(0, 10)
  const expenses = categoryRows(period, 'expense')
  const income = categoryRows(period, 'income')

  const plannedIncome = sum(income, row => row.plannedCents)
  const actualIncome = sum(income, row => row.actualCents)
  const plannedExpenses = sum(expenses, row => row.plannedCents)
  const actualExpenses = sum(expenses, row => row.actualCents)
  const hasPlanned = period.records.planned.count > 0
  const hasActual = period.records.actual.count > 0
  const hasActualIncome = period.records.actual.income > 0
  const totals = {
    income: line(plannedIncome, actualIncome, period.records.planned.income > 0, hasActualIncome),
    expenses: line(plannedExpenses, actualExpenses, period.records.planned.expenses > 0, period.records.actual.expenses > 0),
    balance: line(plannedIncome - plannedExpenses, actualIncome - actualExpenses, hasPlanned, hasActual)
  }

  // Onde passou do planejado: every expense above plan (threshold 0) or with
  // no plan, by excess. Two offsetting terms close the list with the table:
  // below plan (has actual, less than planned) and still without actual
  // (planned, nothing recorded). A missing entry is never shown as savings.
  const overruns = budgetExpenseOverruns(expenses.filter(row => row.hasActual), 0)
  const over = [...overruns.exceeded, ...overruns.unplanned]
    .map(row => ({ categoryId: row.categoryId, category: row.category, planned: row.planned, actual: row.actual, excess: row.excess, excessPercent: row.excessPercent ?? null, unplanned: row.plannedCents === 0 }))
    .sort((a, b) => b.excess - a.excess || a.category.localeCompare(b.category, 'pt-BR'))
  const overIds = new Set(over.map(row => row.categoryId))
  const below = expenses.filter(row => row.hasActual && !overIds.has(row.categoryId) && row.actualCents < row.plannedCents)
  const missingExpenses = expenses.filter(row => !row.hasActual && row.plannedCents !== 0)
  const overCents = sum(over, row => toCents(row.excess))
  const belowCents = sum(below, row => row.plannedCents - row.actualCents)
  const missingExpenseCents = sum(missingExpenses, row => row.plannedCents)
  const variance = {
    over,
    overCents,
    below: { count: below.length, amount: fromCents(belowCents) },
    missing: { count: missingExpenses.length, amount: fromCents(missingExpenseCents) },
    total: fromCents(overCents - belowCents - missingExpenseCents),
    // Category totals with any difference at all (inner offsets count too).
    hasInnerDifferences: over.length > 0 || below.length > 0 || missingExpenses.length > 0
  }

  // Ainda sem realizado: planned income and expense categories with nothing
  // recorded this month, largest first, plus one-off entries with no date.
  const missing = [...missingExpenses, ...income.filter(row => !row.hasActual && row.plannedCents !== 0)]
    .map(row => ({ categoryId: row.categoryId, category: row.category, type: row.type, planned: row.planned }))
    .sort((a, b) => b.planned - a.planned || a.category.localeCompare(b.category, 'pt-BR'))
  const undated = period.excluded.undated.map(item => ({ id: item.id, description: item.description || item.category?.name || 'Lançamento', type: item.type, recordKind: item.recordKind }))

  // Base dos números: one-off actuals carry the occurrence date (statement
  // imports too); recurring and annual ones keep a start date, so they are out.
  const occasional = period.entries.actual.filter(entry => entry.frequency === 'occasional' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date || ''))
  const futureDated = occasional.filter(entry => entry.date > todayKey)
  const lastDate = occasional.filter(entry => entry.date <= todayKey).map(entry => entry.date).sort().at(-1) || null

  const topPlannedExpenses = expenses.filter(row => row.plannedCents > 0).sort((a, b) => b.plannedCents - a.plannedCents || a.category.localeCompare(b.category, 'pt-BR')).slice(0, 3).map(row => ({ categoryId: row.categoryId, category: row.category, planned: row.planned }))
  const topActualExpenses = expenses.filter(row => row.actualCents > 0).sort((a, b) => b.actualCents - a.actualCents || a.category.localeCompare(b.category, 'pt-BR')).slice(0, 3).map(row => ({ categoryId: row.categoryId, category: row.category, actual: row.actual }))

  return {
    month, timing,
    hasPlanned, hasActual,
    totals,
    variance,
    missing,
    undated,
    records: {
      actualCount: period.records.actual.count,
      lastDate,
      futureDatedCount: timing === 'future' ? period.records.actual.count : futureDated.length,
      plannedAnnual: period.records.planned.annual > 0
    },
    topPlannedExpenses,
    topActualExpenses
  }
}
