import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { renderBudgetCategories, budgetCategoriesView, resetBudgetCategories } from '../src/features/cash-flow/budget-categories.js'
import { resetBudgetEntriesView } from '../src/features/cash-flow/budget-entries-view.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'

const item = (id, patch = {}) => ({ id, description: id, categoryId: 'groceries', type: 'expense', currency: 'BRL', amount: 100, frequency: 'monthly', recordKind: 'planned', ...patch })
function fixture() {
  return { currency: 'BRL', valuesHidden: false, exchangeRates: bundledExchangeRates, customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, referenceMonth: '2026-08', commitments: [], annualGoals: [], consortia: [], items: [
    item('food-planned'), item('food-actual', { amount: 150, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-03' }),
    item('rent', { categoryId: 'housing', amount: 500 }),
    item('unplanned', { categoryId: 'shopping', amount: 50, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-05' }),
    item('salary', { categoryId: 'salary', type: 'income', amount: 2000 })
  ] } }
}
test.beforeEach(resetBudgetCategories)

test('agrupa despesas e compara categorias presentes em apenas um dos registros', () => {
  const state = fixture(), before = structuredClone(state)
  const result = budgetExpenseCategories(buildBudgetYear(state, 2026).months[7])
  assert.equal(result.categories.length, 3)
  const food = result.categories.find(row => row.categoryId === 'groceries')
  assert.deepEqual([food.planned, food.actual, food.difference, food.differencePercent], [100, 150, 50, 0.5])
  const rent = result.categories.find(row => row.categoryId === 'housing')
  assert.equal(rent.difference, null)
  const shopping = result.categories.find(row => row.categoryId === 'shopping')
  assert.equal(shopping.unplanned, true)
  assert.equal(shopping.differencePercent, null)
  const html = renderBudgetCategories(state)
  assert.match(html, /data-plan-budget-category="shopping" data-plan-budget-month="2026-08"/)
  assert.doesNotMatch(html, /data-plan-budget-category="groceries"/)
  assert.deepEqual(result.totals, { planned: 600, actual: 200, plannedCount: 2, actualCount: 2 })
  assert.deepEqual(state, before)
})

test('totais anuais conciliam com categorias, rateio, câmbio e exclusão de investimentos', () => {
  const state = fixture()
  state.customCategories = [{ id: 'custom', name: 'Projeto', type: 'expense', budgetGroup: 'variable' }]
  state.cashFlow.items.push(item('yearly', { categoryId: 'custom', frequency: 'annual', amount: 1200 }), item('foreign', { categoryId: 'custom', currency: 'CHF', amount: 10 }), item('investment', { description: 'BB RF LP High', imported: true, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-01', amount: 10000 }))
  const model = buildBudgetYear(state, 2026), result = budgetExpenseCategories(model.annual)
  assert.ok(Math.abs(result.totals.planned - model.annual.planned.expenses) < 1e-8)
  assert.equal(result.totals.actual, model.annual.actual.expenses)
  assert.equal(result.categories.reduce((sum, row) => sum + row.actual, 0), 200)
  assert.ok(result.categories.find(row => row.categoryId === 'custom').planned > 1200)
  assert.equal(result.actualMonths, 1)
  budgetCategoriesView.month = 'all'
  assert.match(renderBudgetCategories(state), /despesas realizadas em 1 de 12 meses/)
})

test('respeita meses ativos e deixa explícitos dados ausentes e períodos vazios', () => {
  const state = fixture()
  state.cashFlow.items[0].endDate = '2026-07-31'
  const result = budgetExpenseCategories(buildBudgetYear(state, 2026).months[7])
  assert.equal(result.categories.find(row => row.categoryId === 'groceries').unplanned, true)
  const html = renderBudgetCategories(state)
  assert.match(html, /Sem planejamento/)
  assert.match(html, /Sem realizado/)
  assert.match(html, /Não calculado/)
  state.cashFlow.items = []
  assert.match(renderBudgetCategories(state), /Nenhuma despesa planejada ou realizada/)
})

test('oculta categorias, detalhes, totais e barras no modo privado e escapa descrições', () => {
  const state = fixture()
  state.cashFlow.items[1].description = '<img src=x onerror=alert(1)>'
  assert.match(renderBudgetCategories(state), /&lt;img src=x/)
  const hidden = renderBudgetCategories({ ...state, valuesHidden: true })
  assert.match(hidden, /Valores ocultos/)
  assert.doesNotMatch(hidden, /<table|width:|food-planned|Mercado e alimentação|img src|data-plan-budget-category/)
})

test('ordena por maior excesso por padrão e limpa seleção ao trocar a sessão', () => {
  assert.equal(budgetCategoriesView.sort, 'difference')
  const state = fixture()
  state.cashFlow.items[1].amount = 180
  const html = renderBudgetCategories(state)
  assert.match(html, /value="difference" selected>Maior excesso/ )
  const table = html.split('<tbody>')[1]
  assert.ok(table.indexOf('Mercado e alimentação') < table.indexOf('Compras'))
  assert.ok(table.indexOf('Compras') < table.indexOf('Moradia'))
  Object.assign(budgetCategoriesView, { year: 2020, month: 'all', sort: 'planned' })
  resetBudgetEntriesView()
  assert.deepEqual(budgetCategoriesView, { year: null, month: null, sort: 'difference' })
})
