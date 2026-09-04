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
    maximumFractionDigits: 0
  }).format(value)
}

export function privateCurrency(value, valuesHidden, precise = false, currency = 'BRL') {
  return valuesHidden ? `${currencySymbol(currency)} •••••` : formatCurrency(value, precise, currency)
}

export function parseNumber(value) {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
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
