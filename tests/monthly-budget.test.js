import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMonthlyBudget, buildBudgetMonths } from '../src/domain/monthly-budget.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { reconcileOwnTransfers } from '../src/domain/own-transfers.js'
import { renderMonthTracking } from '../src/features/cash-flow/month-tracking.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'

const item = (id, amount, patch = {}) => ({ id, description: id, categoryId: 'groceries', type: 'expense', currency: 'BRL', amount, frequency: 'monthly', recordKind: 'planned', ...patch })
const actual = (id, amount, patch = {}) => item(id, amount, { recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-04', ...patch })
function fixture(items = []) {
  return {
    currency: 'BRL', valuesHidden: false, customCategories: [],
    exchangeRates: { date: '2026-08-01', rates: { EUR: 1, BRL: 5, CHF: 1, USD: 1 } },
    plan: { finappMethod: { pensionMode: 'external', chfBrlRate: 10 } },
    cashFlow: { ...defaultCashFlow, referenceMonth: '2026-08', commitments: [], annualGoals: [], consortia: [], items }
  }
}

test('monthly summary, annual comparison and categories share operational currency instead of a projection scenario', () => {
  const state = fixture([item('foreign', 100, { currency: 'CHF' }), actual('paid', 90, { currency: 'CHF' })])
  const original = structuredClone(state)
  const month = buildMonthlyBudget(state)
  assert.equal(month.planned.expenses, 500)
  assert.equal(month.actual.expenses, 450)
  assert.equal(month.variance.expenses, 50)
  assert.deepEqual(month, buildBudgetYear(state, 2026).months[7])
  const categories = budgetExpenseCategories(month)
  assert.equal(categories.totals.planned, month.planned.expenses)
  assert.equal(categories.totals.actual, month.actual.expenses)
  assert.equal(cashFlowTimeline(state, '2026-08', 1)[0].expenses, 1000)
  assert.match(renderMonthTracking(state), /R\$\s*500,00/)
  assert.deepEqual(state, original)
})

test('partial actuals expose separate income and expense coverage without inventing receipts', () => {
  const state = fixture([item('net-salary', 4000, { type: 'income', categoryId: 'salary' }), item('food', 1000), actual('receipt', 300)])
  const month = buildMonthlyBudget(state)
  assert.deepEqual(month.records.actual, { count: 1, income: 0, expenses: 1, annual: 0, recurring: 0, undated: 0 })
  assert.equal(month.actual.balance, -300)
  assert.match(renderMonthTracking(state), /Nenhuma receita registrada/)
  assert.doesNotMatch(renderMonthTracking(state), /Diferença: registrado menos previsto/)
  assert.equal(month.convertedItems.find(entry => entry.id === 'receipt').plannedExpenseLink.id, 'food')
})

test('undated one-off planned and actual records stay available for correction but never enter monthly totals or coverage', () => {
  const state = fixture([
    item('annual', 1200, { frequency: 'annual' }),
    item('unplaced-plan', 700, { frequency: 'occasional' }),
    actual('unplaced-actual', 800, { startDate: '' }),
    actual('dated', 150)
  ])
  const month = buildMonthlyBudget(state)
  assert.equal(month.planned.expenses, 100)
  assert.equal(month.actual.expenses, 150)
  assert.deepEqual(month.excluded.undated.map(entry => entry.id), ['unplaced-plan', 'unplaced-actual'])
  assert.ok(month.excluded.undated.every(entry => !entry.isIncluded))
  assert.equal(month.records.planned.count, 1)
  assert.equal(month.records.actual.count, 1)
  const annual = buildBudgetYear(state, 2026).annual
  assert.equal(annual.planned.expenses, 1200)
  assert.equal(annual.actual.expenses, 150)
})

test('payroll pensions stay outside both sides for every frequency and reappear when paid from the budget', () => {
  const state = fixture([
    item('net-salary', 4500, { type: 'income', categoryId: 'salary' }), item('food', 3000),
    item('monthly-pension', 500, { categoryId: 'private-pension' }),
    item('annual-pension', 1200, { categoryId: 'private-pension', frequency: 'annual' }),
    item('once-pension', 200, { categoryId: 'private-pension', frequency: 'occasional', startDate: '2026-08-01' }),
    actual('paid-pension', 500, { categoryId: 'private-pension' })
  ])
  const outside = buildMonthlyBudget(state)
  assert.equal(outside.planned.balance, 1500)
  assert.equal(outside.actual.expenses, 0)
  assert.equal(outside.excluded.pension.length, 4)
  assert.ok(!budgetExpenseCategories(outside).categories.some(category => category.categoryId === 'private-pension'))
  state.plan.finappMethod.pensionMode = 'cash-funded'
  const inside = buildMonthlyBudget(state)
  assert.equal(inside.planned.expenses, 3800)
  assert.equal(inside.actual.expenses, 500)
  assert.equal(inside.excluded.pension.length, 0)
})

test('own transfers only contribute the explicit fee, preserving imported amounts', () => {
  const outgoing = actual('outgoing', 102, { statementAccount: 'A', imported: true, statementImportKey: 'reference:outgoing', currency: 'CHF', description: 'Wise transferência, fee CHF 2.00', statementDescription: 'Wise transferência, fee CHF 2.00' })
  const incoming = actual('incoming', 100, { type: 'income', categoryId: 'other-income', statementAccount: 'B', imported: true, statementImportKey: 'reference:incoming', currency: 'CHF', description: 'Wise', statementDescription: 'Wise' })
  const state = fixture(reconcileOwnTransfers([outgoing, incoming], ['A', 'B']))
  const month = buildMonthlyBudget(state)
  assert.equal(month.actual.income, 0)
  assert.equal(month.actual.expenses, 10)
  assert.equal(month.entries.actual.length, 1)
  assert.equal(month.entries.actual[0].description, 'Tarifa: Wise transferência, fee CHF 2.00')
  assert.equal(state.cashFlow.items[0].amount, 102)
  assert.equal(state.cashFlow.items[1].amount, 100)
})

test('generated provisions, calendar goals and consortium installments reconcile with categories and the annual history', () => {
  const state = fixture()
  state.cashFlow.annualGoals = [{ id: 'holiday', name: 'Férias', currency: 'BRL', amount: 1200, startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0, categoryId: 'travel' }]
  state.cashFlow.commitments = [{ id: 'purchase', name: 'Compra', kind: 'goal', amount: 500, saved: 100, currency: 'BRL', date: '2026-08-05', categoryId: 'shopping' }]
  state.cashFlow.consortia = [{ id: 'house', name: 'Casa', currency: 'BRL', referenceMonth: '2026-08', stage: 'pending', useType: 'asset', credit: 120000, principal: 120000, months: 120, administration: 18000, reserve: 2400, insurance: 30, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0, awardMonth: null, earlyMonth: null, lateMonth: null, useMonth: null }]
  const month = buildMonthlyBudget(state)
  assert.equal(month.planned.expenses, 1700)
  assert.equal(month.entries.planned.find(entry => entry.annualGoalId === 'holiday').amount, 100)
  assert.equal(month.entries.planned.find(entry => entry.commitmentId === 'purchase').amount, 400)
  assert.equal(month.entries.planned.find(entry => entry.consortiumId === 'house').amount, 1200)
  assert.equal(budgetExpenseCategories(month).totals.planned, month.planned.expenses)
  assert.deepEqual(month, buildBudgetYear(state, 2026).months[7])
})

test('month batches keep retirement boundaries and reject invalid periods', () => {
  const state = fixture([item('salary', 4000, { type: 'income', categoryId: 'salary', endMode: 'retirement' })])
  state.plan.retirementMonth = '2026-09'
  const months = buildBudgetMonths(state, ['2026-08', '2026-09'])
  assert.equal(months[0].planned.income, 4000)
  assert.equal(months[1].planned.income, 0)
  assert.throws(() => buildMonthlyBudget(state, '2026-13'), /Mês do orçamento inválido/)
})
