import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateMultiCurrencyCashFlow, comparePlannedAndActualCashFlow } from '../src/domain/cash-flow.js'
import { retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { sanitizeCashFlow, sanitizeCustomCategories } from '../src/app/state-storage.js'

const rates = {
  date: '2026-09-03',
  stale: false,
  rates: { EUR: 1, BRL: 6, USD: 1.2, CHF: 0.9 }
}

test('consolida receitas e despesas de moedas distintas na moeda da visão geral', () => {
  const cashFlow = sanitizeCashFlow({
    currentEmergencyReserve: 0,
    emergencyReserveTarget: 0,
    reserveBuildMonths: 12,
    items: [
      { id: 'salary', type: 'income', categoryId: 'salary', amount: 1000, currency: 'EUR', frequency: 'monthly' },
      { id: 'rent', type: 'expense', categoryId: 'housing', amount: 100, currency: 'USD', frequency: 'monthly' },
      { id: 'tax', type: 'expense', categoryId: 'taxes', amount: 900, currency: 'CHF', frequency: 'annual' },
      { id: 'refund', type: 'income', categoryId: 'refund', amount: 60, currency: 'BRL', frequency: 'occasional' }
    ]
  })

  const result = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates)

  assert.equal(result.summary.recurringIncome, 6000)
  assert.ok(Math.abs(result.summary.essentialExpenses - 500) < 1e-9)
  assert.equal(result.summary.annualExpenses, 6000)
  assert.equal(result.monthlyExpenses, 1000)
  assert.equal(result.recurringSurplus, 5000)
  assert.equal(result.sustainableContribution, 5000)
  assert.equal(result.convertedItems.length, 4)
})

test('categoria personalizada entra no orçamento com grupo conservador', () => {
  const categories = sanitizeCustomCategories([
    { id: 'custom-pets', name: 'Animais', type: 'expense' }
  ])
  const cashFlow = sanitizeCashFlow({
    currentEmergencyReserve: 0,
    emergencyReserveTarget: 0,
    reserveBuildMonths: 12,
    items: [
      { id: 'pets', type: 'expense', categoryId: 'custom-pets', amount: 300, currency: 'BRL', frequency: 'monthly' }
    ]
  }, 'BRL', categories)

  const result = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates, 0, categories)

  assert.equal(result.summary.variableExpenses, 300)
  assert.equal(result.convertedItems[0].category.name, 'Animais')
})

test('lançamento com categoria incompatível é descartado na importação', () => {
  const cashFlow = sanitizeCashFlow({
    items: [{ id: 'bad', type: 'income', categoryId: 'housing', amount: 500, currency: 'BRL', frequency: 'monthly' }]
  })

  assert.equal(cashFlow.items.length, 0)
})

test('respeita início e fim dos lançamentos no orçamento mensal', () => {
  const cashFlow = sanitizeCashFlow({
    currentEmergencyReserve: 0,
    emergencyReserveTarget: 0,
    reserveBuildMonths: 12,
    items: [
      { id: 'active', type: 'income', categoryId: 'salary', amount: 5000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2026-12-31' },
      { id: 'future', type: 'income', categoryId: 'salary', amount: 9000, currency: 'BRL', frequency: 'monthly', startDate: '2027-01-01' },
      { id: 'old', type: 'expense', categoryId: 'housing', amount: 2000, currency: 'BRL', frequency: 'monthly', endDate: '2025-12-31' }
    ]
  })

  const result = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates, 0, [], new Date('2026-09-04T12:00:00Z'))

  assert.equal(result.summary.recurringIncome, 5000)
  assert.equal(result.summary.essentialExpenses, 0)
  assert.equal(result.convertedItems.filter((item) => item.isActive).length, 1)
})

test('previdência entra como saída e gera agenda de aporte futuro', () => {
  const cashFlow = sanitizeCashFlow({
    currentEmergencyReserve: 0,
    emergencyReserveTarget: 0,
    reserveBuildMonths: 12,
    items: [
      { id: 'salary', type: 'income', categoryId: 'salary', amount: 5000, currency: 'BRL', frequency: 'monthly' },
      { id: 'pension', type: 'expense', categoryId: 'private-pension', amount: 500, currency: 'BRL', frequency: 'monthly', startDate: '2026-09-01', endDate: '2027-08-31' }
    ]
  })

  const result = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates, 0, [], new Date('2026-09-04T12:00:00Z'))
  const schedules = retirementContributionSchedules(cashFlow, 'BRL', rates)

  assert.equal(result.pensionContributions, 500)
  assert.equal(result.recurringOutflows, 500)
  assert.equal(result.sustainableContribution, 4500)
  assert.equal(schedules[0].amount, 500)
  assert.equal(schedules[0].endDate, '2027-08-31')
})

test('compara orçamento planejado e realizado no mês sem dupla contagem', () => {
  const cashFlow = sanitizeCashFlow({
    referenceMonth: '2026-09',
    currentEmergencyReserve: 0,
    emergencyReserveTarget: 0,
    reserveBuildMonths: 12,
    items: [
      { id: 'planned-income', type: 'income', categoryId: 'salary', amount: 5000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
      { id: 'planned-rent', type: 'expense', categoryId: 'housing', amount: 2000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
      { id: 'actual-income', type: 'income', categoryId: 'salary', amount: 5100, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-09-05' },
      { id: 'actual-rent', type: 'expense', categoryId: 'housing', amount: 2100, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-09-06' },
      { id: 'actual-other-month', type: 'expense', categoryId: 'groceries', amount: 900, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-08-10' }
    ]
  })
  const date = new Date('2026-09-15T12:00:00Z')

  const budget = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates, 0, [], date)
  const comparison = comparePlannedAndActualCashFlow(cashFlow, 'BRL', rates, [], date)

  assert.equal(budget.monthlyIncome, 5000)
  assert.equal(budget.monthlyExpenses, 2000)
  assert.deepEqual(comparison.planned, { income: 5000, expenses: 2000, balance: 3000 })
  assert.deepEqual(comparison.actual, { income: 5100, expenses: 2100, balance: 3000 })
  assert.equal(comparison.variance.balance, 0)
})
