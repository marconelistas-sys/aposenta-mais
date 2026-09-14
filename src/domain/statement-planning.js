// Observations describe the supplied complete statement period, never guaranteed future income.
export function analyzeStatementPlanning(items, { start, end, currency, asOf = new Date().toISOString().slice(0, 10), complete = false } = {}) {
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!complete || !validDate(start) || !validDate(end) || start > end || end > asOf) throw new Error('Confirme a cobertura completa e informe um período válido até hoje.')
  const months = []
  let cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`)
  while (cursor.toISOString().slice(0, 10) <= end && months.length < 240) {
    const first = cursor.toISOString().slice(0, 10)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    const last = new Date(cursor.getTime() - 86400000).toISOString().slice(0, 10)
    if (first >= start && last <= end && last < asOf) months.push({ month: first.slice(0, 7), income: 0, expense: 0 })
  }
  if (cursor.toISOString().slice(0, 10) <= end) throw new Error('Use um período de até 20 anos.')
  if (months.length < 2) throw new Error('Use pelo menos dois meses completos. Meses parciais não entram na comparação.')
  const byMonth = new Map(months.map(month => [month.month, month]))
  const groups = new Map()
  const excluded = { transfer: 0, currency: 0, outside: 0 }
  for (const item of items) {
    if (item.currency !== currency) { excluded.currency++; continue }
    const month = byMonth.get(item.startDate?.slice(0, 7))
    if (!month) { excluded.outside++; continue }
    const name = String(item.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    if (/transferencia entre contas|own account|conta propria|aplicacao|resgate|saldo anterior|internal transfer/.test(name)) { excluded.transfer++; continue }
    if (!['income', 'expense'].includes(item.type) || !Number.isFinite(item.amount) || item.amount <= 0) continue
    month[item.type] += item.amount
    const key = `${item.type}:${name.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()}`
    const group = groups.get(key) || { description: item.description, type: item.type, total: 0, months: new Set() }
    group.total += item.amount
    group.months.add(month.month)
    groups.set(key, group)
  }
  const income = months.reduce((sum, m) => sum + m.income, 0) / months.length
  const expense = months.reduce((sum, m) => sum + m.expense, 0) / months.length
  return { months: months.map(m => ({ ...m, balance: m.income - m.expense })), income, expense, surplus: income - expense, excluded,
    recurring: [...groups.values()].filter(g => g.months.size >= 2 && g.months.size / months.length >= .6)
      .map(g => ({ description: g.description, type: g.type, monthly: g.total / months.length, months: g.months.size }))
      .sort((a, b) => b.monthly - a.monthly).slice(0, 8) }
}
