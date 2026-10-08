import { categoryById } from '../data/cash-flow-categories.js'

export function pensionOutsideBudget(state, item) {
  return state.plan?.finappMethod?.pensionMode !== 'cash-funded'
    && item.type === 'expense'
    && (item.category || categoryById(item.categoryId, state.customCategories))?.budgetGroup === 'pension'
}

export function cashFlowForBudget(state) {
  return { ...state.cashFlow, items: (state.cashFlow.items || []).filter(item => !pensionOutsideBudget(state, item)) }
}
