import test from 'node:test'
import assert from 'node:assert/strict'
import { portfolioReality } from '../src/domain/portfolio-reality.js'

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected} ± ${tolerance}`)
const indicators = { countries: { BR: { cpi: { yoy: 0.0458, lastMonth: '2026-09' } }, CH: { cpi: { yoy: 0.0099005861, lastMonth: '2026-09' } } } }
const history = (start, end) => [{ date: '2025-10-31', amount: start, flow: 0 }, { date: '2026-10-31', amount: end, flow: 0 }]
const plan = investments => ({ annualRealReturn: 0.04, annualInflation: 0.02, investments })

test('H2.1: realizado em CHF descontado pelo IPC suíço, sem desconto extra de custo', () => {
  const result = portfolioReality(plan([{ id: 'a', name: 'ETF CHF', currency: 'CHF', amount: 100000, assetClass: 'equity', returnType: 'real', returnValue: 0.03, annualFee: 0.005, balanceHistory: history(1000, 1030) }]), { currency: 'CHF', year: 2026, indicators })
  const row = result.items[0]
  near(row.realized.real, 1.03 / 1.0099005861 - 1, 1e-6, 'real')
  assert.equal(row.inflation.label, 'IPC suíço')
  assert.equal(row.inflation.source, 'official')
  near(row.expected, 1.03 * 0.995 - 1, 1e-12, 'esperado líquido de custo')
  assert.equal(result.returns.inflationName, 'inflação')
  assert.equal(result.returns.coverage, 1)
})

test('H2.2 e H2.4: sem histórico entra só no esperado; carteira só em BRL diz IPCA', () => {
  const result = portfolioReality(plan([
    { id: 'a', name: 'CDB', currency: 'BRL', amount: 300000, assetClass: 'fixed-income', returnType: 'cdi', returnValue: 1, indexAnnualRate: 0.1 },
    { id: 'b', name: 'Tesouro IPCA', currency: 'BRL', amount: 100000, assetClass: 'fixed-income', returnType: 'ipca', returnValue: 0.06, balanceHistory: history(1000, 1100) }
  ]), { currency: 'BRL', year: 2026, indicators })
  assert.equal(result.returns.inflationName, 'IPCA')
  assert.equal(result.returns.coveredCount, 1)
  near(result.returns.coverage, 0.25, 1e-12, 'cobertura')
  near(result.returns.realized, 1.1 / 1.0458 - 1, 1e-6, 'realizado')
  near(result.returns.coveredExpected, 0.06, 1e-12, 'premissa do grupo coberto')
})

test('H2.3: sem snapshot, o realizado usa a inflação esperada, rotulada', () => {
  const result = portfolioReality(plan([{ id: 'a', name: 'Fundo', currency: 'BRL', amount: 1000, returnType: 'real', returnValue: 0.04, balanceHistory: history(1000, 1050) }]), { currency: 'BRL', year: 2026 })
  assert.equal(result.items[0].inflation.source, 'estimated')
  assert.equal(result.returns.anyEstimatedInflation, true)
  near(result.items[0].realized.real, 1.05 / 1.02 - 1, 1e-6, 'real estimado')
})

test('H2.5: nenhum histórico válido deixa o realizado vazio', () => {
  const result = portfolioReality(plan([{ id: 'a', name: 'Fundo', amount: 1000, returnType: 'real', returnValue: 0.04 }]), { currency: 'BRL', year: 2026 })
  assert.equal(result.returns.realized, null)
  assert.equal(result.returns.coveredCount, 0)
  near(result.returns.expected, 0.04, 1e-12, 'esperado')
})

test('H4.1 e H4.2: custo do ano, maiores custos e investimentos sem custo', () => {
  const result = portfolioReality(plan([
    { id: 'f', name: 'Fundo multimercado', amount: 200000, assetClass: 'fund', annualFee: 0.015, returnType: 'real', returnValue: 0.04 },
    { id: 'e', name: 'ETF', amount: 300000, assetClass: 'equity', annualFee: 0.002, returnType: 'real', returnValue: 0.05 },
    { id: 'p', name: 'PGBL', amount: 50000, assetClass: 'pension', annualFee: 0, returnType: 'real', returnValue: 0.04 },
    { id: 'c', name: 'Conta', amount: 50000, assetClass: 'cash', returnType: 'real', returnValue: 0 }
  ]), { currency: 'BRL', year: 2026 })
  near(result.costs.annualAmount, 3600, 1e-6, 'custo do ano')
  near(result.costs.weightedFee, 3600 / 600000, 1e-12, 'custo ponderado')
  assert.equal(result.costs.top[0].name, 'Fundo multimercado')
  assert.deepEqual(result.costs.missing.likely.names, ['PGBL'])
  assert.deepEqual(result.costs.missing.maybeZero.names, ['Conta'])
  near(result.costs.missing.likely.share, 50000 / 600000, 1e-12, 'parcela sem custo')
})

test('H4.3: sinal de custo não cadastrado só para CDI e taxa nominal', () => {
  const result = portfolioReality(plan([
    { id: 'c', name: 'CDB 100% CDI', currency: 'BRL', amount: 1000, assetClass: 'fixed-income', returnType: 'cdi', returnValue: 1, indexAnnualRate: 0.1, balanceHistory: history(1000, 1088) },
    { id: 'e', name: 'Ações', currency: 'BRL', amount: 1000, assetClass: 'equity', returnType: 'real', returnValue: 0.1, balanceHistory: history(1000, 900) }
  ]), { currency: 'BRL', year: 2026, indicators })
  assert.equal(result.costs.signals.length, 1)
  assert.equal(result.costs.signals[0].name, 'CDB 100% CDI')
  near(result.costs.signals[0].gap, 0.012, 1e-4, 'diferença')
})

test('H3.1: quantas vezes a carteira cabe no custo de vida', () => {
  const result = portfolioReality(plan([
    { id: 'a', name: 'Disponível', amount: 100000, liquidity: 'available', returnType: 'real', returnValue: 0.02 },
    { id: 'b', name: 'Longo prazo', amount: 500000, liquidity: 'restricted', returnType: 'real', returnValue: 0.05 }
  ]), { currency: 'BRL', year: 2026, monthlyCost: 7000, costBasis: 'actual', costMonths: 10 })
  assert.equal(Math.round(result.coverage.months), 86)
  assert.equal(Number(result.coverage.years.toFixed(1)), 7.1)
  assert.equal(Math.round(result.coverage.availableMonths), 14)
  const noCost = portfolioReality(plan([{ id: 'a', name: 'A', amount: 1000 }]), { currency: 'BRL', year: 2026 })
  assert.equal(noCost.coverage.available, false)
  assert.equal(noCost.coverage.reason, 'cost')
})
