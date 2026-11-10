import { setMarketAssumptions } from './state.js'
import { ownedStorage } from './owned-storage.js'
import { sanitizeEconomicIndicators } from '../shared/economic-indicators.js'
import { shouldRefresh } from '../domain/market-assumptions.js'

export { shouldRefresh }

// Latest public snapshot received in this session, for screens that show the
// indicators themselves (source, date, stale flag). Not persisted.
export const economicIndicatorsState = { snapshot: null, loadedAt: null }

// Fetches the public indicators and applies them to the plan when it follows the
// market (inflationSource !== 'manual'). Failures are ignored: the plan keeps its
// previous assumptions. Returns true only when the plan changed.
export async function loadEconomicIndicators(fetchImpl = globalThis.fetch, now = () => new Date()) {
  const generation = ownedStorage.generation
  try {
    const response = await fetchImpl('/api/economic-indicators', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    })
    if (!response.ok) throw new Error('Indicadores indisponíveis.')
    const snapshot = sanitizeEconomicIndicators(await response.json())
    if (generation !== ownedStorage.generation) return false
    if (!Object.keys(snapshot.countries).length) return false
    economicIndicatorsState.snapshot = snapshot
    economicIndicatorsState.loadedAt = now().toISOString()
    return setMarketAssumptions(snapshot, now())
  } catch {
    return false
  }
}

// Applies the session snapshot again, for example after the plan currency changes
// or the person goes back to the market mode. Without a snapshot nothing changes.
// Not a user edit. Returns true only when the plan changed.
export function reapplyMarketAssumptions(now = () => new Date()) {
  if (!economicIndicatorsState.snapshot) return false
  return setMarketAssumptions(economicIndicatorsState.snapshot, now())
}
