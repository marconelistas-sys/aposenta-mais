import test from 'node:test'
import assert from 'node:assert/strict'
import { planChecks } from '../src/domain/plan-checks.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
test('identifica lacunas, salário sem término e benefício não orçado sem modificar estado', () => {
  const state = sanitizeStoredState({ plan: { expectedMonthlyBenefit: 1000 }, cashFlow: { items: [{ id: 's', type: 'income', categoryId: 'salary', amount: 100, currency: 'BRL', frequency: 'monthly' }], retirementMonth: '2026-01' } })
  const before = JSON.stringify(state)
  const ids = planChecks(state).map(check => check.id)
  for (const id of ['missing-expense', 'salary-open', 'benefit-not-budgeted']) assert.ok(ids.includes(id))
  assert.ok(!ids.includes('dates-differ'))
  assert.equal(JSON.stringify(state), before)
})
test('verificações removem alerta corrigido e não contam realizados como renda prevista', () => {
  const state = sanitizeStoredState({ cashFlow: { items: [{ id: 's', type: 'income', categoryId: 'salary', amount: 100, currency: 'BRL', frequency: 'monthly', endDate: '2028-12-31' }] } })
  assert.ok(!planChecks(state).some(check => check.id === 'salary-open'))
  state.cashFlow.items[0].recordKind = 'actual'
  assert.ok(planChecks(state).some(check => check.id === 'missing-income'))
})
