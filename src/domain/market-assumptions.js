import { cleanRate, sanitizeEconomicIndicators, sanitizeRateYears } from '../shared/economic-indicators.js'

// Market assumptions for long-term projections, built from the public snapshot
// of /api/economic-indicators. Short term: market expectations (Focus) or the
// latest published data. Long term: a fixed anchor. The latest monthly print is
// never extrapolated for decades. See docs/product/indicadores-mercado.md.

// Swiss long-run inflation: middle of the SNB price-stability range (0% to 2%)
// and of the historical range. A documented hypothesis, not a forecast.
export const swissLongRunInflation = 0.0075
// CDI runs slightly below the Selic target: 0.10 percentage point.
export const cdiSelicSpread = 0.001
// CMN inflation target for Brazil (continuous target since 2025). Reference
// only: the long run uses the market median, which is above it.
export const brazilInflationTarget = 0.03
export const inflationSources = Object.freeze(['market', 'manual'])
export const marketCountryByCurrency = Object.freeze({ BRL: 'BR', CHF: 'CH' })

const maxPathYears = 30

function validYear(year) {
  return Number.isInteger(year) && year >= 2000 && year <= 2199
}

function validRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= -0.2 && value <= 1
}

function sortedYears(path) {
  return Object.keys(path?.years || {}).map(Number).sort((left, right) => left - right)
}

// Rate of a trajectory in a year: the year itself, the first year for earlier
// years, and the long run after the last year. Without a year, the long run.
export function trajectoryRate(path, year) {
  const target = Number(year)
  if (year === undefined || year === null || !Number.isInteger(target)) return path.longRun
  const own = path.years?.[target]
  if (validRate(own)) return own
  const years = sortedYears(path)
  if (years.length && target < years[0]) return path.years[years[0]]
  return path.longRun
}

export function sanitizeInflationSource(value) {
  return inflationSources.includes(value) ? value : undefined
}

function sanitizePath(candidate) {
  if (!candidate || typeof candidate !== 'object' || !validRate(candidate.longRun)) return null
  return { years: sanitizeRateYears(candidate.years, maxPathYears) || {}, longRun: candidate.longRun }
}

export function sanitizeMarketAssumptions(candidate) {
  if (!candidate || typeof candidate !== 'object' || candidate.source !== 'market') return null
  if (!validYear(candidate.baseYear)) return null
  const byCurrency = {}
  for (const currency of Object.keys(marketCountryByCurrency)) {
    const source = candidate.byCurrency?.[currency]
    const inflation = sanitizePath(source?.inflation)
    if (!inflation) continue
    const entry = { inflation }
    const cdi = currency === 'BRL' ? sanitizePath(source.cdi) : null
    if (cdi) entry.cdi = cdi
    if (typeof source.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.asOf)) entry.asOf = source.asOf
    entry.stale = source.stale === true
    byCurrency[currency] = entry
  }
  if (!Object.keys(byCurrency).length) return null
  return {
    asOf: typeof candidate.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.asOf) ? candidate.asOf : null,
    fetchedAt: typeof candidate.fetchedAt === 'string' && candidate.fetchedAt.length <= 40 && Number.isFinite(Date.parse(candidate.fetchedAt)) ? candidate.fetchedAt : null,
    baseYear: candidate.baseYear,
    stale: Object.values(byCurrency).some(entry => entry.stale),
    byCurrency,
    source: 'market'
  }
}

function brazilAssumptions(country, baseYear) {
  const focusInflation = country.expectations.inflation
  const selic = country.expectations.policyRateYearEnd
  const inflationYears = Object.fromEntries(Object.entries(focusInflation).filter(([year]) => Number(year) >= baseYear))
  const lastInflationYear = Math.max(...Object.keys(focusInflation).map(Number))
  const selicYears = Object.keys(selic).map(Number).sort((left, right) => left - right)
  const lastSelicYear = selicYears.at(-1)
  const cdiYears = {}
  for (const year of selicYears.filter(value => value >= baseYear)) {
    if (year === baseYear) { cdiYears[year] = country.cdi; continue }
    // Average Selic of the year, approximated by the mean of the two year-ends.
    const previous = selic[year - 1] ?? selic[year]
    cdiYears[year] = cleanRate((previous + selic[year]) / 2 - cdiSelicSpread)
  }
  if (!(baseYear in cdiYears) && baseYear <= lastSelicYear) cdiYears[baseYear] = country.cdi
  return {
    inflation: { years: inflationYears, longRun: focusInflation[lastInflationYear] },
    cdi: { years: cdiYears, longRun: cleanRate(selic[lastSelicYear] - cdiSelicSpread) },
    asOf: country.expectations.asOf,
    stale: country.stale
  }
}

