import test from 'node:test'
import assert from 'node:assert/strict'
import { debtExtraFields, parseDebtExtraPayments, renderDebtDetails } from '../src/features/cash-flow/debt-details.js'

const debt = { name: 'Empréstimo <script>', kind: 'debt', amount: 1200, annualRate: 0, installments: 2, date: '2026-01-10', currency: 'EUR', monthlyFee: 5 }

test('debt details show balances, payoff, costs and expandable schedule in debt currency', () => {
  const html = renderDebtDetails(debt, { month: '2026-01', currency: 'BRL' })
  assert.match(html, /Saldo antes de 2026-01/)
  assert.match(html, /1\.200,00/)
  assert.match(html, /600,00/)
  assert.match(html, /2026-02 em 2 parcelas/)
  assert.match(html, /Tarifas previstas:.*10,00/)
  assert.match(html, /€/)
  assert.doesNotMatch(html, /R\$/)
  assert.match(html, /<details><summary>/)
  assert.match(html, /Extra incluído/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('hidden values never leak into summary or schedule markup', () => {
  const html = renderDebtDetails(debt, { month: '2026-01', valuesHidden: true })
  assert.match(html, /•••••/)
  assert.doesNotMatch(html, /1\.200|600,00|605,00|10,00|1200/)
})

test('non-debt items have no debt details', () => {
  assert.equal(renderDebtDetails({ kind: 'goal' }), '')
  assert.equal(renderDebtDetails(null), '')
})

test('extra fields default PRICE and zero fees and explain reduction of term', () => {
  const html = debtExtraFields()
  assert.match(html, /data-debt-extra/)
  assert.match(html, /value="price" selected/)
  assert.match(html, /name="monthlyFee"[^>]+step="0.01"[^>]+value="0"/)
  assert.match(html, /name="extraPayments"/)
  assert.match(html, /reduz o prazo/)
})

test('extra fields preserve SAC and escape attribute and textarea content', () => {
  const html = debtExtraFields({ amortization: 'sac', monthlyFee: '" autofocus', extraPayments: [{ month: '</textarea><script>', amount: 10 }] })
  assert.match(html, /value="sac" selected/)
  assert.match(html, /&quot; autofocus/)
  assert.match(html, /&lt;\/textarea&gt;&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('extra parser accepts decimal comma, decimal point and blank lines', () => {
  assert.deepEqual(parseDebtExtraPayments(' 2026-01;1500,50\r\n\n2026-03;20.25 '), [{ month: '2026-01', amount: 1500.5 }, { month: '2026-03', amount: 20.25 }])
  assert.deepEqual(parseDebtExtraPayments('  \n'), [])
})

test('extra parser rejects malformed values, ordering, duplicates and excessive rows', () => {
  for (const text of ['2026-13;10', '2026-01;0', '2026-01;-10', '2026-01;1.001', '2026-01;1.000,00', '2026-01;1e3', '2026-01;1000000001', '2026-01;10;20', '2026-02;10\n2026-01;10', '2026-01;10\n2026-01;20', Array(101).fill('2026-01;10').join('\n')]) assert.throws(() => parseDebtExtraPayments(text), RangeError)
  assert.throws(() => parseDebtExtraPayments(null), RangeError)
})
