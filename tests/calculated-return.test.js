import test from 'node:test'
import assert from 'node:assert/strict'
import { activeCalculatedReturn, calculatedReturn, minimumWindowDays, periodFlow, recordBalanceSnapshot, returnModeOf, sanitizeBalanceHistory } from '../src/domain/calculated-return.js'
import { resolveInvestmentNominalReturn, resolveInvestmentRealReturn } from '../src/domain/investment-returns.js'
import { sanitizeInvestment } from '../src/app/state-storage.js'

const rates = { base: 'CHF', rates: { CHF: 1, EUR: 1, BRL: 0.2, USD: 1 } }
const options = { currency: 'BRL', exchangeRates: rates }
const plan = { annualRealReturn: 0.05, annualInflation: 0.04 }
const base = { id: 'cdb', name: 'CDB', amount: 1100, monthlyContribution: 0, currency: 'BRL', balanceAsOf: '2026-12-31', returnType: 'real', returnValue: 0.03, assetClass: 'fixed-income' }

test('one year from 1000 to 1100 without flows is 10% a year', () => {
  const result = calculatedReturn([{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 1100 }])
  assert.equal(result.status, 'ok')
  assert.ok(Math.abs(result.nominal - 0.1) < 1e-9)
  assert.equal(result.days, 365)
})

test('flows are removed from the yield', () => {
  // 1000 -> 1600 with a 500 application: gain 100 on 1250 average = 8%
  const result = calculatedReturn([{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 1600, flow: 500 }])
  assert.ok(Math.abs(result.nominal - 100 / 1250) < 1e-9)
  // A redemption of 300: 1000 -> 800 is a gain of 100.
  const redeem = calculatedReturn([{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 800, flow: -300 }])
  assert.ok(Math.abs(redeem.nominal - 100 / 850) < 1e-9)
})

test('no previous balance, a short window or an implausible jump never produce a rate', () => {
  assert.equal(calculatedReturn([{ date: '2026-12-31', amount: 1000 }]).status, 'none')
  assert.equal(calculatedReturn([]).status, 'none')
  const short = calculatedReturn([{ date: '2026-11-30', amount: 1000 }, { date: '2026-12-31', amount: 1010 }])
  assert.equal(short.status, 'insufficient')
  assert.ok(short.days < minimumWindowDays)
  assert.equal(calculatedReturn([{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 5000 }]).status, 'implausible')
})

test('periods chain and old balances leave the window', () => {
  const result = calculatedReturn([{ date: '2022-01-01', amount: 100 }, { date: '2025-12-31', amount: 1000 }, { date: '2026-06-30', amount: 1050 }, { date: '2026-12-31', amount: 1102.5 }])
  assert.equal(result.status, 'ok')
  assert.equal(result.from, '2025-12-31')
  assert.ok(Math.abs(result.nominal - 0.1025) < 0.002)
})

test('calculated is the default and manual keeps the calculated value aside', () => {
  const history = [{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 1100 }]
  const calculated = { ...base, balanceHistory: history }
  assert.equal(returnModeOf(calculated), 'calculated')
  assert.equal(returnModeOf({ ...calculated, returnMode: 'manual' }), 'manual')
  assert.ok(activeCalculatedReturn(calculated))
  assert.equal(activeCalculatedReturn({ ...calculated, returnMode: 'manual' }), null)
  assert.ok(Math.abs(resolveInvestmentNominalReturn(calculated, plan, 2027) - 0.1) < 1e-9)
  assert.ok(Math.abs(resolveInvestmentRealReturn(calculated, plan, 2027) - (1.1 / 1.04 - 1)) < 1e-9)
  // Manual: the typed 3% real, the history is ignored.
  assert.equal(resolveInvestmentRealReturn({ ...calculated, returnMode: 'manual' }, plan, 2027), 0.03)
})

test('without a previous balance the manual return is the reference', () => {
  assert.equal(resolveInvestmentRealReturn(base, plan, 2027), 0.03)
  assert.equal(resolveInvestmentRealReturn({ ...base, balanceHistory: [{ date: '2026-12-31', amount: 1100 }] }, plan, 2027), 0.03)
  assert.equal(resolveInvestmentRealReturn({ ...base, returnType: 'default', returnValue: null }, plan, 2027), 0.05)
})

test('yearly overrides still win over the calculated return', () => {
  const investment = { ...base, annualRealReturns: [{ year: 2027, rate: 0.01 }], balanceHistory: [{ date: '2025-12-31', amount: 1000 }, { date: '2026-12-31', amount: 1100 }] }
  assert.equal(resolveInvestmentRealReturn(investment, plan, 2027), 0.01)
})

test('snapshots keep the flow of linked applications and redemptions since the previous one', () => {
  const items = [
    { id: 'a', type: 'expense', amount: 500, currency: 'BRL', startDate: '2026-03-10', statementInternalTransfer: true, statementInvestmentId: 'cdb' },
    { id: 'r', type: 'income', amount: 200, currency: 'BRL', startDate: '2026-05-10', statementInternalTransfer: true, statementInvestmentId: 'cdb' },
    { id: 'old', type: 'expense', amount: 999, currency: 'BRL', startDate: '2025-12-31', statementInternalTransfer: true, statementInvestmentId: 'cdb' },
    { id: 'other', type: 'expense', amount: 999, currency: 'BRL', startDate: '2026-03-10', statementInternalTransfer: true, statementInvestmentId: 'x' }
  ]
  const previous = { ...base, amount: 1000, balanceAsOf: '2025-12-31' }
  const history = recordBalanceSnapshot({ ...base, amount: 1450, balanceAsOf: '2026-12-31' }, previous, { items, ...options })
  assert.deepEqual(history, [{ date: '2025-12-31', amount: 1000, flow: 0 }, { date: '2026-12-31', amount: 1450, flow: 300 }])
  // Same date replaces, a repeated call is stable.
  assert.deepEqual(recordBalanceSnapshot({ ...base, amount: 1450, balanceAsOf: '2026-12-31', balanceHistory: history }, previous, { items, ...options }), history)
})

test('without linked movements the declared contribution is an estimate and is flagged', () => {
  const investment = { ...base, monthlyContribution: 100 }
  const result = periodFlow(investment, [], '2026-01-01', '2026-07-01', options)
  assert.equal(result.estimated, true)
  assert.ok(Math.abs(result.flow - 100 * 181 / 30.4375) < 0.01)
  assert.deepEqual(periodFlow(base, [], '2026-01-01', '2026-07-01', options), { flow: 0, estimated: false })
})

test('a legacy investment seeds the history with the balance it had before', () => {
  const history = recordBalanceSnapshot({ ...base, amount: 1100, balanceAsOf: '2026-12-31' }, { ...base, amount: 1000, balanceAsOf: '2026-06-30' }, options)
  assert.equal(history.length, 2)
  assert.equal(history[0].date, '2026-06-30')
})

test('storage keeps the mode and a clean history, and drops invalid rows', () => {
  const saved = sanitizeInvestment({ ...base, returnMode: 'manual', balanceHistory: [{ date: '2026-12-31', amount: 10 }, { date: 'x', amount: 5 }, { date: '2026-01-01', amount: -1 }] })
  assert.equal(saved.returnMode, 'manual')
  assert.deepEqual(saved.balanceHistory, [{ date: '2026-12-31', amount: 10, flow: 0 }])
  assert.equal(sanitizeInvestment(base).returnMode, undefined)
  assert.deepEqual(sanitizeBalanceHistory('x'), [])
})
