import { monthlyBudgetDialog } from './monthly-budget-detail.js'
import { state } from '../../app/state.js'
import { cashFlowTimeline, retirementMonth } from '../../domain/cash-flow-timeline.js'
import { privateCurrency, escapeHtml, formatMonth } from '../../shared/formatters.js'
import { openSalaryItems, salaryEndMessage } from '../../domain/cash-flow-checks.js'
import { renderBudgetInsights } from './budget-insights.js'
import { planningHorizon, annualCashFlow, cashFlowProjectionState } from '../../domain/planning-horizon.js'
import { cashFlowChartView } from '../../shared/cash-flow-line-chart.js'
import { annualRowsInPriceBasis } from '../../domain/inflation-display.js'
import { planningChart } from '../../shared/planning-chart.js'
import { renderPropertyFilter } from '../../shared/property-solvency.js'
import { cashFlowDetailIndex, cashFlowDetailPanels } from '../../shared/cash-flow-detail.js'
import { renderFinancialReconciliation } from '../../shared/financial-reconciliation.js'
import { renderHorizonForm } from '../plan/horizon.js'
import { finappViability, sanitizeFinappMethod } from '../../domain/finapp-viability.js'
import { moneyWithMonthly } from '../../shared/monthly-equivalent.js'

export const timelineView = { period: 'target', selectedYear: null }

function periodControl() {
  const options = [['target', 'Até a idade-alvo configurada'], ['100', 'Até 100 anos, simulação'], ['12', '12 meses'], ['60', '5 anos'], ['retirement', 'Até 2 anos após a aposentadoria']]
  return `<label class="form-field"><span class="form-field__label">Período da projeção</span><span class="input-shell"><select data-timeline-period>${options.map(([value, label]) => `<option value="${value}" ${timelineView.period === value ? 'selected' : ''}>${label}</option>`).join('')}</select></span></label>`
}

function retirementPremises(retirement) {
  return `<section class="panel settings-card" aria-labelledby="projection-retirement-title"><h2 id="projection-retirement-title">Horizonte e aposentadoria</h2>${renderHorizonForm()}
    <form class="timeline-retirement-form" data-budget-retirement-form><label class="form-field"><span class="form-field__label">Mês da aposentadoria</span><span class="input-shell"><input type="month" name="retirementMonth" min="2000-01" max="2199-12" value="${retirement}" required /></span></label><button type="submit" class="button button--secondary">Confirmar mês e recalcular vínculos</button></form>
    <p class="timeline-status">${state.cashFlow.retirementMonth ? 'Aposentadoria confirmada' : 'Aposentadoria sugerida pelas idades, ainda não confirmada'}: <strong>${formatMonth(retirement)}</strong>.</p>
    <details class="disclosure"><summary>Como o mês da aposentadoria afeta o orçamento</summary><p>Receitas vinculadas terminam no mês anterior. Datas manuais não mudam. Este mês confirmado controla o orçamento e a projeção patrimonial. Alterar as idades gera uma nova estimativa de mês, que você pode revisar.</p></details>
    ${!state.cashFlow.retirementMonth && state.cashFlow.items.some(item => item.endMode === 'retirement') ? '<p>Há receitas vinculadas sem mês confirmado. Elas ficam fora dos cálculos até você confirmar o mês.</p>' : ''}
    ${renderPropertyFilter(state.cashFlow, state.valuesHidden)}</section>`
}

