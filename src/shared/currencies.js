export const currencies = Object.freeze({
  BRL: Object.freeze({ code: 'BRL', label: 'Real brasileiro', symbol: 'R$' }),
  EUR: Object.freeze({ code: 'EUR', label: 'Euro', symbol: '€' }),
  USD: Object.freeze({ code: 'USD', label: 'Dólar americano', symbol: 'US$' }),
  CHF: Object.freeze({ code: 'CHF', label: 'Franco suíço', symbol: 'CHF' })
})

export const defaultCurrency = 'BRL'

export function normalizeCurrency(value) {
  const code = String(value || '').toUpperCase()
  return currencies[code] ? code : defaultCurrency
}

export function currencySymbol(value) {
  return currencies[normalizeCurrency(value)].symbol
}
