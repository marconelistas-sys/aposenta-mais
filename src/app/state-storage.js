import { sanitizePaymentMatches } from '../domain/calendar-payments.js'
import { sanitizeStatementHistory } from '../domain/statement-history.js'
import { defaultPlan } from '../data/mock-plan.js'
import { sanitizeCurrencyTrends, validateAnnualRealReturns } from '../domain/investment-returns.js'
import { defaultCashFlow } from '../data/mock-cash-flow.js'
import { normalizeCurrency } from '../shared/currencies.js'
import { bundledExchangeRates, sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { categoryById } from '../data/cash-flow-categories.js'
import { sanitizeLedger } from '../domain/accounts.js'
import { sanitizeCommitments } from '../domain/financial-calendar.js'
import { sanitizeConsortia } from '../domain/consortium.js'
import { sanitizeRiskSettings } from '../domain/risk-plan.js'
import { sanitizeDecumulation } from '../domain/post-retirement.js'
import { linkedBudgetItem } from '../domain/ledger-links.js'
import { sanitizeAnnualRows, sanitizeMigration } from '../domain/annual-planning.js'
import { sanitizeFinappMethod } from '../domain/finapp-viability.js'
import { sanitizeTargetAllocation } from '../domain/target-allocation.js'
import { currencies } from '../shared/currencies.js'

export const stateVersion = 10
export const storageKeys = Object.freeze({
  current: 'aposenta-plus-state-v10',
  previous: 'aposenta-plus-state-v9',
  legacy: 'aposenta-plus-state-v8',
  older: 'aposenta-plus-state-v7',
  oldest: 'aposenta-plus-state-v6',
  earlier: 'aposenta-plus-state-v5',
  earliest: 'aposenta-plus-state-v4',
  original: 'aposenta-plus-state-v3',
  first: 'aposenta-plus-state-v2',
  initial: 'aposenta-plus-state-v1',
  deletionMarker: 'aposenta-plus-deleted-v1'
})

const cashFlowRules = {
  recurringIncome: [0, 1000000000],
  occasionalIncome: [0, 1000000000],
  essentialExpenses: [0, 1000000000],
  variableExpenses: [0, 1000000000],
  debtPayments: [0, 1000000000],
  annualExpenses: [0, 1000000000],
  currentEmergencyReserve: [0, 1000000000],
  emergencyReserveTarget: [0, 1000000000],
  reserveBuildMonths: [1, 120]
}

const planRules = {
  currentAge: [16, 99],
  retirementAge: [17, 100],
  currentAssets: [0, 1000000000],
  monthlyContribution: [0, 10000000],
  annualRealReturn: [-0.99, 1],
  annualInflation: [-0.99, 1],
  targetMonthlyIncome: [0, 10000000],
  expectedMonthlyBenefit: [0, 1000000],
  annualWithdrawalRate: [0.001, 1],
  spouseCurrentAge: [16, 99],
  spouseRetirementAge: [17, 100],
  spouseExpectedMonthlyBenefit: [0, 1000000]
}

function validNumber(value, [minimum, maximum]) {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

function safeId(value, fallback) {
  const id = typeof value === 'string' ? value.trim().slice(0, 80) : ''
  return /^[a-zA-Z0-9:_-]+$/.test(id) ? id : fallback
}

function safeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value
}

const investmentClasses = new Set([
  'fixed-income',
  'equity',
  'fund',
  'pension',
  'cash',
  'other'
])

const investmentReturnTypes = new Set(['default', 'real', 'nominal', 'cdi', 'ipca'])

export function sanitizeInvestment(investment, index = 0) {
  if (!investment || typeof investment !== 'object') return null
  const name = typeof investment.name === 'string' ? investment.name.trim().slice(0, 60) : ''
  const amount = Number(investment.amount)
  const monthlyContribution = Number(investment.monthlyContribution || 0)
  const assetClass = investmentClasses.has(investment.assetClass) ? investment.assetClass : 'other'
  const legacyReturn = investment.annualRealReturn
  const returnType = investmentReturnTypes.has(investment.returnType)
    ? investment.returnType
    : legacyReturn === null || legacyReturn === undefined || legacyReturn === '' ? 'default' : 'real'
  const suppliedReturn = investment.returnValue ?? legacyReturn
  const returnValue = returnType === 'default' ? null : Number(suppliedReturn)
  const indexAnnualRate = returnType === 'cdi' ? Number(investment.indexAnnualRate) : null
  if (!name || !validNumber(amount, [0.01, 1000000000]) || !validNumber(monthlyContribution, [0, 10000000])) return null
  if (['real', 'nominal', 'ipca'].includes(returnType) && !validNumber(returnValue, [-0.99, 1])) return null
  if (returnType === 'cdi' && (!validNumber(returnValue, [0, 3]) || !validNumber(indexAnnualRate, [0, 1]))) return null
  const annualFee = Number(investment.annualFee || 0)
  let annualRealReturns = []
  try { annualRealReturns = validateAnnualRealReturns(investment.annualRealReturns) } catch {}
  return {
    id: safeId(investment.id, `investment-${index + 1}`),
    name,
    assetClass,
    liquidity: ['available', 'restricted'].includes(investment.liquidity) ? investment.liquidity : 'unknown',
    amount,
    monthlyContribution,
    returnType,
    returnValue,
    indexAnnualRate,
    ...(annualRealReturns.length ? { annualRealReturns } : {}),
    ...(validNumber(annualFee, [0.0001, 0.1]) ? { annualFee } : {}),
    ...(currencies[investment.exposureCurrency] ? { exposureCurrency: investment.exposureCurrency } : {}),
    ...(currencies[investment.exposureCurrency] && validNumber(Number(investment.exposureShare), [0, 0.9999]) ? { exposureShare: Number(investment.exposureShare) } : {}),
    ...(['domestic', 'international', 'global'].includes(investment.region) ? { region: investment.region } : {}),
    // Only meaningful for assetClass 'pension': holding period for the regressive tax table.
    ...(assetClass === 'pension' && safeDate(investment.acquiredAt) ? { acquiredAt: safeDate(investment.acquiredAt) } : {})
  }
}

export function sanitizeInvestments(candidate) {
  if (!Array.isArray(candidate)) return []
  const unique = new Map()
  for (const investment of candidate.map(sanitizeInvestment).filter(Boolean).slice(0, 30)) {
    unique.set(investment.id, investment)
  }
  return [...unique.values()]
}

function sanitizeCustomCategory(category) {
  if (!category || typeof category !== 'object') return null
  const name = typeof category.name === 'string' ? category.name.trim().slice(0, 40) : ''
  const type = ['income', 'expense'].includes(category.type) ? category.type : null
  if (!name || !type) return null
  return {
    id: safeId(category.id, `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`),
    name,
    type,
    budgetGroup: type === 'income' ? 'occasional' : 'variable',
    custom: true
  }
}

export function sanitizeCustomCategories(candidate) {
  if (!Array.isArray(candidate)) return []
  const unique = new Map()
  for (const item of candidate.map(sanitizeCustomCategory).filter(Boolean).slice(0, 30)) {
    if (!categoryById(item.id) && !unique.has(item.id)) unique.set(item.id, item)
  }
  return [...unique.values()]
}

export function sanitizeCashFlowItem(item, index = 0, customCategories = [], fallbackCurrency = 'BRL') {
  if (!item || typeof item !== 'object') return null
  const type = ['income', 'expense'].includes(item.type) ? item.type : null
  const category = categoryById(item.categoryId, customCategories)
  const amount = Number(item.amount)
  if (!type || !category || category.type !== type || !validNumber(amount, [0.01, 1000000000])) return null
  const startDate = safeDate(item.startDate)
  const suppliedEndDate = safeDate(item.endDate)
  const endDate = startDate && suppliedEndDate && suppliedEndDate < startDate ? null : suppliedEndDate
  const source = item.source === 'txt' || item.imported === true ? 'txt' : 'manual'
  const recordKind = item.recordKind === 'actual' || source === 'txt' ? 'actual' : 'planned'
  if (recordKind === 'actual' && !startDate) return null
  return {
    id: safeId(item.id, `item-${index + 1}`),
    type,
    categoryId: category.id,
    description: typeof item.description === 'string' ? item.description.trim().slice(0, 60) : '',
    amount,
    currency: normalizeCurrency(item.currency || fallbackCurrency),
    frequency: recordKind === 'actual'
      ? 'occasional'
      : ['monthly', 'annual', 'occasional'].includes(item.frequency) ? item.frequency : 'monthly',
    startDate,
    endDate,
    endMode: type === 'income' && recordKind === 'planned' && ['monthly', 'annual'].includes(item.frequency) && ['retirement', 'spouse-retirement'].includes(item.endMode) ? item.endMode : endDate ? 'date' : 'none',
    source,
    recordKind,
    ...(['primary', 'spouse', 'shared'].includes(item.householdOwner) ? { householdOwner: item.householdOwner } : {}),
    ...(typeof item.analysisOrigin === 'string' && /^analysis-[a-f0-9]{64}:[0-7]$/.test(item.analysisOrigin) ? { analysisOrigin: item.analysisOrigin } : {})
  }
}

function legacyCashFlowItems(source, currency) {
  const definitions = [
    ['recurringIncome', 'income', 'salary', 'Receitas recorrentes', 'monthly'],
    ['occasionalIncome', 'income', 'other-income', 'Receitas eventuais', 'occasional'],
    ['essentialExpenses', 'expense', 'housing', 'Despesas essenciais', 'monthly'],
    ['variableExpenses', 'expense', 'leisure', 'Despesas variáveis', 'monthly'],
    ['debtPayments', 'expense', 'debt', 'Parcelas e dívidas', 'monthly'],
    ['annualExpenses', 'expense', 'taxes', 'Gastos anuais', 'annual']
  ]
  return definitions
    .filter(([field]) => validNumber(source[field], cashFlowRules[field]) && source[field] > 0)
    .map(([field, type, categoryId, description, frequency], index) => ({
      id: `migrated-${index + 1}`,
      type,
      categoryId,
      description,
      amount: source[field],
      currency,
      frequency
    }))
}

export function sanitizePlan(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const plan = { ...defaultPlan }
  plan.decumulation = sanitizeDecumulation(source.decumulation)
  plan.finappMethod = sanitizeFinappMethod(source.finappMethod)
  plan.targetAge = Number.isInteger(source.targetAge) && source.targetAge >= 17 && source.targetAge <= 110 ? source.targetAge : null
  plan.horizonReferenceMonth = typeof source.horizonReferenceMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(source.horizonReferenceMonth) ? source.horizonReferenceMonth : null
  plan.riskSettings = sanitizeRiskSettings(source.riskSettings)
  plan.targetAllocation = sanitizeTargetAllocation(source.targetAllocation)
  plan.currencyTrends = sanitizeCurrencyTrends(source.currencyTrends)
  plan.retirementMonth = typeof source.retirementMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(source.retirementMonth) ? source.retirementMonth : null
  plan.spouseEnabled = source.spouseEnabled === true
  plan.spouseRetirementMonth = typeof source.spouseRetirementMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(source.spouseRetirementMonth) ? source.spouseRetirementMonth : null

  for (const [field, rule] of Object.entries(planRules)) {
    if (validNumber(source[field], rule)) plan[field] = source[field]
  }

  plan.investments = sanitizeInvestments(source.investments)
  if (plan.investments.length > 0) {
    plan.currentAssets = plan.investments.reduce((total, investment) => total + investment.amount, 0)
    plan.monthlyContribution = plan.investments.reduce((total, investment) => total + investment.monthlyContribution, 0)
  }

  if (plan.retirementAge <= plan.currentAge) {
    plan.retirementAge = Math.min(plan.currentAge + 1, 100)
  }

  if (!plan.spouseEnabled) {
    plan.spouseCurrentAge = null
    plan.spouseRetirementAge = null
    plan.spouseRetirementMonth = null
    plan.spouseExpectedMonthlyBenefit = 0
  } else if (Number.isFinite(plan.spouseCurrentAge) && Number.isFinite(plan.spouseRetirementAge) && plan.spouseRetirementAge <= plan.spouseCurrentAge) {
    plan.spouseRetirementAge = Math.min(plan.spouseCurrentAge + 1, 100)
  }

  return plan
}

export function sanitizeCashFlow(candidate = {}, currency = 'BRL', customCategories = []) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const cashFlow = { ...defaultCashFlow }
  const analyses = sanitizeStatementHistory(source.statementAnalyses)
  if (analyses.length) cashFlow.statementAnalyses = analyses
  cashFlow.ledger = sanitizeLedger(source.ledger)
  const paymentMatches = sanitizePaymentMatches(source.paymentMatches)
  if (paymentMatches.length) cashFlow.paymentMatches = paymentMatches
  cashFlow.commitments = sanitizeCommitments(source.commitments)
  cashFlow.consortia = sanitizeConsortia(source.consortia)
  cashFlow.annualGoals = sanitizeAnnualRows(source.annualGoals)
  cashFlow.nonFinancialAssets = sanitizeAnnualRows(source.nonFinancialAssets)
  if (typeof source.includeRealEstateInSolvency === 'boolean') cashFlow.includeRealEstateInSolvency = source.includeRealEstateInSolvency
  cashFlow.finappMigration = sanitizeMigration(source.finappMigration)
  cashFlow.retirementMonth = typeof source.retirementMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(source.retirementMonth) ? source.retirementMonth : null
  cashFlow.spouseRetirementMonth = typeof source.spouseRetirementMonth === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(source.spouseRetirementMonth) ? source.spouseRetirementMonth : null

  for (const [field, rule] of Object.entries(cashFlowRules)) {
    if (validNumber(source[field], rule)) cashFlow[field] = source[field]
  }
  cashFlow.referenceMonth = typeof source.referenceMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(source.referenceMonth)
    ? source.referenceMonth
    : defaultCashFlow.referenceMonth
  cashFlow.reserveBuildMonths = Math.round(cashFlow.reserveBuildMonths)
  const hasLegacyTotals = Object.keys(cashFlowRules)
    .some((field) => validNumber(source[field], cashFlowRules[field]))
  const suppliedItems = Array.isArray(source.items)
    ? source.items
    : hasLegacyTotals
      ? legacyCashFlowItems(source, currency)
      : defaultCashFlow.items
  cashFlow.items = suppliedItems
    .map((item, index) => sanitizeCashFlowItem(item, index, customCategories, currency))
    .filter(Boolean)
    .slice(0, 100)
  cashFlow.items = cashFlow.items.filter(item => !item.id.startsWith('ledger:'))
  for (const movement of cashFlow.ledger.movements) {
    if (!movement.budgetCategoryId) continue
    try {
      if (cashFlow.items.length >= 100) throw new Error('Limite de lançamentos.')
      cashFlow.items.push(linkedBudgetItem(movement, cashFlow.ledger, movement.budgetCategoryId, customCategories))
    } catch { delete movement.budgetCategoryId }
  }
  return cashFlow
}

