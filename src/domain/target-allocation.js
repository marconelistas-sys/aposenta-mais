/**
 * Alocação-alvo por classe com bandas de rebalanceamento.
 * Educativo: não recomenda produtos. Direciona aportes antes de sugerir vendas,
 * o que evita custos de transação e imposto em muitos casos.
 */
export const allocationClasses = Object.freeze(['fixed-income', 'equity', 'fund', 'pension', 'cash', 'other'])
export const defaultRebalanceBand = 0.05

export function sanitizeTargetAllocation(source) {
  if (!source || typeof source !== 'object') return null
  const shares = {}
  let total = 0
  for (const key of allocationClasses) {
    const value = Number(source.shares?.[key] ?? 0)
    if (!Number.isFinite(value) || value < 0 || value > 1) return null
    if (value > 0) shares[key] = value
    total += value
  }
  if (Math.abs(total - 1) > 0.005) return null
  const band = Number(source.band ?? defaultRebalanceBand)
  return { shares, band: Number.isFinite(band) && band >= 0.01 && band <= 0.2 ? band : defaultRebalanceBand }
}

export function validateTargetAllocation(source) {
  const clean = sanitizeTargetAllocation(source)
  if (!clean) throw new RangeError('A alocação-alvo precisa somar 100%, com cada classe entre 0% e 100%, e banda entre 1 e 20 pontos percentuais.')
  return clean
}

function currentByClass(investments) {
  const totals = Object.fromEntries(allocationClasses.map(key => [key, 0]))
  for (const item of investments || []) {
    const key = allocationClasses.includes(item.assetClass) ? item.assetClass : 'other'
    totals[key] += Number(item.amount) || 0
  }
  return totals
}

// Splits the monthly contribution toward classes below target after the
// contribution. Any remainder follows the target weights.
export function contributionSplit(current, target, contribution) {
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  const split = Object.fromEntries(allocationClasses.map(key => [key, 0]))
  if (!(contribution > 0)) return split
  const futureTotal = total + contribution
  const gaps = Object.fromEntries(allocationClasses.map(key => [key, Math.max(0, (target.shares[key] || 0) * futureTotal - current[key])]))
  const gapTotal = Object.values(gaps).reduce((sum, value) => sum + value, 0)
  if (gapTotal >= contribution) {
    for (const key of allocationClasses) split[key] = contribution * gaps[key] / gapTotal
    return split
  }
  const rest = contribution - gapTotal
  for (const key of allocationClasses) split[key] = gaps[key] + rest * (target.shares[key] || 0)
  return split
}

export function rebalanceAnalysis(plan, target, { monthlyContribution = plan?.monthlyContribution || 0 } = {}) {
  const clean = sanitizeTargetAllocation(target)
  if (!clean) return null
  const current = currentByClass(plan?.investments)
  const total = Object.values(current).reduce((sum, value) => sum + value, 0)
  const split = contributionSplit(current, clean, monthlyContribution)
  const rows = allocationClasses
    .filter(key => current[key] > 0 || clean.shares[key] > 0)
    .map(key => {
      const currentShare = total > 0 ? current[key] / total : 0
      const targetShare = clean.shares[key] || 0
      const deviation = currentShare - targetShare
      return {
        assetClass: key,
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
    total,
    band: clean.band,
    rows,
    needsRebalance: outside.length > 0,
    outsideCount: outside.length,
    monthsToCloseWithContributions: monthlyContribution > 0 && largestShortfall > 0 ? Math.ceil(largestShortfall / monthlyContribution) : 0
  }
}
