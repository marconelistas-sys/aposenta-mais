import { activeMarketAssumptions, cdiFor, inflationFor, planCurrencyOf } from './market-assumptions.js'

export const investmentReturnTypes = Object.freeze(['default', 'real', 'nominal', 'cdi', 'ipca'])

export function validateAnnualRealReturns(rows = []) {
  if (!Array.isArray(rows) || rows.length > 200) throw new RangeError('Informe até 200 retornos anuais.')
  const years = new Set()
  for (const row of rows) {
    if (!row || !Number.isInteger(row.year) || row.year < 2000 || row.year > 2199 || !Number.isFinite(row.rate) || row.rate < -0.99 || row.rate > 1 || years.has(row.year)) throw new RangeError('Use anos únicos de 2000 a 2199 e retornos reais entre -99% e 100%.')
    years.add(row.year)
  }
  return rows.map(({ year, rate }) => ({ year, rate })).sort((a, b) => a.year - b.year)
}

export function parseAnnualRealReturns(text = '') {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  return validateAnnualRealReturns(lines.map(line => {
    const match = line.match(/^(\d{4})\s*[:=]\s*([+-]?\d+(?:[.,]\d+)?)\s*%?$/)
    if (!match) throw new Error('Use uma linha por ano, por exemplo: 2027: 4,5%.')
    return { year: Number(match[1]), rate: Number(match[2].replace(',', '.')) / 100 }
  }))
}

export function formatAnnualRealReturns(rows = []) {
  return rows.map(row => `${row.year}: ${Number((row.rate * 100).toFixed(10))}%`).join('\n')
}

export function nominalToRealReturn(nominalReturn, annualInflation) {
  if (!Number.isFinite(nominalReturn) || nominalReturn <= -1) {
    throw new RangeError('O retorno nominal deve ser maior que -100%.')
  }
  if (!Number.isFinite(annualInflation) || annualInflation <= -1) {
    throw new RangeError('A inflação deve ser maior que -100%.')
  }
  return (1 + nominalReturn) / (1 + annualInflation) - 1
}

export function realToNominalReturn(realReturn, annualInflation) {
  return (1 + realReturn) * (1 + annualInflation) - 1
}

// Annual product cost (administration fee, TER) charged on the balance.
export function investmentAnnualFee(investment) {
  const fee = Number(investment?.annualFee)
  return Number.isFinite(fee) && fee > 0 && fee < 1 ? fee : 0
}

export function applyAnnualFee(annualReturn, fee) {
  return fee > 0 ? (1 + annualReturn) * (1 - fee) - 1 : annualReturn
}

// Share of the balance that follows the exposure currency. The rest follows the plan currency.
export function investmentExposureShare(investment) {
  const share = Number(investment?.exposureShare)
  return Number.isFinite(share) && share >= 0 && share <= 1 ? share : 1
}

// Optional real annual change of a foreign currency against the plan currency,
// applied to the exposed share. { base, rates: { USD: 0.01 } }. Hypothesis, not forecast.
export function currencyTrendAdjustment(investment, plan) {
  const trends = plan?.currencyTrends
  const code = investment?.exposureCurrency
  if (!trends || !code || code === trends.base) return 0
  const rate = Number(trends.rates?.[code])
  return Number.isFinite(rate) ? rate * investmentExposureShare(investment) : 0
}

// Yearly overrides are entered as the net real return of that year, so the
// annual fee and the currency trend apply only to the habitual rate.
export function resolveInvestmentRealReturn(investment, plan, year) {
  const override = investment?.annualRealReturns?.find(row => row.year === Number(year))
  if (override) return override.rate
  const net = applyAnnualFee(resolveGrossInvestmentRealReturn(investment, plan, year), investmentAnnualFee(investment))
  const trend = currencyTrendAdjustment(investment, plan)
  return trend ? (1 + net) * (1 + trend) - 1 : net
}

export function sanitizeCurrencyTrends(source, codes = ['BRL', 'EUR', 'USD', 'CHF']) {
  if (!source || typeof source !== 'object' || !codes.includes(source.base)) return null
  const rates = {}
  for (const code of codes) {
    if (code === source.base) continue
    const value = Number(source.rates?.[code])
    if (Number.isFinite(value) && value !== 0 && value >= -0.2 && value <= 0.2) rates[code] = value
  }
  return Object.keys(rates).length ? { base: source.base, rates } : null
}

