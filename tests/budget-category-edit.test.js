import test from 'node:test'
import assert from 'node:assert/strict'
import { state, resetState, updateCashFlow } from '../src/app/state.js'
import { sanitizeCashFlowItem } from '../src/app/state-storage.js'
import { linkMovementBudget } from '../src/app/accounts.js'
import { saveBudgetCategory } from '../src/app/budget-category-edit.js'
import { buildBudgetYear } from '../src/domain/budget-overview.js'
import { renderBudgetCategories } from '../src/features/cash-flow/budget-categories.js'

test.beforeEach(resetState)
const expense = { id: 'imported', description: 'Loja exemplo', amount: 125, currency: 'CHF', categoryId: 'groceries', type: 'expense', frequency: 'occasional', recordKind: 'actual', source: 'txt', imported: true, startDate: '2026-08-03', categoryOrigin: 'automatic', categoryMerchantKey: 'loja exemplo', statementReference: 'tx-001', statementAccount: 'test-account' }

test('corrigir categoria de importado preserva dados financeiros, referências e origem e recalcula os grupos', () => {
  updateCashFlow({ referenceMonth: '2026-08', items: [sanitizeCashFlowItem(expense, 0, [], state.currency)], annualGoals: [], commitments: [], consortia: [] })
  const before = structuredClone(state.cashFlow.items[0])
  saveBudgetCategory('item', expense.id, 'shopping')
  const after = structuredClone(state.cashFlow.items[0])
  assert.equal(after.categoryId, 'shopping')
  assert.equal(after.categoryOrigin, 'confirmed')
  delete before.categoryId; delete before.categoryOrigin
  delete after.categoryId; delete after.categoryOrigin
  assert.deepEqual(after, before)
  assert.equal(buildBudgetYear(state, 2026).months[7].entries.actual[0].categoryId, 'shopping')
  assert.match(renderBudgetCategories(state), /data-edit-budget-category="item"/)
})

test('corrigir despesas derivadas altera cadastro de origem e mantém o valor da provisão e do compromisso', () => {
  updateCashFlow({ referenceMonth: '2026-08', items: [], consortia: [], annualGoals: [{ id: 'goal', name: 'Viagem', amount: 1200, currency: 'BRL', startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0, categoryId: 'groceries' }], commitments: [{ id: 'commitment', name: 'Compra', kind: 'goal', amount: 500, saved: 0, currency: 'BRL', date: '2026-08-10', categoryId: 'groceries' }] })
  const before = buildBudgetYear(state, 2026).annual.planned.expenses
  saveBudgetCategory('annualGoals', 'goal', 'travel')
  saveBudgetCategory('commitments', 'commitment', 'shopping')
  const model = buildBudgetYear(state, 2026)
  assert.equal(model.annual.planned.expenses, before)
  assert.ok(model.months.every(month => month.entries.planned.find(entry => entry.annualGoalId === 'goal')?.categoryId === 'travel'))
  assert.equal(model.months[7].entries.planned.find(entry => entry.commitmentId === 'commitment').categoryId, 'shopping')
  assert.match(renderBudgetCategories(state), /data-edit-budget-category="annualGoals"/)
  assert.match(renderBudgetCategories(state), /data-edit-budget-category="commitments"/)
})

test('correção de realizado vinculado salva a categoria no movimento em Contas', () => {
  updateCashFlow({ referenceMonth: '2026-08', items: [], annualGoals: [], commitments: [], consortia: [], ledger: { accounts: [{ id: 'account', name: 'Conta', currency: 'CHF', openingDate: '2026-01-01', openingBalance: 1000 }], movements: [{ id: 'movement', accountId: 'account', type: 'expense', date: '2026-08-03', amount: 125, budgetCategoryId: 'groceries' }] } })
  const data = new FormData()
  data.set('movementId', 'movement')
  data.set('categoryId', 'groceries')
  linkMovementBudget(data)
  saveBudgetCategory('item', 'ledger:movement', 'shopping')
  assert.equal(state.cashFlow.ledger.movements[0].budgetCategoryId, 'shopping')
  assert.equal(state.cashFlow.items.find(item => item.id === 'ledger:movement').categoryId, 'shopping')
  assert.equal(state.cashFlow.ledger.movements[0].amount, 125)
})

test('categoria incompatível e lançamentos ausentes não alteram o orçamento', () => {
  updateCashFlow({ items: [sanitizeCashFlowItem(expense, 0, [], state.currency)] })
  const before = structuredClone(state.cashFlow)
  assert.throws(() => saveBudgetCategory('item', 'imported', 'salary'), /categoria de despesa/)
  assert.throws(() => saveBudgetCategory('item', 'missing', 'shopping'), /não encontrada/)
  assert.deepEqual(state.cashFlow, before)
})
