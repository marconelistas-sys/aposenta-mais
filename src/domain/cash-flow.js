import { categoryById } from '../data/cash-flow-categories.js'
import { convertCurrency } from '../shared/exchange-rates.js'

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

export function isCashFlowItemActive(item, asOfDate = new Date()) {
  const current = dateKey(asOfDate)
  if (!current) throw new TypeError('A data de referência não é válida.')
  if (item.frequency === 'occasional' && item.startDate) return sameMonth(item.startDate, current)
  if (item.startDate && current < item.startDate) return false
  if (item.endDate && current > item.endDate) return false
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

  for (const item of cashFlow.items || []) {
    const category = categoryById(item.categoryId, customCategories)
    if (!category) continue
    const convertedAmount = convertCurrency(item.amount, item.currency, baseCurrency, exchangeRates)
    const isActive = isCashFlowItemActive(item, asOfDate)
    const recordKind = recordKindFor(item)
    const isIncluded = isActive && (includedRecordKind === 'all' || recordKind === includedRecordKind)
    convertedItems.push({ ...item, recordKind, convertedAmount, category, isActive, isIncluded })
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
    if (recordKindFor(item) !== 'planned' || item.type !== 'expense' || item.frequency !== 'monthly' || category?.budgetGroup !== 'pension') return []
    return [{
      amount: convertCurrency(item.amount, item.currency, baseCurrency, exchangeRates),
      startDate: item.startDate,
      endDate: item.endDate,
      label: item.description || category.name
    }]
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
  const planned = monthlyTotals(summarizeCashFlowItems(
    cashFlow,
    baseCurrency,
    exchangeRates,
    customCategories,
    asOfDate,
    'planned'
  ).summary)
  const actual = monthlyTotals(summarizeCashFlowItems(
    cashFlow,
    baseCurrency,
    exchangeRates,
    customCategories,
    asOfDate,
    'actual'
  ).summary)

  return {
    planned,
    actual,
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
