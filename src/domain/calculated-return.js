import { convertCurrency } from '../shared/exchange-rates.js'
import { investmentBalanceCurrency, investmentNativeAmount, round2 } from './investment-currency.js'

// Rendimento calculado: a variação entre saldos informados, descontados os
// aportes e resgates do período. É o padrão de cada investimento. O rendimento
// manual (returnType e returnValue) é a referência quando não há saldo anterior
// suficiente, e vale sozinho quando a pessoa escolhe returnMode 'manual'.
// Ver docs/product/rendimento-calculado.md.

export const returnModes = Object.freeze(['calculated', 'manual'])
export const historyLimit = 36
// Janela mínima para anualizar. Abaixo disso, um mês bom viraria 80% ao ano.
export const minimumWindowDays = 90
// Janela máxima: saldos mais antigos deixam de contar.
export const maximumWindowDays = 730
// Fora destes limites o mais provável é um aporte não registrado, não rendimento.
export const plausibleRange = Object.freeze([-0.5, 1])

const dayMs = 86400000
const monthDays = 30.4375
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / dayMs)

export function returnModeOf(investment) {
  return investment?.returnMode === 'manual' ? 'manual' : 'calculated'
}

export function sanitizeReturnMode(value) {
  return returnModes.includes(value) ? value : undefined
}

export function sanitizeBalanceHistory(rows) {
  if (!Array.isArray(rows)) return []
  const byDate = new Map()
  for (const row of rows) {
    const amount = Number(row?.amount)
    const flow = Number(row?.flow ?? 0)
    if (!row || !validDate(row.date) || !Number.isFinite(amount) || amount < 0 || amount > 1e9 || !Number.isFinite(flow) || Math.abs(flow) > 1e9) continue
    byDate.set(row.date, { date: row.date, amount: round2(amount), flow: round2(flow), ...(row.estimated === true ? { estimated: true } : {}) })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-historyLimit)
}

// Net flow into the investment, in its balance currency, between two dates
// (from excluded, to included). Linked applications and redemptions are real.
// Without any, the declared monthly contribution and the linked pension
// contributions are estimates, and the result is flagged as estimated.
export function periodFlow(investment, items = [], from, to, { currency, exchangeRates } = {}) {
  const balanceCurrency = investmentBalanceCurrency(investment, currency)
  const convert = item => round2(convertCurrency(item.amount, item.currency || balanceCurrency, balanceCurrency, exchangeRates))
  const moved = items.filter(item => item.statementInternalTransfer && item.statementInvestmentId === investment.id && validDate(item.startDate) && item.startDate > from && item.startDate <= to)
  if (moved.length) return { flow: round2(moved.reduce((sum, item) => sum + convert(item) * (item.type === 'expense' ? 1 : -1), 0)), estimated: false }
  const months = days(from, to) / monthDays
  const pension = items.filter(item => item.pensionInvestmentId === investment.id && item.type === 'expense' && item.frequency === 'monthly')
  let monthly = pension.reduce((sum, item) => sum + convert(item), 0)
  if (!pension.length) {
    const native = Number(investment.nativeMonthlyContribution ?? investment.monthlyContribution)
    if (Number.isFinite(native) && native > 0) monthly = balanceCurrency === currency ? Number(investment.monthlyContribution) || 0 : native
  }
  return monthly > 0 ? { flow: round2(monthly * months), estimated: true } : { flow: 0, estimated: false }
}

// Adds the balance just informed to the history, with the flow since the previous
// snapshot. The same date replaces the earlier snapshot. The first snapshot
// of a legacy investment seeds from the balance it had before the change.
export function recordBalanceSnapshot(investment, previous, { items = [], currency, exchangeRates } = {}) {
  const date = investment?.balanceAsOf
  if (!validDate(date)) return sanitizeBalanceHistory(investment?.balanceHistory ?? previous?.balanceHistory)
  let history = sanitizeBalanceHistory(investment.balanceHistory ?? previous?.balanceHistory)
  if (!history.length && validDate(previous?.balanceAsOf) && previous.balanceAsOf < date) {
    history = [{ date: previous.balanceAsOf, amount: round2(investmentNativeAmount(previous, currency)), flow: 0 }]
  }
  history = history.filter(row => row.date !== date)
  const before = history.filter(row => row.date < date).at(-1)
  const { flow, estimated } = before ? periodFlow(investment, items, before.date, date, { currency, exchangeRates }) : { flow: 0, estimated: false }
  history.push({ date, amount: round2(investmentNativeAmount(investment, currency)), flow, ...(estimated ? { estimated: true } : {}) })
  return sanitizeBalanceHistory(history)
}

// Chain-linked modified Dietz: each period has a return (end - start - flow) /
// (start + flow / 2), flows assumed in the middle of the period. Periods chain
// into one growth factor, annualized over the covered days. Returns the
// nominal annual rate in the balance currency, net of the product cost.
export function calculatedReturn(history) {
  const rows = sanitizeBalanceHistory(history)
  if (rows.length < 2) return { status: 'none' }
  const last = rows.at(-1)
  const cutoff = new Date(Date.parse(last.date) - maximumWindowDays * dayMs).toISOString().slice(0, 10)
  const window = rows.filter(row => row.date >= cutoff)
  let growth = 1, covered = 0, estimated = false, from = null
  for (let index = 1; index < window.length; index++) {
    const start = window[index - 1], end = window[index]
    const span = days(start.date, end.date)
    const base = start.amount + end.flow / 2
    if (span <= 0 || start.amount <= 0 || base <= 0) { growth = 1; covered = 0; estimated = false; from = null; continue }
    growth *= 1 + (end.amount - start.amount - end.flow) / base
    covered += span
    if (end.estimated) estimated = true
    if (from === null) from = start.date
  }
  if (!from || covered <= 0) return { status: 'none' }
  if (covered < minimumWindowDays) return { status: 'insufficient', days: covered, from, to: last.date }
  if (!(growth > 0)) return { status: 'implausible', days: covered, from, to: last.date }
  const nominal = Math.pow(growth, 365 / covered) - 1
  if (nominal < plausibleRange[0] || nominal > plausibleRange[1]) return { status: 'implausible', nominal, days: covered, from, to: last.date }
  return { status: 'ok', nominal, days: covered, from, to: last.date, estimated }
}

// The calculated return applies only in 'calculated' mode with a usable window.
export function activeCalculatedReturn(investment) {
  if (returnModeOf(investment) !== 'calculated') return null
  const result = calculatedReturn(investment?.balanceHistory)
  return result.status === 'ok' ? result : null
}
