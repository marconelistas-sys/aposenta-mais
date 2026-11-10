import { bundledEconomicIndicators, cleanRate, economicSources, percentToRate, sanitizeEconomicIndicators } from '../shared/economic-indicators.js'

// Public sources, fixed hosts. Only clock-derived parameters (fromDate) are
// added: no user data ever leaves the server.
export const sgsSeries = Object.freeze({ ipcaMonthly: 433, ipca12m: 13522, cdi: 4389, selicTarget: 432 })
export const sgsUrl = (series, last) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/${last}?formato=json`
// The literal quotes and %20 are required: without them Olinda answers 400 "URI malformed".
export const focusUrl = indicator => `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=40&$format=json&$orderby=Data%20desc&$filter=Indicador%20eq%20'${indicator}'%20and%20baseCalculo%20eq%200&$select=Indicador,Data,DataReferencia,Mediana`
export const snbCpiUrl = fromMonth => `https://data.snb.ch/api/cube/plkopr/data/csv/en?fromDate=${fromMonth}`
export const snbRatesUrl = fromDate => `https://data.snb.ch/api/cube/snbgwdzid/data/csv/en?fromDate=${fromDate}`

export const cacheDurationMs = 12 * 60 * 60 * 1000
export const retryAfterFailureMs = 10 * 60 * 1000
const defaultTimeoutMs = 6000
const maxResponseBytes = 2_000_000

function finitePercent(text) {
  const value = Number(String(text).trim())
  if (String(text).trim() === '' || !Number.isFinite(value) || Math.abs(value) > 100) throw new Error('Valor percentual inválido.')
  return value
}

function isoDate(day, month, year) {
  const value = `${year}-${month}-${day}`
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Data inválida.')
  return value
}

function parseJson(text) {
  if (typeof text !== 'string' || text.length > maxResponseBytes) throw new Error('Resposta inválida.')
  return JSON.parse(text)
}

// SGS: [{"data":"01/09/2026","valor":"0.82"}]. The order is not guaranteed
// (series 4389 comes newest first), so points are sorted by date.
export function parseSgsSeries(text) {
  const rows = parseJson(text)
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('Série SGS vazia ou inválida.')
  return rows.map(row => {
    const match = String(row?.data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!match) throw new Error('Data SGS inválida.')
    return { date: isoDate(match[1], match[2], match[3]), value: finitePercent(row.valor) }
  }).sort((left, right) => left.date.localeCompare(right.date))
}

// Latest point not after today. Series 432 (Selic target) is published until the
// next meeting, so its last dates can be in the future.
export function latestSgsPoint(text, today = new Date()) {
  const points = parseSgsSeries(text)
  const limit = today.toISOString().slice(0, 10)
  return points.findLast(point => point.date <= limit) || points[0]
}

// Focus annual medians: only the rows of the most recent publication date.
export function parseFocusAnnual(text, indicator) {
  const rows = parseJson(text)?.value
  if (!Array.isArray(rows) || !rows.length || rows.length > 200) throw new Error('Focus sem dados.')
  const valid = rows.filter(row => row?.Indicador === indicator && typeof row.Data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.Data))
  if (!valid.length) throw new Error('Focus sem o indicador pedido.')
  const asOf = valid.reduce((latest, row) => row.Data > latest ? row.Data : latest, valid[0].Data)
  isoDate(asOf.slice(8, 10), asOf.slice(5, 7), asOf.slice(0, 4))
  const years = {}
  for (const row of valid.filter(row => row.Data === asOf)) {
    const year = Number(row.DataReferencia)
    if (!Number.isInteger(year) || year < 2000 || year > 2199) continue
    if (typeof row.Mediana !== 'number' || !Number.isFinite(row.Mediana)) throw new Error('Mediana Focus inválida.')
    years[year] = percentToRate(finitePercent(row.Mediana))
  }
  if (!Object.keys(years).length) throw new Error('Focus sem anos válidos.')
  return { asOf, years }
}

