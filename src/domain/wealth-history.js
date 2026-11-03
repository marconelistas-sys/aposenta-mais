// Monthly snapshot of the balance sheet, kept in plan.wealthHistory. Same
// pattern as goalsHistory: one photo per month (a new one in the same month
// replaces it), sanitized on load and capped. It records what was declared at
// the time; it never estimates the past. Debts keep only the total: each
// balance follows from its schedule, and a list per photo multiplies the size.
import { currencies } from '../shared/currencies.js'
import { wealthByCurrency, wealthComposition, wealthGroups } from './wealth-composition.js'

export const wealthHistoryLimit = 120
const investmentLimit = 30
const monthPattern = /^(20|21)\d{2}-(0[1-9]|1[0-2])$/
const idPattern = /^[a-zA-Z0-9:_-]{1,80}$/
const classes = new Set(['fixed-income', 'equity', 'fund', 'pension', 'cash', 'other'])
const liquidities = new Set(['available', 'restricted', 'unknown'])
const groupKeys = wealthGroups.map(group => group.key)

const cents = value => Math.round(value * 100) / 100 || 0
const amountIn = (value, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? cents(number) : null
}

function sanitizeRates(source) {
  if (!source || typeof source !== 'object') return null
  const rates = {}
  for (const code of Object.keys(currencies)) {
    const value = Number(source[code])
    if (Number.isFinite(value) && value > 0 && value < 1e6) rates[code] = value
  }
  return Object.keys(rates).length ? rates : null
}

function sanitizeTotals(source, keys) {
  const totals = {}
  for (const key of keys) {
    const value = amountIn(source?.[key], 0, 1e12)
    if (value !== null && value > 0) totals[key] = value
  }
  return totals
}

function sanitizeCurrencyTotals(source) {
  const totals = {}
  for (const code of Object.keys(currencies)) {
    const row = source?.[code]
    const amount = amountIn(row?.amount, 0, 1e12)
    const nativeAmount = amountIn(row?.nativeAmount, 0, 1e12)
    if (amount !== null && nativeAmount !== null && (amount > 0 || nativeAmount > 0)) totals[code] = { amount, nativeAmount }
  }
  return totals
}

export function sanitizeWealthSnapshot(row) {
  if (!row || typeof row !== 'object' || typeof row.month !== 'string' || !monthPattern.test(row.month) || !Object.hasOwn(currencies, row.currency)) return null
  const rates = sanitizeRates(row.rates)
  const netWorth = amountIn(row.netWorth, -1e12, 1e12)
  const gross = amountIn(row.gross, 0, 1e12)
  const debtTotal = amountIn(row.debtTotal, 0, 1e12)
  if (!rates || !rates[row.currency] || netWorth === null || gross === null || debtTotal === null) return null
  // Snapshots must add up. A tampered or truncated row is dropped, not repaired.
  if (Math.abs(gross - debtTotal - netWorth) > 0.05) return null
  const investments = (Array.isArray(row.investments) ? row.investments : []).slice(0, investmentLimit).map(item => {
    if (!item || typeof item.id !== 'string' || !idPattern.test(item.id) || !classes.has(item.class) || !Object.hasOwn(currencies, item.currency) || !liquidities.has(item.liquidity)) return null
    const nativeAmount = amountIn(item.nativeAmount, 0, 1e9), amount = amountIn(item.amount, 0, 1e9)
    return nativeAmount === null || amount === null ? null : { id: item.id, class: item.class, currency: item.currency, nativeAmount, amount, liquidity: item.liquidity }
  }).filter(Boolean)
  return {
    month: row.month,
    currency: row.currency,
    ...(typeof row.ratesDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.ratesDate) ? { ratesDate: row.ratesDate } : {}),
    rates,
    netWorth, gross, debtTotal,
    totals: {
      groups: sanitizeTotals(row.totals?.groups, groupKeys),
      classes: sanitizeTotals(row.totals?.classes, [...classes]),
      currencies: sanitizeCurrencyTotals(row.totals?.currencies)
    },
    investments
  }
}

export function sanitizeWealthHistory(source) {
  const byMonth = new Map()
  for (const row of Array.isArray(source) ? source : []) {
    const clean = sanitizeWealthSnapshot(row)
    if (clean) byMonth.set(clean.month, clean)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-wealthHistoryLimit)
}

// One photo per month. A new photo in the same month replaces the previous one.
export function upsertWealthHistory(history, snapshot) {
  const clean = sanitizeWealthSnapshot(snapshot)
  const rows = sanitizeWealthHistory(history)
  if (!clean) return rows
  return sanitizeWealthHistory([...rows.filter(row => row.month !== clean.month), clean])
}

// Builds the photo of the balance sheet on `date` (YYYY-MM-DD), in the plan
// currency, from the same composition shown on the Patrimônio page. Returns
// null when nothing is registered, so an empty plan never creates a zero point.
export function wealthSnapshot(state, date = new Date().toISOString().slice(0, 10)) {
  const composition = wealthComposition(state, date)
  if (composition.gross <= 0.005 && composition.debtTotal <= 0.005) return null
  const groups = Object.fromEntries(composition.groups.map(group => [group.key, group.amount]))
  const classTotals = {}
  for (const item of state.plan.investments || []) {
    const key = classes.has(item.assetClass) ? item.assetClass : 'other'
    classTotals[key] = (classTotals[key] || 0) + (Number(item.amount) || 0)
  }
  const currencyTotals = Object.fromEntries(wealthByCurrency(composition, state.currency).map(row => [row.currency, { amount: row.amount, nativeAmount: row.nativeAmount }]))
  return sanitizeWealthSnapshot({
    month: date.slice(0, 7),
    currency: state.currency,
    ratesDate: state.exchangeRates?.date,
    rates: state.exchangeRates?.rates,
    netWorth: cents(composition.gross) - cents(composition.debtTotal),
    gross: composition.gross,
    debtTotal: composition.debtTotal,
    totals: { groups, classes: classTotals, currencies: currencyTotals },
    investments: (state.plan.investments || []).map(item => {
      const foreign = Object.hasOwn(currencies, item.currency) && item.currency !== state.currency && Number.isFinite(item.nativeAmount)
      return { id: item.id, class: classes.has(item.assetClass) ? item.assetClass : 'other', currency: foreign ? item.currency : state.currency, nativeAmount: foreign ? item.nativeAmount : item.amount, amount: item.amount, liquidity: liquidities.has(item.liquidity) ? item.liquidity : 'unknown' }
    })
  })
}

// Snapshot amounts in another currency are converted with the rates stored in
// the snapshot itself: the value at that time, not at today's rate.
export function snapshotIn(row, currency) {
  const factor = row.currency === currency ? 1 : row.rates?.[currency] && row.rates?.[row.currency] ? row.rates[currency] / row.rates[row.currency] : null
  if (!factor) return null
  const convert = value => value * factor
  return {
    netWorth: convert(row.netWorth), gross: convert(row.gross), debtTotal: convert(row.debtTotal),
    groups: Object.fromEntries(Object.entries(row.totals?.groups || {}).map(([key, value]) => [key, convert(value)])),
    converted: factor !== 1 || row.currency !== currency
  }
}