function sanitizeScenario(scenario, customCategories) {
  if (!scenario || typeof scenario !== 'object') return null
  const name = typeof scenario.name === 'string' ? scenario.name.trim().slice(0, 40) : ''
  if (!name) return null

  return {
    id: typeof scenario.id === 'string' ? scenario.id.slice(0, 80) : '',
    name,
    createdAt: typeof scenario.createdAt === 'string' ? scenario.createdAt : null,
    currency: normalizeCurrency(scenario.currency),
    plan: sanitizePlan({ ...scenario.plan, retirementMonth: scenario.cashFlow?.retirementMonth || scenario.plan?.retirementMonth }),
    cashFlow: scenario.cashFlow
      ? sanitizeCashFlow({ ...scenario.cashFlow, spouseRetirementMonth: scenario.plan?.spouseEnabled ? scenario.plan.spouseRetirementMonth : null, retirementMonth: scenario.cashFlow.retirementMonth || scenario.plan?.retirementMonth }, scenario.currency, customCategories)
      : null
  }
}

export function sanitizeStoredState(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const currency = normalizeCurrency(source.currency)
  const customCategories = sanitizeCustomCategories(source.customCategories)
  const scenarios = Array.isArray(source.scenarios)
    ? source.scenarios.map((scenario) => sanitizeScenario(scenario, customCategories)).filter(Boolean).slice(0, 3)
    : []

  return {
    version: stateVersion,
    valuesHidden: Boolean(source.valuesHidden),
    reminderEnabled: source.reminderEnabled !== false,
    isDemo: source.isDemo === true || !source.plan,
    lastUpdatedAt: typeof source.lastUpdatedAt === 'string' ? source.lastUpdatedAt : null,
    activeChartRange: ['five', 'ten', 'retirement'].includes(source.activeChartRange)
      ? source.activeChartRange
      : 'retirement',
    currency,
    exchangeRates: sanitizeExchangeRates(source.exchangeRates || bundledExchangeRates),
    customCategories,
    plan: sanitizePlan(source.plan
      ? { ...source.plan, retirementMonth: source.cashFlow?.retirementMonth || source.plan?.retirementMonth }
      : { ...defaultPlan, retirementMonth: source.cashFlow?.retirementMonth }),
    cashFlow: sanitizeCashFlow({ ...source.cashFlow, spouseRetirementMonth: source.plan?.spouseEnabled ? source.plan.spouseRetirementMonth : null, retirementMonth: source.cashFlow?.retirementMonth || source.plan?.retirementMonth }, currency, customCategories),
    scenarios
  }
}