function swissAssumptions(country, baseYear) {
  const latest = country.cpi.yoy
  return {
    inflation: { years: { [baseYear]: latest, [baseYear + 1]: cleanRate((latest + swissLongRunInflation) / 2) }, longRun: swissLongRunInflation },
    asOf: country.asOf || null,
    stale: country.stale
  }
}

export function buildMarketAssumptions(snapshot, today = new Date()) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw new TypeError('A data de referência não é válida.')
  const safe = sanitizeEconomicIndicators(snapshot)
  const baseYear = today.getUTCFullYear()
  const byCurrency = {}
  if (safe.countries.BR) byCurrency.BRL = brazilAssumptions(safe.countries.BR, baseYear)
  if (safe.countries.CH) byCurrency.CHF = swissAssumptions(safe.countries.CH, baseYear)
  const dates = Object.values(byCurrency).map(entry => entry.asOf).filter(Boolean).sort()
  return sanitizeMarketAssumptions({ asOf: dates.at(-1) || null, fetchedAt: safe.fetchedAt, baseYear, byCurrency, source: 'market' })
}

// Market assumptions in use: present and not overridden by the manual mode.
export function activeMarketAssumptions(plan) {
  if (plan?.inflationSource === 'manual') return null
  const market = plan?.marketAssumptions
  return market?.source === 'market' && market.byCurrency ? market : null
}

export function planCurrencyOf(plan) {
  return plan?.inflationByCurrency?.base || null
}

// Inflation trajectory of a currency, or null when there is no market data for it.
export function marketInflationPath(plan, currency) {
  const code = currency || planCurrencyOf(plan)
  return activeMarketAssumptions(plan)?.byCurrency?.[code]?.inflation || null
}

// The rules before market data: the saved inflation of a foreign currency, or
// the plan inflation (the same as balanceCurrencyInflation in the Carteira).
function legacyInflation(plan, currency) {
  const source = plan?.inflationByCurrency
  const own = currency && source && currency !== source.base ? source.rates?.[currency] : undefined
  if (typeof own === 'number' && Number.isFinite(own)) return own
  return Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
}

export function inflationFor(plan, currency, year) {
  const path = marketInflationPath(plan, currency)
  return path ? trajectoryRate(path, year) : legacyInflation(plan, currency)
}

// Annual CDI of a year. Without market data, the fallback (the indexAnnualRate
// of the investment), which is the behaviour before market assumptions.
export function cdiFor(plan, year, fallback = null) {
  const path = activeMarketAssumptions(plan)?.byCurrency?.BRL?.cdi
  return path ? trajectoryRate(path, year) : fallback
}

// Price index of a year relative to the base year: Π(1 + π(y)) for the years
// after the base year. The base year itself is never applied (factor 1), the
// same convention as annualPriceFactor = (1 + π)^(year − baseYear).
export function cumulativePriceIndex(path, baseYear, year) {
  if (!validYear(baseYear) || !validYear(year)) throw new Error('Ano-base ou ano inválidos.')
  let index = 1
  for (let current = baseYear + 1; current <= year; current++) index *= 1 + trajectoryRate(path, current)
  for (let current = year + 1; current <= baseYear; current++) index /= 1 + trajectoryRate(path, current)
  if (!Number.isFinite(index) || index <= 0) throw new Error('Índice de preços fora do limite numérico.')
  return index
}

// New plan with the market assumptions applied. The manual mode is never
// overwritten. Contract fields of investments (returnType, returnValue,
// annualFee, indexAnnualRate) are never touched. Idempotent.
export function applyMarketAssumptions(plan, snapshot, today = new Date(), { currency = planCurrencyOf(plan) } = {}) {
  if (!plan || typeof plan !== 'object') throw new TypeError('Plano inválido.')
  if (plan.inflationSource === 'manual') return plan
  const marketAssumptions = buildMarketAssumptions(snapshot, today)
  if (!marketAssumptions) return plan
  const next = { ...plan, marketAssumptions }
  const own = currency ? marketAssumptions.byCurrency[currency] : null
  if (own) next.annualInflation = own.inflation.longRun
  if (currency) {
    const rates = { ...(plan.inflationByCurrency?.base === currency ? plan.inflationByCurrency.rates : {}) }
    for (const [code, entry] of Object.entries(marketAssumptions.byCurrency)) if (code !== currency) rates[code] = entry.inflation.longRun
    if (Object.keys(rates).length) next.inflationByCurrency = { base: currency, rates }
  }
  return next
}

// True when the plan has no market assumptions yet or they are older than 24 h.
export function shouldRefresh(plan, now = new Date()) {
  if (plan?.inflationSource === 'manual') return false
  const market = plan?.marketAssumptions
  if (!market) return true
  const time = now instanceof Date ? now.getTime() : Number(now)
  const reference = Date.parse(market.fetchedAt || (market.asOf ? `${market.asOf}T00:00:00Z` : ''))
  return !Number.isFinite(reference) || time - reference > 24 * 60 * 60 * 1000
}
