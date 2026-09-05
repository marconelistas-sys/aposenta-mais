import { state, updateCashFlow } from './state.js'
import { sanitizeLedger, validateAccount, validateMovement } from '../domain/accounts.js'
export function changeAccounts(action, data) {
  const ledger = sanitizeLedger(state.cashFlow.ledger)
  if (action === 'account') {
    const id = data.get('id') || null
    const current = id ? ledger.accounts.find(item => item.id === id) : null
    if (id && !current) throw new RangeError('Conta não encontrada.')
    if (!id && ledger.accounts.length >= 20) throw new RangeError('Limite de 20 contas.')
    if (data.get('openingBalance') === null || String(data.get('openingBalance')).trim() === '') throw new RangeError('Informe o saldo inicial.')
    const account = { id: id || crypto.randomUUID(), name: String(data.get('name') || '').trim(), currency: data.get('currency'), openingDate: data.get('openingDate'), openingBalance: Number(data.get('openingBalance')) }
    validateAccount(account)
    if (current && current.currency !== account.currency && ledger.movements.some(item => item.accountId === id || item.destinationId === id)) throw new RangeError('Não altere a moeda de uma conta com movimentos. Crie outra conta para essa moeda.')
    ledger.accounts = current ? ledger.accounts.map(item => item.id === id ? account : item) : [...ledger.accounts, account]
    for (const movement of ledger.movements) validateMovement(movement, ledger.accounts)
  } else if (action === 'movement') {
    const id = data.get('id') || null
    if (id && !ledger.movements.some(item => item.id === id)) throw new RangeError('Movimento não encontrado.')
    if (!id && ledger.movements.length >= 500) throw new RangeError('Limite de 500 movimentos.')
    const movement = { id: id || crypto.randomUUID(), type: data.get('type'), accountId: data.get('accountId'), destinationId: data.get('destinationId'), date: data.get('date'), amount: Number(data.get('amount')), receivedAmount: Number(data.get('receivedAmount')) }
    validateMovement(movement, ledger.accounts)
    ledger.movements = id ? ledger.movements.map(item => item.id === id ? movement : item) : [...ledger.movements, movement]
  } else if (action === 'delete-account') {
    if (ledger.movements.some(item => item.accountId === data || item.destinationId === data)) throw new RangeError('Remova os movimentos vinculados antes de excluir a conta.')
    ledger.accounts = ledger.accounts.filter(item => item.id !== data)
  } else if (action === 'delete-movement') ledger.movements = ledger.movements.filter(item => item.id !== data)
  else throw new RangeError('Operação inválida.')
  updateCashFlow({ ledger: sanitizeLedger(ledger) })
}
