import { currencies } from '../shared/currencies.js'

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const validId = id => typeof id === 'string' && /^[\w:-]{1,80}$/.test(id)
const hasCents = value => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001
export function validateAccount(account) {
  if (!validId(account.id) || typeof account.name !== 'string' || !account.name.trim() || account.name.length > 60 || !Object.hasOwn(currencies, account.currency) || !Number.isFinite(account.openingBalance) || !hasCents(account.openingBalance) || Math.abs(account.openingBalance) > 1e9 || !validDate(account.openingDate)) throw new RangeError('Revise nome, moeda, data e saldo inicial da conta. Use até duas casas decimais.')
}
export function validateMovement(movement, accounts) {
  const from = accounts.find(account => account.id === movement.accountId)
  const to = accounts.find(account => account.id === movement.destinationId)
  if (!hasCents(movement.amount) || (movement.type === 'transfer' && !hasCents(movement.receivedAmount))) throw new RangeError('Use até duas casas decimais nos valores.')
  if (!validId(movement.id) || !from || !['income', 'expense', 'transfer'].includes(movement.type) || !validDate(movement.date) || movement.date < from.openingDate || !Number.isFinite(movement.amount) || movement.amount <= 0 || movement.amount > 1e9) throw new RangeError('Revise a conta, o valor e a data do movimento.')
  if (movement.type === 'transfer' && (!to || to.id === from.id || movement.date < to.openingDate || !Number.isFinite(movement.receivedAmount) || movement.receivedAmount <= 0 || movement.receivedAmount > 1e9 || (to.currency === from.currency && movement.receivedAmount !== movement.amount))) throw new RangeError('Revise o destino e o valor recebido. Na mesma moeda, os valores devem ser iguais.')
}
export function sanitizeLedger(value) {
  const accounts = [], movements = []
  const usedReferences = new Set()
  for (const raw of Array.isArray(value?.accounts) ? value.accounts.slice(0, 20) : []) {
    if (!raw) continue
    const account = { id: raw.id, name: raw.name, currency: raw.currency, openingBalance: raw.openingBalance, openingDate: raw.openingDate }
    if (validId(raw.investmentId) && validDate(raw.investmentSyncDate)) { account.investmentId = raw.investmentId; account.investmentSyncDate = raw.investmentSyncDate }
    try { validateAccount(account); if (!accounts.some(item => item.id === account.id)) accounts.push(account) } catch {}
  }
  for (const raw of Array.isArray(value?.movements) ? value.movements.slice(0, 500) : []) {
    if (!raw) continue
    const movement = { id: raw.id, type: raw.type, accountId: raw.accountId, destinationId: raw.type === 'transfer' ? raw.destinationId : null, amount: raw.amount, receivedAmount: raw.type === 'transfer' ? raw.receivedAmount : null, date: raw.date }
    try { validateMovement(movement, accounts); if (movements.some(item => item.id === movement.id)) continue } catch { continue }
    if (raw.type !== 'transfer' && validId(raw.budgetCategoryId)) movement.budgetCategoryId = raw.budgetCategoryId
    const matches = (Array.isArray(raw.reconciliations) ? raw.reconciliations : []).filter(match => match && typeof match.reference === 'string' && match.reference.trim() && match.reference.length <= 100 && Number.isFinite(Date.parse(match.at)) && match.date === raw.date && Number.isFinite(match.amount) && hasCents(match.amount) && ((match.accountId === raw.accountId && match.amount === raw.amount * (raw.type === 'income' ? 1 : -1)) || (raw.type === 'transfer' && match.accountId === raw.destinationId && match.amount === raw.receivedAmount))).slice(0, 2)
    const seenAccounts = new Set()
    const uniqueMatches = matches.filter(match => {
      const key = JSON.stringify([match.accountId, match.reference])
      if (usedReferences.has(key) || seenAccounts.has(match.accountId)) return false
      usedReferences.add(key); seenAccounts.add(match.accountId); return true
    })
    if (uniqueMatches.length) movement.reconciliations = uniqueMatches.map(({ accountId, reference, date, amount, at }) => ({ accountId, reference, date, amount, at }))
    try { validateMovement(movement, accounts); if (!movements.some(item => item.id === movement.id)) movements.push(movement) } catch {}
  }
  const result = { accounts, movements }
  const history = (Array.isArray(value?.reconciliationHistory) ? value.reconciliationHistory : []).filter(item => item && validId(item.movementId) && validId(item.accountId) && ['confirmed', 'revoked', 'edited', 'deleted'].includes(item.operation) && typeof item.reference === 'string' && item.reference.length <= 100 && Number.isFinite(Date.parse(item.at))).slice(-100).map(({ movementId, accountId, reference, operation, at }) => ({ movementId, accountId, reference, operation, at }))
  if (history.length) result.reconciliationHistory = history
  return result
}
export function accountBalances(ledger, date) {
  if (!validDate(date)) throw new RangeError('Data de consulta inválida.')
  return ledger.accounts.filter(account => account.openingDate <= date).map(account => {
    let cents = Math.round(account.openingBalance * 100)
    for (const movement of ledger.movements.filter(item => item.date <= date)) {
      if (movement.accountId === account.id) cents += Math.round(movement.amount * 100) * (movement.type === 'income' ? 1 : -1)
      if (movement.type === 'transfer' && movement.destinationId === account.id) cents += Math.round(movement.receivedAmount * 100)
    }
    return { ...account, balance: cents / 100 }
  })
}