// Expected annual inflation of each currency, used to deflate nominal returns of
// balances held in that currency. { base, rates: { CHF: 0.01 } }. The entry for
// the plan currency is kept but unused: the plan inflation applies to it.
export function sanitizeInflationByCurrency(source, codes = ['BRL', 'EUR', 'USD', 'CHF']) {
  if (!source || typeof source !== 'object' || !codes.includes(source.base)) return null
  const rates = {}
  for (const code of codes) {
    const value = source.rates?.[code]
    if (typeof value === 'number' && Number.isFinite(value) && value >= -0.2 && value <= 0.2) rates[code] = value
  }
  return Object.keys(rates).length ? { base: source.base, rates } : null
}

// Saved inflation of the balance currency, or null when the balance is in the
// plan currency or no rate was informed. Without it the plan inflation applies.
export function balanceCurrencyInflation(investment, plan) {
  const source = plan?.inflationByCurrency
  const code = investment?.currency
  if (!source || !code || code === source.base) return null
  const rate = source.rates?.[code]
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}

// Inflation that deflates a nominal return: the balance currency. With market
// assumptions, the trajectory of that currency in the year. Without them, the
// saved inflation of a foreign currency or the plan inflation.
export function investmentInflation(investment, plan, year) {
  if (activeMarketAssumptions(plan)) return inflationFor(plan, investment?.currency || planCurrencyOf(plan), year)
  const inflation = Number.isFinite(plan?.annualInflation) ? plan.annualInflation : 0
  return balanceCurrencyInflation(investment, plan) ?? inflation
}

// Nominal CDI-linked return before fees: share of the CDI of the year.
export function investmentCdiNominalReturn(investment, plan, year) {
  return cdiFor(plan, year, Number(investment?.indexAnnualRate)) * Number(investment?.returnValue)
}

// The year only matters with market assumptions ('nominal' and 'cdi'). Without a
// year, the long-run assumption applies.
export function resolveGrossInvestmentRealReturn(investment, plan, year) {
  const defaultReturn = Number(plan?.annualRealReturn)
  const legacyReturn = investment?.annualRealReturn
  const returnType = investmentReturnTypes.includes(investment?.returnType)
    ? investment.returnType
    : legacyReturn === null || legacyReturn === undefined ? 'default' : 'real'
  const returnValue = Number(investment?.returnValue ?? legacyReturn)

  if (returnType === 'default') return defaultReturn
  if (returnType === 'real' || returnType === 'ipca') return returnValue
  if (returnType === 'nominal') return nominalToRealReturn(returnValue, investmentInflation(investment, plan, year))
  // CDI is deflated by the inflation of the balance currency, like 'nominal'.
  return nominalToRealReturn(investmentCdiNominalReturn(investment, plan, year), investmentInflation(investment, plan, year))
}

export function resolveInvestmentNominalReturn(investment, plan, year) {
  const inflation = inflationFor(plan, planCurrencyOf(plan), year)
  const realReturn = resolveInvestmentRealReturn(investment, plan, year)
  if (investment?.annualRealReturns?.some(row => row.year === Number(year))) return realToNominalReturn(realReturn, inflation)
  const fee = investmentAnnualFee(investment)
  if (investment?.returnType === 'nominal') return applyAnnualFee(investment.returnValue, fee)
  if (investment?.returnType === 'cdi') return applyAnnualFee(investmentCdiNominalReturn(investment, plan, year), fee)
  return realToNominalReturn(realReturn, inflation)
}

export function investmentAccumulationFactors(investment, plan, months, asOfDate = new Date()) {
  let growth = 1, contribution = 0
  const first = asOfDate.getUTCFullYear() * 12 + asOfDate.getUTCMonth()
  for (let month = 0; month < months; month++) {
    const factor = Math.exp(Math.log1p(resolveInvestmentRealReturn(investment, plan, Math.floor((first + month) / 12))) / 12)
    growth *= factor
    contribution = contribution * factor + 1
  }
  return { growth, contribution }
}
