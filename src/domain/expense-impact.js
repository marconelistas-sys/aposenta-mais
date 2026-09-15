import { finappViability } from './finapp-viability.js'
import { projectAnnualInvestments } from './annual-investment-projection.js'
import { assessPropertySolvency } from './property-solvency.js'
import { categoryById } from '../data/cash-flow-categories.js'

export function simulateExpenseReduction(state, { itemId, percent, startYear, targetAge = state.plan.targetAge }, today = new Date()) {
  const baseYear = today.getUTCFullYear()
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Informe uma redução entre 0% e 100%.')
  if (!Number.isInteger(startYear) || startYear < baseYear || startYear > 2199) throw new Error('Informe um ano inicial válido, a partir do ano atual.')
  const item = state.cashFlow.items.find(item => item.id === itemId)
  const category = categoryById(item?.categoryId, state.customCategories)
  if (!item || item.type !== 'expense' || item.recordKind === 'actual' || item.source === 'txt' || item.id.startsWith('ledger:') || !['essential', 'variable'].includes(category?.budgetGroup)) throw new Error('Selecione uma despesa planejada de consumo. Dívidas, metas e previdência exigem revisão própria.')
  if (targetAge !== state.plan.targetAge && targetAge !== 100) throw new Error('Use a idade-alvo salva ou a simulação até 100 anos.')
  const context = { ...state, plan: { ...state.plan, targetAge } }
  const baseline = finappViability(context, undefined, today, { includeBreakdown: true })
  if (startYear > baseline.horizon.endYear) throw new Error('O ano inicial deve estar dentro do horizonte do plano.')
  let totalReduction = 0
  const deltas = []
  const rows = baseline.rows.map(row => {
    const expense = row.breakdown.costs.find(entry => entry.budgetItemId === item.id && entry.source === 'Orçamento')
    const reduction = Number(row.year) >= startYear ? (expense?.amount || 0) * percent / 100 : 0
    totalReduction += reduction
    deltas.push({ year: row.year, reduction })
    return { ...row, costs: row.costs - reduction, breakdown: { ...row.breakdown, costs: row.breakdown.costs.map(entry => entry === expense ? { ...entry, amount: entry.amount - reduction, originalAmount: entry.originalAmount * (entry.amount ? (entry.amount - reduction) / entry.amount : 1) } : entry) } }
  })
  const changed = assessPropertySolvency(projectAnnualInvestments(rows, baseline.investmentModel), state.cashFlow.includeRealEstateInSolvency)
  const firstFailure = changed.find(row => row.netFinancial < -0.005 || row.liquidAssets < -0.005)
  return { name: item.description || category.name, percent, startYear, targetAge, endYear: baseline.horizon.endYear, baseline, changed, firstFailure, totalReduction, deltas,
    finalDifference: changed.at(-1).financialAssets - baseline.rows.at(-1).financialAssets }
}
