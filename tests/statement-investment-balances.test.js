import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticBbText, bbInvestmentFixturePages } from '../scripts/fixtures/bb-pdf.mjs'
import { parseBbStatement } from '../src/domain/bb-statement.js'
import { previewInvestmentBalances } from '../src/domain/statement-investment-balances.js'
import { sanitizeInvestments } from '../src/app/state-storage.js'
import { renderStatementInvestmentReview } from '../src/shared/statement-investment-review.js'

const rates = { rates: { EUR: 1, BRL: 5, CHF: 1, USD: 1 } }
const options = { currency: 'BRL', exchangeRates: rates }
const holding = (patch = {}) => ({ id: 'holding', name: 'BB Rende Fácil', amount: 1000, currency: 'BRL', monthlyContribution: 10, assetClass: 'fixed-income', liquidity: 'available', returnType: 'default', balanceAsOf: '2025-12-31', ...patch })
const snapshot = (patch = {}) => ({ name: 'BB RENDE FACIL', amount: 2500, currency: 'BRL', asOfDate: '2026-01-31', sourceAccount: 'BB:1234-5:6789-0', ...patch })

test('reads individual holdings on the separate BB investment page and keeps movements separate', () => {
  const parsed = parseBbStatement(syntheticBbText(bbInvestmentFixturePages()))
  assert.deepEqual(parsed.investmentBalances.map(row => [row.name, row.amount, row.asOfDate]), [['BB RENDE FACIL', 2500, '2026-01-31'], ['RF LP High', 16000, '2026-01-31'], ['BB CDB DI *', 28000, '2026-01-31']])
  assert.equal(parsed.investmentBalances[0].sourceAccount, parsed.sourceAccount)
  assert.equal(parsed.internalTransferReferences.size, 4)
  assert.equal(parsed.text.split('\n').length, 14)
  assert.deepEqual(parseBbStatement(syntheticBbText()).investmentBalances, [])
  assert.throws(() => parseBbStatement(syntheticBbText(bbInvestmentFixturePages()).replace('2.500,00', 'ilegivel')), /Saldo de aplicação/)
})

test('updates only a uniquely matched newer balance, preserves investment settings and persists dates', () => {
  const investments = [holding({ annualFee: .01, statementAccount: 'BB:1234-5:6789-0' })]
  const original = structuredClone(investments)
  const result = previewInvestmentBalances([snapshot()], investments, options)
  assert.equal(result.updates.length, 1)
  assert.equal(result.investments[0].amount, 2500)
  assert.equal(result.investments[0].monthlyContribution, 10)
  assert.equal(result.investments[0].annualFee, .01)
  assert.equal(result.investments[0].liquidity, 'available')
  assert.equal(result.investments[0].balanceAsOf, '2026-01-31')
  assert.equal(result.investments[0].balanceSource, 'statement')
  assert.deepEqual(investments, original)
  const restored = sanitizeInvestments(JSON.parse(JSON.stringify(result.investments)))
  assert.equal(previewInvestmentBalances([snapshot()], restored, options).updates.length, 0)
  assert.equal(previewInvestmentBalances([snapshot({ asOfDate: '2025-12-30' })], restored, options).updates.length, 0)
})

test('unknown dates require explicit initialization, ambiguous names and different accounts or currencies are preserved', () => {
  assert.equal(previewInvestmentBalances([snapshot()], [holding({ balanceAsOf: undefined })], options).rows[0].status, 'undated')
  assert.equal(previewInvestmentBalances([snapshot()], [holding({ balanceAsOf: undefined })], { ...options, allowUndated: true }).updates.length, 1)
  assert.equal(previewInvestmentBalances([snapshot()], [holding(), holding({ id: 'duplicate' })], options).rows[0].status, 'ambiguous')
  for (const patch of [{ name: 'BB CDB DI' }, { currency: 'CHF' }, { statementAccount: 'BB:other' }]) assert.equal(previewInvestmentBalances([snapshot()], [holding(patch)], options).updates.length, 0)
  assert.equal(previewInvestmentBalances([snapshot(), snapshot({ sourceAccount: 'BB:other', asOfDate: '2026-02-28' })], [holding()], options).updates.length, 0)
})

test('a batch uses its latest snapshot regardless of order, repeated files do not duplicate balances and conflicts block updates', () => {
  const newer = snapshot({ asOfDate: '2026-02-28', amount: 3000 })
  for (const rows of [[snapshot(), newer, newer], [newer, snapshot(), newer]]) {
    const result = previewInvestmentBalances(rows, [holding()], options)
    assert.equal(result.rows.length, 2)
    assert.equal(result.updates.length, 1)
    assert.equal(result.investments[0].amount, 3000)
  }
  const conflict = previewInvestmentBalances([snapshot(), newer, { ...newer, amount: 4000 }], [holding()], options)
  assert.equal(conflict.updates.length, 0)
  assert.equal(conflict.investments[0].amount, 1000)
})

test('keeps native balances, converts totals and accepts exhausted zero balances', () => {
  const result = previewInvestmentBalances([snapshot({ amount: 500 })], [holding({ amount: 200, nativeAmount: 1000, nativeMonthlyContribution: 50, monthlyContribution: 10 })], { currency: 'EUR', exchangeRates: rates })
  assert.equal(result.investments[0].nativeAmount, 500)
  assert.equal(result.investments[0].amount, 100)
  assert.equal(result.investments[0].monthlyContribution, 10)
  const zero = sanitizeInvestments(previewInvestmentBalances([snapshot({ amount: 0 })], [holding()], options).investments)
  assert.equal(zero.length, 1)
  assert.equal(zero[0].amount, 0)
})

test('recognizes punctuation, bank prefixes and previously linked descriptions but does not guess unrelated holdings', () => {
  assert.equal(previewInvestmentBalances([snapshot({ name: 'RF LP High' })], [holding({ name: 'BB RF LP HIGH' })], options).updates.length, 1)
  assert.equal(previewInvestmentBalances([snapshot()], [holding({ name: 'Minha reserva', statementAccount: snapshot().sourceAccount, statementInvestmentName: snapshot().name })], options).updates.length, 1)
  assert.equal(previewInvestmentBalances([snapshot({ name: 'BB CDB DI *' })], [holding({ name: 'BB CDB DI' })], options).updates.length, 1)
})

test('review explains older and undated balances and hides amounts in privacy mode', () => {
  const rows = previewInvestmentBalances([snapshot()], [holding()], options).rows
  const html = renderStatementInvestmentReview(rows, { currency: 'BRL', valuesHidden: true })
  assert.match(html, /Aplicações Financeiras/)
  assert.match(html, /data-statement-investment-balance/)
  assert.doesNotMatch(html, /2.500,00|1.000,00/)
  assert.match(html, /31\/01\/2026/)
})
