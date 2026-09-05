import test from 'node:test'
import assert from 'node:assert/strict'

import {
  nominalToRealReturn,
  resolveInvestmentNominalReturn,
  resolveInvestmentRealReturn
} from '../src/domain/investment-returns.js'

const plan = { annualRealReturn: 0.05, annualInflation: 0.04 }

test('converte retorno nominal para retorno real por equivalência composta', () => {
  assert.ok(Math.abs(nominalToRealReturn(0.10, 0.04) - 0.0576923077) < 1e-9)
})

test('mantém o retorno real do plano como padrão dinâmico', () => {
  const investment = { returnType: 'default', returnValue: null }
  assert.equal(resolveInvestmentRealReturn(investment, plan), 0.05)
  assert.equal(resolveInvestmentRealReturn(investment, { ...plan, annualRealReturn: 0.03 }), 0.03)
})

test('converte percentual do CDI usando taxa e inflação informadas', () => {
  const investment = { returnType: 'cdi', returnValue: 1.1, indexAnnualRate: 0.12 }
  const nominal = resolveInvestmentNominalReturn(investment, plan)
  const real = resolveInvestmentRealReturn(investment, plan)

  assert.ok(Math.abs(nominal - 0.132) < 1e-12)
  assert.ok(Math.abs(real - ((1.132 / 1.04) - 1)) < 1e-12)
})

test('trata a taxa acima do IPCA como retorno real', () => {
  assert.equal(resolveInvestmentRealReturn({ returnType: 'ipca', returnValue: 0.06 }, plan), 0.06)
})
