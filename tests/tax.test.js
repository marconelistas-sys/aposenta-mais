import test from 'node:test'
import assert from 'node:assert/strict'

import { progressiveTableTaxAmount, progressiveTaxAmount, regressiveRate, withdrawalTaxAmount } from '../src/domain/tax.js'

test('tabela regressiva reduz a alíquota conforme o tempo de aporte', () => {
  assert.equal(regressiveRate(0), 0.35)
  assert.equal(regressiveRate(24), 0.35)
  assert.equal(regressiveRate(25), 0.30)
  assert.equal(regressiveRate(48), 0.30)
  assert.equal(regressiveRate(72), 0.25)
  assert.equal(regressiveRate(96), 0.20)
  assert.equal(regressiveRate(120), 0.15)
  assert.equal(regressiveRate(121), 0.10)
  assert.equal(regressiveRate(600), 0.10)
})

test('regressiva sem tempo informado assume o pior caso', () => {
  assert.equal(regressiveRate(undefined), 0.35)
  assert.equal(regressiveRate(-5), 0.35)
})

test('tabela progressiva 2026 isenta a primeira faixa e aplica dedução nas demais', () => {
  assert.equal(progressiveTableTaxAmount(2428.80), 0)
  assert.ok(Math.abs(progressiveTableTaxAmount(2500) - (2500 * 0.075 - 182.16)) < 0.01)
  assert.ok(Math.abs(progressiveTableTaxAmount(10000) - (10000 * 0.275 - 908.73)) < 0.01)
})

test('redutor da Lei 15.270 zera o imposto até R$ 5.000', () => {
  assert.equal(progressiveTaxAmount(0), 0)
  assert.equal(progressiveTaxAmount(3000), 0)
  assert.equal(progressiveTaxAmount(5000), 0)
})

test('redutor decresce linearmente entre R$ 5.000 e R$ 7.350 e some acima', () => {
  const amount = 6000
  const base = amount - 607.20
  const expected = base * 0.275 - 908.73 - (978.62 - 0.133145 * amount)
  assert.ok(Math.abs(progressiveTaxAmount(amount) - expected) < 0.01)
  assert.ok(Math.abs(progressiveTaxAmount(8000) - ((8000 - 607.20) * 0.275 - 908.73)) < 0.01)
  assert.ok(progressiveTaxAmount(5000.01) < 1)
})

test('progressiva nunca resulta em imposto negativo perto da transição de faixa', () => {
  assert.ok(progressiveTaxAmount(2428.81) >= 0)
  assert.ok(progressiveTableTaxAmount(2428.81) >= 0)
})

test('withdrawalTaxAmount despacha por regime e ignora valores não positivos', () => {
  assert.equal(withdrawalTaxAmount(0, 'regressive', { monthsHeld: 0 }), 0)
  assert.equal(withdrawalTaxAmount(-100, 'manual', { manualRate: 0.5 }), 0)
  assert.equal(withdrawalTaxAmount(1000, 'none'), 0)
  assert.equal(withdrawalTaxAmount(1000, 'manual', { manualRate: 0.2 }), 200)
  assert.equal(withdrawalTaxAmount(12000, 'regressive', { monthsHeld: 200 }), 1200)
})

test('withdrawalTaxAmount progressiva distribui o valor anual em 12 parcelas mensais', () => {
  const annual = 60000
  const expected = progressiveTaxAmount(annual / 12) * 12
  assert.equal(withdrawalTaxAmount(annual, 'progressive'), expected)
})

test('manualRate é limitada entre 0 e 1 mesmo com entrada fora de faixa', () => {
  assert.equal(withdrawalTaxAmount(1000, 'manual', { manualRate: 5 }), 1000)
  assert.equal(withdrawalTaxAmount(1000, 'manual', { manualRate: -1 }), 0)
})
