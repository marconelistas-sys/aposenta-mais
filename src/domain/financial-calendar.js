import { validDate } from './accounts.js'
import { currencies } from '../shared/currencies.js'
import { advancedDebtSchedule, validateDebtTerms } from './debt-analysis.js'
import { consortiumEvents } from './consortium.js'

export function addMonths(date, offset) {
  const source = new Date(`${date}-01T00:00:00Z`)
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + offset, 1)).toISOString().slice(0, 7)
}

export function validateCommitment(item) {
  if (!item || !/^[\w:-]{1,80}$/.test(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 60 || !['debt', 'goal'].includes(item.kind) || !Object.hasOwn(currencies, item.currency) || !validDate(item.date) || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 1e9) throw new RangeError('Revise nome, tipo, data, moeda e valor.')
  if (item.kind === 'debt' && (!Number.isInteger(item.installments) || item.installments < 1 || item.installments > 600 || !Number.isFinite(item.annualRate) || item.annualRate < 0 || item.annualRate > 1)) throw new RangeError('Informe de 1 a 600 parcelas e juros efetivos anuais de 0% a 100%.')
  if (item.kind === 'goal' && (!Number.isFinite(item.saved) || item.saved < 0 || item.saved > item.amount)) throw new RangeError('O valor já reservado deve ficar entre zero e o valor da meta.')
  if (Math.abs(item.amount * 100 - Math.round(item.amount * 100)) > 0.0001 || (item.kind === 'goal' && Math.abs(item.saved * 100 - Math.round(item.saved * 100)) > 0.0001)) throw new RangeError('Use até duas casas decimais nos valores.')
  if (item.kind === 'debt') validateDebtTerms(item)
}

export function sanitizeCommitments(raw) {
  const result = []
  for (const value of Array.isArray(raw) ? raw.slice(0, 50) : []) {
    const item = { id: value?.id, name: value?.name, kind: value?.kind, currency: value?.currency, date: value?.date, amount: value?.amount, installments: value?.installments, annualRate: value?.annualRate, saved: value?.saved }
    if (item.kind === 'debt') {
      item.amortization = value.amortization ?? 'price'
      item.monthlyFee = value.monthlyFee ?? 0
      item.extraPayments = Array.isArray(value.extraPayments) ? value.extraPayments.map(row => ({ month: row?.month, amount: row?.amount })) : []
    }
    try { validateCommitment(item); if (!result.some(row => row.id === item.id)) result.push(item) } catch {}
  }
  return result
}

export function debtSchedule(item) {
  validateCommitment(item)
  if (item.kind !== 'debt') throw new RangeError('Selecione uma dívida.')
  return advancedDebtSchedule(item)
}

function dueDate(month, day) {
  const [year, number] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, number, 0)).getUTCDate())).padStart(2, '0')}`
}

export function prepareCommitmentSchedules(items) {
  return new Map(sanitizeCommitments(items).filter(item => item.kind === 'debt').map(item => [item.id, debtSchedule(item)]))
}

export function commitmentEvents(items, month, prepared = null) {
  return sanitizeCommitments(items).flatMap(item => {
    const row = item.kind === 'debt' ? (prepared?.get(item.id) || debtSchedule(item)).find(row => row.month === month) : item.date.slice(0, 7) === month ? { amount: item.amount - item.saved } : null
    return row && row.amount > 0 ? [{ id: `${item.id}:${month}`, commitmentId: item.id, description: item.name, type: 'expense', categoryId: item.kind === 'debt' ? 'debt' : 'other-expense', amount: row.amount, currency: item.currency, date: dueDate(month, Number(item.date.slice(8))), startDate: dueDate(month, Number(item.date.slice(8))), frequency: 'occasional', recordKind: 'planned', source: 'manual' }] : []
  })
}

export function financialCalendar(cashFlow, month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError('Mês inválido.')
  const events = []
  const undated = []
  for (const item of cashFlow.items || []) {
    if (item.recordKind === 'actual' || item.source === 'txt') continue
    if (!item.startDate) { undated.push(item); continue }
    if (month < item.startDate.slice(0, 7) || (item.endMode === 'retirement' ? cashFlow.retirementMonth && month >= cashFlow.retirementMonth : item.endDate && month > item.endDate.slice(0, 7))) continue
    if (item.frequency === 'occasional' && month !== item.startDate.slice(0, 7)) continue
    if (item.frequency === 'annual' && month.slice(5) !== item.startDate.slice(5, 7)) continue
    const date = dueDate(month, Number(item.startDate.slice(8)))
    if (item.endDate && item.endMode !== 'retirement' && date > item.endDate) continue
    events.push({ ...item, date })
  }
  events.push(...commitmentEvents(cashFlow.commitments, month))
  events.push(...consortiumEvents(cashFlow.consortia, month))
  return { events: events.sort((a, b) => a.date.localeCompare(b.date)), undated }
}
