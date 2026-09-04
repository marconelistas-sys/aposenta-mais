import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateCashFlow, validateCashFlow } from '../src/domain/cash-flow.js'

const input = {
  recurringIncome: 10000,
  occasionalIncome: 4000,
  essentialExpenses: 4000,
  variableExpenses: 1500,
  debtPayments: 500,
  annualExpenses: 12000,
  currentEmergencyReserve: 6000,
  emergencyReserveTarget: 18000,
  reserveBuildMonths: 12
}

test('calcula provisão anual, saldo recorrente e indicadores', () => {
  const result = calculateCashFlow(input, 2500)

  assert.equal(result.monthlyAnnualProvision, 1000)
  assert.equal(result.recurringOutflows, 7000)
  assert.equal(result.recurringSurplus, 3000)
  assert.equal(result.savingsRate, 0.3)
  assert.equal(result.commitmentRate, 0.7)
})

test('não usa receita eventual no aporte sustentável', () => {
  const withOccasional = calculateCashFlow(input, 2500)
  const withoutOccasional = calculateCashFlow({ ...input, occasionalIncome: 0 }, 2500)

  assert.equal(withOccasional.sustainableContribution, withoutOccasional.sustainableContribution)
  assert.equal(withOccasional.sustainableContribution, 2000)
})

test('reserva completa libera todo o saldo para o aporte', () => {
  const result = calculateCashFlow({
    ...input,
    currentEmergencyReserve: input.emergencyReserveTarget
  }, 2500)

  assert.equal(result.reserveMonthlyAllocation, 0)
  assert.equal(result.sustainableContribution, 3000)
  assert.equal(result.contributionGap, -500)
})

test('déficit mensal nunca gera aporte sustentável negativo', () => {
  const result = calculateCashFlow({ ...input, recurringIncome: 5000 }, 2500)

  assert.equal(result.recurringSurplus, -2000)
  assert.equal(result.sustainableContribution, 0)
  assert.equal(result.isDeficit, true)
})

test('aporte atual não é descontado como despesa', () => {
  const result = calculateCashFlow(input, 1570)

  assert.equal(result.recurringOutflows, 7000)
  assert.equal(result.sustainableContribution, 2000)
})

test('renda zero mantém taxas finitas e valida entradas', () => {
  const result = calculateCashFlow({
    ...input,
    recurringIncome: 0,
    essentialExpenses: 0,
    variableExpenses: 0,
    debtPayments: 0,
    annualExpenses: 0
  })

  assert.equal(result.savingsRate, 0)
  assert.equal(result.commitmentRate, 0)
  assert.throws(() => validateCashFlow({ ...input, reserveBuildMonths: 0 }), RangeError)
  assert.throws(() => validateCashFlow({ ...input, essentialExpenses: -1 }), RangeError)
})
