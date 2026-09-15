import { renderProjectionChecks } from '../../shared/projection-checks.js'
import { state } from '../../app/state.js'
import { finappViability } from '../../domain/finapp-viability.js'
import { planningChart } from '../../shared/planning-chart.js'
import { renderCashFlowLineChart } from '../../shared/cash-flow-line-chart.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { renderFinancialReconciliation } from '../../shared/financial-reconciliation.js'
import { renderPlanInterpretation } from './plan-interpretation.js'
import { renderPropertyFilter, renderSolvencyAssessment } from '../../shared/property-solvency.js'
import { solvencyWealthLabel } from '../../domain/property-solvency.js'
import { renderDashboardCockpit } from './cockpit.js'

export function renderPlanningOverview(options = {}) {
  const compact = Boolean(options.compact)
  const cockpit = Boolean(options.cockpit)
  const links = '<p><a href="/viabilidade" data-route>Premissas, liberações e auditoria anual</a> · <a href="/riscos" data-route>Risco anual e matriz</a> · <a href="/plano" data-route>Configurar idade-alvo</a></p>'
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Avaliação anual até a idade-alvo</h2><p>Valores e gráficos ocultos.</p>' + (compact ? '' : links) + '</section>'
  let result
  try { result = finappViability(state, undefined, new Date(), { includeBreakdown: true }) }
  catch (error) { return '<section class="panel settings-card"><div class="plan-sustainability plan-sustainability--incomplete" data-plan-sustainability="incomplete"><p class="eyebrow">SUSTENTABILIDADE FAMILIAR</p><h2>Avaliação incompleta</h2><p role="status">' + escapeHtml(error.message) + '</p></div>' + (cockpit ? renderDashboardCockpit({ budget: options.budget, currency: state.currency, today: options.today }) : '') + (compact ? '<p><a href="/plano" data-route>Configurar idade-alvo</a></p>' : links) + '</section>' }
  const last = result.rows.at(-1)
  const assessment = result.firstFailure ? 'insufficient' : result.viable && !result.issues.length ? 'sustainable' : 'incomplete'
  const status = assessment === 'insufficient' ? 'Recursos insuficientes para sustentar o plano familiar' : assessment === 'sustainable' ? 'Plano familiar sustentável nas premissas informadas' : 'Avaliação incompleta da sustentabilidade familiar'
  const money = value => privateCurrency(value, false, true, state.currency)
  const summary = `<div class="plan-sustainability plan-sustainability--${assessment}" data-plan-sustainability="${assessment}"><p class="eyebrow">SUSTENTABILIDADE FAMILIAR ATÉ DEZEMBRO DE ${last.year}</p><h2>${status}</h2><p>${result.firstFailure ? `Primeiro fechamento com insuficiência financeira ou de liquidez: ${result.firstFailure.year}. Patrimônio total positivo não garante recursos disponíveis para pagar despesas.` : assessment === 'sustainable' ? 'Os recursos cobrem o orçamento familiar em todos os fechamentos anuais calculados até a data-alvo.' : 'Confira os dados e confirme as premissas indicadas abaixo para concluir se os recursos cobrem o orçamento familiar até a data-alvo.'}</p>${compact ? '' : `<dl><div><dt>Patrimônio total líquido de dívidas na data-alvo</dt><dd>${money(last.netWorth)}</dd></div><div><dt>Liquidez na data-alvo</dt><dd>${money(last.liquidAssets)}</dd></div></dl>`}${renderProjectionChecks(result)}<p>Projeção anual nas premissas informadas. Confira também a <a href="/riscos-mensais" data-route>liquidez dentro de cada ano</a>.</p></div>`
  const common = { rows: result.rows.map(row => ({ ...row, outflows: row.costs + row.goals })), currency: state.currency, markers: result.retirement ? [{ year: result.retirement.slice(0, 4), label: 'Aposentadoria' }] : [] }
  const wealth = compact ? planningChart({ ...common, title: 'Patrimônio ao fim de cada ano', annualReadout: true, interpolation: 'linear', readoutCaption: `${state.currency} · Poder de compra de ${result.rows[0].year} · Saldo no fim do ano`, series: [
    { key: 'solvencyNetWorth', label: solvencyWealthLabel(result.rows.find(row => row.excludedRealEstateAssets > 0) || last), color: '#475569', width: 3, emphasize: true },
    { key: 'liquidAssets', label: 'Liquidez disponível', color: '#0369a1', dash: '2 3' },
  ] }) : ''
  const pensionNote = result.settings.pensionMode === 'external' ? 'crédito externo, fora do saldo do orçamento' : 'paga com o orçamento'
  if (compact && cockpit) {
    return '<section class="panel settings-card dashboard-instruments-panel">' + summary + renderDashboardCockpit({ result, budget: options.budget, currency: state.currency, today: options.today }) + '<section class="cockpit-trajectory" aria-label="Evolução e imóveis considerados"><h3>Como o patrimônio evolui</h3>' + renderPropertyFilter(state.cashFlow) + wealth + '</section><details class="disclosure cockpit-explanation"><summary>Ver marcos, comparação patrimonial e próximos passos</summary>' + renderSolvencyAssessment(result.rows, state.currency) + renderPlanInterpretation(result, { currency: state.currency }) + '</details><p><a href="/viabilidade" data-route>Ver avaliação completa, ano a ano</a></p></section>'
  }
  if (compact) {
    return '<section class="panel settings-card">' + summary + renderPropertyFilter(state.cashFlow) + renderSolvencyAssessment(result.rows, state.currency) + wealth + renderPlanInterpretation(result, { currency: state.currency }) + '<p><a href="/viabilidade" data-route>Ver avaliação completa, ano a ano</a></p></section>'
  }
  const flow = renderCashFlowLineChart({ ...common, plan: state.plan, cashFlow: state.cashFlow, title: 'Fluxos anuais do orçamento, avaliação anual detalhada', baseYear: Number(result.rows[0].year) })
  return '<section class="panel settings-card">' + summary + '<p>Fluxos totais durante cada ano e saldos patrimoniais no fechamento. Previdência: ' + pensionNote + '. Liberações transferem patrimônio já existente, sem criar receita.</p>' + flow + renderFinancialReconciliation({ rows: result.rows, currency: state.currency }) + links + '</section>'
}
