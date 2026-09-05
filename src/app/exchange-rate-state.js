import { setExchangeRates } from './state.js'
import { ownedStorage } from './owned-storage.js'

export async function loadExchangeRates(fetchImpl = globalThis.fetch) {
  const generation = ownedStorage.generation
  try {
    const response = await fetchImpl('/api/exchange-rates', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    })
    if (!response.ok) throw new Error('Cotação indisponível.')
    const payload = await response.json()
    if (generation !== ownedStorage.generation) return false
    setExchangeRates(payload)
    return true
  } catch {
    return false
  }
}
