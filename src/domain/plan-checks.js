import { retirementMonth } from './cash-flow-timeline.js'
export function planChecks(state, today = new Date()) {
  const result = []
  const add = (id, message, href) => result.push({ id, message, href })
  const planned = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt')
  if (!planned.some(item => item.type === 'income')) add('missing-income', 'Nenhuma receita planejada. Confira se o orçamento está completo.', '/construir/orcamento')
  if (!planned.some(item => item.type === 'expense')) add('missing-expense', 'Nenhuma despesa planejada. A capacidade de aporte pode estar superestimada.', '/construir/orcamento')
  if (planned.some(item => item.categoryId === 'salary' && !item.endDate && item.endMode !== 'retirement')) add('salary-open', 'Há salário sem término, inclusive após a aposentadoria.', '/fluxo-caixa')
  if (planned.some(item => item.frequency === 'occasional' && !item.startDate)) add('undated', 'Há lançamento único sem data, excluído da evolução temporal.', '/fluxo-caixa')
  if (state.cashFlow.retirementMonth && state.cashFlow.retirementMonth !== retirementMonth(state.plan, today)) add('dates-differ', 'O mês do orçamento difere do mês patrimonial. Confirme o mês novamente para alinhar os prazos.', '/construir/objetivo')
  if (state.plan.retirementMonth && state.plan.retirementMonth <= today.toISOString().slice(0, 7)) add('no-time', 'O mês da aposentadoria já chegou. A projeção não tem período de acumulação nem calcula aporte necessário para recuperar a meta.', '/construir/objetivo')
  if (planned.some(item => item.endMode === 'retirement') && !state.cashFlow.retirementMonth) add('unresolved', 'Receita vinculada sem mês confirmado fica fora dos cálculos.', '/fluxo-caixa')
  if (state.plan.expectedMonthlyBenefit > 0 && !planned.some(item => item.categoryId === 'pension')) add('benefit-not-budgeted', 'Há benefício na projeção, mas nenhuma receita de aposentadoria no orçamento. Não adicionamos esse valor automaticamente.', '/construir/orcamento')
  if (planned.filter(item => item.categoryId === 'pension').length > 1) add('benefit-review', 'Há mais de uma receita de aposentadoria. Confira se representam benefícios diferentes.', '/fluxo-caixa')
  if (state.cashFlow.ledger?.accounts.length) add('accounts-separate', 'Contas, reserva e Carteira são registros separados. Confira sobreposição antes de consolidar seu patrimônio.', '/contas')
  if (state.plan.investments.length && Math.abs(state.plan.currentAssets - state.plan.investments.reduce((sum, item) => sum + item.amount, 0)) > 0.01) add('wealth-total', 'O patrimônio agregado difere da soma da Carteira. Revise os saldos.', '/carteira')
  return result
}
