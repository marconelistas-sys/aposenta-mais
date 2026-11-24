import { finappViability } from './finapp-viability.js'
import { convertCurrency } from '../shared/exchange-rates.js'

const finite = Number.isFinite
const moneyKeys = ['financialAssets', 'liquidAssets', 'netFinancial', 'freeCashFlow']

// Each copy keeps its own budget, inflation and product returns. Convert only
// the calculated amounts for presentation, never the original assumptions.
export function prepareScenarioComparison(state, hypothesis, { referenceId = 'current', today = new Date() } = {}) {
  const saved = state.scenarios?.find(row => row.id === referenceId)
  const reference = saved || { name: 'Plano atual', currency: state.currency, plan: state.plan, cashFlow: state.cashFlow }
  const run = (scenario, name) => {
    try {
      const currency = scenario.currency || state.currency
      const copy = { ...structuredClone(state), currency, plan: structuredClone(scenario.plan), cashFlow: structuredClone(scenario.cashFlow || state.cashFlow) }
      const report = finappViability(copy, undefined, today)
      const rows = report.rows.map(row => ({ ...row, ...Object.fromEntries(moneyKeys.map(key => [key, convertCurrency(row[key], currency, state.currency, state.exchangeRates)])) }))
      return { name, currency, plan: scenario.plan, report, rows, monthlyContribution: convertCurrency(scenario.plan.monthlyContribution, currency, state.currency, state.exchangeRates) }
    } catch (error) { return { name, error: error.message } }
  }
  const baseline = run(reference, reference.name)
  const candidate = run(hypothesis, 'Hipótese em teste')
  const result = { reference: baseline, hypothesis: candidate, referenceId: saved?.id || 'current', currency: state.currency, baseYear: today.getUTCFullYear() }
  if (baseline.error || candidate.error) return { ...result, available: false }
  const referenceRows = new Map(baseline.rows.map(row => [Number(row.year), row]))
  const rows = candidate.rows.filter(row => referenceRows.has(Number(row.year))).map(row => ({ year: Number(row.year), reference: referenceRows.get(Number(row.year)), hypothesis: row }))
  if (!rows.length) return { ...result, available: false, error: 'Os cenários não têm anos em comum. Revise os horizontes antes de comparar.' }
  const summarize = (scenario, key) => {
    const period = rows.map(row => row[key])
    const minimum = period.reduce((min, row) => row.liquidAssets < min.liquidAssets ? row : min)
    const firstLiquidity = period.find(row => row.liquidAssets < -0.005)
    const firstFinancial = period.find(row => row.netFinancial < -0.005)
    const failureYear = Math.min(firstLiquidity?.year ?? Infinity, firstFinancial?.year ?? Infinity)
    return { ...scenario, ending: period.at(-1), monthlyBudgetBalance: period[0].freeCashFlow / 12, minimumLiquidity: { year: minimum.year, amount: minimum.liquidAssets }, firstLiquidityYear: firstLiquidity?.year ?? null, firstFinancialYear: firstFinancial?.year ?? null, status: finite(failureYear) ? 'shortfall' : scenario.report.issues.length ? 'incomplete' : 'covered', failureYear: finite(failureYear) ? failureYear : null }
  }
  const referenceSummary = summarize(baseline, 'reference'), candidateSummary = summarize(candidate, 'hypothesis')
  return {
    ...result, available: true, reference: referenceSummary, hypothesis: candidateSummary, rows,
    startYear: rows[0].year, endYear: rows.at(-1).year,
    sameProjection: rows.every(row => moneyKeys.every(key => Math.abs(row.reference[key] - row.hypothesis[key]) < 0.005)),
    financialDifference: candidateSummary.ending.financialAssets - referenceSummary.ending.financialAssets,
    contributionDifference: candidate.monthlyContribution - baseline.monthlyContribution
  }
}
