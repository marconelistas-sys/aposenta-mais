import { resolveInvestmentRealReturn, validateAnnualRealReturns } from './investment-returns.js'
import { withdrawalTaxAmount } from './tax.js'

function monthsHeldAt(investment, year) {
  if (!investment?.acquiredAt) return 0
  const acquired = new Date(`${investment.acquiredAt}T00:00:00Z`)
  const reference = new Date(Date.UTC(year, 11, 31))
  return Math.max(0, (reference.getUTCFullYear() - acquired.getUTCFullYear()) * 12 + (reference.getUTCMonth() - acquired.getUTCMonth()))
}

// Year-end budget flows. A deficit consumes available holdings proportionally.
// Unfunded amounts remain negative cash for diagnosis, never available credit.
export function projectAnnualInvestments(rows, model, annualReturns = null) {
  const { plan, openingYearPeriod, releases = [] } = model
  const releaseYears = new Map(releases.map(row => [row.investmentId, row.year]))
  const source = plan.investments.length ? plan.investments : [{ amount: plan.currentAssets, liquidity: 'unknown', returnType: 'default' }]
  const buckets = source.map(item => {
    validateAnnualRealReturns(item.annualRealReturns)
    return { investment: item, balance: item.amount, liquid: item.liquidity === 'available', releaseYear: releaseYears.get(item.id), id: `opening:${item.id}`, name: item.name || 'Patrimônio', pension: item.assetClass === 'pension' }
  })
  const cash = { id: 'projected-cash', name: 'Caixa acumulado do planejamento', balance: 0, liquid: true }
  buckets.push(cash)
  const total = liquidOnly => buckets.reduce((sum, bucket) => sum + (!liquidOnly || bucket.liquid ? bucket.balance : 0), 0)
  return rows.map((row, index) => {
    const year = Number(row.year)
    // A path entry is either one annual return for all holdings or, in the
    // per-class model, { default, shifts } with deviations by asset class.
    const entry = annualReturns ? annualReturns[index] : null
    const defaultShift = entry === null ? 0 : typeof entry === 'number' ? entry - plan.annualRealReturn : entry.default - plan.annualRealReturn
    const shiftFor = bucket => entry && typeof entry === 'object' && Number.isFinite(entry.shifts?.[bucket.investment?.assetClass]) ? entry.shifts[bucket.investment.assetClass] : defaultShift
    const period = index === 0 ? openingYearPeriod : 1
    const previousFinancial = total(false), previousLiquid = total(true)
    let financialReturn = 0, liquidReturn = 0, released = 0
    const releasedItems = []
    for (const bucket of buckets) {
      const rate = Math.max(-0.999999, resolveInvestmentRealReturn(bucket.investment, plan, year) + shiftFor(bucket))
      if (!Number.isFinite(rate)) throw new Error('Retorno anual inválido.')
      const growth = bucket.balance * Math.expm1(Math.log1p(rate) * period)
      bucket.balance += growth
      financialReturn += growth
      if (bucket.liquid) liquidReturn += growth
    }
    for (const flow of row.pensionFlows || []) {
      let bucket = buckets.find(item => item.id === flow.id)
      if (!bucket) { bucket = { id: flow.id, name: flow.name, balance: 0, liquid: false, pension: true, releaseYear: flow.releaseYear }; buckets.push(bucket) }
      bucket.balance += flow.amount
    }
    for (const bucket of buckets) if (!bucket.liquid && bucket.releaseYear === year) {
      bucket.liquid = true
      released += bucket.balance
      releasedItems.push({ id: bucket.id, name: bucket.name, category: 'Liberação de saldo restrito', source: 'Patrimônio', currency: model.currency, frequency: 'Liberação anual', amount: bucket.balance, originalAmount: bucket.balance, months: 1 })
    }
    const freeCashFlow = row.income - row.costs - row.goals
    let withdrawalTax = 0
    if (freeCashFlow >= 0) {
      // Pay any diagnostic cash deficit before allocating new savings.
      const repayment = Math.min(freeCashFlow, Math.max(0, -cash.balance))
      cash.balance += repayment
      const surplus = freeCashFlow - repayment
      const planned = buckets.reduce((sum, bucket) => sum + (bucket.investment?.monthlyContribution || 0) * 12, 0)
      const invested = Math.min(surplus, planned)
      for (const bucket of buckets) if (bucket.investment?.monthlyContribution > 0) bucket.balance += invested * bucket.investment.monthlyContribution * 12 / planned
      cash.balance += surplus - invested
    }
    else {
      const available = buckets.filter(bucket => bucket.liquid && bucket.balance > 0)
      const balance = available.reduce((sum, bucket) => sum + bucket.balance, 0)
      const paid = Math.min(balance, -freeCashFlow)
      // Tax the pension-sourced share of the withdrawal before draining the
      // buckets below, using each bucket's own pre-withdrawal balance and
      // holding period. The tax reduces cash actually received, not the
      // gross amount debited from the bucket.
      if (model.taxRegime && model.taxRegime !== 'none') {
        withdrawalTax = available.filter(bucket => bucket.pension).reduce((sum, bucket) => {
          const share = balance > 0 ? paid * bucket.balance / balance : 0
          return sum + withdrawalTaxAmount(share, model.taxRegime, { monthsHeld: monthsHeldAt(bucket.investment, year), manualRate: model.manualTaxRate })
        }, 0)
      }
      for (const bucket of available) bucket.balance -= balance > 0 ? paid * bucket.balance / balance : 0
      cash.balance -= -freeCashFlow - paid + withdrawalTax
    }
    const financialAssets = total(false), liquidAssets = total(true)
    if (![financialAssets, liquidAssets].every(value => Number.isFinite(value) && Math.abs(value) < 1e100)) throw new Error('Projeção excede limite numérico.')
    const pensionRestricted = buckets.reduce((sum, bucket) => sum + (bucket.pension && !bucket.liquid ? bucket.balance : 0), 0)
    return { ...row, month: `${year}-12`, previousFinancial, previousLiquid, financialReturn, liquidReturn, freeCashFlow, withdrawalTax,
      effectiveReturn: previousFinancial > 0 ? financialReturn / previousFinancial : 0,
      financialAssets, liquidAssets, releases: released, pensionRestricted,
      financialChange: financialAssets - previousFinancial, liquidChange: liquidAssets - previousLiquid,
      restrictedFinancial: financialAssets - liquidAssets, netFinancial: financialAssets - row.liabilities,
      netWorth: financialAssets + row.assets - row.liabilities,
      ...(row.breakdown ? {
        breakdown: { ...row.breakdown, releases: releasedItems },
        // Copy year-end balances. Never expose the mutable buckets to later years.
        wealthBreakdown: { ...row.wealthBreakdown, financial: buckets.map(bucket => ({
          id: bucket.id, name: bucket.name,
          amount: bucket.balance,
          kind: bucket === cash ? 'cash' : bucket.pension ? 'pension' : bucket.investment?.assetClass || 'other-investment',
          liquidity: bucket.liquid ? 'available' : bucket.investment && bucket.investment.liquidity !== 'restricted' ? 'unknown' : 'restricted',
          releaseYear: bucket.releaseYear ?? null
        })) }
      } : {}) }
  })
}
