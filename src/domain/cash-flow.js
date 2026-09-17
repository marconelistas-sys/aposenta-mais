import { isRetirementEnd, incomeEndMonth } from './income-end.js'
import { categoryById } from '../data/cash-flow-categories.js'
import { convertCurrency } from '../shared/exchange-rates.js'
import { commitmentEvents } from './financial-calendar.js'
import { consortiumEvents } from './consortium.js'
import { annualGoalEvents } from './annual-planning.js'

const monetaryFields = [
  'recurringIncome',
  'occasionalIncome',
  'essentialExpenses',
  'variableExpenses',
  'debtPayments',
  'annualExpenses',
  'currentEmergencyReserve',
  'emergencyReserveTarget'
]

export function validateCashFlow(input) {
  for (const field of monetaryFields) {
    if (!Number.isFinite(input[field])) {
      throw new TypeError(`O campo ${field} precisa ser um número válido.`)
    }
    if (input[field] < 0) {
      throw new RangeError(`O campo ${field} não pode ser negativo.`)
    }
  }

  if (!Number.isInteger(input.reserveBuildMonths) || input.reserveBuildMonths < 1 || input.reserveBuildMonths > 120) {
    throw new RangeError('O prazo da reserva deve estar entre 1 e 120 meses.')
  }
}

export function calculateCashFlow(input, requiredMonthlyContribution = 0) {
  validateCashFlow(input)
  if (!Number.isFinite(requiredMonthlyContribution) || requiredMonthlyContribution < 0) {
    throw new RangeError('O aporte necessário não pode ser negativo.')
  }

  const pensionContributions = Number.isFinite(input.pensionContributions) ? input.pensionContributions : 0
  if (pensionContributions < 0) throw new RangeError('A contribuição previdenciária não pode ser negativa.')
  const monthlyAnnualProvision = input.annualExpenses / 12
  const recurringOutflows = input.essentialExpenses + input.variableExpenses +
    input.debtPayments + pensionContributions + monthlyAnnualProvision
  const recurringSurplus = input.recurringIncome - recurringOutflows
  const reserveGap = Math.max(input.emergencyReserveTarget - input.currentEmergencyReserve, 0)
  const reserveMonthlyAllocation = Math.min(
    Math.max(recurringSurplus, 0),
    reserveGap / input.reserveBuildMonths
  )
  const sustainableContribution = Math.max(recurringSurplus - reserveMonthlyAllocation, 0)

  return {
    monthlyAnnualProvision,
    recurringOutflows,
    recurringSurplus,
    reserveGap,
    reserveMonthlyAllocation,
    sustainableContribution,
    pensionContributions,
    totalRetirementContributionCapacity: pensionContributions + sustainableContribution,
    savingsRate: input.recurringIncome > 0 ? Math.max(recurringSurplus, 0) / input.recurringIncome : 0,
    commitmentRate: input.recurringIncome > 0 ? recurringOutflows / input.recurringIncome : 0,
    requiredMonthlyContribution,
    contributionGap: requiredMonthlyContribution - sustainableContribution,
    isDeficit: recurringSurplus < 0
  }
}

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function sameMonth(left, right) {
  return left?.slice(0, 7) === right?.slice(0, 7)
}

function recordKindFor(item) {
  return item.recordKind === 'actual' || item.source === 'txt' ? 'actual' : 'planned'
}

export function isCashFlowItemActive(item, asOfDate = new Date(), retirementMonth = null, spouseRetirementMonth = null) {
  const current = dateKey(asOfDate)
  if (!current) throw new TypeError('A data de referência não é válida.')
  if (isRetirementEnd(item.endMode) && item.type === 'income' && recordKindFor(item) === 'planned') {
    retirementMonth = incomeEndMonth(item, { retirementMonth, spouseRetirementMonth })
    if (!retirementMonth || current.slice(0, 7) >= retirementMonth) return false
    return !item.startDate || current.slice(0, 7) >= item.startDate.slice(0, 7)
  }
  if (item.frequency === 'occasional' && item.startDate) return sameMonth(item.startDate, current)
  if (item.startDate && current.slice(0, 7) < item.startDate.slice(0, 7)) return false
  if (item.endDate && current.slice(0, 7) > item.endDate.slice(0, 7)) return false
  return true
}