function projectedCharts(rows, plan, markers, annual) {
  if (state.valuesHidden) return '<p>Valores ocultos. Gráfico e composição ocultos.</p>'
  const baseYear = new Date().getUTCFullYear()
  const basis = cashFlowChartView.basis === 'nominal' ? 'nominal' : 'real'
  let display
  try { display = annualRowsInPriceBasis(rows, { basis, annualInflation: plan.annualInflation, baseYear }) }
  catch (error) { return `<p role="status">${escapeHtml(error.message)}</p>` }
  const index = cashFlowDetailIndex(display.map(row => ({ label: String(row.year) })), timelineView.selectedYear ?? cashFlowChartView.selectedYear)
  const selectedYear = String(display[index].year)
  const caption = `${state.currency} · ${basis === 'nominal' ? 'Valores nominais de cada ano' : `Poder de compra de ${baseYear}`}`
  const input = { rows: display, currency: state.currency, markers, selectedYear, linkedSelection: true, interpolation: 'linear', annualReadout: true, readoutCaption: caption }
  const financialView = annual && cashFlowChartView.flow === 'financial'
  const flowSeries = financialView ? [
    { key: 'freeCashFlow', label: 'Saldo do orçamento', color: '#2855c7', monthly: true },
    { key: 'financialReturn', label: basis === 'nominal' ? 'Rendimento nominal implícito' : 'Rendimento real', color: '#7c69a8', dash: '2 3' },
    { key: 'pensionCredits', label: 'Créditos previdenciários', color: '#64748b', dash: '8 4', monthly: true },
    { key: 'financialChange', label: 'Variação do patrimônio financeiro no ano', color: '#17243b', width: 3, emphasize: true }
  ] : [
    { key: 'income', label: 'Receitas previstas', color: '#2855c7', monthly: true },
    { key: 'outflows', label: 'Despesas e metas previstas', color: '#64748b', dash: '6 3', monthly: true },
    { key: 'freeCashFlow', label: 'Saldo previsto antes dos rendimentos', color: '#17243b', width: 3, emphasize: true, monthly: true }
  ]
  const financial = annual ? `<section class="cash-flow-wealth-chart annual-chart-section" aria-label="Evolução do patrimônio financeiro e da liquidez"><div class="annual-chart-heading"><div><span class="annual-chart-kind">SALDOS NO FECHAMENTO DE DEZEMBRO</span><h3>Patrimônio financeiro e liquidez</h3></div></div>
    <p>Patrimônio financeiro reúne os investimentos disponíveis e restritos. Liquidez é a parcela disponível para pagar despesas. A diferença entre as duas linhas é o saldo financeiro restrito. Quando todos os investimentos estão disponíveis, os dois saldos coincidem. Abaixo de zero, a liquidez representa o déficit acumulado que os recursos disponíveis não cobriram. As linhas compartilham valores e não devem ser somadas. Imóveis e dívidas aparecem na composição separada abaixo.</p>
    ${planningChart({ ...input, title: 'Patrimônio financeiro e liquidez ao fim de cada ano', series: [{ key: 'financialAssets', label: 'Patrimônio financeiro', color: '#475569', width: 3, emphasize: true }, { key: 'liquidAssets', label: 'Liquidez disponível', color: '#2855c7', dash: '2 3' }] })}
    <details class="disclosure"><summary>Comparar patrimônio restrito, bens e dívidas</summary><p>Saldos financeiros restritos não estão disponíveis para despesas até a liberação cadastrada. Bens não geram caixa automaticamente. Patrimônio total é financeiro mais bens, menos dívidas. O patrimônio considerado respeita o filtro de imóveis nas Premissas.</p>
    ${planningChart({ ...input, title: 'Composição patrimonial projetada', series: [{ key: 'restrictedFinancial', label: 'Financeiro restrito', color: '#7c69a8', dash: '6 3' }, { key: 'assets', label: 'Bens e direitos', color: '#64748b', dash: '2 3' }, { key: 'liabilities', label: 'Dívidas', color: '#9a6b00', dash: '8 4' }, { key: 'netWorth', label: 'Patrimônio total líquido de dívidas', color: '#167454' }, { key: 'solvencyNetWorth', label: 'Patrimônio considerado pelo filtro de imóveis', color: '#475569' }] })}</details></section>` : '<p>Este recorte compara fluxos previstos, sem projetar saldos patrimoniais ou rendimentos. Selecione a idade-alvo para avaliar a evolução patrimonial completa.</p>'
  return `<section class="cash-flow-line-view" data-cash-flow-line-view><div class="annual-chart-toolbar"><label class="cash-flow-price-control">Base dos valores <select data-cash-flow-price-basis><option value="real" ${basis === 'real' ? 'selected' : ''}>Poder de compra de ${baseYear}</option><option value="nominal" ${basis === 'nominal' ? 'selected' : ''}>Valores nominais de cada ano</option></select></label><label>Ano selecionado nos gráficos<select data-cash-flow-year>${display.map((row, rowIndex) => `<option value="${rowIndex}" ${rowIndex === index ? 'selected' : ''}>${escapeHtml(row.year)}</option>`).join('')}</select></label></div>
    <p class="annual-chart-basis">${escapeHtml(caption)}. ${basis === 'nominal' ? 'Cada ano inclui a inflação acumulada do plano.' : 'Todos os anos usam o mesmo poder de compra.'} Inflação anual do plano: ${(plan.annualInflation * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%. Alternar a base não altera os cálculos da viabilidade ou os lançamentos.</p>
    ${financial}
    <details class="disclosure" data-projection-flow-details><summary>Ver receitas, despesas e saldo previstos por ano</summary><p>Receitas menos despesas e metas = saldo do orçamento, antes dos rendimentos. Déficit no orçamento consome patrimônio, mas não significa automaticamente falta de liquidez. Liberações transferem saldo existente e não criam receita.</p>
    ${annual ? `<label>Visão dos fluxos<select data-annual-chart-mode="flow"><option value="budget" ${financialView ? '' : 'selected'}>Orçamento: receitas, despesas e saldo</option><option value="financial" ${financialView ? 'selected' : ''}>Resultado: saldo, rendimentos e previdência</option></select></label>` : ''}
    ${financialView ? '<p>Saldo do orçamento + rendimentos + créditos previdenciários = variação do patrimônio financeiro no ano. A variação descreve a mudança no período, não o patrimônio acumulado. Os créditos previdenciários podem permanecer restritos.</p>' : ''}
    ${planningChart({ ...input, title: financialView ? 'Variação anual do patrimônio financeiro' : 'Fluxos anuais previstos do orçamento', series: flowSeries, details: cashFlowDetailPanels(display, plan, state.currency, false, { wealthTargetAge: state.plan.targetAge }) })}</details>
    <details class="disclosure"><summary>Como a inflação entra nesta projeção</summary><p>Na visão real, valores e retorno descontam a inflação. Na visão nominal, cada ano recebe a inflação acumulada do plano desde ${baseYear}. O rendimento nominal implícito inclui a atualização do saldo inicial. A conversão usa a inflação da moeda de apresentação após o câmbio fixo, sem prever câmbio de cada país. A composição na moeda original e as demais tabelas continuam na base real do cadastro.</p><a href="/fluxo-caixa?aba=premissas" data-route>Revisar premissas</a></details></section>`
}

