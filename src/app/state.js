import { defaultPlan } from '../data/mock-plan.js'
import { defaultCashFlow } from '../data/mock-cash-flow.js'
import {
  loadStoredState,
  removeStoredState,
  sanitizeStoredState,
  stateVersion,
  storageKeys
} from './state-storage.js'

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

export function toggleReminder() {
  state.reminderEnabled = !state.reminderEnabled
  saveState()
}

export function addScenario(name, plan) {
  if (state.scenarios.length >= 3) {
    throw new RangeError('Você pode salvar até três cenários.')
  }
  const id = globalThis.crypto?.randomUUID?.() || `scenario-${Date.now()}`
  state.scenarios.push({ id, name: name.trim().slice(0, 40), plan: { ...plan }, createdAt: new Date().toISOString() })
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
    for (const key of [storageKeys.legacy, storageKeys.oldest]) {
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
