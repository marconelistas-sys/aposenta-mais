import { currencySymbol, normalizeCurrency } from './currencies.js'

const currencyFormatters = new Map()

function currencyFormatter(currency, precise = false, compact = false) {
  const code = normalizeCurrency(currency)
  const key = `${code}:${precise}:${compact}`
  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(key, new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
      notation: compact ? 'compact' : 'standard',
      minimumFractionDigits: precise ? 2 : 0,
      maximumFractionDigits: precise ? 2 : compact ? 2 : 0
    }))
  }
  return currencyFormatters.get(key)
}

export function formatCurrency(value, precise = false, currency = 'BRL') {
  return currencyFormatter(currency, precise).format(value)
}

export function formatCompactCurrency(value, currency = 'BRL') {
  return currencyFormatter(currency, false, true).format(value)
}

export function formatPercent(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(value)
}

export function privateCurrency(value, valuesHidden, precise = false, currency = 'BRL') {
  return valuesHidden ? `${currencySymbol(currency)} •••••` : formatCurrency(value, precise, currency)
}

export function parseNumber(value) {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

// Stored fractions round-trip through /100 then *100 for editable percent inputs.
// That reintroduces binary floating-point noise (e.g. 3.33 becomes 3.3300000000000005) — clean it before display.
export function percentInputValue(value) {
  return Number.isFinite(value) ? Number((value * 100).toFixed(10)) : ''
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatUpdateTime(value) {
  if (!value) return 'dados de demonstração'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data não disponível'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date)
}

// "2026-09" -> "setembro de 2026". Keeps the original text when it is not a month.
export function formatMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) return String(value ?? '')
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-15T12:00:00Z`))
}
