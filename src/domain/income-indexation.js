import { annualPriceFactor } from './inflation-display.js'
import { balanceCurrencyInflation } from './investment-returns.js'
import { isRetirementEnd, incomeEndMonth } from './income-end.js'
import { reviewItemName } from './review-targets.js'

// Indexation of a planned income in long-term projections.
// 'inflation': the amount keeps its purchasing power (the historical behaviour).
// 'fixed': the amount is the nominal contract value and loses purchasing power
// from the projection base year on: real value in year Y = amount / (1 + π)^(Y − baseYear).
// A missing field means 'inflation'. The operational budget never applies the factor.
export const incomeIndexations = Object.freeze(['inflation', 'fixed'])

export function isIndexableIncome(item) {
  return item?.type === 'income' && item.recordKind !== 'actual' && item.source !== 'txt'
}

export function sanitizeIncomeIndexation(value) {
  return incomeIndexations.includes(value) ? value : undefined
}

// Context passed by the projection engines on their own copy of cashFlow
// (cashFlow.projectionInflation). Without it, summarizeCashFlowItems keeps the
// registered amounts, which is what the operational budget needs.
export function projectionInflation(state, today = new Date()) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw new TypeError('A data de referência não é válida.')
  return {
    baseYear: today.getUTCFullYear(),
    currency: state.currency,
    annualInflation: state.plan?.annualInflation,
    inflationByCurrency: state.plan?.inflationByCurrency ?? null
  }
}

// Same rule as balanceCurrencyInflation in the Carteira: the saved inflation of the
// item currency when it differs from the plan currency, otherwise the plan inflation.
export function incomeInflation(item, context) {
  const own = item?.currency && item.currency !== context.currency
    ? balanceCurrencyInflation(item, { inflationByCurrency: context.inflationByCurrency })
    : null
  return own === null
    ? { rate: context.annualInflation, source: 'plan', currency: context.currency }
    : { rate: own, source: 'currency', currency: item.currency }
}

// Annual step, the same convention as annualPriceFactor and the nominal view.
// Months before the base year use factor 1: the past does not lose value.
export function fixedIncomeIndexation(item, year, context) {
  if (!context || item?.indexation !== 'fixed' || !isIndexableIncome(item)) return null
  const inflation = incomeInflation(item, context)
  const priceIndex = annualPriceFactor(Math.max(year, context.baseYear), context.baseYear, inflation.rate)
  return { factor: 1 / priceIndex, priceIndex, inflation: inflation.rate, inflationSource: inflation.source, inflationCurrency: inflation.currency, baseYear: context.baseYear }
}

// Real value of a contract amount in a given year, in the item currency.
// Division keeps the nominal view exact: (amount / index) × index = amount.
export function realContractAmount(amount, year, context, currency = context.currency) {
  const rule = fixedIncomeIndexation({ type: 'income', recordKind: 'planned', indexation: 'fixed', currency }, year, context)
  return amount / rule.priceIndex
}

// Pure data for the purchasing-power preview of a fixed income (H3). Amounts in
// the item currency, without rounding. The first year is never before the base
// year; the last one is the item end or the horizon end, whichever comes first.
export function fixedIncomePurchasingPower({ amount, currency, startDate = null, endDate = null }, { baseYear, currency: planCurrency, annualInflation, inflationByCurrency = null, horizonEndYear }) {
  if (!Number.isFinite(amount) || amount <= 0) return null
  if (!Number.isInteger(horizonEndYear)) throw new Error('Horizonte inválido.')
  const context = { baseYear, currency: planCurrency, annualInflation, inflationByCurrency }
  const startYear = startDate ? Number(String(startDate).slice(0, 4)) : baseYear
  const endYear = endDate ? Number(String(endDate).slice(0, 4)) : null
  const firstYear = Math.max(startYear, baseYear)
  const lastYear = endYear !== null && endYear < horizonEndYear ? endYear : horizonEndYear
  if (lastYear < firstYear) return null
  const inflation = incomeInflation({ currency }, context)
  const firstValue = realContractAmount(amount, firstYear, context, currency)
  const lastValue = realContractAmount(amount, lastYear, context, currency)
  return {
    baseYear, firstYear, lastYear, lastIsItemEnd: endYear !== null && endYear < horizonEndYear,
    amount, currency, firstValue, lastValue,
    firstLoss: 1 - firstValue / amount, lastLoss: 1 - lastValue / amount,
    inflation: inflation.rate, inflationSource: inflation.source, inflationCurrency: inflation.currency
  }
}

// Premise line of the projection (H3.5): how many fixed incomes and which inflation applies.
export function fixedIncomeAssumptions(state, today = new Date()) {
  const context = projectionInflation(state, today)
  const items = (state.cashFlow?.items || []).filter(item => isIndexableIncome(item) && item.indexation === 'fixed')
  const rates = new Map()
  for (const item of items) {
    const inflation = incomeInflation(item, context)
    rates.set(inflation.currency, { currency: inflation.currency, rate: inflation.rate, source: inflation.source })
  }
  return { count: items.length, baseYear: context.baseYear, rates: [...rates.values()].sort((left, right) => (left.currency === context.currency ? -1 : right.currency === context.currency ? 1 : left.currency.localeCompare(right.currency))) }
}

// True when the planned item has at least one month between fromMonth and toMonth
// (inclusive), with the same activity rules as isCashFlowItemActive.
export function plannedItemActiveWithin(item, fromMonth, toMonth = null, links = {}) {
  const start = item.startDate ? item.startDate.slice(0, 7) : null
  if (item.frequency === 'occasional') return Boolean(start) && start >= fromMonth && (!toMonth || start <= toMonth)
  const first = start && start > fromMonth ? start : fromMonth
  if (toMonth && first > toMonth) return false
  if (isRetirementEnd(item.endMode)) {
    const retirement = incomeEndMonth(item, links)
    return Boolean(retirement) && retirement > first
  }
  const end = item.endDate ? item.endDate.slice(0, 7) : null
  return !end || end >= first
}

export const benefitIndexationAction = 'Conferir reajuste desta renda'
export function benefitIndexationMessage(item) {
  return `${reviewItemName(item)}: confirme o reajuste desta renda. Hoje a projeção supõe que ela acompanha a inflação. A renda de velhice da caixa de pensão suíça costuma ser fixa em francos.`
}

// Planned retirement incomes (category 'pension') active in the horizon, from
// January of the base year, without an explicit indexation choice (H4).
export function benefitsMissingIndexation(cashFlow, { fromMonth, toMonth = null, retirementMonth = null, spouseRetirementMonth = null }) {
  return (cashFlow.items || []).filter(item => isIndexableIncome(item)
    && item.categoryId === 'pension'
    && sanitizeIncomeIndexation(item.indexation) === undefined
    && Number.isFinite(item.amount) && item.amount > 0
    && plannedItemActiveWithin(item, fromMonth, toMonth, { retirementMonth, spouseRetirementMonth }))
}
