import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceChartModel } from '../src/domain/balance-chart.js'
import { calculatedReturn } from '../src/domain/calculated-return.js'
import { renderBalanceHistory } from '../src/shared/balance-history-chart.js'

const history = [
  { date: '2025-01-01', amount: 1000 },
  { date: '2025-07-01', amount: 1100 },
  { date: '2025-10-01', amount: 1045, flow: 0 },
  { date: '2026-01-01', amount: 1300, flow: 150, estimated: true }
]

test('invested is the first balance plus the accumulated flow', () => {
  const model = balanceChartModel(history)
  assert.deepEqual(model.points.map(point => point.invested), [1000, 1000, 1000, 1150])
  assert.equal(model.points.at(-1).gain, 150)
})

test('drawdown is never positive, starts at zero and recovers', () => {
  const model = balanceChartModel(history)
  assert.equal(model.points[0].drawdown, 0)
  assert.ok(model.points.every(point => point.drawdown <= 0))
  assert.ok(model.points[2].drawdown < 0)
  assert.ok(Math.abs(model.points[2].drawdown - (1045 / 1100 - 1)) < 1e-9)
  assert.equal(model.maxDrawdown.from, '2025-07-01')
  assert.equal(model.maxDrawdown.to, '2025-10-01')
})

test('the last index matches the calculated rate once annualized', () => {
  const model = balanceChartModel(history)
  const result = calculatedReturn(history)
  const days = Math.round((Date.parse('2026-01-01') - Date.parse('2025-01-01')) / 86400000)
  assert.ok(Math.abs(Math.pow(model.points.at(-1).index, 365 / days) - 1 - result.nominal) < 1e-9)
})

test('no chart before two balances, drawdown only from three', () => {
  assert.equal(balanceChartModel([{ date: '2026-01-01', amount: 1 }]).hasDrawdown, false)
  assert.equal(balanceChartModel(history.slice(0, 2)).hasDrawdown, false)
  assert.ok(!renderBalanceHistory([], {}).includes('<svg'))
  assert.ok(!renderBalanceHistory(history.slice(0, 1), {}).includes('<svg'))
  const two = renderBalanceHistory(history.slice(0, 2), {})
  assert.equal((two.match(/<svg/g) || []).length, 1)
  assert.match(two, /precisa de 3 saldos/)
  assert.equal((renderBalanceHistory(history, {}).match(/<svg/g) || []).length, 2)
})

test('estimated flow is dashed, has a diamond marker and is named in text', () => {
  const html = renderBalanceHistory(history, { currency: 'BRL' })
  assert.match(html, /stroke-dasharray="6 4"/)
  assert.match(html, /balance-chart__diamond/)
  assert.match(html, /fluxo estimado/)
  assert.match(html, /<td>estimado<\/td>/)
})

test('hidden values draw no balance chart and the drop chart has no currency', () => {
  const html = renderBalanceHistory(history, { currency: 'BRL', hidden: true })
  assert.equal((html.match(/<svg/g) || []).length, 1)
  assert.match(html, /Valores ocultos/)
  assert.ok(!/R\$|BRL|1\.\d{3}/.test(html))
})

test('every marker is focusable, charts have a text summary and the table a caption', () => {
  const html = renderBalanceHistory(history, { currency: 'BRL' })
  assert.equal((html.match(/data-balance-point/g) || []).length, 8)
  assert.equal((html.match(/tabindex="0" role="button"/g) || []).length, 8)
  assert.equal((html.match(/role="img" aria-label="[^"]+"/g) || []).length, 2)
  assert.match(html, /<caption class="sr-only">/)
  assert.match(html, /scope="col"/)
})
