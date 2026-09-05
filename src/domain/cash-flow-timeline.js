import { calculateMultiCurrencyCashFlow } from './cash-flow.js'

export function retirementMonth(plan, today = new Date()) {
  if (plan.retirementMonth) return plan.retirementMonth
  const months = Math.round((plan.retirementAge - plan.currentAge) * 12)
  if (!Number.isFinite(months) || months < 0 || months > 1200) throw new RangeError('Prazo de aposentadoria inválido.')
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1)).toISOString().slice(0, 7)
}

export function lastIncomeDate(plan, today = new Date()) {
  const month = retirementMonth(plan, today)
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCDate(0)
  return date.toISOString().slice(0, 10)
}

export function cashFlowTimeline(state, startMonth, months) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) || !Number.isInteger(months) || months < 1 || months > 1200) throw new RangeError('Período inválido.')
  const start = new Date(`${startMonth}-01T00:00:00Z`)
  // Monthly budget, not daily cash settlement. Include both boundary months.
  const cashFlow = { ...state.cashFlow, items: state.cashFlow.items.filter(item => item.frequency !== 'occasional' || item.startDate) }
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 15))
    const result = calculateMultiCurrencyCashFlow(cashFlow, state.currency, state.exchangeRates, 0, state.customCategories, date)
    return { month: date.toISOString().slice(0, 7), income: result.monthlyIncome, expenses: result.monthlyExpenses, balance: result.monthlyIncome - result.monthlyExpenses }
  })
}
