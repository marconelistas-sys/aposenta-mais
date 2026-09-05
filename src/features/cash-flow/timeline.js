import { state } from '../../app/state.js'
import { cashFlowTimeline, retirementMonth } from '../../domain/cash-flow-timeline.js'
import { privateCurrency } from '../../shared/formatters.js'
import { renderBudgetInsights } from './budget-insights.js'
import { planningHorizon, annualCashFlow } from '../../domain/planning-horizon.js'
import { planningChart } from '../../shared/planning-chart.js'
import { renderHorizonForm } from '../plan/horizon.js'
import { finappViability, sanitizeFinappMethod } from '../../domain/finapp-viability.js'

export const timelineView = { period: 'target' }

export function renderCashFlowTimeline() {
  const retirement = state.cashFlow.retirementMonth || state.plan.retirementMonth || retirementMonth(state.plan)
  const start = state.cashFlow.referenceMonth
  const distance = (Number(retirement.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(retirement.slice(5)) - Number(start.slice(5))
  let horizon = null, horizonError = ''
  if (timelineView.period === 'target') { try { horizon = planningHorizon(state.plan, start) } catch (error) { horizonError = error.message } }
  const months = horizon?.months || (timelineView.period === 'retirement' ? Math.min(1200, Math.max(12, distance + 24)) : timelineView.period === '60' ? 60 : 12)
  const points = cashFlowTimeline(state, start, months)
  let annual = null
  if (horizon) { try { annual = finappViability(state) } catch (error) { horizonError = error.message } }
  const yearly = annual ? annual.rows.map(row => ({ ...row, months: 12, expenses: row.costs + row.goals, pension: row.pensionCredits, spending: row.costs + row.goals, balance: row.freeCashFlow })) : annualCashFlow(points).map(row => ({ ...row, spending: row.expenses }))
  const external = sanitizeFinappMethod(state.plan.finappMethod).pensionMode === 'external'
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const deficit = points.find(point => point.balance < 0)
  const max = Math.max(1, ...points.flatMap(point => [point.income, point.expenses]))
  const x = index => 30 + index / Math.max(1, points.length - 1) * 740
  const path = key => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${(170 - point[key] / max * 140).toFixed(1)}`).join(' ')
  const marker = points.findIndex(point => point.month === retirement)
  const undated = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency === 'occasional' && !item.startDate).length
  const openSalaries = state.cashFlow.items.filter(item => item.categoryId === 'salary' && item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency !== 'occasional' && !item.endDate && item.endMode !== 'retirement').length
  return `<section class="panel settings-card" aria-labelledby="timeline-title">
    <p class="eyebrow">FINAPP ANUAL · REVISÃO 2</p><h2 id="timeline-title">Receitas e despesas ao longo do tempo</h2>
    ${horizonError ? `<p role="status">${horizonError} Exibindo somente 12 meses até você configurar o horizonte.</p>` : ''}
    ${renderHorizonForm()}<label>Período <select data-timeline-period><option value="target" ${timelineView.period === 'target' ? 'selected' : ''}>Até a idade-alvo configurada</option><option value="12" ${timelineView.period === '12' ? 'selected' : ''}>12 meses</option><option value="60" ${timelineView.period === '60' ? 'selected' : ''}>5 anos</option><option value="retirement" ${timelineView.period === 'retirement' ? 'selected' : ''}>Até 2 anos após a aposentadoria</option></select></label>
    <form data-budget-retirement-form><label>Mês da aposentadoria no orçamento <input type="month" name="retirementMonth" min="2000-01" max="2199-12" value="${retirement}" required /></label><button type="submit" class="button button--secondary">Confirmar mês e recalcular vínculos</button></form>
    <p>${state.cashFlow.retirementMonth ? 'Mês confirmado' : 'Sugestão pelas idades do plano, ainda não confirmada'}: ${retirement}. Receitas vinculadas terminam no mês anterior. Datas manuais não mudam. Este mês confirmado controla o orçamento e a projeção patrimonial. Alterar as idades gera uma nova estimativa de mês, que você pode revisar.</p>
    ${!state.cashFlow.retirementMonth && state.cashFlow.items.some(item => item.endMode === 'retirement') ? '<p>Há receitas vinculadas sem mês confirmado. Elas ficam fora dos cálculos até você confirmar o mês.</p>' : ''}
    <p>Série mensal de ${start} a ${points.at(-1).month}. ${annual ? `Gráfico anual de ${annual.rows[0].year} a ${annual.rows.at(-1).year}, anos completos, mesma base da viabilidade e do risco anual.` : 'Gráfico somado pelos meses incluídos, sem extrapolar anos parciais.'}</p>
    ${openSalaries ? `<p>Revise ${openSalaries} receita(s) de salário sem data final. Elas continuam na previsão após o marco da aposentadoria até você definir o término.</p>` : ''}
    ${undated ? `<p>${undated} lançamento(s) eventual(is) sem data foram excluídos desta série. Informe uma data no cadastro para incluí-los.</p>` : ''}
    <p>${deficit ? `Primeiro mês com despesas acima das receitas neste período: ${deficit.month}.` : 'Não há déficit no orçamento previsto deste período.'} Confira os prazos dos lançamentos antes de interpretar o resultado.</p>
    ${planningChart({ title: 'Fluxos anuais em valores reais', rows: yearly, currency: state.currency, hidden: state.valuesHidden, markers: [{ year: retirement.slice(0, 4), label: 'Aposentadoria' }], series: [{ key: 'income', label: 'Entradas', type: 'bar', color: '#0ea5e9' }, { key: 'spending', label: 'Custos e metas no FCX', type: 'bar', color: '#f59e0b' }, { key: 'pension', label: 'Previdência, informativa', type: 'bar', color: '#8b5cf6' }, { key: 'balance', label: 'FCX, não é saldo patrimonial', color: '#047857' }] })}
    <p>FCX = receitas menos custos e metas. ${external ? 'Previdência externa fica fora do FCX e aumenta o patrimônio, como no finapp.' : 'Modo financiado: contribuições são pagas pelo orçamento e já estão nos custos. A barra previdenciária é informativa, não deve ser subtraída novamente.'} Liberações de patrimônio não são receita nem FCX. <a href="/viabilidade" data-route>Revisar origem da previdência, saldos e liberações</a>.</p>
    <p>FCX negativo não significa automaticamente insolvência: pode ser coberto pelo patrimônio líquido disponível. ${annual ? `No último ano, AF: ${money(annual.rows.at(-1).financialAssets)}. Liquidez: ${money(annual.rows.at(-1).liquidAssets)}. ${annual.firstFailure ? `Há insuficiência de financeiro líquido ou liquidez desde ${annual.firstFailure.year}.` : 'Não há insuficiência nos fechamentos anuais calculados.'}` : 'Configure a idade-alvo para avaliar a cobertura patrimonial.'}</p>
    <details><summary>Ver totais anuais</summary><div class="currency-table" tabindex="0" role="region" aria-label="Fluxos anuais"><table><thead><tr><th>Ano</th><th>Meses incluídos</th><th>Entradas</th><th>Custos e metas no FCX</th><th>Previdência, informativa</th><th>Saldo</th></tr></thead><tbody>${yearly.map(row => `<tr><th scope="row">${row.year}</th><td>${row.months}</td><td>${money(row.income)}</td><td>${money(row.expenses)}</td><td>${money(row.pension)}</td><td>${money(row.balance)}</td></tr>`).join('')}</tbody></table></div></details>
    <details><summary>Ver valores por mês</summary><div class="currency-table"><table><caption>Orçamento mensal previsto em ${state.currency}</caption><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Saldo</th></tr></thead><tbody>${points.map(point => `<tr><th scope="row">${point.month}${point.month === retirement ? ' · Aposentadoria' : ''}</th><td>${money(point.income)}</td><td>${money(point.expenses)}</td><td>${money(point.balance)}</td></tr>`).join('')}</tbody></table></div></details>
    <p>Orçamento mensal equivalente, não saldo bancário: valores anuais divididos por 12, meses de início e fim incluídos integralmente. Câmbio e valores constantes, sem inflação ou rendimentos. Realizados e eventuais sem data não entram. Benefícios de aposentadoria só entram se cadastrados como receita, com início definido. Esta série não ajusta os aportes constantes da projeção patrimonial.</p>
  </section>${renderBudgetInsights(state, points)}`
}
