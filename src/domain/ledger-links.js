import { validateMovement } from './accounts.js'
import { categoryById } from '../data/cash-flow-categories.js'

export function movementLeg(movement, accountId) {
  if (movement.accountId === accountId) return movement.amount * (movement.type === 'income' ? 1 : -1)
  if (movement.type === 'transfer' && movement.destinationId === accountId) return movement.receivedAmount
  throw new Error('O movimento não pertence à conta selecionada.')
}

export function reconcileMovement(ledger, input, now = new Date()) {
  const movement = ledger.movements.find(row => row.id === input.movementId)
  if (!movement) throw new Error('Movimento não encontrado.')
  validateMovement(movement, ledger.accounts)
  const reference = String(input.reference || '').trim()
  if (!reference || reference.length > 100 || !Number.isFinite(input.amount) || Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.0001 || input.date !== movement.date || input.date > now.toISOString().slice(0, 10) || Math.round(input.amount * 100) !== Math.round(movementLeg(movement, input.accountId) * 100)) throw new Error('Data e valor com sinal devem coincidir com o extrato. Informe uma referência única de até 100 caracteres.')
  if (ledger.movements.some(row => (row.reconciliations || []).some(match => match.accountId === input.accountId && match.reference === reference && row.id !== movement.id))) throw new Error('Essa referência do extrato já foi conciliada nesta conta.')
  const record = { accountId: input.accountId, reference, date: input.date, amount: input.amount, at: now.toISOString() }
  const updated = { ...ledger, movements: ledger.movements.map(row => row.id === movement.id ? { ...row, reconciliations: [...(row.reconciliations || []).filter(match => match.accountId !== input.accountId), record] } : row) }
  return recordReconciliation(updated, movement.id, [record], 'confirmed', now)
}

export function recordReconciliation(ledger, movementId, matches, operation, now = new Date()) {
  const events = matches.map(match => ({ movementId, accountId: match.accountId, reference: match.reference, operation, at: now.toISOString() }))
  return { ...ledger, reconciliationHistory: [...(ledger.reconciliationHistory || []), ...events].slice(-100) }
}

export function linkedBudgetItem(movement, ledger, categoryId, customCategories = []) {
  if (movement.id.length > 73) throw new Error('Identificador do movimento excede o limite para vínculo.')
  if (movement.type === 'transfer') throw new Error('Transferência não é receita nem despesa do orçamento.')
  const account = ledger.accounts.find(row => row.id === movement.accountId)
  const category = categoryById(categoryId, customCategories)
  if (!account || !category || category.type !== movement.type) throw new Error('Selecione uma categoria compatível com o movimento.')
  return { id: `ledger:${movement.id}`, type: movement.type, categoryId, description: `Movimento de ${account.name}`, amount: movement.amount, currency: account.currency, startDate: movement.date, endDate: null, endMode: 'none', recordKind: 'actual', source: 'manual', frequency: 'occasional' }
}

export function refreshBudgetLinks(cashFlow, ledger, customCategories = []) {
  const items = cashFlow.items.filter(item => !item.id.startsWith('ledger:'))
  for (const movement of ledger.movements) {
    if (movement.budgetCategoryId) items.push(linkedBudgetItem(movement, ledger, movement.budgetCategoryId, customCategories))
  }
  if (items.length > 100) throw new Error('O orçamento comporta até 100 lançamentos. Nenhuma alteração foi aplicada.')
  return items
}
