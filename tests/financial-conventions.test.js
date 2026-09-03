import test from 'node:test'
import assert from 'node:assert/strict'

import { projectRetirement } from '../src/domain/retirement.js'

const input = {
  currentAge: 40,
  retirementAge: 41,
  currentAssets: 100000,
  monthlyContribution: 0,
  annualRealReturn: 0.12,
  targetMonthlyIncome: 5000,
  expectedMonthlyBenefit: 2000,
  annualWithdrawalRate: 0.04
}

test('converte a taxa efetiva anual por equivalência composta', () => {
  const result = projectRetirement(input)
  assert.ok(Math.abs((1 + result.monthlyRate) ** 12 - 1.12) < 1e-12)
})

test('gera exatamente o mesmo resultado para as mesmas entradas', () => {
  assert.deepEqual(projectRetirement(input), projectRetirement(input))
})

test('mantém aporte postecipado quando o retorno é zero', () => {
  const result = projectRetirement({
    ...input,
    currentAssets: 0,
    monthlyContribution: 1000,
    annualRealReturn: 0
  })

  assert.equal(result.projectedAssets, 12000)
})

