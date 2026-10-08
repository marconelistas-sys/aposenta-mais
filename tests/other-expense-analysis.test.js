import test from 'node:test'
import assert from 'node:assert/strict'
import { otherExpenseAnalysis } from '../src/domain/other-expense-analysis.js'
import { budgetExpenseDistribution } from '../src/domain/budget-expense-distribution.js'
import { renderOtherExpenseAnalysis } from '../src/shared/budget-expense-pies.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'

const entry = (id, description, amount, patch = {}) => ({ id, type: 'expense', categoryId: 'other-expense', description, amount, currency: 'BRL', month: '2026-08', frequency: 'occasional', ...patch })
const categories = (actual, planned = []) => [{ categoryId: 'other-expense', category: 'Outras despesas', entries: { actual, planned }, actual: actual.reduce((sum, item) => sum + item.amount, 0), planned: planned.reduce((sum, item) => sum + item.amount, 0) }]

test('suggests expense types, groups fees and recurring descriptions, preserves source categories and totals', () => {
  const source = categories([entry('sbb', 'SBB CFF FFS', 100), entry('netflix', 'Netflix', 50), entry('fee', 'Anuidade cartão', 25), entry('a', 'Fornecedor desconhecido 123', 10), entry('b', 'Fornecedor desconhecido 456', 15)], [entry('plan', 'Netflix', 60)])
  const original = structuredClone(source)
  const groups = otherExpenseAnalysis(source)
  assert.equal(groups.find(group => group.category.includes('Transporte')).actual, 100)
  assert.equal(groups.find(group => group.category.includes('Assinaturas')).actual, 50)
  assert.equal(groups.find(group => group.category.includes('Assinaturas')).planned, 60)
  assert.equal(groups.find(group => group.category === 'Tarifas e anuidade').actual, 25)
  assert.equal(groups.find(group => group.category.includes('fornecedor')).entries.actual.length, 2)
  assert.equal(groups.reduce((sum, group) => sum + group.actual, 0), 200)
  assert.deepEqual(source, original)
})

test('trusted corrections and custom categories inform suggestions, current Other expense labels do not suppress them', () => {
  const existingItems = [entry('other', 'SBB', 100, { categoryOrigin: 'confirmed' }), entry('known', 'Fornecedor Especial', 90, { categoryId: 'custom', categoryOrigin: 'confirmed' })]
  const customCategories = [{ id: 'custom', name: 'Meu grupo', type: 'expense' }]
  const groups = otherExpenseAnalysis(categories([entry('a', 'SBB', 10), entry('b', 'Fornecedor Especial', 20)]), { existingItems, customCategories })
  assert.ok(groups.some(group => group.category === 'Transporte (sugestão)'))
  assert.ok(groups.some(group => group.category === 'Meu grupo (sugestão)'))
})

test('ambiguous descriptions remain description groups and small slices retain every entry in the chart', () => {
  const source = categories([entry('ambiguous', 'Amazon Prim', 1), ...Array.from({ length: 10 }, (_, i) => entry(`id${i}`, `Fornecedor ${String.fromCharCode(65 + i).repeat(8)}`, 10 + i))])
  const groups = otherExpenseAnalysis(source)
  assert.ok(groups.find(group => group.entries.actual.some(item => item.id === 'ambiguous')).category.startsWith('Descrição:'))
  const model = budgetExpenseDistribution(groups).actual
  assert.equal(model.segments.length, 6)
  assert.equal(model.total, source[0].actual)
  assert.equal(model.segments.flatMap(segment => segment.categoryIds).length, groups.length)
  assert.ok(Math.abs(model.segments.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-9)
})

test('uses only included Other expenses in the selected month, converted amounts and annual proportions', () => {
  const source = [entry('foreign', 'SBB', 10, { startDate: '2026-08-01', recordKind: 'actual', currency: 'CHF' }), entry('future', 'Netflix', 100, { recordKind: 'actual', startDate: '2026-09-01' }), entry('transfer', 'Transferência', 100, { recordKind: 'actual', startDate: '2026-08-01', statementInternalTransfer: true }), entry('income', 'Salário', 100, { type: 'income', categoryId: 'salary', recordKind: 'actual', startDate: '2026-08-01' }), entry('annual', 'Netflix', 120, { recordKind: 'planned', frequency: 'annual' })]
  const state = { currency: 'BRL', customCategories: [], exchangeRates: { rates: { EUR: 1, BRL: 5, CHF: 1, USD: 1 } }, cashFlow: { ...defaultCashFlow, items: source, annualGoals: [], consortia: [], commitments: [] } }
  const groups = otherExpenseAnalysis(budgetExpenseCategories(buildMonthlyBudget(state, '2026-08')).categories)
  assert.equal(groups.reduce((sum, group) => sum + group.actual, 0), 50)
  assert.equal(groups.reduce((sum, group) => sum + group.planned, 0), 10)
})

test('renderer explains denominators, links to full editing, escapes descriptions and respects privacy', () => {
  const entries = [entry('script', '<script>alert(1)</script>', 25), entry('sbb', 'SBB', 75)]
  const source = categories(entries)
  const state = { currency: 'BRL', valuesHidden: false, cashFlow: { items: entries }, customCategories: [] }
  const html = renderOtherExpenseAnalysis(source, state)
  assert.match(html, /Analisar Outras despesas/)
  assert.match(html, /100% de Outras despesas realizadas/)
  assert.match(html, /75%/)
  assert.match(html, /data-edit-budget-category="item"/)
  assert.match(html, /data-category-item-id="sbb"/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.equal(renderOtherExpenseAnalysis(source, { ...state, valuesHidden: true }), '')
  assert.equal(renderOtherExpenseAnalysis([], state), '')
})
