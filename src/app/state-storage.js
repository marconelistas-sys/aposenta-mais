import { defaultPlan } from '../data/mock-plan.js'
import { defaultCashFlow } from '../data/mock-cash-flow.js'

export const stateVersion = 3
export const storageKeys = Object.freeze({
  current: 'aposenta-plus-state-v3',
  legacy: 'aposenta-plus-state-v2',
  oldest: 'aposenta-plus-state-v1',
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
  targetMonthlyIncome: [0, 10000000],
  expectedMonthlyBenefit: [0, 1000000],
  annualWithdrawalRate: [0.001, 1]
}

function validNumber(value, [minimum, maximum]) {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

export function sanitizePlan(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const plan = { ...defaultPlan }

  for (const [field, rule] of Object.entries(planRules)) {
    if (validNumber(source[field], rule)) plan[field] = source[field]
  }

  if (plan.retirementAge <= plan.currentAge) {
    plan.retirementAge = Math.min(plan.currentAge + 1, 100)
  }

  return plan
}

export function sanitizeCashFlow(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const cashFlow = { ...defaultCashFlow }

  for (const [field, rule] of Object.entries(cashFlowRules)) {
    if (validNumber(source[field], rule)) cashFlow[field] = source[field]
  }
  cashFlow.reserveBuildMonths = Math.round(cashFlow.reserveBuildMonths)
  return cashFlow
}

function sanitizeScenario(scenario) {
  if (!scenario || typeof scenario !== 'object') return null
  const name = typeof scenario.name === 'string' ? scenario.name.trim().slice(0, 40) : ''
  if (!name) return null

  return {
    id: typeof scenario.id === 'string' ? scenario.id.slice(0, 80) : '',
    name,
    createdAt: typeof scenario.createdAt === 'string' ? scenario.createdAt : null,
    plan: sanitizePlan(scenario.plan)
  }
}

export function sanitizeStoredState(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const scenarios = Array.isArray(source.scenarios)
    ? source.scenarios.map(sanitizeScenario).filter(Boolean).slice(0, 3)
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
    plan: sanitizePlan(source.plan),
    cashFlow: sanitizeCashFlow(source.cashFlow),
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

    const legacyKey = storage.getItem(storageKeys.legacy) ? storageKeys.legacy : storageKeys.oldest
    const legacy = storage.getItem(legacyKey)
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

  for (const key of [storageKeys.current, storageKeys.legacy, storageKeys.oldest]) {
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
    plan: safe.plan,
    cashFlow: safe.cashFlow,
    scenarios: safe.scenarios
  }
}

export function serializeExportableState(candidate) {
  return JSON.stringify(createExportableState(candidate), null, 2)
}