// SNB cube CSV: BOM, CRLF, a few header lines, then "Date";"D0";"Value".
// Empty values are skipped. Returns Map(series -> points sorted by date).
export function parseSnbCsv(text) {
  if (typeof text !== 'string' || text.length > maxResponseBytes) throw new Error('CSV inválido.')
  const series = new Map()
  let inData = false
  for (const rawLine of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const cells = rawLine.split(';').map(cell => cell.trim().replace(/^"|"$/g, ''))
    if (!inData) { inData = cells[0] === 'Date' && cells[1] === 'D0'; continue }
    if (cells.length < 3 || cells[2] === '') continue
    const [date, key, value] = cells
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date) || !/^[A-Z0-9]{1,20}$/.test(key)) throw new Error('Linha do CSV inválida.')
    if (!series.has(key)) series.set(key, [])
    const number = Number(value)
    if (!Number.isFinite(number) || Math.abs(number) > 1e6) throw new Error('Valor do CSV inválido.')
    series.get(key).push({ date, value: number })
  }
  if (!inData || !series.size) throw new Error('CSV sem dados.')
  for (const points of series.values()) points.sort((left, right) => left.date.localeCompare(right.date))
  return series
}

function previousMonth(month) {
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, '0')}`
}

// plkopr: VVP = annual CPI change in %, LD2010100 = the index. The monthly change
// comes from two consecutive index points.
export function parseSnbCpi(text) {
  const series = parseSnbCsv(text)
  const yoyPoint = series.get('VVP')?.at(-1)
  if (!yoyPoint) throw new Error('IPC suíço sem variação anual.')
  const index = new Map((series.get('LD2010100') || []).map(point => [point.date, point.value]))
  const current = index.get(yoyPoint.date), previous = index.get(previousMonth(yoyPoint.date))
  const monthly = current > 0 && previous > 0 ? cleanRate(current / previous - 1) : null
  return { lastMonth: yoyPoint.date, monthly, yoy: percentToRate(finitePercent(yoyPoint.value)) }
}

// snbgwdzid: LZ = SNB policy rate, SARON. Both in %.
export function parseSnbRates(text) {
  const series = parseSnbCsv(text)
  const policy = series.get('LZ')?.at(-1), saron = series.get('SARON')?.at(-1)
  if (!policy || !saron) throw new Error('Taxas do SNB indisponíveis.')
  return { policyRate: percentToRate(finitePercent(policy.value)), saron: percentToRate(finitePercent(saron.value)), asOf: [policy.date, saron.date].sort().at(-1) }
}

export function buildBrazilIndicators({ ipcaMonthly, ipca12m, cdi, selicTarget, focusIpca, focusSelic }, today = new Date()) {
  const monthly = latestSgsPoint(ipcaMonthly, today)
  const yoy = latestSgsPoint(ipca12m, today)
  const cdiPoint = latestSgsPoint(cdi, today)
  const selic = latestSgsPoint(selicTarget, today)
  const inflation = parseFocusAnnual(focusIpca, 'IPCA')
  const policyRateYearEnd = parseFocusAnnual(focusSelic, 'Selic')
  if (monthly.date !== yoy.date) throw new Error('IPCA mensal e de 12 meses com meses diferentes.')
  return {
    currency: 'BRL',
    asOf: [inflation.asOf, policyRateYearEnd.asOf, cdiPoint.date].sort().at(-1),
    cpi: { lastMonth: monthly.date.slice(0, 7), monthly: percentToRate(monthly.value), yoy: percentToRate(yoy.value) },
    policyRate: percentToRate(selic.value),
    cdi: percentToRate(cdiPoint.value),
    expectations: { asOf: [inflation.asOf, policyRateYearEnd.asOf].sort().at(-1), inflation: inflation.years, policyRateYearEnd: policyRateYearEnd.years },
    source: economicSources.BR.name,
    sourceUrl: economicSources.BR.url
  }
}

export function buildSwissIndicators({ cpi, rates }) {
  const prices = parseSnbCpi(cpi)
  const money = parseSnbRates(rates)
  return { currency: 'CHF', asOf: money.asOf, cpi: prices, policyRate: money.policyRate, saron: money.saron, source: economicSources.CH.name, sourceUrl: economicSources.CH.url }
}

function shiftDays(date, days) {
  return new Date(date.getTime() + days * 86400000).toISOString().slice(0, 10)
}

async function fetchText(fetchImpl, url, timeoutMs, accept) {
  const upstream = await fetchImpl(url, { headers: { Accept: accept }, signal: AbortSignal.timeout(timeoutMs) })
  if (!upstream.ok) throw new Error('Fonte indisponível.')
  const text = await upstream.text()
  if (text.length > maxResponseBytes) throw new Error('Resposta grande demais.')
  return text
}

export const countryFetchers = Object.freeze({
  async BR(fetchImpl, today, timeoutMs) {
    const get = url => fetchText(fetchImpl, url, timeoutMs, 'application/json')
    const [ipcaMonthly, ipca12m, cdi, selicTarget, focusIpca, focusSelic] = await Promise.all([
      get(sgsUrl(sgsSeries.ipcaMonthly, 2)), get(sgsUrl(sgsSeries.ipca12m, 2)), get(sgsUrl(sgsSeries.cdi, 5)),
      get(sgsUrl(sgsSeries.selicTarget, 5)), get(focusUrl('IPCA')), get(focusUrl('Selic'))
    ])
    return buildBrazilIndicators({ ipcaMonthly, ipca12m, cdi, selicTarget, focusIpca, focusSelic }, today)
  },
  async CH(fetchImpl, today, timeoutMs) {
    const get = url => fetchText(fetchImpl, url, timeoutMs, 'text/csv')
    const [cpi, rates] = await Promise.all([get(snbCpiUrl(shiftDays(today, -430).slice(0, 7))), get(snbRatesUrl(shiftDays(today, -45)))])
    return buildSwissIndicators({ cpi, rates })
  }
})

// Each country is fetched, cached and degraded on its own: one unavailable
// source never removes the other country. A failed country keeps its last good
// data, or the bundled snapshot, marked stale, and is retried after 10 minutes.
export function createEconomicIndicatorsHandler({ fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = defaultTimeoutMs } = {}) {
  const entries = new Map()
  let inFlight = null

  async function refreshCountry(code) {
    const previous = entries.get(code)
    const today = new Date(now())
    try {
      const data = await countryFetchers[code](fetchImpl, today, timeoutMs)
      entries.set(code, { data: { ...data, fetchedAt: today.toISOString(), stale: false }, checkedAt: now(), ok: true })
    } catch {
      const fallback = previous?.data || bundledEconomicIndicators.countries[code]
      entries.set(code, { data: { ...fallback, stale: true }, checkedAt: now(), ok: false })
    }
  }

  async function snapshot() {
    const due = Object.keys(countryFetchers).filter(code => {
      const entry = entries.get(code)
      return !entry || now() - entry.checkedAt >= (entry.ok ? cacheDurationMs : retryAfterFailureMs)
    })
    if (due.length) {
      inFlight ||= Promise.all(due.map(refreshCountry)).finally(() => { inFlight = null })
      await inFlight
    }
    const countries = Object.fromEntries([...entries].map(([code, entry]) => [code, entry.data]))
    // The oldest live fetch. Null while any country is on the bundled snapshot,
    // so the client asks again on the next opening.
    const times = Object.values(countries).map(country => country.fetchedAt)
    const fetchedAt = times.length && times.every(Boolean) ? times.sort()[0] : null
    return sanitizeEconomicIndicators({ fetchedAt, countries })
  }

  return async function handleEconomicIndicators(request, response, requestUrl) {
    if (requestUrl.pathname !== '/api/economic-indicators') return false
    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' })
      response.end(JSON.stringify({ error: 'Método não permitido.' }))
      return true
    }
    const payload = await snapshot()
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=1800' })
    response.end(JSON.stringify(payload))
    return true
  }
}
