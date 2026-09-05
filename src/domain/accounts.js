import { currencies } from '../shared/currencies.js'

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const validId = id => typeof id === 'string' && /^[\w:-]{1,80}$/.test(id)
export function validateAccount(account) {
  if (!validId(account.id) || typeof account.name !== 'string' || !account.name.trim() || account.name.length > 60 || !Object.hasOwn(currencies, account.currency) || !Number.isFinite(account.openingBalance) || Math.abs(account.openingBalance) > 1e9 || !validDate(account.openingDate)) throw new RangeError('Revise nome, moeda, data e saldo inicial da conta.')
}
export function validateMovement(movement, accounts) {
  const from = accounts.find(account => account.id === movement.accountId)
  const to = accounts.find(account => account.id === movement.destinationId)
  if (!validId(movement.id) || !from || !['income', 'expense', 'transfer'].includes(movement.type) || !validDate(movement.date) || movement.date < from.openingDate || !Number.isFinite(movement.amount) || movement.amount <= 0 || movement.amount > 1e9) throw new RangeError('Revise a conta, o valor e a data do movimento.')
  if (movement.type === 'transfer' && (!to || to.id === from.id || movement.date < to.openingDate || !Number.isFinite(movement.receivedAmount) || movement.receivedAmount <= 0 || movement.receivedAmount > 1e9 || (to.currency === from.currency && movement.receivedAmount !== movement.amount))) throw new RangeError('Revise o destino e o valor recebido. Na mesma moeda, os valores devem ser iguais.')
}
export function sanitizeLedger(value) {
  const accounts = [], movements = []
  for (const raw of Array.isArray(value?.accounts) ? value.accounts.slice(0, 20) : []) {
    if (!raw) continue
    const account = { id: raw.id, name: raw.name, currency: raw.currency, openingBalance: raw.openingBalance, openingDate: raw.openingDate }
    try { validateAccount(account); if (!accounts.some(item => item.id === account.id)) accounts.push(account) } catch {}
  }
  for (const raw of Array.isArray(value?.movements) ? value.movements.slice(0, 500) : []) {
    if (!raw) continue
    const movement = { id: raw.id, type: raw.type, accountId: raw.accountId, destinationId: raw.type === 'transfer' ? raw.destinationId : null, amount: raw.amount, receivedAmount: raw.type === 'transfer' ? raw.receivedAmount : null, date: raw.date }
    try { validateMovement(movement, accounts); if (!movements.some(item => item.id === movement.id)) movements.push(movement) } catch {}
  }
  return { accounts, movements }
}
export function accountBalances(ledger, date) {
  if (!validDate(date)) throw new RangeError('Data de consulta inválida.')
  return ledger.accounts.filter(account => account.openingDate <= date).map(account => {
    let balance = account.openingBalance
    for (const movement of ledger.movements.filter(item => item.date <= date)) {
      if (movement.accountId === account.id) balance += movement.type === 'income' ? movement.amount : -movement.amount
      if (movement.type === 'transfer' && movement.destinationId === account.id) balance += movement.receivedAmount
    }
    return { ...account, balance }
  })
}
