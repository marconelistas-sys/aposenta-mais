import { calculateMultiCurrencyCashFlow, retirementContributionSchedules } from './cash-flow.js'
import { projectRetirementWithSchedules } from './retirement.js'
import { resolveInvestmentRealReturn } from './investment-returns.js'

export function compareVariableContributions(state, asOfDate = new Date()) {
  const baseline = projectRetirementWithSchedules(state.plan, retirementContributionSchedules(state.cashFlow, state.currency, state.exchangeRates, state.customCategories), asOfDate)
  const source = state.plan.investments.length ? state.plan.investments : [{ amount: state.plan.currentAssets, monthlyContribution: state.plan.monthlyContribution, returnType: 'default' }]
  const buckets = source.map(item => ({ balance: item.amount, weight: state.plan.monthlyContribution > 0 ? item.monthlyContribution / state.plan.monthlyContribution : 0, rate: (1 + resolveInvestmentRealReturn(item, state.plan)) ** (1 / 12) - 1 }))
  const reserveTarget = state.cashFlow.emergencyReserveTarget
  let reserve = state.cashFlow.currentEmergencyReserve
  let pension = 0
  let contributionTotal = 0
  let reducedMonths = 0
  let firstReducedMonth = null
  let deficitTotal = 0
  const rows = []
  for (let index = 0; index < baseline.months; index++) {
    const date = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() + index, 15))
    const budget = calculateMultiCurrencyCashFlow({ ...state.cashFlow, items: state.cashFlow.items.filter(item => item.frequency !== 'occasional' || item.startDate), currentEmergencyReserve: reserve, reserveBuildMonths: Math.max(1, state.cashFlow.reserveBuildMonths - index) }, state.currency, state.exchangeRates, 0, state.customCategories, date)
    reserve = Math.min(Math.max(reserveTarget, reserve), reserve + budget.reserveMonthlyAllocation)
    const amount = Math.min(state.plan.monthlyContribution, budget.sustainableContribution)
    contributionTotal += amount
    deficitTotal += Math.max(0, budget.monthlyExpenses - budget.monthlyIncome)
    const month = date.toISOString().slice(0, 7)
    if (amount + 1e-8 < state.plan.monthlyContribution) { reducedMonths++; firstReducedMonth ||= month }
    for (const bucket of buckets) bucket.balance = bucket.balance * (1 + bucket.rate) + amount * bucket.weight
    pension = pension * (1 + baseline.monthlyRate) + budget.pensionContributions
    rows.push({ month, contribution: amount })
  }
  const projectedAssets = buckets.reduce((total, item) => total + item.balance, pension)
  return { baseline, projectedAssets, projectedMonthlyIncome: state.plan.expectedMonthlyBenefit + projectedAssets * state.plan.annualWithdrawalRate / 12, contributionTotal, reducedMonths, firstReducedMonth, deficitTotal, rows }
}
