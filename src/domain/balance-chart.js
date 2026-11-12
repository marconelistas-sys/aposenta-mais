import { maximumWindowDays, sanitizeBalanceHistory } from './calculated-return.js'

// Model of the balance history charts of one investment. Pure: only the saved
// balances and flows, nothing projected. Same period return as calculatedReturn
// (chain-linked modified Dietz), so the last index matches the calculated rate.
// See docs/product/avaliacao-ux-grafico-saldo.md.

const dayMs = 86400000
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs)

export function balanceChartModel(history) {
  const rows = sanitizeBalanceHistory(history)
  if (!rows.length) return { points: [], count: 0, hasDrawdown: false, maxDrawdown: null, currentDrawdown: null, allEstimated: false }
  let invested = rows[0].amount
  let index = 1, peak = 1, peakDate = rows[0].date
  let maxDrawdown = { value: 0, from: rows[0].date, to: rows[0].date }
  const points = rows.map((row, position) => {
    let restart = false
    if (position > 0) {
      const start = rows[position - 1]
      invested += row.flow
      const span = days(start.date, row.date)
      const base = start.amount + row.flow / 2
      if (span > maximumWindowDays || start.amount <= 0 || base <= 0) {
        restart = true
        index = 1; peak = 1; peakDate = row.date
      } else {
        index *= 1 + (row.amount - start.amount - row.flow) / base
        if (index > peak) { peak = index; peakDate = row.date }
      }
    }
    const drawdown = index / peak - 1
    if (drawdown < maxDrawdown.value) maxDrawdown = { value: drawdown, from: peakDate, to: row.date }
    const gain = row.amount - invested
    return { date: row.date, amount: row.amount, flow: row.flow, estimated: row.estimated === true, invested: Math.round(invested * 100) / 100, gain: Math.round(gain * 100) / 100, gainShare: invested > 0 ? gain / invested : null, index, drawdown, peakDate, restart }
  })
  return {
    points,
    count: points.length,
    // The drop needs three balances: with two there is one period and nothing to compare.
    hasDrawdown: points.length >= 3,
    maxDrawdown: maxDrawdown.value < 0 ? maxDrawdown : null,
    currentDrawdown: points.at(-1).drawdown,
    allEstimated: points.slice(1).every(point => point.estimated)
  }
}
