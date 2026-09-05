import test from 'node:test'
import assert from 'node:assert/strict'
import { advancedDebtSchedule, summaryDebt, validateDebtTerms } from '../src/domain/debt-analysis.js'

const debt = overrides => ({ amount: 12000, annualRate: 0.12, installments: 12, date: '2026-01-31', ...overrides })
const cents = amount => Math.round(amount * 100)

test('PRICE defaults preserve payment and reconcile cents through final payoff', () => {
  const rows = advancedDebtSchedule(debt())
  assert.equal(rows.length, 12)
  assert.equal(rows[0].month, '2026-01')
  assert.equal(rows.at(-1).month, '2026-12')
  assert.equal(rows.at(-1).balance, 0)
  assert.equal(rows.reduce((sum, row) => sum + cents(row.principal), 0), 1200000)
  assert.ok(rows.slice(0, -1).every(row => row.amount === rows[0].amount))
  for (const row of rows) assert.equal(cents(row.amount), cents(row.principal) + cents(row.interest) + cents(row.fee))
})

test('effective annual rate converts to monthly rather than dividing by twelve', () => {
  const row = advancedDebtSchedule(debt())[0]
  assert.equal(row.interest, 113.87)
})

test('zero interest and tiny rates remain finite with final cent settlement', () => {
  for (const annualRate of [0, 1e-18]) {
    const rows = advancedDebtSchedule(debt({ amount: 100, installments: 3, annualRate }))
    assert.deepEqual(rows.map(row => row.principal), [33.33, 33.33, 33.34])
    assert.equal(rows.at(-1).balance, 0)
  }
})

test('SAC principal remains constant and payments decrease', () => {
  const rows = advancedDebtSchedule(debt({ amortization: 'sac', monthlyFee: 5 }))
  assert.ok(rows.every(row => row.principal === 1000 && row.fee === 5))
  assert.ok(rows[0].amount > rows.at(-1).amount)
  assert.equal(rows.at(-1).balance, 0)
})

test('extra payment applies after installment, caps at balance and stops future fees', () => {
  const rows = advancedDebtSchedule(debt({ annualRate: 0, monthlyFee: 10, extraPayments: [{ month: '2026-01', amount: 100000 }] }))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].extraPayment, 11000)
  assert.equal(rows[0].principal, 12000)
  assert.equal(rows[0].amount, 12010)
  assert.equal(rows[0].balance, 0)
})

test('PRICE extra payments retain original normal payment and reduce term and interest', () => {
  const item = debt({ extraPayments: [{ month: '2026-02', amount: 4000 }] })
  const normal = advancedDebtSchedule(debt())
  const summary = summaryDebt(item, '2026-02')
  assert.equal(summary.schedule[2].amount, normal[0].amount)
  assert.ok(summary.schedule.length < normal.length)
  assert.ok(summary.interestSavings > 0)
  assert.equal(summary.balanceBefore, summary.schedule[0].balance)
  assert.equal(summary.balanceAfter, summary.schedule[1].balance)
  assert.equal(summary.baselineInterest, summaryDebt(debt(), '2026-02').totalInterest)
})

test('SAC extras do not recalculate scheduled principal', () => {
  const rows = advancedDebtSchedule(debt({ amortization: 'sac', extraPayments: [{ month: '2026-01', amount: 3000 }] }))
  assert.equal(rows[0].principal, 4000)
  assert.equal(rows[1].principal, 1000)
  assert.equal(rows.length, 9)
})

test('summary distinguishes month opening and closing, including outside the term', () => {
  const item = debt({ annualRate: 0, installments: 2, monthlyFee: 2 })
  const before = summaryDebt(item, '2025-12')
  assert.equal(before.balanceBefore, 12000)
  assert.equal(before.balanceAfter, 12000)
  const first = summaryDebt(item, '2026-01')
  assert.equal(first.balanceBefore, 12000)
  assert.equal(first.balanceAfter, 6000)
  const after = summaryDebt(item, '2027-01')
  assert.equal(after.balanceBefore, 0)
  assert.equal(after.balanceAfter, 0)
  assert.equal(after.totalFees, 4)
  assert.equal(after.totalPaid, 12004)
  assert.equal(after.payoffMonth, '2026-02')
  assert.equal(after.interestSavings, 0)
})

test('terms validate bounds, currency precision and malformed extra payments', () => {
  const invalid = [
    { amount: 0 }, { amount: 1e9 + 1 }, { amount: 10.001 }, { amount: NaN },
    { installments: 0 }, { installments: 601 }, { installments: 1.5 },
    { annualRate: -0.1 }, { annualRate: 1.01 }, { annualRate: Infinity },
    { date: '2026-02-30' }, { date: '9999-12-01' }, { amortization: 'other' },
    { monthlyFee: -1 }, { monthlyFee: 1e7 + 1 }, { monthlyFee: 0.001 },
    { extraPayments: {} },
    { extraPayments: [{ month: '2025-12', amount: 1 }] },
    { extraPayments: [{ month: '2027-01', amount: 1 }] },
    { extraPayments: [{ month: '2026-13', amount: 1 }] },
    { extraPayments: [{ month: '2026-01', amount: 0 }] },
    { extraPayments: [{ month: '2026-01', amount: 1.001 }] },
    { extraPayments: [{ month: '2026-01', amount: 1e9 + 1 }] },
    { extraPayments: [{ month: '2026-01', amount: 1 }, { month: '2026-01', amount: 1 }] },
    { extraPayments: [{ month: '2026-02', amount: 1 }, { month: '2026-01', amount: 1 }] },
    { extraPayments: Array.from({ length: 101 }, () => ({ month: '2026-01', amount: 1 })) },
  ]
  for (const values of invalid) assert.throws(() => advancedDebtSchedule(debt(values)), RangeError, JSON.stringify(values))
  assert.throws(() => summaryDebt(debt(), '2026-00'), RangeError)
  assert.doesNotThrow(() => validateDebtTerms(debt({ amount: 1e9, installments: 600, annualRate: 1, monthlyFee: 1e7 })))
})

test('small principal and long term conserve cents without negative balances', () => {
  const rows = advancedDebtSchedule(debt({ amount: 0.01, installments: 600, annualRate: 0 }))
  assert.equal(rows.at(-1).balance, 0)
  assert.equal(rows.reduce((sum, row) => sum + cents(row.principal), 0), 1)
  assert.ok(rows.every(row => row.balance >= 0))
})
