/**
 * Alocação-alvo por classe, moeda de exposição e região, com bandas de
 * rebalanceamento. Educativo: não recomenda produtos. Direciona aportes antes
 * de sugerir vendas, o que evita custos de transação e imposto em muitos casos.
 */
import { currencies } from '../shared/currencies.js'

export const allocationClasses = Object.freeze(['fixed-income', 'equity', 'fund', 'pension', 'cash', 'other'])
export const allocationCurrencies = Object.freeze(Object.keys(currencies))
export const allocationRegions = Object.freeze(['domestic', 'international', 'global'])
export const regionLabels = Object.freeze({ domestic: 'Mercado local', international: 'Exterior', global: 'Global diversificado' })
export const defaultRebalanceBand = 0.05

// shares keeps the original class target for compatibility with saved plans.
export const allocationDimensions = Object.freeze({
  class: { sharesKey: 'shares', keys: allocationClasses, keyOf: item => allocationClasses.includes(item.assetClass) ? item.assetClass : 'other' },
  currency: { sharesKey: 'currencyShares', keys: allocationCurrencies, keyOf: (item, baseCurrency) => allocationCurrencies.includes(item.exposureCurrency) ? item.exposureCurrency : baseCurrency },
  region: { sharesKey: 'regionShares', keys: allocationRegions, keyOf: item => allocationRegions.includes(item.region) ? item.region : 'domestic' }
})

function sanitizeShares(source, keys) {
  if (!source || typeof source !== 'object') return undefined
  const shares = {}
  let total = 0
  for (const key of keys) {
    const value = Number(source[key] ?? 0)
    if (!Number.isFinite(value) || value < 0 || value > 1) return null
    if (value > 0) shares[key] = value
    total += value
  }
  return Math.abs(total - 1) > 0.005 ? null : shares
}

export function sanitizeTargetAllocation(source) {
  if (!source || typeof source !== 'object') return null
  const result = {}
  for (const dimension of Object.values(allocationDimensions)) {
    const shares = sanitizeShares(source[dimension.sharesKey], dimension.keys)
    if (shares === null) return null
    if (shares) result[dimension.sharesKey] = shares
  }
  if (!Object.keys(result).length) return null
  const band = Number(source.band ?? defaultRebalanceBand)
  return { ...result, band: Number.isFinite(band) && band >= 0.01 && band <= 0.2 ? band : defaultRebalanceBand }
}

export function validateTargetAllocation(source) {
  const clean = sanitizeTargetAllocation(source)
  if (!clean) throw new RangeError('Cada alvo preenchido precisa somar 100%, com valores entre 0% e 100%, e banda entre 1 e 20 pontos percentuais. Informe ao menos um alvo.')
  return clean
}

export function currentByDimension(investments, dimension = 'class', baseCurrency = 'BRL') {
  const { keys, keyOf } = allocationDimensions[dimension]
  const totals = Object.fromEntries(keys.map(key => [key, 0]))
  for (const item of investments || []) {
    const amount = Number(item.amount) || 0
    const key = keyOf(item, baseCurrency)
    // Partial currency exposure: only the exposed share follows the foreign currency.
    const share = dimension === 'currency' && key !== baseCurrency && Number.isFinite(item.exposureShare) ? Math.min(1, Math.max(0, item.exposureShare)) : 1
    totals[key] += amount * share
    if (share < 1) totals[baseCurrency] += amount * (1 - share)
  }
  return totals
}

export function exposureDistribution(plan, dimension = 'class', baseCurrency = 'BRL') {
  const current = currentByDimension(plan?.investments, dimension, baseCurrency)
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  return Object.entries(current).filter(([, amount]) => amount > 0).map(([key, amount]) => ({ key, amount, share: total > 0 ? amount / total : 0 })).sort((a, b) => b.amount - a.amount)
}

// Splits the monthly contribution toward keys below target after the
// contribution. Any remainder follows the target weights.
export function contributionSplit(current, shares, contribution, keys = Object.keys(current)) {
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  const split = Object.fromEntries(keys.map(key => [key, 0]))
  if (!(contribution > 0)) return split
  const futureTotal = total + contribution
  const gaps = Object.fromEntries(keys.map(key => [key, Math.max(0, (shares[key] || 0) * futureTotal - (current[key] || 0))]))
  const gapTotal = Object.values(gaps).reduce((sum, value) => sum + value, 0)
  if (gapTotal >= contribution) {
    for (const key of keys) split[key] = contribution * gaps[key] / gapTotal
    return split
  }
  const rest = contribution - gapTotal
  for (const key of keys) split[key] = gaps[key] + rest * (shares[key] || 0)
  return split
}

export function rebalanceAnalysis(plan, target, { monthlyContribution = plan?.monthlyContribution || 0, dimension = 'class', baseCurrency = 'BRL' } = {}) {
  const clean = sanitizeTargetAllocation(target)
  const config = allocationDimensions[dimension]
  const shares = clean?.[config.sharesKey]
  if (!shares) return null
  const current = currentByDimension(plan?.investments, dimension, baseCurrency)
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  const split = contributionSplit(current, shares, monthlyContribution, config.keys)
  const rows = config.keys
    .filter(key => current[key] > 0 || shares[key] > 0)
    .map(key => {
      const currentShare = total > 0 ? current[key] / total : 0
      const targetShare = shares[key] || 0
      const deviation = currentShare - targetShare
      return {
        key,
        assetClass: dimension === 'class' ? key : undefined,
        amount: current[key],
        currentShare,
        targetShare,
        deviation,
        status: Math.abs(deviation) <= clean.band ? 'within' : deviation > 0 ? 'above' : 'below',
        amountToTarget: targetShare * total - current[key],
        monthlyContribution: split[key]
      }
    })
  const outside = rows.filter(row => row.status !== 'within')
  // Months of redirected contributions needed to close the largest shortfall, without selling.
  const largestShortfall = Math.max(0, ...rows.map(row => row.amountToTarget))
  return {
    dimension,
    total,
    band: clean.band,
    rows,
    needsRebalance: outside.length > 0,
    outsideCount: outside.length,
    monthsToCloseWithContributions: monthlyContribution > 0 && largestShortfall > 0 ? Math.ceil(largestShortfall / monthlyContribution) : 0
  }
}
