import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateRisk, deterministicPath, riskMatrix } from '../src/domain/risk-simulation.js'

function fixture(months = 12) {
  return { buckets: [{ amount: 1000, annualRealReturn: 0.12 }], timelines: [Array.from({ length: months }, (_, index) => ({ month: `${2026 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`, cashFlow: 10, income: 20, expenses: 10, nonLiquidAssets: 500, liabilities: 100 }))], annualVolatility: 0.2, simulations: 100, seed: 0 }
}
test('seeded risk simulations reproduce results without mutating the input', () => {
  const input = fixture()
  const original = structuredClone(input)
  const first = simulateRisk(input)
  assert.deepEqual(first, simulateRisk(input))
  assert.deepEqual(input, original)
  assert.notDeepEqual(first.series, simulateRisk({ ...input, seed: 1 }).series)
})
test('zero volatility equals deterministic path and preserves individual return rates', () => {
  const input = fixture()
  input.buckets.push({ amount: 1000, annualRealReturn: 0 })
  input.annualVolatility = 0
  const result = simulateRisk(input)
  const deterministic = deterministicPath(input)
  result.series.forEach((row, index) => {
    assert.equal(row.p10, deterministic.rows[index].netWorth)
    assert.equal(row.p10, row.p50)
    assert.equal(row.p50, row.p90)
  })
  assert.ok(Math.abs(deterministic.rows.at(-1).financialAssets - 2240) < 1e-8)
})
test('unfunded deficits persist as implicit liabilities even after subsequent positive cash flow', () => {
  const input = fixture(3)
  input.buckets = []
  input.annualVolatility = 0
  input.timelines[0].forEach((row, index) => { row.cashFlow = index === 2 ? 20 : -100 })
  const result = deterministicPath(input)
  assert.equal(result.firstShortfall, '2026-01')
  assert.equal(result.rows[2].unfunded, 200)
  assert.equal(result.rows[2].financialAssets, 20)
  assert.equal(result.rows[2].netWorth, 220)
  const simulated = simulateRisk({ ...input, targetAssets: 21 })
  assert.equal(simulated.probabilityShortfall, 1)
  assert.equal(simulated.probabilityTarget, 0)
  assert.equal(simulated.series[2].unfundedP50, 200)
})
test('percentiles are ordered and financial solvency is independent from non-liquid wealth', () => {
  const input = fixture()
  const result = simulateRisk(input)
  for (const row of result.series) {
    assert.ok(row.p10 <= row.p50 && row.p50 <= row.p90)
    assert.ok(row.financialP10 <= row.financialP50 && row.financialP50 <= row.financialP90)
  }
  input.buckets = []
  input.timelines[0].forEach(row => { row.cashFlow = -100; row.nonLiquidAssets = 1e6 })
  assert.equal(simulateRisk(input).probabilityShortfall, 1)
})
test('multiple equal-weight hypothetical timelines contribute to simulated percentiles', () => {
  const input = fixture(1)
  input.annualVolatility = 0
  input.timelines.push(input.timelines[0].map(row => ({ ...row, nonLiquidAssets: 5000 })))
  const row = simulateRisk(input).series[0]
  assert.ok(row.p90 > row.p10)
  assert.equal(row.financialP10, row.financialP90)
})
test('matrix has nine cells and preserves base cash flow including extra flows', () => {
  const input = fixture(1)
  input.buckets = []
  input.timelines[0][0].cashFlow = 999
  const matrix = riskMatrix(input)
  assert.equal(matrix.length, 9)
  assert.equal(matrix.find(row => row.returnShift === 0 && row.expenseMultiplier === 1).financialAssets, 999)
  assert.equal(matrix.find(row => row.returnShift === 0 && row.expenseMultiplier === 0.9).financialAssets, 1000)
  assert.equal(matrix.find(row => row.returnShift === 0 && row.expenseMultiplier === 1.1).financialAssets, 998)
})
test('risk simulation rejects malformed inputs and bounds work', () => {
  for (const patch of [{ seed: -1 }, { seed: 4294967296 }, { seed: true }, { simulations: 49 }, { simulations: 1001 }, { simulations: 50.5 }, { annualVolatility: NaN }, { annualVolatility: 1.1 }, { targetAssets: Infinity }, { timelines: [] }, { buckets: [{ amount: -1, annualRealReturn: 0 }] }]) assert.throws(() => simulateRisk({ ...fixture(), ...patch }))
  assert.throws(() => simulateRisk(fixture(721)))
  const large = fixture(720)
  large.simulations = 1000
  large.buckets = Array.from({ length: 100 }, () => ({ amount: 1, annualRealReturn: 0 }))
  assert.throws(() => simulateRisk(large), /muito grande/)
  const mismatch = fixture(2)
  mismatch.timelines.push(mismatch.timelines[0].slice(0, 1))
  assert.throws(() => simulateRisk(mismatch))
})
test('monthly growth precedes withdrawals and applies default rate only to new contributions', () => {
  const input = fixture(12)
  input.buckets = []
  input.defaultAnnualReturn = 0.12
  input.timelines[0].forEach((row, index) => { row.cashFlow = index === 0 ? 1000 : 0 })
  assert.ok(Math.abs(deterministicPath(input).rows.at(-1).financialAssets - 1000 * 1.12 ** (11 / 12)) < 1e-8)
})
test('negative linked net equity is retained without subtracting consortium principal twice', () => {
  const input = fixture(1)
  input.buckets = []
  input.timelines[0][0] = { ...input.timelines[0][0], cashFlow: 0, nonLiquidAssets: -100, liabilities: 50 }
  assert.equal(deterministicPath(input).rows[0].netWorth, -150)
  input.buckets = [{ amount: 100, annualRealReturn: -0.99 }]
  assert.throws(() => riskMatrix(input), /Retorno ajustado/)
})
test('restricted financial assets keep growing but cannot fund cash deficits', () => {
  const input = fixture(2)
  input.annualVolatility = 0
  input.targetAssets = 1000
  input.buckets = [{ amount: 1000, annualRealReturn: 0.12, liquid: false }]
  input.timelines[0][0].cashFlow = -100
  input.timelines[0][1].cashFlow = 20
  const rows = deterministicPath(input).rows
  assert.ok(rows[0].financialAssets > 1000)
  assert.equal(rows[0].liquidAssets, 0)
  assert.equal(rows[0].unfunded, 100)
  assert.equal(rows[1].liquidAssets, 20)
  assert.equal(rows[1].unfunded, 100)
  const result = simulateRisk(input)
  assert.equal(result.probabilityTarget, 1)
  assert.equal(result.probabilityShortfall, 1)
  assert.equal(result.series[0].liquidP50, 0)
  assert.equal(result.series[1].liquidP90, 20)
})
test('validation limits combined scenario input and rejects ambiguous liquidity', () => {
  const input = fixture(720)
  input.timelines = Array.from({ length: 28 }, () => input.timelines[0])
  assert.throws(() => deterministicPath(input), /20.000/)
  const invalid = fixture()
  invalid.buckets[0].liquid = 'false'
  assert.throws(() => riskMatrix(invalid), /Liquidez/)
})
test('expense sensitivity excludes fixed commitments and keeps additional cash flows', () => {
  const input = fixture(1)
  input.buckets = []
  Object.assign(input.timelines[0][0], { income: 1000, expenses: 800, cashFlow: 250, stressExpenses: 100 })
  const matrix = riskMatrix(input)
  assert.equal(matrix.find(row => row.returnShift === 0 && row.expenseMultiplier === 1.1).financialAssets, 240)
  assert.equal(matrix.find(row => row.returnShift === 0 && row.expenseMultiplier === 0.9).financialAssets, 260)
  assert.equal(deterministicPath(input, 0, 0, 1.1).rows[0].financialAssets, 240)
  input.timelines[0][0].stressExpenses = 0
  assert.equal(deterministicPath(input, 0, 0, 1.1).rows[0].financialAssets, 250)
  input.timelines[0][0].stressExpenses = 801
  assert.throws(() => riskMatrix(input), /Gastos correntes/)
})
