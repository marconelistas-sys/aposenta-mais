import { setExchangeRates } from './state.js'

export async function loadExchangeRates(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl('/api/exchange-rates', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin'
    })
    if (!response.ok) throw new Error('Cotação indisponível.')
    setExchangeRates(await response.json())
    return true
  } catch {
    return false
  }
}
