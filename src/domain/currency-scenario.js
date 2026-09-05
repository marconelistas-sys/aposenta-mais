import { currencies } from '../shared/currencies.js'
import { sanitizeExchangeRates } from '../shared/exchange-rates.js'
import { calculateMultiCurrencyCashFlow } from './cash-flow.js'

export function currencyShock(snapshot, currency, change) {
  if (!Object.hasOwn(currencies, currency) || !Number.isFinite(change) || change < -0.5 || change > 0.5) {
    throw new RangeError('Escolha uma moeda e uma variação entre -50% e 50%.')
  }
  const result = sanitizeExchangeRates(snapshot)
  if (currency === 'EUR') {
    for (const code of Object.keys(result.rates)) if (code !== 'EUR') result.rates[code] *= 1 + change
  } else result.rates[currency] /= 1 + change
  return result
}

export function compareCurrencyScenario(state, currency, change) {
  if (currency === state.currency) throw new RangeError('Escolha uma moeda diferente da moeda do orçamento.')
  const date = new Date(`${state.cashFlow.referenceMonth}-15T12:00:00Z`)
  const calculate = snapshot => calculateMultiCurrencyCashFlow(state.cashFlow, state.currency, snapshot, 0, state.customCategories, date)
  return {
    baseline: calculate(state.exchangeRates),
    scenario: calculate(currencyShock(state.exchangeRates, currency, change))
  }
}

export function comparePortfolioCurrencyScenario(investments, exposures, change) {
  if (!Number.isFinite(change) || change < -0.5 || change > 0.5) throw new RangeError('Variação inválida.')
  const rows = investments.map(investment => {
    const exposure = Object.hasOwn(exposures, investment.id) ? exposures[investment.id] : 0
    if (!Number.isFinite(exposure) || exposure < 0 || exposure > 1) throw new RangeError('Informe uma exposição entre 0% e 100%.')
    if (!Number.isFinite(investment.amount) || investment.amount < 0) throw new RangeError('Saldo inválido.')
    const exposed = investment.amount * exposure
    const difference = exposed * change
    return { id: investment.id, name: investment.name, baseline: investment.amount, exposed, difference, scenario: investment.amount + difference }
  })
  return rows.reduce((result, row) => {
    for (const key of ['baseline', 'exposed', 'difference', 'scenario']) result[key] += row[key]
    return result
  }, { rows, baseline: 0, exposed: 0, difference: 0, scenario: 0 })
}
