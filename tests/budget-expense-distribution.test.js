import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetExpenseDistribution } from '../src/domain/budget-expense-distribution.js'
import { expenseCategoryColor, renderBudgetExpensePies } from '../src/shared/budget-expense-pies.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'

const categories = [{ categoryId: 'housing', category: 'Moradia', planned: 1000, actual: 600 }, { categoryId: 'groceries', category: 'Mercado', planned: 500, actual: 800 }, { categoryId: 'shopping', category: 'Compras', planned: 0, actual: 100 }]
const state = { currency: 'BRL', valuesHidden: false }
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8)

test('percentuais usam denominadores separados e categorias sem planejamento entram no realizado', () => {
  const before = structuredClone(categories)
  const model = budgetExpenseDistribution(categories)
  assert.equal(model.planned.total, 1500)
  assert.equal(model.actual.total, 1500)
  assert.equal(model.planned.segments.length, 2)
  assert.equal(model.actual.segments[0].key, 'groceries')
  close(model.planned.segments.find(row => row.key === 'housing').share, 2 / 3)
  close(model.actual.segments.find(row => row.key === 'housing').share, .4)
  assert.ok(model.actual.segments.some(row => row.key === 'shopping'))
  assert.deepEqual(categories, before)
})

test('até seis fatias, agrupamento conserva os totais e a seleção das classes principais é compartilhada', () => {
  const source = Array.from({ length: 12 }, (_, index) => ({ categoryId: `category-${index}`, category: `Categoria ${index}`, planned: 12 - index, actual: index * 2 }))
  const model = budgetExpenseDistribution(source)
  for (const kind of ['planned', 'actual']) {
    assert.equal(model[kind].segments.length, 6)
    close(model[kind].segments.reduce((sum, row) => sum + row.amount, 0), source.reduce((sum, row) => sum + row[kind], 0))
    close(model[kind].segments.reduce((sum, row) => sum + row.share, 0), 1)
    assert.equal(model[kind].segments.find(row => row.key === '__remaining').categoryIds.length, kind === 'planned' ? 7 : 6)
  }
  assert.deepEqual(model.planned.segments.filter(row => row.key !== '__remaining').map(row => row.key).sort(), model.actual.segments.filter(row => row.key !== '__remaining').map(row => row.key).sort())
  assert.equal(budgetExpenseDistribution(source.slice(0, 6)).planned.segments.some(row => row.key === '__remaining'), false)
})

test('nenhum realizado tem estado vazio e privacidade não revela distribuição, valores ou percentuais', () => {
  const html = renderBudgetExpensePies(categories.map(row => ({ ...row, actual: 0 })), state, 'agosto de 2026')
  assert.match(html, /Nenhuma despesa realizada registrada/)
  assert.match(html, /ausência de registros não confirma ausência de gastos/)
  assert.equal((html.match(/<svg/g) || []).length, 1)
  assert.equal(renderBudgetExpensePies(categories, { ...state, valuesHidden: true }, 'agosto de 2026'), '')
})

test('cores independem da ordem e textos são escapados, inclusive em atributos do agrupamento', () => {
  assert.equal(expenseCategoryColor('housing'), expenseCategoryColor([...categories].reverse()[2].categoryId))
  const html = renderBudgetExpensePies([{ categoryId: 'custom', category: '<script>', planned: .01, actual: 0 }, { categoryId: 'housing', category: 'Moradia', planned: 1000, actual: 0 }], state, '<img>')
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img&gt;/)
  assert.match(html, /Menos de 0,1%/)
  assert.doesNotMatch(html, /<script>|<img>/)
})

test('pizzas conciliam com a tabela usando vigência, câmbio, valores anuais e exclusão de receitas', () => {
  const value = sanitizeStoredState({ currency: 'BRL', valuesHidden: false, cashFlow: { referenceMonth: '2026-08', annualGoals: [], commitments: [], consortia: [], items: [
    { id: 'rent', categoryId: 'housing', description: 'Aluguel', type: 'expense', amount: 1200, currency: 'BRL', frequency: 'annual', recordKind: 'planned' },
    { id: 'actual', categoryId: 'shopping', description: 'Compra', type: 'expense', amount: 10, currency: 'CHF', frequency: 'occasional', startDate: '2026-08-10', recordKind: 'actual' },
    { id: 'income', categoryId: 'salary', description: 'Salário', type: 'income', amount: 5000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'future', categoryId: 'housing', type: 'expense', amount: 600, currency: 'BRL', frequency: 'occasional', startDate: '2026-09-10', recordKind: 'planned' }
  ] } })
  const { categories, totals } = budgetExpenseCategories(buildBudgetYear(value, 2026).months[7])
  const model = budgetExpenseDistribution(categories)
  assert.equal(model.planned.total, 100)
  close(model.planned.total, totals.planned)
  close(model.actual.total, totals.actual)
  assert.equal(model.actual.segments[0].share, 1)
})

test('detalhamento ajustável conserva valores e abre todas as categorias no máximo', () => {
  const source = Array.from({ length: 9 }, (_, index) => ({ categoryId: `detail-${index}`, category: `Categoria ${index}`, planned: 10 + index, actual: 100 - index }))
  const before = structuredClone(source)
  for (const count of [1, 3, 5, 9, 100]) {
    const model = budgetExpenseDistribution(source, count)
    for (const kind of ['planned', 'actual']) {
      assert.equal(model[kind].segments.length, count >= 9 ? 9 : count + 1)
      close(model[kind].total, source.reduce((sum, row) => sum + row[kind], 0))
      close(model[kind].segments.reduce((sum, row) => sum + row.amount, 0), model[kind].total)
      close(model[kind].segments.reduce((sum, row) => sum + row.share, 0), 1)
      const remaining = model[kind].segments.find(row => row.key === '__remaining')
      if (count < 9) assert.equal(remaining.categoryIds.length, 9 - count)
      else assert.equal(remaining, undefined)
    }
    assert.deepEqual(model.planned.segments.map(row => row.key).sort(), model.actual.segments.map(row => row.key).sort())
  }
  assert.deepEqual(source, before)
})

test('controle usa limites válidos e não aparece quando não há categorias para agrupar', () => {
  const html = renderBudgetExpensePies(categories, state, 'agosto de 2026')
  assert.match(html, /type="range" min="1" max="3" step="1" value="3"/)
  assert.match(html, /Todas as 3 categorias individualmente/)
  assert.match(html, /aria-label="Quantidade de categorias individuais"/)
  assert.doesNotMatch(renderBudgetExpensePies(categories.slice(0, 1), state, 'agosto'), /data-budget-expense-detail aria-label/)
  assert.doesNotMatch(renderBudgetExpensePies([], state, 'agosto'), /data-budget-expense-detail aria-label/)
})