export function summarizeCashFlowItems(
  cashFlow,
  baseCurrency,
  exchangeRates,
  customCategories = [],
  asOfDate = new Date(),
  includedRecordKind = 'planned'
) {
  const summary = {
    recurringIncome: 0,
    occasionalIncome: 0,
    essentialExpenses: 0,
    variableExpenses: 0,
    debtPayments: 0,
    annualExpenses: 0,
    occasionalExpenses: 0,
    pensionContributions: 0,
    currentEmergencyReserve: cashFlow.currentEmergencyReserve,
    emergencyReserveTarget: cashFlow.emergencyReserveTarget,
    reserveBuildMonths: cashFlow.reserveBuildMonths
  }
  const convertedItems = []

  // A commitment is a payable in this month, including one-off goals.
  const commitmentItems = commitmentEvents(cashFlow.commitments, dateKey(asOfDate).slice(0, 7), cashFlow.commitmentSchedules).map(item => ({ ...item, frequency: 'monthly', endDate: item.startDate }))
  for (const item of [...(cashFlow.items || []), ...annualGoalEvents(cashFlow.annualGoals, dateKey(asOfDate).slice(0, 7)), ...commitmentItems, ...consortiumEvents(cashFlow.consortia, dateKey(asOfDate).slice(0, 7), cashFlow.consortiumEvents)]) {
    // Provisions and calendar commitments keep counting when their category was removed or is not an expense.
    const found = categoryById(item.categoryId, customCategories)
    const category = (item.annualGoalId || item.commitmentId) && (!found || found.type !== 'expense') ? categoryById('other-expense') : found
    if (!category) continue
    const convertedAmount = convertCurrency(item.amount, item.currency, baseCurrency, exchangeRates)
    const isActive = isCashFlowItemActive(item, asOfDate, cashFlow.retirementMonth, cashFlow.spouseRetirementMonth)
    const recordKind = recordKindFor(item)
    const isIncluded = isActive && (includedRecordKind === 'all' || recordKind === includedRecordKind)
    convertedItems.push({ ...item, recordKind, convertedAmount, category, isActive, isIncluded, linkedRetirementMonth: isRetirementEnd(item.endMode) ? incomeEndMonth(item, cashFlow) : null })
    if (!isIncluded) continue

    if (item.type === 'income') {
      if (item.frequency === 'occasional') summary.occasionalIncome += convertedAmount
      else if (item.frequency === 'annual') summary.occasionalIncome += convertedAmount / 12
      else if (category.budgetGroup === 'occasional') summary.occasionalIncome += convertedAmount
      else summary.recurringIncome += convertedAmount
      continue
    }

    if (item.frequency === 'occasional') {
      summary.occasionalExpenses += convertedAmount
    } else if (item.frequency === 'annual') {
      summary.annualExpenses += convertedAmount
    } else {
      if (category.budgetGroup === 'debt') summary.debtPayments += convertedAmount
      else if (category.budgetGroup === 'pension') summary.pensionContributions += convertedAmount
      else if (category.budgetGroup === 'essential') summary.essentialExpenses += convertedAmount
      else summary.variableExpenses += convertedAmount
    }
  }

  return { summary, convertedItems }
}

export function retirementContributionSchedules(cashFlow, baseCurrency, exchangeRates, customCategories = []) {
  return (cashFlow.items || []).flatMap((item) => {
    const category = categoryById(item.categoryId, customCategories)
    if (recordKindFor(item) !== 'planned') return []
    if (item.frequency === 'monthly' && item.type === 'expense' && category?.budgetGroup === 'pension') {
      return [{
        amount: convertCurrency(item.amount, item.currency, baseCurrency, exchangeRates),
        startDate: item.startDate,
        endDate: item.endDate,
        label: item.description || category.name
      }]
    }
    // One-off liquidity shocks (buying a house, tuition, a sabbatical) shift the
    // main plan chart and the scenario simulator at their exact month: positive
    // for an inflow, negative for an outflow. Any category qualifies here, unlike
    // the recurring pension contribution above.
    if (item.frequency === 'occasional' && item.startDate) {
      const amount = convertCurrency(item.amount, item.currency, baseCurrency, exchangeRates) * (item.type === 'income' ? 1 : -1)
      return [{
        amount,
        startDate: item.startDate,
        endDate: item.startDate,
        label: item.description || category?.name || 'Evento único'
      }]
    }
    return []
  })
}

function monthlyTotals(summary) {
  const income = summary.recurringIncome + summary.occasionalIncome
  const expenses = summary.essentialExpenses + summary.variableExpenses + summary.debtPayments +
    summary.pensionContributions + summary.annualExpenses / 12 + summary.occasionalExpenses
  return { income, expenses, balance: income - expenses }
}

export function comparePlannedAndActualCashFlow(
  cashFlow,
  baseCurrency,
  exchangeRates,
  customCategories = [],
  asOfDate = new Date()
) {
  const plannedRecords = summarizeCashFlowItems(
    cashFlow,
    baseCurrency,
    exchangeRates,
    customCategories,
    asOfDate,
    'planned'
  )
  const actualRecords = summarizeCashFlowItems(
    cashFlow,
    baseCurrency,
    exchangeRates,
    customCategories,
    asOfDate,
    'actual'
  )
  const planned = monthlyTotals(plannedRecords.summary)
  const actual = monthlyTotals(actualRecords.summary)
  const coverage = result => {
    const items = result.convertedItems.filter(item => item.isIncluded)
    return {
      count: items.length,
      income: items.filter(item => item.type === 'income').length,
      expenses: items.filter(item => item.type === 'expense').length,
      annual: items.filter(item => item.frequency === 'annual').length,
      recurring: items.filter(item => item.frequency !== 'occasional').length,
      undated: items.filter(item => !item.startDate).length
    }
  }

  return {
    planned,
    actual,
    records: { planned: coverage(plannedRecords), actual: coverage(actualRecords) },
    variance: {
      income: actual.income - planned.income,
      expenses: planned.expenses - actual.expenses,
      balance: actual.balance - planned.balance
    }
  }
}

export function calculateMultiCurrencyCashFlow(
  cashFlow,
  baseCurrency,
  exchangeRates,
  requiredMonthlyContribution = 0,
  customCategories = [],
  asOfDate = new Date()
) {
  const { summary, convertedItems } = summarizeCashFlowItems(
    cashFlow,
    baseCurrency,
    exchangeRates,
    customCategories,
    asOfDate
  )
  return {
    ...calculateCashFlow(summary, requiredMonthlyContribution),
    summary,
    convertedItems,
    monthlyIncome: summary.recurringIncome + summary.occasionalIncome,
    monthlyExpenses: summary.essentialExpenses + summary.variableExpenses +
      summary.debtPayments + summary.pensionContributions + summary.annualExpenses / 12 +
      summary.occasionalExpenses
  }
}
