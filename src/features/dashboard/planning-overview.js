import { state } from '../../app/state.js'
import { planningHorizon, annualCashFlow, annualClosing } from '../../domain/planning-horizon.js'
import { cashFlowTimeline } from '../../domain/cash-flow-timeline.js'
import { prepareRiskInput, defaultRiskSettings } from '../../domain/risk-plan.js'
import { deterministicPath } from '../../domain/risk-simulation.js'
import { planningChart } from '../../shared/planning-chart.js'
import { escapeHtml } from '../../shared/formatters.js'

export function renderPlanningOverview() {
  const links = '<p><a href="/plano" data-route>Configurar idade-alvo</a> · <a href="/fluxo-caixa" data-route>Fluxos e tabela anual</a> · <a href="/riscos" data-route>Patrimônio, Monte Carlo e tabela mensal</a></p>'
  let horizon
  try { horizon = planningHorizon(state.plan, state.cashFlow.referenceMonth) }
  catch { return `<section class="panel settings-card"><h2>Visão até a idade-alvo</h2><p>Configure o horizonte para visualizar fluxos anuais e evolução patrimonial além da aposentadoria.</p>${links}</section>` }
  if (state.valuesHidden) return `<section class="panel settings-card"><h2>Visão até a idade-alvo</h2><p>Valores e gráficos ocultos.</p>${links}</section>`
  const cash = annualCashFlow(cashFlowTimeline(state, horizon.startMonth, horizon.months))
  const flow = planningChart({ title: 'Fluxos anuais do orçamento', rows: cash, currency: state.currency, series: [{ key: 'income', label: 'Entradas', type: 'bar', color: '#0ea5e9' }, { key: 'spending', label: 'Saídas sem previdência', type: 'bar', color: '#f59e0b' }, { key: 'pension', label: 'Previdência', type: 'bar', color: '#8b5cf6' }, { key: 'balance', label: 'Saldo após todas as saídas', color: '#047857' }] })
  let wealth
  try {
    const input = prepareRiskInput(state, { ...defaultRiskSettings, ...state.plan.riskSettings, horizonMode: 'target' })
    const rows = annualClosing(deterministicPath(input).rows.map(row => ({ ...row, restricted: row.financialAssets - row.liquidAssets })))
    wealth = planningChart({ title: 'Evolução patrimonial base', rows, currency: state.currency, series: [{ key: 'netWorth', label: 'Patrimônio líquido total', color: '#475569', dash: '5 3' }, { key: 'financialAssets', label: 'Ativos financeiros', color: '#047857' }, { key: 'liquidAssets', label: 'Financeiro disponível', color: '#0369a1' }, { key: 'restricted', label: 'Financeiro restrito', color: '#7c3aed', dash: '2 3' }] })
  } catch (error) { wealth = `<p role="status">Projeção patrimonial requer revisão: ${escapeHtml(error.message)}</p>` }
  return `<section class="panel settings-card"><h2>Visão até ${state.plan.targetAge} anos, dezembro de ${horizon.endYear}</h2><p>Fluxos somados por ano, patrimônio no último mês de cada ano. Anos parciais não são extrapolados. O patrimônio parte do mês atual, investe sobras e respeita liquidez, dívidas e bens. Fluxos começam no mês consultado do orçamento e não acrescentam benefícios que você não cadastrou. A projeção patrimonial segue a premissa de benefício definida em Risco.</p><div class="planning-overview-grid">${flow}${wealth}</div>${links}</section>`
}
