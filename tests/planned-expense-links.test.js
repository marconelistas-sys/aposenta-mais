import test from 'node:test'
import assert from 'node:assert/strict'
import { state, resetState, setCurrency, updateCashFlow, addCashFlowItem, updateCashFlowItem, removeCashFlowItem } from '../src/app/state.js'
import { buildBudgetYear } from '../src/domain/budget-overview.js'
import { renderBudgetCategories } from '../src/features/cash-flow/budget-categories.js'
import { renderBudgetEntryResults } from '../src/features/cash-flow/cash-flow.js'

const expense = (id, patch = {}) => ({ id, description: 'Manutenção da casa', type: 'expense', categoryId: 'housing', currency: 'CHF', amount: 200, recordKind: 'planned', frequency: 'monthly', source: 'manual', ...patch })
const actual = (id, patch = {}) => expense(id, { recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-10', amount: 120, ...patch })
const month = () => buildBudgetYear(state, 2026).months[7]
test.beforeEach(() => {
  resetState()
  setCurrency('CHF')
  updateCashFlow({ referenceMonth: '2026-08', items: [], annualGoals: [], commitments: [], consortia: [] })
})

test('despesa cadastrada posteriormente vincula ao único planejamento e mantém valores separados', () => {
  updateCashFlow({ items: [expense('plan')] })
  addCashFlowItem(actual('new'))
  const stored = structuredClone(state.cashFlow.items)
  const result = month()
  assert.equal(result.entries.actual[0].plannedExpenseLink.id, 'plan')
  assert.equal(result.planned.expenses, 200)
  assert.equal(result.actual.expenses, 120)
  assert.deepEqual(state.cashFlow.items, stored)
  assert.match(renderBudgetCategories(state), /Vinculado automaticamente ao planejado: Manutenção da casa/)
  assert.match(renderBudgetEntryResults(), /data-planned-expense-link="plan"/)
})

test('vínculo funciona com ordem inversa, parcelas realizadas e descrição diferente', () => {
  updateCashFlow({ items: [actual('first', { description: 'Loja de materiais' }), actual('second', { amount: 350 }), expense('plan')] })
  assert.deepEqual(month().entries.actual.map(entry => entry.plannedExpenseLink.id), ['plan', 'plan'])
  assert.equal(month().actual.expenses, 470)
})

test('vários planejamentos exigem descrição igual e única, ignorando acentos e caixa', () => {
  updateCashFlow({ items: [expense('maintenance'), expense('rent', { description: 'Aluguel' }), actual('exact', { description: 'MANUTENCAO DA CASA' }), actual('ambiguous', { description: 'Materiais' })] })
  assert.equal(month().entries.actual[0].plannedExpenseLink.id, 'maintenance')
  assert.equal(month().entries.actual[1].plannedExpenseLinkStatus, 'ambiguous')
  assert.equal(month().entries.actual[1].plannedExpenseLink, undefined)
  updateCashFlow({ items: [...state.cashFlow.items, expense('duplicate')] })
  assert.equal(month().entries.actual[0].plannedExpenseLinkStatus, 'ambiguous')
})

test('outra moeda, titularidade, categoria e planejamentos fora da vigência não vinculam', () => {
  updateCashFlow({ items: [expense('future', { startDate: '2026-09-01' }), expense('past', { endDate: '2026-07-31' }), expense('other-currency', { currency: 'EUR' }), expense('other-owner', { householdOwner: 'spouse' }), expense('other-category', { categoryId: 'shopping' }), expense('undated', { frequency: 'occasional' }), actual('actual')] })
  assert.equal(month().entries.actual[0].plannedExpenseLinkStatus, 'unplanned')
})

test('edição de categoria ou remoção do planejamento desfaz vínculo e reclassificação o recalcula', () => {
  updateCashFlow({ items: [expense('plan'), actual('actual')] })
  assert.equal(month().entries.actual[0].plannedExpenseLink.id, 'plan')
  updateCashFlowItem('actual', { categoryId: 'shopping' })
  assert.equal(month().entries.actual[0].plannedExpenseLink, undefined)
  updateCashFlowItem('plan', { categoryId: 'shopping' })
  assert.equal(month().entries.actual[0].plannedExpenseLink.id, 'plan')
  removeCashFlowItem('plan')
  assert.equal(month().entries.actual[0].plannedExpenseLink, undefined)
})

test('vínculos são específicos do mês e incluem provisões anuais', () => {
  updateCashFlow({ items: [expense('once', { frequency: 'occasional', startDate: '2026-07-01' }), actual('actual')], annualGoals: [{ id: 'goal', name: 'Manutenção anual', amount: 2400, currency: 'CHF', categoryId: 'housing', startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0 }] })
  assert.equal(month().entries.actual[0].plannedExpenseLink.annualGoalId, 'goal')
  assert.equal(month().planned.expenses, 200)
})

test('realizados importados e derivados de contas usam o mesmo vínculo sem duplicar registros', () => {
  updateCashFlow({ items: [expense('plan'), actual('import', { source: 'txt', description: 'Materiais importados' }), actual('ledger:movement', { description: 'Movimento da conta' })] })
  assert.deepEqual(month().entries.actual.map(entry => entry.plannedExpenseLink.id), ['plan', 'plan'])
  assert.equal(state.cashFlow.items.length, 3)
})

test('transferências próprias não vinculam, mesmo com tarifa e categoria compatível', () => {
  updateCashFlow({ items: [expense('plan'), actual('transfer', { transferDecision: 'own', statementDescription: 'Transferência entre minhas contas, tarifa CHF 5' })] })
  assert.equal(month().entries.actual[0]?.plannedExpenseLink, undefined)
})
