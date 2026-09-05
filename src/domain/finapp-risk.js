import { finappViability } from './finapp-viability.js'
import { validateRiskSettings } from './risk-plan.js'

export const finappCostLevels = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5]
export const finappReturnRates = [-0.02, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06]

// Annual arithmetic-normal returns, as in finapp.run_monte_carlo.
// The seeded uniform generator differs from Python's MT19937. Distribution
// and recurrence agree, but identical seeds do not imply identical draws.
function normalGenerator(seed) {
  let cursor = seed >>> 0
  const uniform = () => {
    cursor = (cursor + 0x6D2B79F5) >>> 0
    let value = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform())
}

export function percentile(sorted, probability) {
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower)
}

export function annualRiskPath(base, annualReturns) {
  if (annualReturns.length !== base.rows.length || annualReturns.some(value => !Number.isFinite(value))) throw new Error('Percurso de retornos inválido.')
  let financialAssets = base.openingFinancial
  return base.rows.map((row, index) => {
    const rate = Math.max(-0.999999, annualReturns[index])
    const effectiveReturn = index === 0 ? (1 + rate) ** base.settings.openingYearPeriod - 1 : rate
    financialAssets = financialAssets * (1 + effectiveReturn) + row.freeCashFlow + row.pensionCredits
    if (!Number.isFinite(financialAssets) || Math.abs(financialAssets) >= 1e100) throw new Error('Percurso excede limite numérico.')
    return { year: row.year, month: row.month, financialAssets, wealth: financialAssets + row.assets, netWorth: financialAssets + row.assets - row.liabilities }
  })
}

export function calculateFinappRisk(state, settings, today = new Date(), returnPaths = null) {
  validateRiskSettings(settings)
  const base = finappViability(state, state.plan.finappMethod, today)
  if (returnPaths && (returnPaths.length !== settings.simulations || returnPaths.some(path => path.length !== base.rows.length))) throw new Error('Amostra de retornos incompatível.')
  const normal = normalGenerator(settings.seed)
  const samples = base.rows.map(() => ({ af: [], wealth: [], net: [] }))
  let successes = 0, targetSuccesses = 0
  const endings = []
  for (let simulation = 0; simulation < settings.simulations; simulation++) {
    const returns = returnPaths?.[simulation] || base.rows.map(() => state.plan.annualRealReturn + settings.annualVolatility * normal())
    const rows = annualRiskPath(base, returns)
    if (rows.every(row => row.financialAssets >= 0)) successes++
    if (rows.at(-1).financialAssets >= settings.targetAssets) targetSuccesses++
    endings.push(rows.at(-1).financialAssets)
    rows.forEach((row, index) => { samples[index].af.push(row.financialAssets); samples[index].wealth.push(row.wealth); samples[index].net.push(row.netWorth) })
  }
  const series = samples.map((sample, index) => {
    for (const values of Object.values(sample)) values.sort((a, b) => a - b)
    const row = { year: base.rows[index].year, month: base.rows[index].month }
    for (const [prefix, values] of Object.entries(sample)) for (const p of [10, 25, 50, 75, 90]) row[`${prefix}P${p}`] = percentile(values, p / 100)
    return row
  })
  endings.sort((a, b) => a - b)
  const tail = endings.slice(0, Math.max(1, Math.ceil(endings.length * 0.1)))
  const matrix = []
  const returnRates = [...new Set([...finappReturnRates, state.plan.annualRealReturn])].sort((a, b) => a - b)
  for (const costMultiplier of finappCostLevels) for (const annualRealReturn of returnRates) {
    const scenario = finappViability({ ...state, plan: { ...state.plan, annualRealReturn } }, state.plan.finappMethod, today, { costMultiplier })
    matrix.push({ costMultiplier, annualRealReturn, financialAssets: scenario.rows.at(-1).financialAssets, liquidAssets: scenario.rows.at(-1).liquidAssets, minFinancial: Math.min(...scenario.rows.map(row => row.financialAssets)), minLiquid: Math.min(...scenario.rows.map(row => row.liquidAssets)) })
  }
  return { method: 'finapp-annual', base, simulated: { series, simulations: settings.simulations, seed: settings.seed, probabilitySuccess: successes / settings.simulations, probabilityTarget: targetSuccesses / settings.simulations, cvar10: tail.reduce((sum, value) => sum + value, 0) / tail.length }, matrix, returnRates, costLevels: finappCostLevels, settings }
}
