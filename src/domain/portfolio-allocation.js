import { allocationClasses, sanitizeTargetAllocation } from './target-allocation.js'

// Investment amounts already use the plan currency. Never convert them twice.
export function portfolioAllocation(plan) {
  const investments = plan.investments?.length ? plan.investments : Number.isFinite(plan.currentAssets) && plan.currentAssets > 0
    ? [{ id: 'aggregate', name: 'Patrimônio agregado, sem classificação', assetClass: 'other', amount: plan.currentAssets }] : []
  const groups = new Map(allocationClasses.map(key => [key, { key, cents: 0, items: [] }]))
  for (const investment of investments) {
    if (!Number.isFinite(investment.amount) || investment.amount <= 0) continue
    const cents = Math.round(investment.amount * 100)
    if (!Number.isSafeInteger(cents) || cents <= 0) continue
    const group = groups.get(investment.assetClass) || groups.get('other')
    group.cents += cents
    group.items.push({ ...investment, amount: cents / 100 })
  }
  const totalCents = [...groups.values()].reduce((total, group) => total + group.cents, 0)
  const target = sanitizeTargetAllocation(plan.targetAllocation)
  const shares = target?.shares
  const rows = [...groups.values()].map(group => {
    const share = totalCents > 0 ? group.cents / totalCents : 0
    const targetShare = shares ? shares[group.key] || 0 : null
    const deviation = targetShare === null ? null : share - targetShare
    return { ...group, amount: group.cents / 100, share, targetShare, deviation,
      status: deviation === null || totalCents === 0 ? null : Math.abs(deviation) <= target.band + 1e-10 ? 'within' : deviation > 0 ? 'above' : 'below',
      items: group.items.sort((a, b) => b.amount - a.amount || (a.name || '').localeCompare(b.name || '', 'pt-BR')) }
  }).sort((a, b) => b.amount - a.amount || allocationClasses.indexOf(a.key) - allocationClasses.indexOf(b.key))
  return { total: totalCents / 100, rows, hasTarget: Boolean(shares), targetTotal: shares ? Object.values(shares).reduce((sum, share) => sum + share, 0) : null, band: target?.band, outsideCount: rows.filter(row => row.status && row.status !== 'within').length }
}
