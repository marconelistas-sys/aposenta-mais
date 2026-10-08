import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { monthlyBudgetComposition, renderMonthlyBudgetComposition } from '../src/features/cash-flow/monthly-budget-detail.js'

const item = (id, patch = {}) => ({ id, description: id, categoryId: 'housing', type: 'expense', amount: 100, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', ...patch })
const fixture = items => sanitizeStoredState({ currency: 'BRL', valuesHidden: false, cashFlow: { items, referenceMonth: '2026-08', annualGoals: [], commitments: [], consortia: [] } })
const sum = rows => rows.reduce((total, row) => total + row.amount, 0)

test('composição concilia receitas, despesas e saldo com a tabela, inclusive câmbio e provisão anual', () => {
  const state = fixture([item('salary', { categoryId: 'salary', type: 'income', amount: 500 }), item('rent', { amount: 700 }), item('annual', { frequency: 'annual', amount: 1200 }), item('foreign', { currency: 'CHF', amount: 10 }), item('actual', { recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-03', amount: 9000 }), item('undated', { frequency: 'occasional', amount: 8000 })])
  const before = structuredClone(state)
  const point = monthlyBudgetComposition(state, '2026-08')
  const table = cashFlowTimeline(state, '2026-08', 1)[0]
  assert.equal(point.income, table.income)
  assert.equal(point.expenses, table.expenses)
  assert.equal(point.balance, table.balance)
  assert.equal(sum(point.breakdown.income), point.income)
  assert.equal(sum([...point.breakdown.costs, ...point.breakdown.goals]), point.expenses)
  assert.equal(point.breakdown.costs.find(row => row.name === 'annual').amount, 100)
  const html = renderMonthlyBudgetComposition(state, '2026-08')
  assert.match(html, /superam as receitas/)
  assert.match(html, /Valor anual dividido por 12/)
  assert.match(html, /na moeda original/)
  assert.ok(html.indexOf('<strong>rent') < html.indexOf('<strong>annual'))
  assert.doesNotMatch(html, /<strong>actual|<strong>undated/)
  assert.deepEqual(state, before)
})

test('mês futuro respeita encerramento de receita e inclusão de despesa eventual', () => {
  const state = fixture([item('salary', { categoryId: 'salary', type: 'income', amount: 1000, endDate: '2026-08-31' }), item('repair', { frequency: 'occasional', startDate: '2026-09-10', amount: 300 })])
  const august = monthlyBudgetComposition(state, '2026-08')
  const september = monthlyBudgetComposition(state, '2026-09')
  assert.equal(august.income, 1000)
  assert.equal(august.expenses, 0)
  assert.equal(september.income, 0)
  assert.equal(september.balance, -300)
  assert.match(renderMonthlyBudgetComposition(state, '2026-09'), /Sem lançamentos previstos neste mês/)
})

test('previdência externa fica separada e financiada pelo caixa concilia com despesas', () => {
  const state = fixture([item('pension', { categoryId: 'private-pension', amount: 200 })])
  for (const pensionMode of ['external', 'cash-funded']) {
    state.plan.finappMethod.pensionMode = pensionMode
    const point = monthlyBudgetComposition(state, '2026-08')
    assert.equal(sum(point.breakdown.costs), point.expenses)
    assert.equal(point.pension, 200)
    assert.equal(point.expenses, pensionMode === 'external' ? 0 : 200)
  }
})

test('ocultação não revela dados e descrições são escapadas', () => {
  const state = fixture([item('expense', { description: '<img src=x onerror=alert(1)>' })])
  assert.match(renderMonthlyBudgetComposition(state, '2026-08'), /&lt;img/)
  state.valuesHidden = true
  assert.equal(renderMonthlyBudgetComposition(state, '2026-08'), '')
  assert.throws(() => monthlyBudgetComposition(state, '2026-13'))
})
