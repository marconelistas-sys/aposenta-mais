import test from 'node:test'
import assert from 'node:assert/strict'
import { portfolioBalanceHistory } from '../src/domain/portfolio-balance-history.js'
import { balanceInvestedLine } from '../src/features/report/report-charts.js'

const rates = { base: 'CHF', rates: { CHF: 1, EUR: 1, BRL: 0.2, USD: 1 } }
const options = { currency: 'BRL', exchangeRates: rates }
const a = { id: 'a', name: 'A', currency: 'BRL', balanceHistory: [{ date: '2025-01-01', amount: 1000 }, { date: '2025-07-01', amount: 1100, flow: 0 }, { date: '2026-01-01', amount: 1300, flow: 100 }] }
const b = { id: 'b', name: 'B', currency: 'BRL', balanceHistory: [{ date: '2025-07-01', amount: 500 }, { date: '2026-01-01', amount: 540, flow: 0 }] }

test('sums balances and invested by date, holding the last balance of each investment', () => {
  const view = portfolioBalanceHistory([a, b], options)
  assert.equal(view.available, true)
  assert.equal(view.count, 2)
  assert.deepEqual(view.series.map(point => [point.date, point.balance, point.invested]), [
    ['2025-01-01', 1000, 1000],
    ['2025-07-01', 1600, 1500],
    ['2026-01-01', 1840, 1600]
  ])
})

test('an investment entering later raises balance and invested together, so the gap stays the yield', () => {
  const view = portfolioBalanceHistory([a, b], options)
  const gap = point => point.balance - point.invested
  assert.equal(gap(view.series[1]), 100)
  assert.equal(gap(view.series[2]), 240)
})

test('needs two balances in at least one investment and two dates', () => {
  assert.equal(portfolioBalanceHistory([], options).available, false)
  assert.equal(portfolioBalanceHistory([{ ...a, balanceHistory: [a.balanceHistory[0]] }], options).available, false)
  assert.equal(portfolioBalanceHistory([{ ...a, balanceHistory: [a.balanceHistory[0]] }, a], options).count, 1)
})

test('foreign balances convert at today rate in every date and are listed', () => {
  const chf = { id: 'c', name: 'C', currency: 'CHF', balanceHistory: [{ date: '2025-01-01', amount: 100 }, { date: '2026-01-01', amount: 110, flow: 0 }] }
  const view = portfolioBalanceHistory([chf], options)
  // With these rates 100 CHF is 20 BRL, the same factor on both dates.
  assert.deepEqual(view.series.map(point => point.balance), [20, 22])
  assert.deepEqual(view.foreign, ['CHF'])
})

test('estimated flow is reported', () => {
  const estimated = { ...a, balanceHistory: [{ date: '2025-01-01', amount: 1000 }, { date: '2026-01-01', amount: 1200, flow: 100, estimated: true }] }
  assert.equal(portfolioBalanceHistory([estimated], options).estimated, true)
  assert.equal(portfolioBalanceHistory([a], options).estimated, false)
})

test('the report chart draws two paths, labels both lines and has an accessible name', () => {
  const view = portfolioBalanceHistory([a, b], options)
  const svg = balanceInvestedLine({ series: view.series, currency: 'BRL', label: 'Saldo e aportado' })
  assert.match(svg, /role="img" aria-label="Saldo e aportado"/)
  assert.equal((svg.match(/<path class="report-svg-line/g) || []).length, 2)
  assert.match(svg, />Saldo</)
  assert.match(svg, />Aportado</)
})
