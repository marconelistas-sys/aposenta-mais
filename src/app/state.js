import { defaultPlan } from '../data/mock-plan.js'
import { defaultCashFlow } from '../data/mock-cash-flow.js'
import {
  loadStoredState,
  removeStoredState,
  sanitizeCashFlow,
  sanitizeCashFlowItem,
  sanitizeCustomCategories,
  sanitizeStoredState,
  stateVersion,
  storageKeys
} from './state-storage.js'
import { convertCurrency, sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { normalizeCurrency } from '../shared/currencies.js'

const unavailableStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('Armazenamento indisponível') },
  removeItem: () => { throw new Error('Armazenamento indisponível') }
}

function resolveStorage() {
  try {
    return globalThis.localStorage || unavailableStorage
  } catch {
    return unavailableStorage
  }
}

const appStorage = resolveStorage()
const savedState = loadStoredState(appStorage)

export const state = {
  ...savedState,
  version: stateVersion
}

export function saveState() {
  try {
    appStorage.setItem(storageKeys.current, JSON.stringify(state))
    try {
      appStorage.removeItem(storageKeys.deletionMarker)
    } catch {
      // A versão atual tem precedência sobre um marcador antigo.
    }
    return true
  } catch {
    // O aplicativo continua funcional quando o armazenamento está indisponível.
    return false
  }
}

export function toggleValues() {
  state.valuesHidden = !state.valuesHidden
  saveState()
}

