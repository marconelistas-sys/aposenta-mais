import { state } from '../../app/state.js'
import { cashFlowTimeline, retirementMonth } from '../../domain/cash-flow-timeline.js'
import { privateCurrency, escapeHtml } from '../../shared/formatters.js'
import { openSalaryItems, salaryEndMessage } from '../../domain/cash-flow-checks.js'
import { renderBudgetInsights } from './budget-insights.js'
import { planningHorizon, annualCashFlow, cashFlowProjectionState } from '../../domain/planning-horizon.js'
import { renderCashFlowLineChart } from '../../shared/cash-flow-line-chart.js'
import { renderFinancialReconciliation } from '../../shared/financial-reconciliation.js'
import { renderHorizonForm } from '../plan/horizon.js'
import { finappViability, sanitizeFinappMethod } from '../../domain/finapp-viability.js'

export const timelineView = { period: 'target', selectedYear: null }

export function renderCashFlowTimeline() {
  const projectionState = cashFlowProjectionState(state, timelineView.period)
  const retirement = state.cashFlow.retirementMonth || state.plan.retirementMonth || retirementMonth(state.plan)
  const start = state.cashFlow.referenceMonth
  const distance = (Number(retirement.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(retirement.slice(5)) - Number(start.slice(5))
  let horizon = null, horizonError = ''
  if (['target', '100'].includes(timelineView.period)) { try { horizon = planningHorizon(projectionState.plan, start) } catch (error) { horizonError = error.message } }
  const months = horizon?.months || (timelineView.period === 'retirement' ? Math.min(1200, Math.max(12, distance + 24)) : timelineView.period === '60' ? 60 : 12)
  const points = cashFlowTimeline(projectionState, start, months, { includeBreakdown: !horizon && !state.valuesHidden })
  let annual = null
  if (horizon) { try { annual = finappViability(projectionState, undefined, new Date(), { includeBreakdown: !state.valuesHidden }) } catch (error) { horizonError = error.message } }
  const yearly = annual ? annual.rows.map(row => ({ ...row, months: 12, expenses: row.costs + row.goals, pension: row.pensionCredits, spending: row.costs + row.goals, balance: row.freeCashFlow })) : annualCashFlow(points).map(row => {
    const goals = row.breakdown?.goals.reduce((total, entry) => total + entry.amount, 0) || 0
    return { ...row, spending: row.expenses, goals, costs: row.expenses - goals, pensionCredits: row.pension, freeCashFlow: row.balance }
  })
  const markers = [{ year: retirement.slice(0, 4), label: 'Aposentadoria' }]
  if (timelineView.period === '100' && annual) {
    markers.push({ year: annual.horizon.endYear, label: '100 anos' })
    if (Number.isInteger(state.plan.targetAge) && state.plan.targetAge !== 100) markers.push({ year: Number(annual.horizon.reference.slice(0, 4)) + state.plan.targetAge - state.plan.currentAge, label: 'Idade-alvo salva' })
  }
  const external = sanitizeFinappMethod(state.plan.finappMethod).pensionMode === 'external'
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const deficit = points.find(point => point.balance < 0)
  const max = Math.max(1, ...points.flatMap(point => [point.income, point.expenses]))
  const x = index => 30 + index / Math.max(1, points.length - 1) * 740
  const path = key => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${(170 - point[key] / max * 140).toFixed(1)}`).join(' ')
  const marker = points.findIndex(point => point.month === retirement)
  const undated = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency === 'occasional' && !item.startDate).length
  const openSalaries = openSalaryItems(state.cashFlow, { endMonth: points.at(-1).month })
  return `<section class="panel settings-card" aria-labelledby="timeline-title">
    <p class="eyebrow">AVALIAÇÃO ANUAL</p><h2 id="timeline-title">Receitas e despesas ao longo do tempo</h2>
    ${horizonError ? `<p role="status">${horizonError} Não foi possível concluir a avaliação anual. O recorte mensal abaixo não comprova cobertura até a idade selecionada.</p>` : ''}
    ${renderHorizonForm()}<label>Período <select data-timeline-period><option value="target" ${timelineView.period === 'target' ? 'selected' : ''}>Até a idade-alvo configurada</option><option value="100" ${timelineView.period === '100' ? 'selected' : ''}>Até 100 anos, simulação</option><option value="12" ${timelineView.period === '12' ? 'selected' : ''}>12 meses</option><option value="60" ${timelineView.period === '60' ? 'selected' : ''}>5 anos</option><option value="retirement" ${timelineView.period === 'retirement' ? 'selected' : ''}>Até 2 anos após a aposentadoria</option></select></label>
    ${timelineView.period === '100' ? '<p>Simulação até 100 anos. A idade-alvo salva e as datas dos lançamentos não mudam. Esta opção pode encurtar um plano configurado acima de 100 anos. Salários e despesas encerrados não são prorrogados. Para tornar este o horizonte do plano e do risco, informe 100 no formulário acima e salve.</p>' : ''}
    <form data-budget-retirement-form><label>Mês da aposentadoria no orçamento <input type="month" name="retirementMonth" min="2000-01" max="2199-12" value="${retirement}" required /></label><button type="submit" class="button button--secondary">Confirmar mês e recalcular vínculos</button></form>
    <p>${state.cashFlow.retirementMonth ? 'Mês confirmado' : 'Sugestão pelas idades do plano, ainda não confirmada'}: ${retirement}. Receitas vinculadas terminam no mês anterior. Datas manuais não mudam. Este mês confirmado controla o orçamento e a projeção patrimonial. Alterar as idades gera uma nova estimativa de mês, que você pode revisar.</p>
    ${!state.cashFlow.retirementMonth && state.cashFlow.items.some(item => item.endMode === 'retirement') ? '<p>Há receitas vinculadas sem mês confirmado. Elas ficam fora dos cálculos até você confirmar o mês.</p>' : ''}
    <p>Série mensal de ${start} a ${points.at(-1).month}. ${annual ? `Gráfico anual de ${annual.rows[0].year} a ${annual.rows.at(-1).year}, anos completos, ${timelineView.period === '100' ? 'cenário até 100 anos, sem alterar o horizonte salvo da viabilidade e do risco' : 'mesma base da viabilidade e do risco anual'}.` : 'Gráfico somado pelos meses incluídos, sem extrapolar anos parciais.'}</p>
    ${openSalaries.length ? `<p>${state.valuesHidden ? 'Há salário recorrente sem término definido. Exiba os dados para revisar os lançamentos.' : escapeHtml(salaryEndMessage(openSalaries))}</p>` : ''}
    ${undated ? `<p>${undated} lançamento(s) eventual(is) sem data foram excluídos desta série. Informe uma data no cadastro para incluí-los.</p>` : ''}
    <p>${deficit ? `Primeiro mês com despesas acima das receitas neste período: ${deficit.month}.` : 'Não há déficit no orçamento previsto deste período.'} Confira os prazos dos lançamentos antes de interpretar o resultado.</p>
    ${renderCashFlowLineChart({ title: 'Fluxos anuais', rows: yearly, plan: projectionState.plan, cashFlow: state.cashFlow, currency: state.currency, hidden: state.valuesHidden, markers, selectedYear: timelineView.selectedYear })}
    <p>Saldo do orçamento = receitas menos custos e metas. ${external ? 'Previdência externa fica fora desse saldo e aumenta o patrimônio.' : 'Modo financiado: contribuições são pagas pelo orçamento e já estão nos custos. A informação previdenciária é complementar, não deve ser subtraída novamente.'} Liberações de patrimônio não são receita nem entram nesse saldo. <a href="/viabilidade" data-route>Revisar origem da previdência, saldos e liberações</a>.</p>
    <p>Saldo do orçamento negativo não significa automaticamente insolvência: pode ser coberto pelo patrimônio líquido disponível. ${annual ? `No último ano, patrimônio financeiro: ${money(annual.rows.at(-1).financialAssets)}. Liquidez: ${money(annual.rows.at(-1).liquidAssets)}. ${annual.firstFailure ? `Há insuficiência de financeiro líquido ou liquidez desde ${annual.firstFailure.year}.` : 'Não há insuficiência nos fechamentos anuais calculados.'}` : 'Configure a idade-alvo para avaliar a cobertura patrimonial.'}</p>
    ${annual ? renderFinancialReconciliation({ rows: annual.rows, currency: state.currency, hidden: state.valuesHidden }) : ''}
    <details class="disclosure"><summary>Ver totais anuais</summary><div class="currency-table" tabindex="0" role="region" aria-label="Fluxos anuais"><table><thead><tr><th>Ano</th><th>Meses incluídos</th><th>Entradas</th><th>Custos e metas no saldo</th><th>Previdência, informativa</th><th>Saldo</th></tr></thead><tbody>${yearly.map(row => `<tr><th scope="row">${row.year}</th><td>${row.months}</td><td>${money(row.income)}</td><td>${money(row.expenses)}</td><td>${money(row.pension)}</td><td>${money(row.balance)}</td></tr>`).join('')}</tbody></table></div></details>
    <details class="disclosure"><summary>Ver valores por mês</summary><div class="currency-table"><table><caption>Orçamento mensal previsto em ${state.currency}</caption><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Saldo</th></tr></thead><tbody>${points.map(point => `<tr><th scope="row">${point.month}${point.month === retirement ? ' · Aposentadoria' : ''}</th><td>${money(point.income)}</td><td>${money(point.expenses)}</td><td>${money(point.balance)}</td></tr>`).join('')}</tbody></table></div></details>
    <p>Orçamento mensal equivalente, não saldo bancário: valores anuais divididos por 12, meses de início e fim incluídos integralmente. Câmbio fixo e valores reais, sem rendimentos nesta tabela mensal. Inflação implícita na hipótese de poder de compra constante. Realizados e eventuais sem data não entram. Benefícios de aposentadoria só entram se cadastrados como receita, com início definido. Esta série não ajusta os aportes constantes da projeção patrimonial.</p>
  </section>${renderBudgetInsights(state, points)}`
}
