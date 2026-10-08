import { summarizeCashFlowItems } from './cash-flow.js'
import { pensionOutsideBudget } from './pension-budget.js'
import { prepareCommitmentSchedules } from './financial-calendar.js'
import { prepareConsortiumEvents } from './consortium.js'

const emptyTotals = () => ({ income: 0, expenses: 0, balance: 0, count: 0 })
const emptyCoverage = () => ({ count: 0, income: 0, expenses: 0, annual: 0, recurring: 0, undated: 0 })

// Operational budget: the same month, exchange rates and inclusion rules feed
// the summary, recorded-versus-planned comparison and expense categories.
// Projection exchange-rate scenarios and investment returns stay separate.
function prepareMonthlySource(state) {
  return {
    ...state.cashFlow,
    retirementMonth: state.cashFlow.retirementMonth || state.plan?.retirementMonth,
    spouseRetirementMonth: state.plan?.spouseEnabled ? state.plan.spouseRetirementMonth : null,
    commitmentSchedules: prepareCommitmentSchedules(state.cashFlow.commitments),
    consortiumEvents: prepareConsortiumEvents(state.cashFlow.consortia)
  }
}

export function buildMonthlyBudget(state, month = state.cashFlow.referenceMonth) {
  return monthlyBudget(state, month, prepareMonthlySource(state))
}

export function buildBudgetMonths(state, months) {
  const cashFlow = prepareMonthlySource(state)
  return months.map(month => monthlyBudget(state, month, cashFlow))
}

function monthlyBudget(state, month, cashFlow) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Mês do orçamento inválido.')
  const result = summarizeCashFlowItems(cashFlow, state.currency, state.exchangeRates, state.customCategories, new Date(`${month}-15T12:00:00Z`), 'all')
  const period = {
    key: month,
    planned: emptyTotals(), actual: emptyTotals(),
    records: { planned: emptyCoverage(), actual: emptyCoverage() },
    entries: { planned: [], actual: [] },
    actualMonths: 0,
    excluded: { undated: [], pension: [] },
    convertedItems: []
  }
  for (const source of result.convertedItems) {
    const undated = source.frequency === 'occasional' && !source.startDate
    const pension = pensionOutsideBudget(state, source)
    const item = undated || pension ? { ...source, isIncluded: false } : source
    period.convertedItems.push(item)
    if (source.isIncluded && undated) period.excluded.undated.push(item)
    if (source.isIncluded && pension) period.excluded.pension.push(item)
    if (!item.isIncluded) continue
    const kind = item.recordKind
    const amount = item.convertedAmount / (item.frequency === 'annual' ? 12 : 1)
    const entry = {
      plannedExpenseLink: item.plannedExpenseLink, plannedExpenseLinkStatus: item.plannedExpenseLinkStatus,
      ...(item.annualGoalId ? { annualGoalId: item.annualGoalId } : {}),
      ...(item.commitmentId ? { commitmentId: item.commitmentId } : {}),
      ...(item.consortiumId ? { consortiumId: item.consortiumId } : {}),
      id: item.id, month,
      description: item.transferMatch || item.transferPending || item.transferDecision === 'own' ? `Tarifa: ${item.description || item.category.name}` : item.description || item.category.name,
      category: item.category.name, categoryId: item.category.id, type: item.type, amount,
      originalAmount: item.budgetAmount ?? item.amount, currency: item.currency,
      frequency: item.frequency, date: item.startDate
    }
    period.entries[kind].push(entry)
    const metric = item.type === 'income' ? 'income' : 'expenses'
    period[kind][metric] += amount
    period[kind].count++
    const coverage = period.records[kind]
    coverage.count++
    coverage[metric]++
    if (item.frequency === 'annual') coverage.annual++
    if (item.frequency !== 'occasional') coverage.recurring++
    if (!item.startDate) coverage.undated++
  }
  for (const kind of ['planned', 'actual']) period[kind].balance = period[kind].income - period[kind].expenses
  period.actualMonths = period.actual.count ? 1 : 0
  period.variance = {
    income: period.actual.income - period.planned.income,
    expenses: period.planned.expenses - period.actual.expenses,
    balance: period.actual.balance - period.planned.balance
  }
  return period
}
