import { bundledExchangeRates, ecbSource, sanitizeExchangeRates } from '../shared/exchange-rates.js'

const ecbDailyRatesUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const cacheDurationMs = 6 * 60 * 60 * 1000

export function parseEcbRates(xml, fetchedAt = new Date().toISOString()) {
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1]
  if (!date) throw new Error('A resposta do BCE não contém uma data válida.')

  const rates = { EUR: 1 }
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    rates[match[1]] = Number(match[2])
  }

  for (const code of ['BRL', 'CHF', 'USD']) {
    if (!Number.isFinite(rates[code]) || rates[code] <= 0) {
      throw new Error(`A resposta do BCE não contém a taxa ${code}.`)
    }
  }

  return sanitizeExchangeRates({
    base: 'EUR',
    date,
    fetchedAt,
    source: ecbSource.name,
    sourceUrl: ecbSource.url,
    stale: false,
    rates
  })
}

export function createExchangeRateHandler({ fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let cache = null
  let cachedAt = 0

  return async function handleExchangeRates(request, response, requestUrl) {
    if (requestUrl.pathname !== '/api/exchange-rates') return false

    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' })
      response.end(JSON.stringify({ error: 'Método não permitido.' }))
      return true
    }

    if (!cache || now() - cachedAt >= cacheDurationMs) {
      try {
        const upstream = await fetchImpl(ecbDailyRatesUrl, {
          headers: { Accept: 'application/xml' },
          signal: AbortSignal.timeout(5000)
        })
        if (!upstream.ok) throw new Error('Cotação indisponível.')
        cache = parseEcbRates(await upstream.text(), new Date(now()).toISOString())
        cachedAt = now()
      } catch {
        cache = sanitizeExchangeRates({
          ...bundledExchangeRates,
          fetchedAt: new Date(now()).toISOString(),
          stale: true
        })
        cachedAt = now()
      }
    }

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=1800'
    })
    response.end(JSON.stringify(cache))
    return true
  }
}
