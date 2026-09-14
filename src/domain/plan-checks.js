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
  if (openSalaries.length) add('salary-open', salaryEndMessage(openSalaries), '/fluxo-caixa')
  if (planned.some(item => item.frequency === 'occasional' && !item.startDate)) add('undated', 'Há lançamento único sem data, excluído da evolução temporal.', '/fluxo-caixa')
  if (state.cashFlow.retirementMonth && state.cashFlow.retirementMonth !== retirementMonth(state.plan, today)) add('dates-differ', 'O mês do orçamento difere do mês patrimonial. Confirme o mês novamente para alinhar os prazos.', '/construir/objetivo')
  if (state.plan.retirementMonth && state.plan.retirementMonth <= today.toISOString().slice(0, 7)) add('no-time', 'O mês da aposentadoria já chegou. A projeção não tem período de acumulação nem calcula aporte necessário para recuperar a meta.', '/construir/objetivo')
  if (planned.some(item => item.type === 'income' && item.endMode === 'retirement') && !(state.cashFlow.retirementMonth || state.plan.retirementMonth)) add('unresolved', 'Receita vinculada sem mês confirmado fica fora dos cálculos.', '/fluxo-caixa')
  if (state.plan.expectedMonthlyBenefit > 0 && !planned.some(item => item.categoryId === 'pension')) add('benefit-not-budgeted', 'Há benefício na projeção, mas nenhuma receita de aposentadoria no orçamento. Não adicionamos esse valor automaticamente.', '/construir/orcamento')
  // Multiple pensions may belong to spouses or represent distinct benefits of one person.
  // A count alone does not establish duplication.
  if (state.cashFlow.ledger?.accounts.length) add('accounts-separate', 'Contas, reserva e Carteira são registros separados. Confira sobreposição antes de consolidar seu patrimônio.', '/contas')
  if (state.plan.investments.length && Math.abs(state.plan.currentAssets - state.plan.investments.reduce((sum, item) => sum + item.amount, 0)) > 0.01) add('wealth-total', 'O patrimônio agregado difere da soma da Carteira. Revise os saldos.', '/carteira')
  if (state.plan.spouseEnabled && !(state.plan.spouseExpectedMonthlyBenefit > 0)) add('spouse-no-benefit', 'O cônjuge está incluído no plano, mas sem renda de previdência privada informada.', '/plano')
  return result
}
