import { budgetReviewLink, fieldReviewLink, reviewItemName } from './review-targets.js'
import { retirementMonth } from './cash-flow-timeline.js'
import { openSalaryItems, salaryEndMessage } from './cash-flow-checks.js'
import { planningHorizon } from './planning-horizon.js'
import { prepareCommitmentSchedules, sanitizeCommitments } from './financial-calendar.js'
import { prepareConsortiumEvents } from './consortium.js'
import { sanitizeAnnualRows } from './annual-planning.js'

function hasPlannedExpenses(cashFlow, planned) {
  if (planned.some(item => item.type === 'expense')) return true
  if (sanitizeAnnualRows(cashFlow.annualGoals).length) return true
  if (sanitizeCommitments(cashFlow.commitments).some(item => item.kind === 'goal' && item.amount > item.saved)) return true
  if ([...prepareCommitmentSchedules(cashFlow.commitments).values()].some(rows => rows.some(row => row.amount > 0))) return true
  return prepareConsortiumEvents(cashFlow.consortia).size > 0
}

export function planChecks(state, today = new Date()) {
  const result = []
  const add = (id, message, href) => result.push({ id, message, href })
  const planned = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt')
  if (!planned.some(item => item.type === 'income')) add('missing-income', 'Nenhuma receita planejada. Confira se o orçamento está completo.', '/construir/orcamento')
  if (!hasPlannedExpenses(state.cashFlow, planned)) add('missing-expense', 'Nenhuma despesa planejada. A capacidade de aporte pode estar superestimada.', '/construir/orcamento')
  let endMonth
  try { endMonth = planningHorizon(state.plan, today.toISOString().slice(0, 7), today).endMonth } catch {}
  const openSalaries = openSalaryItems(state.cashFlow, { endMonth })
  for (const item of openSalaries) add('salary-open', salaryEndMessage([item]), budgetReviewLink(item.id, 'endMode'))
  for (const item of planned.filter(item => item.frequency === 'occasional' && !item.startDate)) add('undated', `${reviewItemName(item)}: lançamento único sem data, excluído da evolução temporal.`, budgetReviewLink(item.id))
  if (state.cashFlow.retirementMonth && state.cashFlow.retirementMonth !== retirementMonth(state.plan, today)) add('dates-differ', 'O mês do orçamento difere do mês patrimonial. Confirme o mês novamente para alinhar os prazos.', fieldReviewLink('/construir/objetivo', 'retirementMonth'))
  if (state.plan.retirementMonth && state.plan.retirementMonth <= today.toISOString().slice(0, 7)) add('no-time', 'O mês da aposentadoria já chegou. A projeção não tem período de acumulação nem calcula aporte necessário para recuperar a meta.', fieldReviewLink('/construir/objetivo', 'retirementMonth'))
  if (!(state.cashFlow.retirementMonth || state.plan.retirementMonth)) for (const item of planned.filter(item => item.type === 'income' && item.endMode === 'retirement')) add('unresolved', `${reviewItemName(item)}: receita vinculada sem mês confirmado fica fora dos cálculos.`, budgetReviewLink(item.id, 'endMode'))
  if (state.plan.expectedMonthlyBenefit > 0 && !planned.some(item => item.categoryId === 'pension')) add('benefit-not-budgeted', 'Há benefício na projeção, mas nenhuma receita de aposentadoria no orçamento. Não adicionamos esse valor automaticamente.', '/construir/orcamento')
  if (!state.plan.spouseEnabled || !state.plan.spouseRetirementMonth) for (const item of planned.filter(item => item.endMode === 'spouse-retirement')) add('spouse-income-end', `${reviewItemName(item)}: receita vinculada ao cônjuge sem aposentadoria confirmada fica fora dos cálculos. Confirme o mês ou use término manual.`, budgetReviewLink(item.id, 'endMode'))
  // Multiple pensions may belong to spouses or represent distinct benefits of one person.
  // A count alone does not establish duplication.
  if (state.cashFlow.ledger?.accounts.length) add('accounts-separate', 'Contas, reserva e Carteira são registros separados. Confira sobreposição antes de consolidar seu patrimônio.', '/contas')
  if (state.plan.investments.length && Math.abs(state.plan.currentAssets - state.plan.investments.reduce((sum, item) => sum + item.amount, 0)) > 0.01) add('wealth-total', 'O patrimônio agregado difere da soma da Carteira. Revise os saldos.', '/carteira')
  if (state.plan.spouseEnabled && !(state.plan.spouseExpectedMonthlyBenefit > 0)) add('spouse-no-benefit', 'O cônjuge está incluído no plano, mas sem renda de previdência privada informada.', fieldReviewLink('/plano', 'spouseExpectedMonthlyBenefit'))
  return result
}