export function parseStoredState(serialized) {
  if (!serialized) return sanitizeStoredState({})
  try {
    return sanitizeStoredState(JSON.parse(serialized))
  } catch {
    return sanitizeStoredState({})
  }
}

export function loadStoredState(storage) {
  try {
    const current = storage.getItem(storageKeys.current)
    if (current) return parseStoredState(current)

    const legacyKey = [storageKeys.previous, storageKeys.legacy, storageKeys.older, storageKeys.oldest, storageKeys.earlier, storageKeys.earliest, storageKeys.original, storageKeys.first, storageKeys.initial]
      .find((key) => storage.getItem(key))
    const legacy = legacyKey ? storage.getItem(legacyKey) : null
    if (!legacy) {
      const emptyState = parseStoredState(null)
      emptyState.dataDeleted = storage.getItem(storageKeys.deletionMarker) === '1'
      return emptyState
    }

    const migrated = parseStoredState(legacy)
    try {
      storage.setItem(storageKeys.current, JSON.stringify(migrated))
      storage.removeItem(legacyKey)
    } catch {
      // Mantém o legado quando a migração não puder ser concluída.
    }
    return migrated
  } catch {
    return parseStoredState(null)
  }
}

export function removeStoredState(storage) {
  const failedKeys = []

  try { storage.removeItem('aposenta-plus-data-history-v1') } catch {
    failedKeys.push('aposenta-plus-data-history-v1')
  }

  for (const key of [storageKeys.current, storageKeys.previous, storageKeys.legacy, storageKeys.older, storageKeys.oldest, storageKeys.earlier, storageKeys.earliest, storageKeys.original, storageKeys.first, storageKeys.initial]) {
    try {
      storage.removeItem(key)
    } catch {
      failedKeys.push(key)
    }
  }

  try {
    storage.setItem(storageKeys.deletionMarker, '1')
  } catch {
    failedKeys.push(storageKeys.deletionMarker)
  }

  return { success: failedKeys.length === 0, failedKeys }
}

export function createExportableState(candidate) {
  const safe = sanitizeStoredState(candidate)
  return {
    version: safe.version,
    valuesHidden: safe.valuesHidden,
    reminderEnabled: safe.reminderEnabled,
    isDemo: safe.isDemo,
    lastUpdatedAt: safe.lastUpdatedAt,
    activeChartRange: safe.activeChartRange,
    currency: safe.currency,
    exchangeRates: safe.exchangeRates,
    customCategories: safe.customCategories,
    plan: safe.plan,
    cashFlow: safe.cashFlow,
    scenarios: safe.scenarios
  }
}

export function serializeExportableState(candidate) {
  return JSON.stringify(createExportableState(candidate), null, 2)
}
