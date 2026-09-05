import { parseEcbRates } from './exchange-rates.mjs'

export const historyUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'

export function parseExchangeHistory(xml, fetchedAt) {
  if (typeof xml !== 'string' || xml.length > 2000000) throw new Error('Histórico inválido.')
  const days = new Map()
  for (const match of xml.matchAll(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g)) {
    const date = match[1]
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Data inválida.')
    days.set(date, parseEcbRates(match[0], fetchedAt))
  }
  if (!days.size) throw new Error('Histórico vazio.')
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-90)
}

export function createExchangeHistoryHandler({ fetchImpl = fetch, now = Date.now } = {}) {
  let cache = null
  let checkedAt = -Infinity
  let stale = false
  return async (request, response, url) => {
    if (url.pathname !== '/api/exchange-history') return false
    const send = (status, payload) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Allow: 'GET' })
      response.end(JSON.stringify(payload))
    }
    if (request.method !== 'GET') { send(405, { error: 'Método não permitido.' }); return true }
    if (now() - checkedAt >= (stale ? 60000 : 21600000)) {
      try {
        const upstream = await fetchImpl(historyUrl, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/xml' } })
        if (!upstream.ok) throw new Error('Indisponível')
        cache = parseExchangeHistory(await upstream.text(), new Date(now()).toISOString())
        stale = false
      } catch { stale = true }
      checkedAt = now()
    }
    send(cache ? 200 : 503, cache ? { points: cache, stale, sourceUrl: historyUrl } : { error: 'Histórico indisponível. Tente novamente.' })
    return true
  }
}
