const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
})

const preciseCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const compactFormatter = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 2
})

export function formatCurrency(value, precise = false) {
  return (precise ? preciseCurrencyFormatter : currencyFormatter).format(value)
}

export function formatCompactCurrency(value) {
  return `R$ ${compactFormatter.format(value)}`
}

export function formatPercent(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(value)
}

export function privateCurrency(value, valuesHidden, precise = false) {
  return valuesHidden ? 'R$ •••••' : formatCurrency(value, precise)
}

export function parseNumber(value) {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
