import { state, updateCashFlow, updateCashFlowItem } from './state.js'
import { linkMovementBudget } from './accounts.js'
import { categoryById } from '../data/cash-flow-categories.js'

export function budgetCategoryTarget(source, id) {
  const collection = { item: state.cashFlow.items, annualGoals: state.cashFlow.annualGoals, commitments: state.cashFlow.commitments }[source]
  const target = collection?.find(row => row.id === id)
  if (!target || (source === 'item' && target.type !== 'expense')) throw new Error('Despesa não encontrada.')
  return target
}

export function saveBudgetCategory(source, id, categoryId) {
  const target = budgetCategoryTarget(source, id)
  const category = categoryById(categoryId, state.customCategories)
  if (!category || category.type !== 'expense') throw new Error('Selecione uma categoria de despesa.')
  if (source === 'item') {
    if (id.startsWith('ledger:')) {
      const data = new FormData()
      data.set('movementId', id.slice('ledger:'.length))
      data.set('categoryId', categoryId)
      linkMovementBudget(data)
    } else updateCashFlowItem(id, { categoryId })
  } else {
    updateCashFlow({ [source]: state.cashFlow[source].map(row => row.id === target.id ? { ...row, categoryId } : row) })
  }
}
