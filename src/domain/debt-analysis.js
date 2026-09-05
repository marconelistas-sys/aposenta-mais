import { validDate } from './accounts.js'

const cents = value => Math.round(value * 100)
const money = value => value / 100
const validMoney = (value, max, allowZero = false) => Number.isFinite(value) && value >= (allowZero ? 0 : 0.01) && value <= max && Math.abs(value * 100 - cents(value)) < 0.0001
const validMonth = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && validDate(`${value}-01`)
const monthIndex = value => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1
function monthAt(index) {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`
}

export function validateDebtTerms(item) {
  if (!item || !validMoney(item.amount, 1e9) || !validDate(item.date) || !Number.isInteger(item.installments) || item.installments < 1 || item.installments > 600 || !Number.isFinite(item.annualRate) || item.annualRate < 0 || item.annualRate > 1) throw new RangeError('Revise valor, data, prazo e juros da dívida.')
  if (!['price', 'sac'].includes(item.amortization ?? 'price') || !validMoney(item.monthlyFee ?? 0, 1e7, true)) throw new RangeError('Revise o sistema de amortização e a tarifa mensal.')
  const extras = item.extraPayments ?? []
  if (!Array.isArray(extras) || extras.length > 100) throw new RangeError('Informe até 100 amortizações extraordinárias.')
  const first = monthIndex(item.date.slice(0, 7))
  if (first + item.installments - 1 > 9999 * 12 + 11) throw new RangeError('O prazo excede o calendário suportado.')
  let previous = first - 1
  for (const extra of extras) {
    if (!extra || !validMonth(extra.month) || !validMoney(extra.amount, 1e9)) throw new RangeError('Revise mês e valor das amortizações extraordinárias.')
    const index = monthIndex(extra.month)
    if (index < first || index >= first + item.installments || index <= previous) throw new RangeError('Ordene as amortizações por mês, sem repetições e dentro do prazo da dívida.')
    previous = index
  }
}

export function advancedDebtSchedule(item) {
  validateDebtTerms(item)
  const rate = Math.expm1(Math.log1p(item.annualRate) / 12)
  const opening = cents(item.amount)
  const payment = Math.round(rate === 0 ? opening / item.installments : opening * rate / -Math.expm1(-item.installments * Math.log1p(rate)))
  const sacPrincipal = Math.round(opening / item.installments)
  const fee = cents(item.monthlyFee ?? 0)
  const extras = new Map((item.extraPayments ?? []).map(extra => [extra.month, cents(extra.amount)]))
  const first = monthIndex(item.date.slice(0, 7))
  const rows = []
  let balance = opening
  for (let index = 0; index < item.installments && balance > 0; index++) {
    const month = monthAt(first + index)
    const interest = Math.round(balance * rate)
    const regularPrincipal = index === item.installments - 1 ? balance : Math.min(balance, Math.max(0, item.amortization === 'sac' ? sacPrincipal : payment - interest))
    const extraPayment = Math.min(balance - regularPrincipal, extras.get(month) ?? 0)
    const principal = regularPrincipal + extraPayment
    balance -= principal
    rows.push({ month, amount: money(principal + interest + fee), interest: money(interest), principal: money(principal), extraPayment: money(extraPayment), fee: money(fee), balance: money(balance) })
  }
  return rows
}

export function summaryDebt(item, month) {
  if (!validMonth(month)) throw new RangeError('Mês inválido.')
  const schedule = advancedDebtSchedule(item)
  const baseline = advancedDebtSchedule({ ...item, extraPayments: [] })
  const sum = (rows, key) => money(rows.reduce((total, row) => total + cents(row[key]), 0))
  const totalInterest = sum(schedule, 'interest')
  const baselineInterest = sum(baseline, 'interest')
  const before = schedule.filter(row => row.month < month).at(-1)
  const through = schedule.filter(row => row.month <= month).at(-1)
  return {
    balanceBefore: before?.balance ?? item.amount,
    balanceAfter: through?.balance ?? item.amount,
    totalInterest,
    totalFees: sum(schedule, 'fee'),
    totalPaid: sum(schedule, 'amount'),
    payoffMonth: schedule.at(-1)?.month ?? null,
    baselineInterest,
    interestSavings: money(cents(baselineInterest) - cents(totalInterest)),
    schedule,
  }
}
