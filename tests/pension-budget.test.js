import test from 'node:test'
import assert from 'node:assert/strict'
import { pensionOutsideBudget, cashFlowForBudget } from '../src/domain/pension-budget.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { comparePlannedAndActualCashFlow, retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { renderMonthTracking } from '../src/features/cash-flow/month-tracking.js'

const item = (id, categoryId, amount, patch = {}) => ({ id, description: id, categoryId, type: categoryId === 'salary' ? 'income' : 'expense', currency: 'BRL', amount, frequency: 'monthly', recordKind: 'planned', ...patch })
function fixture(mode = 'external') {
  return { plan: { finappMethod: { pensionMode: mode } }, currency: 'BRL', exchangeRates: bundledExchangeRates, customCategories: [], cashFlow: { ...defaultCashFlow, referenceMonth: '2026-08', annualGoals: [], commitments: [], consortia: [], items: [
    item('net-salary', 'salary', 4500), item('living', 'groceries', 3000), item('pension', 'private-pension', 500),
    item('net-actual', 'salary', 4500, { recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-01' }),
    item('pension-actual', 'private-pension', 500, { recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-01' })
  ] } }
}

test('payroll pensions do not reduce a net salary again in planned or actual budget', () => {
  const state = fixture(), original = structuredClone(state)
  const month = buildBudgetYear(state, 2026).months[7]
  assert.equal(month.planned.expenses, 3000)
  assert.equal(month.planned.balance, 1500)
  assert.equal(month.actual.expenses, 0)
  assert.equal(month.actual.balance, 4500)
  assert.ok(!budgetExpenseCategories(month).categories.some(row => row.categoryId === 'private-pension'))
  const comparison = comparePlannedAndActualCashFlow(cashFlowForBudget(state), state.currency, state.exchangeRates, [], new Date('2026-08-15'))
  assert.equal(comparison.planned.balance, month.planned.balance)
  assert.equal(comparison.actual.balance, month.actual.balance)
  assert.equal(retirementContributionSchedules(state.cashFlow, state.currency, state.exchangeRates)[0].amount, 500)
  assert.deepEqual(state, original)
  assert.match(renderMonthTracking(state), /desconto em folha ou origem externa fica fora/)
})

test('cash-funded pensions keep their existing effect and switching mode restores them', () => {
  const state = fixture('cash-funded')
  const month = buildBudgetYear(state, 2026).months[7]
  assert.equal(month.planned.expenses, 3500)
  assert.equal(month.planned.balance, 1000)
  assert.equal(month.actual.expenses, 500)
  assert.equal(month.actual.balance, 4000)
  assert.equal(cashFlowForBudget(state).items.length, state.cashFlow.items.length)
})

test('the external rule handles every recurrence, but does not exclude unrelated expenses or income', () => {
  const state = fixture()
  for (const frequency of ['monthly', 'annual', 'occasional']) assert.equal(pensionOutsideBudget(state, item('p', 'private-pension', 500, { frequency })), true)
  assert.equal(pensionOutsideBudget(state, item('g', 'groceries', 500)), false)
  assert.equal(pensionOutsideBudget(state, item('s', 'salary', 500)), false)
})
