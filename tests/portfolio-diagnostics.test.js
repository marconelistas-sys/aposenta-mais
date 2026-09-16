import test from 'node:test'
import assert from 'node:assert/strict'

import { diagnosePortfolio, portfolioMetrics } from '../src/domain/portfolio-diagnostics.js'
import { applyAnnualFee, resolveInvestmentRealReturn, resolveInvestmentNominalReturn } from '../src/domain/investment-returns.js'
import { sanitizeInvestment } from '../src/app/state-storage.js'

const basePlan = {
  currentAge: 40,
  retirementAge: 65,
  targetAge: 90,
  annualRealReturn: 0.04,
  annualInflation: 0.04,
  annualWithdrawalRate: 0.04,
  investments: []
}

const investment = (overrides) => ({ id: overrides.name, returnType: 'default', returnValue: null, indexAnnualRate: null, monthlyContribution: 0, liquidity: 'available', assetClass: 'fixed-income', ...overrides })

test('custo anual reduz o retorno real habitual de forma multiplicativa', () => {
  const plan = { ...basePlan }
  const item = investment({ name: 'Fundo', amount: 1000, returnType: 'real', returnValue: 0.05, annualFee: 0.01 })
  assert.ok(Math.abs(resolveInvestmentRealReturn(item, plan, 2030) - (1.05 * 0.99 - 1)) < 1e-12)
  assert.equal(applyAnnualFee(0.05, 0), 0.05)
})

test('custo anual não altera retorno real informado para um ano específico', () => {
  const item = investment({ name: 'Fundo', amount: 1000, annualFee: 0.02, annualRealReturns: [{ year: 2030, rate: 0.03 }] })
  assert.equal(resolveInvestmentRealReturn(item, basePlan, 2030), 0.03)
  assert.ok(resolveInvestmentRealReturn(item, basePlan, 2031) < 0.04)
})

test('custo anual reduz retorno nominal de CDI', () => {
  const item = investment({ name: 'CDB', amount: 1000, returnType: 'cdi', returnValue: 1, indexAnnualRate: 0.1, annualFee: 0.01 })
  assert.ok(Math.abs(resolveInvestmentNominalReturn(item, basePlan, 2030) - (1.1 * 0.99 - 1)) < 1e-12)
})

test('saneamento preserva custo anual válido e descarta valores fora de faixa', () => {
  const valid = sanitizeInvestment(investment({ name: 'A', amount: 100, annualFee: 0.015 }))
  assert.equal(valid.annualFee, 0.015)
  assert.equal(Object.hasOwn(sanitizeInvestment(investment({ name: 'B', amount: 100, annualFee: 0.5 })), 'annualFee'), false)
  assert.equal(Object.hasOwn(sanitizeInvestment(investment({ name: 'C', amount: 100 })), 'annualFee'), false)
})

test('métricas calculam concentração, liquidez e custo ponderado', () => {
  const plan = { ...basePlan, investments: [
    investment({ name: 'Ações', amount: 300, assetClass: 'equity', liquidity: 'available', annualFee: 0.02 }),
    investment({ name: 'Tesouro', amount: 700, liquidity: 'restricted' })
  ] }
  const metrics = portfolioMetrics(plan, { monthlyExpenses: 100 })
  assert.equal(metrics.total, 1000)
  assert.equal(metrics.largestClass.assetClass, 'fixed-income')
  assert.equal(metrics.equityShare, 0.3)
  assert.equal(metrics.reserveCoverageMonths, 3)
  assert.ok(Math.abs(metrics.weightedFee - 0.006) < 1e-12)
})

test('diagnóstico sinaliza concentração, reserva curta e retirada longa', () => {
  const plan = { ...basePlan, targetAge: 100, investments: [investment({ name: 'CDB', amount: 10000, liquidity: 'available' })] }
  const result = diagnosePortfolio(plan, { monthlyExpenses: 5000, yearsToRetirement: 25 })
  const ids = result.findings.map(item => item.id)
  assert.ok(ids.includes('class-concentration'))
  assert.equal(result.findings.find(item => item.id === 'reserve').level, 'risk')
  assert.equal(result.findings.find(item => item.id === 'withdrawal').level, 'attention')
  assert.equal(result.findings[0].level, 'risk')
})

test('diagnóstico aponta retorno incompatível com carteira conservadora e limite do FGC', () => {
  const plan = { ...basePlan, investments: [
    investment({ name: 'CDB grande', amount: 300000, returnType: 'real', returnValue: 0.065 }),
    investment({ name: 'Ações', amount: 20000, assetClass: 'equity', returnType: 'real', returnValue: 0.065 })
  ] }
  const result = diagnosePortfolio(plan, { monthlyExpenses: 1000, yearsToRetirement: 20 })
  const ids = result.findings.map(item => item.id)
  assert.ok(ids.includes('return-consistency'))
  assert.ok(ids.includes('guarantee-limit'))
  assert.equal(result.findings.find(item => item.id === 'optimistic-return').level, 'attention')
  assert.equal(diagnosePortfolio(plan, { currency: 'EUR', yearsToRetirement: 20 }).findings.some(item => item.id === 'guarantee-limit'), false)
})

test('diagnóstico aponta risco de sequência perto da aposentadoria', () => {
  const plan = { ...basePlan, investments: [investment({ name: 'Ações', amount: 1000, assetClass: 'equity' })] }
  const result = diagnosePortfolio(plan, { yearsToRetirement: 3 })
  assert.ok(result.findings.some(item => item.id === 'sequence-risk'))
})

test('carteira vazia gera orientação sem falsos alertas de concentração', () => {
  const result = diagnosePortfolio(basePlan, { monthlyExpenses: 1000, yearsToRetirement: 20 })
  assert.deepEqual(result.findings.map(item => item.id), ['no-investments'])
})

test('taxa contratada de IPCA + não é tratada como premissa otimista', () => {
  const plan = { ...basePlan, investments: [investment({ name: 'Tesouro IPCA+', amount: 1000, returnType: 'ipca', returnValue: 0.07, liquidity: 'available' })] }
  const result = diagnosePortfolio(plan, { yearsToRetirement: 20 })
  const ids = result.findings.map(item => item.id)
  assert.equal(ids.includes('optimistic-return'), false)
  assert.equal(ids.includes('return-consistency'), false)
  assert.ok(ids.includes('mark-to-market'))
})
