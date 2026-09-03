import { defaultPlan } from '../data/mock-plan.js'

const storageKey = 'aposenta-plus-state-v1'

function readSavedState() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}')
  } catch {
    return {}
  }
}

const savedState = readSavedState()

export const state = {
  valuesHidden: Boolean(savedState.valuesHidden),
  plan: {
    ...defaultPlan,
    ...(savedState.plan || {})
  },
  activeChartRange: savedState.activeChartRange || 'retirement'
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
  saveState()
}
