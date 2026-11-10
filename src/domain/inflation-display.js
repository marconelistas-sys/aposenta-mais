import { cumulativePriceIndex, marketInflationPath } from './market-assumptions.js'

// Annual price basis, matching finapp's index = (1 + inflation)^(year - baseYear).
// Pure presentation conversion. The real projection and its risk do not change.
export function annualPriceFactor(year, baseYear, annualInflation) {
  if (![year, baseYear].every(value => Number.isInteger(value) && value >= 2000 && value <= 2199) || !Number.isFinite(annualInflation) || annualInflation <= -1 || annualInflation > 1) throw new Error('Ano-base ou inflação inválidos.')
  const factor = (1 + annualInflation) ** (year - baseYear)
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Índice de preços fora do limite numérico.')
  return factor
}

const monetaryKeys = ['income', 'costs', 'goals', 'pensionCredits', 'releases', 'freeCashFlow', 'financialAssets', 'liquidAssets', 'restrictedFinancial', 'netFinancial', 'netWorth', 'assets', 'liabilities', 'realEstateAssets', 'excludedRealEstateAssets', 'solvencyNetWorth', 'netWorthWithoutRealEstate']

// Price index of a year. With a market trajectory (inflationPath) it is the
// accumulated index Π(1 + π(y)), the same one used by fixed incomes, so a fixed
// income in the plan currency shows exactly its contract amount in the nominal view.
export function priceIndexFor(year, baseYear, { annualInflation, inflationPath = null }) {
  return inflationPath ? cumulativePriceIndex(inflationPath, baseYear, year) : annualPriceFactor(year, baseYear, annualInflation)
}

// Options for annualRowsInPriceBasis from the plan: the market trajectory of the
// plan currency when market assumptions are active, otherwise the plan inflation.
export function priceBasisInflation(plan, currency) {
  return { annualInflation: plan?.annualInflation, inflationPath: marketInflationPath(plan, currency) }
}

export function annualRowsInPriceBasis(rows, { basis = 'real', annualInflation, baseYear, inflationPath = null }) {
  if (!['real', 'nominal'].includes(basis)) throw new Error('Escolha valores reais ou nominais.')
  if (inflationPath) cumulativePriceIndex(inflationPath, baseYear, baseYear)
  else annualPriceFactor(baseYear, baseYear, annualInflation)
  const options = { annualInflation, inflationPath }
  return rows.map(row => {
    const year = Number(row.year)
    const factor = priceIndexFor(year, baseYear, options)
    const previousFactor = priceIndexFor(Math.max(baseYear, year - 1), baseYear, options)
    const next = { ...row, priceBasis: basis, priceBaseYear: baseYear, priceFactor: factor, realFinancialChange: row.financialChange }
    if (basis === 'nominal') {
      for (const key of monetaryKeys) if (Number.isFinite(row[key])) next[key] = row[key] * factor
      if (Number.isFinite(row.financialAssets)) {
        next.previousFinancial = row.previousFinancial * previousFactor
        // Nominal growth includes the indexation of the opening balance.
        // Merely multiplying real change by the end-year index would not
        // reconcile consecutive nominal opening/closing balances.
        next.inflationRevaluation = row.previousFinancial * (factor - previousFactor)
        next.financialReturn = row.financialReturn * factor + next.inflationRevaluation
        next.financialChange = next.financialAssets - next.previousFinancial
      }
      if (Number.isFinite(row.liquidAssets)) {
        next.previousLiquid = row.previousLiquid * previousFactor
        next.liquidReturn = row.liquidReturn * factor + row.previousLiquid * (factor - previousFactor)
        next.liquidChange = next.liquidAssets - next.previousLiquid
      }
    }
    if (row.breakdown) next.breakdown = Object.fromEntries(Object.entries(row.breakdown).map(([key, entries]) => [key, entries.map(entry => ({ ...entry, amount: entry.amount * (basis === 'nominal' ? factor : 1) }))]))
    if (row.wealthBreakdown) next.wealthBreakdown = Object.fromEntries(Object.entries(row.wealthBreakdown).map(([key, entries]) => [key, entries.map(entry => ({ ...entry, amount: entry.amount * (basis === 'nominal' ? factor : 1) }))]))
    next.outflows = next.costs + next.goals
    next.resultAfterReturns = Number.isFinite(next.financialReturn) ? next.freeCashFlow + next.financialReturn : null
    for (const key of [...monetaryKeys, 'previousFinancial', 'financialReturn', 'financialChange', 'outflows']) if (key in next && (!Number.isFinite(next[key]) || Math.abs(next[key]) >= 1e100)) throw new Error('Valores projetados excedem o limite numérico.')
    return next
  })
}
