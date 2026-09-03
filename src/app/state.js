import { defaultPlan } from '../data/mock-plan.js'
import { parseStoredState, stateVersion } from './state-storage.js'

const storageKey = 'aposenta-plus-state-v2'
const legacyStorageKey = 'aposenta-plus-state-v1'

function readSavedState() {
  try {
    const current = localStorage.getItem(storageKey)
    const legacy = localStorage.getItem(legacyStorageKey)
    return parseStoredState(current || legacy)
  } catch {
    return parseStoredState(null)
  }
}

const savedState = readSavedState()

export const state = {
  ...savedState,
  version: stateVersion
}

export function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // O aplicativo continua funcional quando o armazenamento está indisponível.
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
  state.valuesHidden = false
  state.plan = { ...defaultPlan }
  state.activeChartRange = 'retirement'
  state.reminderEnabled = true
  state.isDemo = true
  state.lastUpdatedAt = null
  state.scenarios = []
  saveState()
}
