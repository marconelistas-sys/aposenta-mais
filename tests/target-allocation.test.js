import test from 'node:test'
import assert from 'node:assert/strict'

import { contributionSplit, rebalanceAnalysis, sanitizeTargetAllocation, validateTargetAllocation } from '../src/domain/target-allocation.js'
import { simulateRisk, deterministicPath } from '../src/domain/risk-simulation.js'
import { sanitizeRiskSettings } from '../src/domain/risk-plan.js'

const target = { shares: { 'fixed-income': 0.6, equity: 0.4 }, band: 0.05 }
const plan = { monthlyContribution: 1000, investments: [
  { assetClass: 'fixed-income', amount: 8000 },
  { assetClass: 'equity', amount: 2000 }
] }

test('alocação-alvo exige soma de 100% e banda válida', () => {
  assert.deepEqual(sanitizeTargetAllocation(target), target)
  assert.equal(sanitizeTargetAllocation({ shares: { equity: 0.5 } }), null)
  assert.throws(() => validateTargetAllocation({ shares: { equity: 1.2 } }), /100%/)
  assert.equal(sanitizeTargetAllocation({ shares: { equity: 1 }, band: 0.5 }).band, 0.05)
})

test('análise aponta classes fora da banda e valor até o alvo', () => {
  const result = rebalanceAnalysis(plan, target)
  const fixed = result.rows.find(row => row.assetClass === 'fixed-income')
  const equity = result.rows.find(row => row.assetClass === 'equity')
  assert.equal(fixed.status, 'above')
  assert.equal(equity.status, 'below')
  assert.ok(Math.abs(equity.amountToTarget - 2000) < 1e-9)
  assert.equal(result.needsRebalance, true)
  assert.equal(result.monthsToCloseWithContributions, 2)
})

test('aportes vão primeiro para a classe abaixo do alvo', () => {
  const split = contributionSplit({ 'fixed-income': 8000, equity: 2000, fund: 0, pension: 0, cash: 0, other: 0 }, target, 1000)
  assert.equal(split.equity, 1000)
  assert.equal(split['fixed-income'], 0)
  const balanced = contributionSplit({ 'fixed-income': 6000, equity: 4000, fund: 0, pension: 0, cash: 0, other: 0 }, target, 1000)
  assert.ok(Math.abs(balanced['fixed-income'] - 600) < 1e-9)
  assert.ok(Math.abs(balanced.equity - 400) < 1e-9)
})

const months = Array.from({ length: 24 }, (_, index) => ({ month: `2030-${String(index % 12 + 1).padStart(2, '0')}`.replace('2030', String(2030 + Math.floor(index / 12))), cashFlow: 0, income: 0, expenses: 0, nonLiquidAssets: 0, liabilities: 0 }))
const riskInput = volatility => ({ buckets: [
  { amount: 1000, annualRealReturn: 0.04, liquid: true, ...(volatility ? { volatility: 0 } : {}) },
  { amount: 1000, annualRealReturn: 0.04, liquid: true, ...(volatility ? { volatility: 0.3 } : {}) }
], timelines: [months], simulations: 200, seed: 7, annualVolatility: 0.1 })

test('modelo comum mantém o resultado reproduzível e o modelo por classe varia só a classe volátil', () => {
  const common = simulateRisk(riskInput(false))
  assert.deepEqual(simulateRisk(riskInput(false)).series.at(-1), common.series.at(-1))
  const perClass = simulateRisk(riskInput(true))
  assert.notDeepEqual(perClass.series.at(-1), common.series.at(-1))
  const base = deterministicPath(riskInput(true)).rows.at(-1).financialAssets
  assert.ok(Number.isFinite(base))
})

test('configuração de risco preserva o modelo de volatilidade', () => {
  assert.equal(sanitizeRiskSettings({}).volatilityModel, 'common')
  assert.equal(sanitizeRiskSettings({ volatilityModel: 'class' }).volatilityModel, 'class')
  assert.equal(sanitizeRiskSettings({ volatilityModel: 'x' }).volatilityModel, 'common')
})
