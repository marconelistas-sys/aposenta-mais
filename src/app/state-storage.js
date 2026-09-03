import { defaultPlan } from '../data/mock-plan.js'

export const stateVersion = 2
export const storageKeys = Object.freeze({
  current: 'aposenta-plus-state-v2',
  legacy: 'aposenta-plus-state-v1',
  deletionMarker: 'aposenta-plus-deleted-v1'
})

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

    const legacy = storage.getItem(storageKeys.legacy)
    if (!legacy) {
      const emptyState = parseStoredState(null)
      emptyState.dataDeleted = storage.getItem(storageKeys.deletionMarker) === '1'
      return emptyState
    }

    const migrated = parseStoredState(legacy)
    try {
      storage.setItem(storageKeys.current, JSON.stringify(migrated))
      storage.removeItem(storageKeys.legacy)
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

  for (const key of [storageKeys.current, storageKeys.legacy]) {
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
    scenarios: safe.scenarios
  }
}

export function serializeExportableState(candidate) {
  return JSON.stringify(createExportableState(candidate), null, 2)
}
