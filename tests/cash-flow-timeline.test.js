import test from 'node:test'
import assert from 'node:assert/strict'
import { cashFlowTimeline, lastIncomeDate, retirementMonth } from '../src/domain/cash-flow-timeline.js'
import { sanitizeStoredState, sanitizeCashFlowItem } from '../src/app/state-storage.js'

const income = { id: 'salary', type: 'income', categoryId: 'salary', amount: 5000, currency: 'BRL', frequency: 'monthly', startDate: '2026-12-20', endDate: '2027-01-02' }
const expense = { id: 'expense', type: 'expense', categoryId: 'housing', amount: 12000, currency: 'BRL', frequency: 'annual' }
const fixture = items => sanitizeStoredState({ currency: 'BRL', cashFlow: { items } })

test('inclui competências limítrofes, encerra salário e mantém despesa provisionada', () => {
  const state = fixture([income, expense])
  const original = JSON.stringify(state)
  const rows = cashFlowTimeline(state, '2026-12', 3)
  assert.deepEqual(rows.map(row => row.income), [5000, 5000, 0])
  assert.deepEqual(rows.map(row => row.balance), [4000, 4000, -1000])
  assert.equal(rows[2].month, '2027-02')
  assert.equal(cashFlowTimeline(state, '2026-01', 12).reduce((sum, row) => sum + row.expenses, 0), 12000)
  assert.equal(JSON.stringify(state), original)
})

test('eventual entra uma vez e realizados não entram na previsão', () => {
  const state = fixture([
    { ...income, frequency: 'occasional', startDate: '2026-12-25', endDate: null },
    { ...income, id: 'undated', frequency: 'occasional', startDate: null, endDate: null },
    { ...income, id: 'actual', recordKind: 'actual' }
  ])
  assert.deepEqual(cashFlowTimeline(state, '2026-12', 2).map(row => row.income), [5000, 0])
})

test('fim sugerido antecede aposentadoria, inclusive ano bissexto, e independe do mês visualizado', () => {
  const plan = { currentAge: 40, retirementAge: 42 }
  const today = new Date('2026-03-20T12:00:00Z')
  assert.equal(retirementMonth(plan, today), '2028-03')
  assert.equal(lastIncomeDate(plan, today), '2028-02-29')
  const state = fixture([{ ...income, startDate: null, endDate: lastIncomeDate(plan, today) }])
  assert.deepEqual(cashFlowTimeline(state, '2028-02', 2).map(row => row.income), [5000, 0])
  assert.equal(cashFlowTimeline(state, '2028-03', 1)[0].income, 0)
  assert.throws(() => cashFlowTimeline(state, '2026-13', 12))
  assert.throws(() => cashFlowTimeline(state, '2026-01', 1201))
  assert.equal(sanitizeCashFlowItem({ ...income, startDate: '2026-02-30' }).startDate, null)
})

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const { state } = await import('../src/app/state.js')
const { renderCashFlowTimeline } = await import('../src/features/cash-flow/timeline.js')
const { renderDashboard } = await import('../src/features/dashboard/dashboard.js')

test('guia oferece sequência e ocultação remove gráfico e valores da série', () => {
  assert.match(renderDashboard(), /Comece aqui/)
  state.valuesHidden = true
  const html = renderCashFlowTimeline()
  assert.doesNotMatch(html, /<svg/)
  assert.match(html, /•••••/)
  assert.match(html, /não saldo bancário/)
})
