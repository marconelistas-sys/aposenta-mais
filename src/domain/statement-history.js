import { currencies } from '../shared/currencies.js'
export const statementHistoryLimit = 6
export const statementHistoryMonths = 24
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const money = value => Number.isFinite(value) && value >= 0 && value <= 1e12

export function sanitizeStatementAnalysis(raw) {
  if (!raw || !/^analysis-[a-f0-9]{64}$/.test(raw.id || '') || !currencies[raw.currency] || !date(raw.start) || !date(raw.end) || raw.start > raw.end || !Number.isFinite(Date.parse(raw.createdAt))) return null
  if (!Array.isArray(raw.months) || raw.months.length < 2 || raw.months.length > statementHistoryMonths || !Array.isArray(raw.recurring) || raw.recurring.length > 8) return null
  let previous = ''
  const months = []
  for (const row of raw.months) {
    if (!row || !/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(row.month) || row.month <= previous || !money(row.income) || !money(row.expense)) return null
    if (previous) {
      const expected = new Date(Date.UTC(Number(previous.slice(0, 4)), Number(previous.slice(5)), 1)).toISOString().slice(0, 7)
      if (row.month !== expected) return null
    }
    const first = `${row.month}-01`
    const last = new Date(Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5)), 0)).toISOString().slice(0, 10)
    if (first < raw.start || last > raw.end) return null
    months.push({ month: row.month, income: row.income, expense: row.expense, balance: row.income - row.expense }); previous = row.month
  }
  const recurring = []
  for (const row of raw.recurring) {
    if (!row || !['income', 'expense'].includes(row.type) || typeof row.description !== 'string' || !money(row.monthly) || row.monthly <= 0 || !Number.isInteger(row.months) || row.months < 2 || row.months > months.length || row.months / months.length < .6) return null
    recurring.push({ type: row.type, description: row.description.trim().slice(0, 60), monthly: row.monthly, months: row.months })
  }
  const income = months.reduce((sum, row) => sum + row.income, 0) / months.length
  const expense = months.reduce((sum, row) => sum + row.expense, 0) / months.length
  return { id: raw.id, currency: raw.currency, start: raw.start, end: raw.end, createdAt: raw.createdAt, months, recurring, income, expense, surplus: income - expense,
    excluded: Object.fromEntries(['transfer', 'currency', 'outside'].map(key => [key, Number.isInteger(raw.excluded?.[key]) && raw.excluded[key] >= 0 && raw.excluded[key] <= 2000 ? raw.excluded[key] : 0])) }
}
export function sanitizeStatementHistory(raw) {
  if (!Array.isArray(raw)) return []
  const ids = new Set()
  return raw.map(sanitizeStatementAnalysis).filter(row => row && !ids.has(row.id) && ids.add(row.id)).slice(0, statementHistoryLimit)
}
export function compareStatementPeriods(a, b) {
  const first = sanitizeStatementAnalysis(a), second = sanitizeStatementAnalysis(b)
  if (!first || !second || first.currency !== second.currency) throw new Error('Compare análises válidas na mesma moeda.')
  if (first.months.some(row => second.months.some(other => row.month === other.month))) throw new Error('Escolha períodos sem meses sobrepostos.')
  const [earlier, later] = first.months[0].month < second.months[0].month ? [first, second] : [second, first]
  return { earlier, later, currency: first.currency, incomeChange: later.income - earlier.income, expenseChange: later.expense - earlier.expense, surplusChange: later.surplus - earlier.surplus }
}
