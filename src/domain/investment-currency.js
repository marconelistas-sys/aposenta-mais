import { currencies } from '../shared/currencies.js'
import { convertCurrency } from '../shared/exchange-rates.js'

// An investment balance can be kept in its own currency (a Swiss pension fund in CHF).
// `nativeAmount` and `nativeMonthlyContribution` hold the values in `currency`.
// `amount` and `monthlyContribution` always hold the plan-currency equivalent,
// so projections, totals and diagnostics keep working in one currency.

export const round2 = value => Math.round(value * 100) / 100

export function investmentBalanceCurrency(investment, planCurrency) {
  return currencies[investment?.currency] ? investment.currency : planCurrency
}

export function isForeignBalance(investment, planCurrency) {
  return investmentBalanceCurrency(investment, planCurrency) !== planCurrency
}

export function investmentNativeAmount(investment, planCurrency) {
  return isForeignBalance(investment, planCurrency) && Number.isFinite(investment.nativeAmount) ? investment.nativeAmount : investment.amount
}

export function investmentNativeContribution(investment, planCurrency) {
  return isForeignBalance(investment, planCurrency) && Number.isFinite(investment.nativeMonthlyContribution) ? investment.nativeMonthlyContribution : investment.monthlyContribution
}

// Older records only had plan-currency values. When the exposure is fully in a
// foreign currency and no balance currency was saved, the balance is taken as held
// in that currency. The value is converted once, so the plan total stays the same.
function inferLegacyCurrency(investment, planCurrency, rates) {
  if (currencies[investment.currency]) return investment
  const exposure = investment.exposureCurrency
  if (!currencies[exposure] || exposure === planCurrency || investment.exposureShare !== undefined) return investment
  return {
    ...investment,
    currency: exposure,
    nativeAmount: round2(convertCurrency(investment.amount, planCurrency, exposure, rates)),
    nativeMonthlyContribution: round2(convertCurrency(investment.monthlyContribution || 0, planCurrency, exposure, rates))
  }
}

// Recomputes plan-currency values from the native balance. Plan-currency
// investments keep their values and drop the native copy.
export function syncInvestmentCurrencies(investments, planCurrency, rates, { inferLegacy = false } = {}) {
  return (investments || []).map(original => {
    const investment = inferLegacy ? inferLegacyCurrency(original, planCurrency, rates) : original
    const currency = investmentBalanceCurrency(investment, planCurrency)
    if (currency === planCurrency) {
      const { nativeAmount, nativeMonthlyContribution, ...rest } = investment
      // A native copy in the plan currency is the source of truth (plan currency just switched to it).
      if (Number.isFinite(nativeAmount)) rest.amount = nativeAmount
      if (Number.isFinite(nativeMonthlyContribution)) rest.monthlyContribution = nativeMonthlyContribution
      return currencies[investment.currency] ? { ...rest, currency } : rest
    }
    const nativeAmount = Number.isFinite(investment.nativeAmount) ? investment.nativeAmount : round2(convertCurrency(investment.amount, planCurrency, currency, rates))
    const nativeMonthlyContribution = Number.isFinite(investment.nativeMonthlyContribution) ? investment.nativeMonthlyContribution : round2(convertCurrency(investment.monthlyContribution || 0, planCurrency, currency, rates))
    return {
      ...investment,
      currency,
      // Without an explicit exposure, the value moves with the balance currency.
      exposureCurrency: currencies[investment.exposureCurrency] ? investment.exposureCurrency : currency,
      nativeAmount,
      nativeMonthlyContribution,
      amount: Math.max(0.01, round2(convertCurrency(nativeAmount, currency, planCurrency, rates))),
      monthlyContribution: round2(convertCurrency(nativeMonthlyContribution, currency, planCurrency, rates))
    }
  })
}

export function investmentTotals(investments) {
  return {
    currentAssets: investments.reduce((total, investment) => total + investment.amount, 0),
    monthlyContribution: investments.reduce((total, investment) => total + investment.monthlyContribution, 0)
  }
}

// Same sync for a whole plan: investments and the aggregated totals.
export function syncPlanInvestments(plan, planCurrency, rates, options = {}) {
  if (!plan?.investments?.length) return plan
  const investments = syncInvestmentCurrencies(plan.investments, planCurrency, rates, options)
  return { ...plan, investments, ...investmentTotals(investments) }
}
