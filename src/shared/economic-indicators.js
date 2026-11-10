// Market indicators (inflation and interest) published by the central banks of
// Brazil (BCB) and Switzerland (SNB). Shared by the server handler, which builds
// the snapshot, and by the client, which sanitizes it again before use.
// All rates are decimals: 0.0458 means 4.58%.

export const economicSources = Object.freeze({
  BR: Object.freeze({ name: 'Banco Central do Brasil', url: 'https://dadosabertos.bcb.gov.br/' }),
  CH: Object.freeze({ name: 'Banco Nacional Suíço', url: 'https://data.snb.ch/' })
})

export const economicCountries = Object.freeze({ BR: 'BRL', CH: 'CHF' })

const rateLimits = [-0.2, 1]
const maxExpectationYears = 15

// Last snapshot embedded in the app: Focus of 2026-11-06, SGS and SNB data
// published until 2026-11-06. Used when the sources are unavailable, always stale.
export const bundledEconomicIndicators = Object.freeze({
  fetchedAt: null,
  countries: Object.freeze({
    BR: Object.freeze({
      currency: 'BRL',
      asOf: '2026-11-06',
      fetchedAt: null,
      cpi: Object.freeze({ lastMonth: '2026-09', monthly: 0.0082, yoy: 0.0458 }),
      policyRate: 0.1375,
      cdi: 0.1365,
      expectations: Object.freeze({
        asOf: '2026-11-06',
        inflation: Object.freeze({ 2026: 0.052195, 2027: 0.049005, 2028: 0.04, 2029: 0.04, 2030: 0.03935 }),
        policyRateYearEnd: Object.freeze({ 2026: 0.1375, 2027: 0.125, 2028: 0.11, 2029: 0.1025, 2030: 0.1 })
      }),
      source: economicSources.BR.name,
      sourceUrl: economicSources.BR.url,
      stale: true
    }),
    CH: Object.freeze({
      currency: 'CHF',
      asOf: '2026-11-06',
      fetchedAt: null,
      cpi: Object.freeze({ lastMonth: '2026-09', monthly: -0.0003900967, yoy: 0.0099005861 }),
      policyRate: 0,
      saron: -0.0004,
      source: economicSources.CH.name,
      sourceUrl: economicSources.CH.url,
      stale: true
    })
  })
})

// Removes binary noise of percent-to-decimal conversions (0.82 / 100) without
// changing any meaningful digit: rates keep 10 decimal places.
export function cleanRate(value) {
  return Math.round(value * 1e10) / 1e10
}

export function percentToRate(value) {
  return cleanRate(value / 100)
}

function validRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= rateLimits[0] && value <= rateLimits[1]
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validMonth(value) {
  return typeof value === 'string' && /^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value)
}

function validTimestamp(value) {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

export function sanitizeRateYears(candidate, limit = maxExpectationYears) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const years = {}
  for (const key of Object.keys(candidate).sort()) {
    const year = Number(key)
    if (!/^\d{4}$/.test(key) || year < 2000 || year > 2199 || !validRate(candidate[key])) continue
    years[year] = candidate[key]
    if (Object.keys(years).length >= limit) break
  }
  return Object.keys(years).length ? years : null
}

function sanitizeCpi(candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  if (!validMonth(candidate.lastMonth) || !validRate(candidate.yoy)) return null
  return { lastMonth: candidate.lastMonth, monthly: validRate(candidate.monthly) ? candidate.monthly : null, yoy: candidate.yoy }
}

function sanitizeCountry(code, candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  const cpi = sanitizeCpi(candidate.cpi)
  if (!cpi || !validRate(candidate.policyRate)) return null
  const base = {
    currency: economicCountries[code],
    asOf: validDate(candidate.asOf) ? candidate.asOf : null,
    fetchedAt: validTimestamp(candidate.fetchedAt) ? candidate.fetchedAt : null,
    cpi,
    policyRate: candidate.policyRate
  }
  const source = { source: economicSources[code].name, sourceUrl: economicSources[code].url, stale: candidate.stale !== false }
  if (code === 'BR') {
    const expectations = candidate.expectations
    const inflation = sanitizeRateYears(expectations?.inflation)
    const policyRateYearEnd = sanitizeRateYears(expectations?.policyRateYearEnd)
    if (!validRate(candidate.cdi) || !inflation || !policyRateYearEnd || !validDate(expectations?.asOf)) return null
    return { ...base, cdi: candidate.cdi, expectations: { asOf: expectations.asOf, inflation, policyRateYearEnd }, ...source }
  }
  if (!validRate(candidate.saron)) return null
  return { ...base, saron: candidate.saron, ...source }
}

// Whitelist of the public payload. Unknown countries and fields are dropped and
// a malformed country is omitted, never partially kept.
export function sanitizeEconomicIndicators(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const countries = {}
  for (const code of Object.keys(economicCountries)) {
    const country = sanitizeCountry(code, source.countries?.[code])
    if (country) countries[code] = country
  }
  return { fetchedAt: validTimestamp(source.fetchedAt) ? source.fetchedAt : null, countries }
}
