import { currencies, normalizeCurrency } from './currencies.js'

export const ecbSource = Object.freeze({
  name: 'Banco Central Europeu',
  url: 'https://www.ecb.europa.eu/stats/eurofxref/'
})

export const bundledExchangeRates = Object.freeze({
  base: 'EUR',
  date: '2026-09-03',
  fetchedAt: null,
  source: ecbSource.name,
  sourceUrl: ecbSource.url,
  stale: true,
  rates: Object.freeze({ EUR: 1, BRL: 5.8935, CHF: 0.9390, USD: 1.1615 })
})

function validRate(value) {
  return Number.isFinite(value) && value > 0 && value < 1000000
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

export function sanitizeExchangeRates(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {}
  const suppliedRates = source.rates && typeof source.rates === 'object' ? source.rates : {}
  const rates = { ...bundledExchangeRates.rates }

  for (const code of Object.keys(currencies)) {
    if (validRate(suppliedRates[code])) rates[code] = suppliedRates[code]
  }

  rates.EUR = 1
  return {
    base: 'EUR',
    date: validDate(source.date) ? source.date : bundledExchangeRates.date,
    fetchedAt: typeof source.fetchedAt === 'string' ? source.fetchedAt : null,
    source: source.source === ecbSource.name ? source.source : ecbSource.name,
    sourceUrl: source.sourceUrl === ecbSource.url ? source.sourceUrl : ecbSource.url,
    stale: source.stale !== false,
    rates
  }
}

export function convertCurrency(amount, fromCurrency, toCurrency, snapshot = bundledExchangeRates) {
  if (!Number.isFinite(amount)) throw new TypeError('O valor para conversão precisa ser um número válido.')
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)
  const safe = sanitizeExchangeRates(snapshot)
  if (from === to) return amount
  return (amount / safe.rates[from]) * safe.rates[to]
}

export function exchangeRate(fromCurrency, toCurrency, snapshot = bundledExchangeRates) {
  return convertCurrency(1, fromCurrency, toCurrency, snapshot)
}
