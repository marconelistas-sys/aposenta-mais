import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMonthTracking } from '../src/features/cash-flow/month-tracking.js'
import { comparePlannedAndActualCashFlow } from '../src/domain/cash-flow.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'

const today = new Date('2026-09-15T12:00:00Z')
const entry = (id, type, amount, extra = {}) => ({ id, type, amount, currency: 'BRL', categoryId: type === 'income' ? 'salary' : 'housing', recordKind: 'planned', frequency: 'monthly', ...extra })
const actual = (id, type, amount, extra = {}) => entry(id, type, amount, { recordKind: 'actual', frequency: 'occasional', startDate: '2026-09-05', ...extra })
const source = (items = []) => ({ currency: 'BRL', valuesHidden: false, customCategories: [], exchangeRates: { rates: { EUR: 1, BRL: 6, USD: 1.2, CHF: .9 } }, cashFlow: sanitizeCashFlow({ referenceMonth: '2026-09', items }) })
const render = value => renderMonthTracking(value, { today })
const planned = [entry('salary', 'income', 5000), entry('rent', 'expense', 2000)]

test('no actual records gives a compact explanation rather than fictitious savings or a zero balance', () => {
  const value = source([...planned, actual('old', 'expense', 900, { startDate: '2026-08-05' })])
  const html = render(value)
  assert.match(html, /Nenhum realizado registrado para este mês/)
  assert.match(html, /não significa que você não gastou/)
  assert.doesNotMatch(html, /month-tracking-grid|Saldo dos registros|Diferença do saldo|R\$/)
  assert.match(html, /data-review-month-records="actual"/)
  const comparison = comparePlannedAndActualCashFlow(value.cashFlow, 'BRL', value.exchangeRates, [], today)
  assert.equal(comparison.records.actual.count, 0)
  assert.equal(comparison.records.planned.count, 2)
})

test('recorded overspending is visible on proportional bars with the exact variance', () => {
  const value = source([...planned, actual('paid', 'expense', 2500), actual('received', 'income', 5000)])
  const snapshot = structuredClone(value)
  const html = render(value)
  assert.match(html, /data-over="true"/)
  assert.match(html, /width:80.0000%/)
  assert.match(html, /Registrado <strong class="money-value">R\$\s*500,00<\/strong> acima do previsto/)
  assert.match(html, /O valor registrado coincide com o previsto/)
  assert.match(html, /Mês em andamento/)
  assert.match(html, /Diferença: registrado menos previsto/)
  assert.match(html, /Realizados não alteram automaticamente o plano futuro/)
  assert.deepEqual(value, snapshot)
})

test('partial records never label missing income as zero or lower spending as confirmed savings', () => {
  const html = render(source([...planned, actual('paid', 'expense', 500)]))
  assert.match(html, /R\$\s*1\.500,00<\/strong> abaixo do previsto/)
  assert.match(html, /lançamentos ainda não registrados/)
  assert.match(html, /Nenhuma receita registrada/)
  assert.match(html, />Sem registro<\/strong>/)
  assert.doesNotMatch(html, /Diferença: registrado menos previsto|data-over="true"|economizou|sobra disponível/)
})

test('missing plans and zero planned amounts do not generate an invalid percentage', () => {
  const noPlan = render(source([actual('paid', 'expense', 500)]))
  assert.match(noPlan, /Ainda falta cadastrar o planejado/)
  assert.match(noPlan, /Sem valor planejado para comparar/)
  const zero = render(source([entry('zero', 'expense', 0), actual('paid', 'expense', 500)]))
  assert.match(zero, /Sem valor planejado para comparar/)
  assert.doesNotMatch(noPlan + zero, /NaN|Infinity/)
})

test('record coverage follows currency conversion and monthly equivalent rules without changing totals', () => {
  const value = source([entry('annual', 'expense', 1200, { frequency: 'annual' }), actual('foreign', 'expense', 100, { currency: 'USD' }), actual('legacy', 'income', 1200, { frequency: 'annual' })])
  // New actuals are normalized to one occurrence. Exercise older in-memory data too.
  value.cashFlow.items.find(item => item.id === 'legacy').frequency = 'annual'
  const result = comparePlannedAndActualCashFlow(value.cashFlow, 'BRL', value.exchangeRates, [], today)
  assert.deepEqual(result.planned, { income: 0, expenses: 100, balance: -100 })
  assert.equal(result.actual.income, 100)
  assert.ok(Math.abs(result.actual.expenses - 500) < 1e-7)
  assert.ok(Math.abs(result.actual.balance + 400) < 1e-7)
  assert.equal(result.records.actual.count, 2)
  assert.equal(result.records.actual.annual, 1)
  const html = render(value)
  assert.match(html, /Há realizados recorrentes, anuais ou sem data inicial/)
  assert.match(html, /anuais divididos por 12/)
  assert.match(html, /Movimentos em Contas só entram aqui quando vinculados/)
})

test('hidden mode removes amounts, statuses, data-dependent counts and chart geometry', () => {
  const value = source([...planned, actual('secret', 'expense', 987654.32)])
  value.valuesHidden = true
  const html = render(value)
  assert.match(html, /Exiba os valores/)
  assert.doesNotMatch(html, /987|654|month-tracking-grid|data-over|width:|registro\(s\)|Mês em andamento|R\$/)
})

test('past and future periods do not claim that the month is fully reconciled', () => {
  const value = source([...planned, actual('paid', 'expense', 500)])
  assert.match(renderMonthTracking(value, { today: new Date('2026-10-01') }), /Os registros podem estar incompletos/)
  assert.match(renderMonthTracking(value, { today: new Date('2026-08-01') }), /Mês futuro. Confira as datas/)
  const compact = renderMonthTracking(value, { compact: true, today })
  assert.match(compact, /^<details class="panel disclosure month-tracking">/)
})
