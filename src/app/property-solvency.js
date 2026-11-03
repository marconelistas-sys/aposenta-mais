import { state, planWithWealthSnapshot } from './state.js'
import { ownedStorage } from './owned-storage.js'
import { storageKeys } from './state-storage.js'

export function savePropertySolvencyPreference(include) {
  if (typeof include !== 'boolean') throw new Error('Escolha se deseja considerar imóveis.')
  commit({ includeRealEstateInSolvency: include })
}

export function saveSolvencyAssets(nonFinancialAssets) {
  commit({ nonFinancialAssets })
}

function commit(patch) {
  const next = { ...state, cashFlow: { ...state.cashFlow, ...patch }, isDemo: false, lastUpdatedAt: new Date().toISOString() }
  // Property values are part of the balance sheet: refresh the photo of the month.
  next.plan = planWithWealthSnapshot(next)
  ownedStorage.setItem(storageKeys.current, JSON.stringify(next))
  Object.assign(state, next)
}
