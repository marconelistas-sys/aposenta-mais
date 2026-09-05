import { convertCurrency } from '../shared/exchange-rates.js'

export function validateAnnualRow(row) {
  if (!row || !/^[\w:-]{1,80}$/.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 60 || !['BRL', 'CHF', 'EUR', 'USD'].includes(row.currency) || !Number.isFinite(row.amount) || row.amount <= 0 || row.amount > 1e9 || !Number.isInteger(row.startYear) || !Number.isInteger(row.endYear) || row.startYear < 2000 || row.endYear > 2199 || row.startYear > row.endYear || !Number.isInteger(row.everyYears) || row.everyYears < 1 || row.everyYears > 100 || !Number.isFinite(row.realGrowth) || row.realGrowth <= -1 || row.realGrowth > 1) throw new Error('Revise o valor, a moeda, os anos e a periodicidade.')
  for (let year = row.startYear; year <= row.endYear; year += row.everyYears) if (row.amount * (1 + row.realGrowth) ** (year - row.startYear) > 1e9) throw new Error('Projeção anual excede o limite de valor.')
}
export function sanitizeAnnualRows(raw) {
  const result = []
  for (const value of Array.isArray(raw) ? raw.slice(0, 50) : []) {
    const row = Object.fromEntries(['id', 'name', 'currency', 'amount', 'startYear', 'endYear', 'everyYears', 'realGrowth'].map(key => [key, value?.[key]]))
    try { validateAnnualRow(row); if (!result.some(item => item.id === row.id)) result.push(row) } catch {}
  }
  return result
}
export function annualValue(row, year) {
  return year >= row.startYear && year <= row.endYear && (year - row.startYear) % row.everyYears === 0 ? Math.round(row.amount * (1 + row.realGrowth) ** (year - row.startYear) * 100) / 100 : 0
}
// Provision, not an invented payment date. Distribute cents so 12 months equal the annual total.
export function annualGoalEvents(rows, month) {
  const year = Number(month.slice(0, 4)), number = Number(month.slice(5))
  return sanitizeAnnualRows(rows).flatMap(row => {
    const cents = Math.round(annualValue(row, year) * 100)
    const amount = (Math.floor(cents / 12) + (number <= cents % 12 ? 1 : 0)) / 100
    return amount > 0 ? [{ id: `${row.id}:${month}`, annualGoalId: row.id, description: `${row.name} (provisão anual)`, amount, currency: row.currency, type: 'expense', categoryId: 'other-expense', frequency: 'monthly', source: 'manual', recordKind: 'planned', startDate: `${month}-01`, endDate: `${month}-01`, provisional: true }] : []
  })
}
export function nonFinancialValue(rows, month, currency, rates) {
  return sanitizeAnnualRows(rows).reduce((total, row) => total + convertCurrency(annualValue(row, Number(month.slice(0, 4))), row.currency, currency, rates), 0)
}

export function sanitizeMigration(raw) {
  if (!raw || raw.source !== 'finapp' || !Array.isArray(raw.pending)) return null
  const pending = raw.pending.slice(0, 100).flatMap(row => {
    if (!row || !['consortiums', 'one_time_flows', 'goals', 'assets', 'revenues', 'budget_items', 'pension_contributions', 'initial_assets'].includes(row.table) || !Number.isInteger(row.id) || typeof row.reason !== 'string') return []
    const record = Object.fromEntries(Object.entries(row.record || {}).filter(([key, value]) => /^[a-z_]{1,50}$/.test(key) && !/password|token|secret|email/.test(key) && ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean' || value === null || typeof value === 'string')).slice(0, 25).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 1000) : value]))
    return [{ table: row.table, id: row.id, reason: row.reason.slice(0, 1000), record }]
  })
  return { source: 'finapp', pending, importedAt: typeof raw.importedAt === 'string' ? raw.importedAt.slice(0, 40) : null }
}
