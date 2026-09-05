export function summarizeLiquidity(plan, monthlyExpenses) {
  if (!Number.isFinite(monthlyExpenses) || monthlyExpenses < 0) throw new RangeError('Despesa mensal inválida.')
  const result = { available: 0, restricted: 0, unknown: 0 }
  const items = plan.investments.length ? plan.investments : [{ amount: plan.currentAssets, liquidity: 'unknown' }]
  for (const item of items) {
    if (!Number.isFinite(item.amount) || item.amount < 0) throw new RangeError('Saldo inválido.')
    const key = ['available', 'restricted'].includes(item.liquidity) ? item.liquidity : 'unknown'
    result[key] += item.amount
  }
  return { ...result, total: result.available + result.restricted + result.unknown, coverageMonths: monthlyExpenses > 0 ? result.available / monthlyExpenses : null }
}
