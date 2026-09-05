import { state, updateCashFlow } from './state.js'
import { sanitizeLedger, validateAccount, validateMovement } from '../domain/accounts.js'
export function changeAccounts(action, data) {
  const ledger = sanitizeLedger(state.cashFlow.ledger)
  if (action === 'account') {
    if (ledger.accounts.length >= 20) throw new RangeError('Limite de 20 contas.')
    const account = { id: crypto.randomUUID(), name: String(data.get('name') || '').trim(), currency: data.get('currency'), openingDate: data.get('openingDate'), openingBalance: Number(data.get('openingBalance')) }
    validateAccount(account)
    ledger.accounts.push(account)
  } else if (action === 'movement') {
    if (ledger.movements.length >= 500) throw new RangeError('Limite de 500 movimentos.')
    const movement = { id: crypto.randomUUID(), type: data.get('type'), accountId: data.get('accountId'), destinationId: data.get('destinationId'), date: data.get('date'), amount: Number(data.get('amount')), receivedAmount: Number(data.get('receivedAmount')) }
    validateMovement(movement, ledger.accounts)
    ledger.movements.push(movement)
  } else if (action === 'delete-account') {
    if (ledger.movements.some(item => item.accountId === data || item.destinationId === data)) throw new RangeError('Remova os movimentos vinculados antes de excluir a conta.')
    ledger.accounts = ledger.accounts.filter(item => item.id !== data)
  } else if (action === 'delete-movement') ledger.movements = ledger.movements.filter(item => item.id !== data)
  else throw new RangeError('Operação inválida.')
  updateCashFlow({ ledger: sanitizeLedger(ledger) })
}