export function updatePlan(patch) {
  state.plan = { ...state.plan, ...patch }
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function updateCashFlow(patch) {
  state.cashFlow = { ...state.cashFlow, ...patch }
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function addCashFlowItem(item) {
  if (item.recordKind === 'actual' && !item.startDate) {
    throw new TypeError('Informe a data do lançamento realizado.')
  }
  if (item.startDate && item.endDate && item.endDate < item.startDate) {
    throw new RangeError('A data final deve ser igual ou posterior à data inicial.')
  }
  const nextCashFlow = sanitizeCashFlow({
    ...state.cashFlow,
    items: [...state.cashFlow.items, {
      ...item,
      id: globalThis.crypto?.randomUUID?.() || `item-${Date.now()}`
    }]
  }, state.currency, state.customCategories)
  if (nextCashFlow.items.length === state.cashFlow.items.length) {
    throw new TypeError('Revise os dados do lançamento.')
  }
  updateCashFlow(nextCashFlow)
}

export function importCashFlowItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError('Nenhum lançamento válido foi encontrado.')
  const availableSlots = Math.max(100 - state.cashFlow.items.length, 0)
  if (availableSlots === 0) throw new RangeError('O limite de 100 lançamentos foi atingido.')
  const nextCashFlow = sanitizeCashFlow({
    ...state.cashFlow,
    items: [...state.cashFlow.items, ...items.slice(0, availableSlots)]
  }, state.currency, state.customCategories)
  const importedCount = nextCashFlow.items.length - state.cashFlow.items.length
  if (importedCount === 0) throw new TypeError('Nenhum lançamento válido foi encontrado.')
  updateCashFlow(nextCashFlow)
  return importedCount
}

export function removeCashFlowItem(id) {
  updateCashFlow({
    ...state.cashFlow,
    items: state.cashFlow.items.filter((item) => item.id !== id)
  })
}

export function updateCashFlowItem(id, patch) {
  const index = state.cashFlow.items.findIndex((item) => item.id === id)
  if (index < 0) throw new TypeError('Lançamento não encontrado.')
  const current = state.cashFlow.items[index]
  const candidate = {
    ...current,
    ...patch,
    id: current.id,
    source: current.source
  }
  if (candidate.recordKind === 'actual' && !candidate.startDate) {
    throw new TypeError('Informe a data do lançamento realizado.')
  }
  if (candidate.startDate && candidate.endDate && candidate.endDate < candidate.startDate) {
    throw new RangeError('A data final deve ser igual ou posterior à data inicial.')
  }
  const updated = sanitizeCashFlowItem(candidate, index, state.customCategories, state.currency)
  if (!updated) throw new TypeError('Revise os dados do lançamento.')
  const items = [...state.cashFlow.items]
  items[index] = updated
  updateCashFlow({ ...state.cashFlow, items })
  return updated
}

export function setCashFlowReferenceMonth(referenceMonth) {
  if (typeof referenceMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
    throw new TypeError('Selecione um mês válido.')
  }
  updateCashFlow({ ...state.cashFlow, referenceMonth })
}

export function addCustomCategory(name, type) {
  const normalizedName = String(name || '').trim().slice(0, 40)
  if (!normalizedName) throw new TypeError('Informe o nome da categoria.')
  const id = `custom-${normalizedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`
  const categories = sanitizeCustomCategories([
    ...state.customCategories,
    { id, name: normalizedName, type }
  ])
  if (categories.length === state.customCategories.length) {
    throw new TypeError('Essa categoria já existe ou não é válida.')
  }
  state.customCategories = categories
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function replaceFinancialData(candidate) {
  const safe = sanitizeStoredState({ ...candidate, isDemo: false })
  state.plan = safe.plan
  state.cashFlow = safe.cashFlow
  state.scenarios = safe.scenarios
  state.currency = safe.currency
  state.exchangeRates = safe.exchangeRates
  state.customCategories = safe.customCategories
  state.lastUpdatedAt = safe.lastUpdatedAt || new Date().toISOString()
  state.isDemo = false
  state.dataDeleted = false
  saveState()
}

export function toggleReminder() {
  state.reminderEnabled = !state.reminderEnabled
  saveState()
}

export function setCurrency(currency) {
  const nextCurrency = normalizeCurrency(currency)
  if (nextCurrency === state.currency) return
  const convert = (value) => convertCurrency(value, state.currency, nextCurrency, state.exchangeRates)
  for (const field of ['currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit']) {
    state.plan[field] = convert(state.plan[field])
  }
  for (const field of ['currentEmergencyReserve', 'emergencyReserveTarget']) {
    state.cashFlow[field] = convert(state.cashFlow[field])
  }
  state.currency = nextCurrency
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function setExchangeRates(exchangeRates) {
  state.exchangeRates = sanitizeExchangeRates(exchangeRates)
  saveState()
}

export function addScenario(name, plan) {
  if (state.scenarios.length >= 3) {
    throw new RangeError('Você pode salvar até três cenários.')
  }
  const id = globalThis.crypto?.randomUUID?.() || `scenario-${Date.now()}`
  state.scenarios.push({
    id,
    name: name.trim().slice(0, 40),
    currency: state.currency,
    plan: { ...plan },
    cashFlow: structuredClone(state.cashFlow),
    createdAt: new Date().toISOString()
  })
  saveState()
}

export function loadScenario(id) {
  const scenario = state.scenarios.find((item) => item.id === id)
  if (!scenario) throw new TypeError('Cenário não encontrado.')
  state.plan = { ...scenario.plan }
  if (scenario.cashFlow) state.cashFlow = structuredClone(scenario.cashFlow)
  state.currency = scenario.currency
  state.isDemo = false
  state.lastUpdatedAt = new Date().toISOString()
  saveState()
}

export function removeScenario(id) {
  state.scenarios = state.scenarios.filter((scenario) => scenario.id !== id)
  saveState()
}

export function setChartRange(range) {
  state.activeChartRange = range
  saveState()
}

export function resetState() {
  Object.assign(state, sanitizeStoredState({ plan: { ...defaultPlan }, cashFlow: { ...defaultCashFlow }, isDemo: true }), { dataDeleted: false })
  const saved = saveState()
  const failedKeys = saved ? [] : [storageKeys.current]
  if (saved) {
    for (const key of [storageKeys.legacy, storageKeys.older, storageKeys.oldest, storageKeys.earlier, storageKeys.earliest, storageKeys.original]) {
      try {
        appStorage.removeItem(key)
      } catch {
        failedKeys.push(key)
      }
    }
  }
  return { success: failedKeys.length === 0, failedKeys }
}

export function deleteLocalData() {
  const result = removeStoredState(appStorage)
  Object.assign(state, sanitizeStoredState({ plan: { ...defaultPlan }, cashFlow: { ...defaultCashFlow }, isDemo: true }), { dataDeleted: true })
  return result
}
