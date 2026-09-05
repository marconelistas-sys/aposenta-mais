import { state, updateCashFlow } from './state.js'
import { sanitizeLedger, validateAccount, validateMovement } from '../domain/accounts.js'
import { refreshBudgetLinks, reconcileMovement, linkedBudgetItem, recordReconciliation } from '../domain/ledger-links.js'
export function changeAccounts(action, data) {
  let ledger = sanitizeLedger(state.cashFlow.ledger)
  if (action === 'account') {
    const id = data.get('id') || null
    const current = id ? ledger.accounts.find(item => item.id === id) : null
    if (id && !current) throw new RangeError('Conta não encontrada.')
    if (!id && ledger.accounts.length >= 20) throw new RangeError('Limite de 20 contas.')
    if (data.get('openingBalance') === null || String(data.get('openingBalance')).trim() === '') throw new RangeError('Informe o saldo inicial.')
    const account = { id: id || crypto.randomUUID(), name: String(data.get('name') || '').trim(), currency: data.get('currency'), openingDate: data.get('openingDate'), openingBalance: Number(data.get('openingBalance')) }
    validateAccount(account)
    if (current && current.currency !== account.currency && ledger.movements.some(item => item.accountId === id || item.destinationId === id)) throw new RangeError('Não altere a moeda de uma conta com movimentos. Crie outra conta para essa moeda.')
    ledger.accounts = current ? ledger.accounts.map(item => item.id === id ? { ...current, ...account } : item) : [...ledger.accounts, account]
    for (const movement of ledger.movements) validateMovement(movement, ledger.accounts)
  } else if (action === 'movement') {
    const id = data.get('id') || null
    if (id && !ledger.movements.some(item => item.id === id)) throw new RangeError('Movimento não encontrado.')
    if (!id && ledger.movements.length >= 500) throw new RangeError('Limite de 500 movimentos.')
    const movement = { id: id || crypto.randomUUID(), type: data.get('type'), accountId: data.get('accountId'), destinationId: data.get('destinationId'), date: data.get('date'), amount: Number(data.get('amount')), receivedAmount: Number(data.get('receivedAmount')) }
    validateMovement(movement, ledger.accounts)
    const previous = ledger.movements.find(row => row.id === id)
    if (previous?.reconciliations?.length) ledger = recordReconciliation(ledger, id, previous.reconciliations, 'edited')
    if (previous?.budgetCategoryId && previous.type === movement.type) movement.budgetCategoryId = previous.budgetCategoryId
    // Editing a movement invalidates its previous statement confirmation.
    ledger.movements = id ? ledger.movements.map(item => item.id === id ? movement : item) : [...ledger.movements, movement]
  } else if (action === 'delete-account') {
    if (ledger.movements.some(item => item.accountId === data || item.destinationId === data)) throw new RangeError('Remova os movimentos vinculados antes de excluir a conta.')
    ledger.accounts = ledger.accounts.filter(item => item.id !== data)
  } else if (action === 'delete-movement') {
    const previous = ledger.movements.find(item => item.id === data)
    if (previous?.reconciliations?.length) ledger = recordReconciliation(ledger, data, previous.reconciliations, 'deleted')
    ledger.movements = ledger.movements.filter(item => item.id !== data)
  }
  else throw new RangeError('Operação inválida.')
  const safeLedger = sanitizeLedger(ledger)
  updateCashFlow({ ledger: safeLedger, items: refreshBudgetLinks(state.cashFlow, safeLedger, state.customCategories) })
}

export function reconcileLedgerMovement(data) {
  const ledger = reconcileMovement(state.cashFlow.ledger, { movementId: data.get('movementId'), accountId: data.get('accountId'), date: data.get('date'), amount: Number(data.get('amount')), reference: data.get('reference') })
  updateCashFlow({ ledger })
}

export function linkMovementBudget(data) {
  const ledger = structuredClone(state.cashFlow.ledger)
  const movement = ledger.movements.find(row => row.id === data.get('movementId'))
  if (!movement) throw new Error('Movimento não encontrado.')
  const categoryId = data.get('categoryId')
  let cashFlow = state.cashFlow
  if (categoryId) {
    const linked = linkedBudgetItem(movement, ledger, categoryId, state.customCategories)
    const matches = cashFlow.items.filter(item => !item.id.startsWith('ledger:') && item.recordKind === 'actual' && item.startDate === linked.startDate && item.type === linked.type && item.currency === linked.currency && Math.round(item.amount * 100) === Math.round(linked.amount * 100))
    const existingId = data.get('existingItemId') || ''
    if (existingId && !matches.some(item => item.id === existingId)) throw new Error('O realizado selecionado precisa ter a mesma data, moeda, tipo e valor do movimento.')
    if (matches.length && !existingId) throw new Error('Já existe um realizado compatível. Selecione-o para substituir pelo vínculo, sem somar novamente.')
    if (matches.length > 1) throw new Error('Há vários realizados compatíveis. Revise as duplicidades no orçamento antes de vincular.')
    if (existingId) cashFlow = { ...cashFlow, items: cashFlow.items.filter(item => item.id !== existingId) }
    movement.budgetCategoryId = categoryId
  }
  else delete movement.budgetCategoryId
  updateCashFlow({ ledger, items: refreshBudgetLinks(cashFlow, ledger, state.customCategories) })
}