// Annual and monthly projections share calculations. Premises owns the saved controls.
export function renderCashFlowTimeline({ part = 'all' } = {}) {
  const retirement = state.cashFlow.retirementMonth || state.plan.retirementMonth || retirementMonth(state.plan)
  if (part === 'premises') return retirementPremises(retirement)
  const projectionState = cashFlowProjectionState(state, timelineView.period)
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
  if (annual?.firstFailure) markers.push({ year: annual.firstFailure.year, label: annual.firstFailure.liquidAssets < -0.005 && annual.firstFailure.netFinancial >= -0.005 ? 'Falta de liquidez' : 'Insuficiência financeira' })
  if (annual) {
    markers.push({ year: annual.horizon.endYear, label: timelineView.period === '100' ? '100 anos' : 'Idade-alvo' })
    if (timelineView.period === '100' && Number.isInteger(state.plan.targetAge) && state.plan.targetAge !== 100) markers.push({ year: Number(annual.horizon.reference.slice(0, 4)) + state.plan.targetAge - state.plan.currentAge, label: 'Idade-alvo salva' })
  }
  const settings = sanitizeFinappMethod(state.plan.finappMethod)
  const external = settings.pensionMode === 'external'
  const money = value => privateCurrency(value, state.valuesHidden, false, state.currency)
  const deficit = points.find(point => point.balance < 0)
  const undated = state.cashFlow.items.filter(item => item.recordKind !== 'actual' && item.source !== 'txt' && item.frequency === 'occasional' && !item.startDate).length
  const openSalaries = openSalaryItems(state.cashFlow, { endMonth: points.at(-1).month })
  const annualTotals = `<details class="disclosure"><summary>Ver totais anuais</summary><div class="currency-table" tabindex="0" role="region" aria-label="Fluxos anuais previstos"><table><thead><tr><th>Ano</th><th>Meses incluídos</th><th>Entradas</th><th>Custos e metas no saldo</th><th>Previdência, informativa</th><th>Saldo previsto</th></tr></thead><tbody>${yearly.map(row => `<tr><th scope="row">${row.year}</th><td>${row.months}</td><td>${moneyWithMonthly(money, row.income, row.months, { hidden: state.valuesHidden })}</td><td>${moneyWithMonthly(money, row.expenses, row.months, { hidden: state.valuesHidden })}</td><td>${moneyWithMonthly(money, row.pension, row.months, { hidden: state.valuesHidden })}</td><td>${moneyWithMonthly(money, row.balance, row.months, { hidden: state.valuesHidden })}</td></tr>`).join('')}</tbody></table></div></details>`
  const annualView = `<section class="panel settings-card" aria-labelledby="timeline-title">
    <p class="eyebrow">IMPACTO FUTURO DAS DECISÕES</p><h2 id="timeline-title">Evolução patrimonial</h2>
    <p>Esta projeção usa o orçamento planejado, o patrimônio cadastrado e as premissas de rendimento e liquidez. Registros realizados ficam na conferência do mês. <a href="/orcamento?aba=resumo" data-route>Revisar orçamento</a>.</p>
    ${horizonError ? `<p role="status">${escapeHtml(horizonError)} Não foi possível concluir a avaliação anual. O recorte mensal não comprova cobertura até a idade selecionada.</p>` : ''}
    <div class="timeline-controls timeline-controls--single">${periodControl()}</div>
    ${timelineView.period === '100' ? '<p>Simulação até 100 anos. A idade-alvo salva e as datas dos lançamentos não mudam. Esta opção pode encurtar um plano configurado acima de 100 anos. Salários e despesas encerrados não são prorrogados. Para salvar este horizonte, revise a aba Premissas.</p>' : ''}
    <p class="timeline-status">${annual ? `Ano-base ${annual.rows[0].year}. Fechamentos anuais até ${annual.rows.at(-1).year}, idade-alvo ${projectionState.plan.targetAge} anos. Anos completos, mesma base da viabilidade e do risco anual.` : `Recorte mensal de ${formatMonth(start)} a ${formatMonth(points.at(-1).month)}, sem extrapolar anos parciais.`} Aposentadoria ${state.cashFlow.retirementMonth ? 'confirmada' : 'sugerida, ainda não confirmada'}: ${formatMonth(retirement)}. <a href="/fluxo-caixa?aba=premissas" data-route>Revisar premissas</a>.</p>
    <p class="annual-chart-basis">Câmbio fixo da projeção${settings.chfBrlRate ? `: 1 CHF = ${settings.chfBrlRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} BRL` : ', conforme as taxas cadastradas'}. ${settings.chfBrlRate ? 'Esta premissa pode diferir do câmbio utilizado no orçamento mensal.' : ''} O aporte mensal fixo de Meu plano não é somado ao saldo do orçamento. Previdência ${external ? 'descontada em folha ou externa ao caixa' : 'financiada pelo orçamento'}.</p>
    ${projectedCharts(yearly, projectionState.plan, markers, annual)}
    ${annual ? renderFinancialReconciliation({ rows: annual.rows, currency: state.currency, hidden: state.valuesHidden }) : ''}
    <details class="disclosure"><summary>Como ler saldo, previdência e patrimônio</summary><p>Saldo do orçamento = receitas menos custos e metas. ${external ? 'Previdência externa fica fora desse saldo e aumenta o patrimônio.' : 'Contribuições financiadas pelo orçamento já estão nos custos. A informação previdenciária não deve ser subtraída novamente.'} Liberações de patrimônio não são receita nem entram nesse saldo.</p><p>Saldo do orçamento negativo não significa automaticamente insolvência: pode ser coberto pelo patrimônio líquido disponível. ${annual ? `No último ano, patrimônio financeiro: ${money(annual.rows.at(-1).financialAssets)}. Liquidez: ${money(annual.rows.at(-1).liquidAssets)}. ${annual.firstFailure ? `Há insuficiência de financeiro líquido ou liquidez desde ${annual.firstFailure.year}.` : 'Não há insuficiência nos fechamentos anuais calculados.'}` : 'Configure a idade-alvo para avaliar a cobertura patrimonial.'}</p></details>
    ${openSalaries.length ? `<p>${state.valuesHidden ? 'Há salário recorrente sem término definido. Exiba os dados para revisar os lançamentos.' : escapeHtml(salaryEndMessage(openSalaries))}</p>` : ''}
    ${undated ? `<p>${undated} lançamento(s) eventual(is) sem data foram excluídos desta série. <a href="/orcamento?aba=lancamentos" data-route>Informar a data</a>.</p>` : ''}
    ${annualTotals}
  </section>`
  const monthlyRows = points.map(point => `<tr><th scope="row">${formatMonth(point.month)}${point.month === retirement ? ' · Aposentadoria' : ''}${state.valuesHidden ? '' : `<br><button type="button" class="budget-category-entry-link" data-monthly-budget-detail="${point.month}" aria-label="Ver composição de ${escapeHtml(formatMonth(point.month))}">Ver composição</button>`}</th><td>${money(point.income)}</td><td>${money(point.expenses)}</td><td data-tone="${point.balance < 0 ? 'negative' : 'positive'}">${money(point.balance)}</td></tr>`).join('')
  const monthlyView = `<section class="panel settings-card" aria-labelledby="timeline-monthly-title">
    <p class="eyebrow">DETALHAMENTO DA PROJEÇÃO</p><h2 id="timeline-monthly-title">Fluxos projetados por mês</h2>
    <div class="timeline-controls timeline-controls--single">${periodControl()}</div>
    <p>Início do recorte mensal: ${formatMonth(start)}. Cobertura até ${formatMonth(points.at(-1).month)}. ${deficit ? `Primeiro mês com saídas acima das entradas previstas: ${formatMonth(deficit.month)}.` : 'Não há déficit nos fluxos previstos deste período.'} <a href="/orcamento?aba=resumo" data-route>Conferir o mês no Orçamento</a>.</p>
    <div class="currency-table monthly-table" tabindex="0" role="region" aria-label="Fluxos mensais projetados"><table><caption>Fluxos mensais projetados em ${state.currency}</caption><thead><tr><th scope="col">Mês</th><th scope="col">Receitas previstas</th><th scope="col">Despesas e metas previstas</th><th scope="col">Saldo previsto</th></tr></thead><tbody>${monthlyRows}</tbody></table></div>
    <p class="annual-chart-basis">Fluxo mensal equivalente, não saldo bancário: valores anuais divididos por 12, meses de início e fim incluídos integralmente. Câmbio fixo e valores reais, sem rendimentos nesta tabela mensal. Inflação implícita na hipótese de poder de compra constante. Realizados e eventuais sem data não entram. Benefícios de aposentadoria só entram se cadastrados como receita, com início definido. Esta série não ajusta os aportes constantes da projeção patrimonial. O recorte mensal não equivale aos anos completos da avaliação patrimonial.</p>
    ${annualTotals}
  </section>${renderBudgetInsights(state, points)}`
  if (part === 'annual') return annualView
  if (part === 'monthly') return monthlyView + monthlyBudgetDialog
  return `${monthlyBudgetDialog}${annualView}<details class="disclosure"><summary>Ver valores por mês</summary>${monthlyView}</details>`
}
