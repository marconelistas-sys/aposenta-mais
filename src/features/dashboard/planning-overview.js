import { state } from '../../app/state.js'
import { finappViability } from '../../domain/finapp-viability.js'
import { planningChart } from '../../shared/planning-chart.js'
import { renderCashFlowLineChart } from '../../shared/cash-flow-line-chart.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { renderFinancialReconciliation } from '../../shared/financial-reconciliation.js'

export function renderPlanningOverview(options = {}) {
  const compact = Boolean(options.compact)
  const links = '<p><a href="/viabilidade" data-route>Premissas, liberações e auditoria anual</a> · <a href="/riscos" data-route>Risco anual e matriz</a> · <a href="/plano" data-route>Configurar idade-alvo</a></p>'
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Avaliação anual até a idade-alvo</h2><p>Valores e gráficos ocultos.</p>' + (compact ? '' : links) + '</section>'
  let result
  try { result = finappViability(state, undefined, new Date(), { includeBreakdown: true }) }
  catch (error) { return '<section class="panel settings-card"><div class="plan-sustainability plan-sustainability--incomplete" data-plan-sustainability="incomplete"><p class="eyebrow">SUSTENTABILIDADE FAMILIAR</p><h2>Avaliação incompleta</h2><p role="status">' + escapeHtml(error.message) + '</p></div>' + (compact ? '<p><a href="/plano" data-route>Configurar idade-alvo</a></p>' : links) + '</section>' }
  const last = result.rows.at(-1)
  const assessment = result.firstFailure ? 'insufficient' : result.viable && !result.issues.length ? 'sustainable' : 'incomplete'
  const status = assessment === 'insufficient' ? 'Recursos insuficientes para sustentar o plano familiar' : assessment === 'sustainable' ? 'Plano familiar sustentável nas premissas informadas' : 'Avaliação incompleta da sustentabilidade familiar'
  const money = value => privateCurrency(value, false, true, state.currency)
  const summary = `<div class="plan-sustainability plan-sustainability--${assessment}" data-plan-sustainability="${assessment}"><p class="eyebrow">SUSTENTABILIDADE FAMILIAR ATÉ DEZEMBRO DE ${last.year}</p><h2>${status}</h2><p>${result.firstFailure ? `Primeiro fechamento com insuficiência financeira ou de liquidez: ${result.firstFailure.year}. Patrimônio total positivo não garante recursos disponíveis para pagar despesas.` : assessment === 'sustainable' ? 'Os recursos cobrem o orçamento familiar em todos os fechamentos anuais calculados até a data-alvo.' : 'Revise as pendências para concluir se os recursos cobrem o orçamento familiar até a data-alvo.'}</p><dl><div><dt>Patrimônio total líquido de dívidas na data-alvo</dt><dd>${money(last.netWorth)}</dd></div><div><dt>Liquidez na data-alvo</dt><dd>${money(last.liquidAssets)}</dd></div></dl>${result.issues.length ? `<p class="badge badge--warn">${result.issues.length} ${result.issues.length === 1 ? 'pendência de revisão' : 'pendências de revisão'}</p>` : ''}<p>Projeção anual nas premissas informadas. Confira também a <a href="/riscos-mensais" data-route>liquidez dentro de cada ano</a>.</p></div>`
  const common = { rows: result.rows.map(row => ({ ...row, outflows: row.costs + row.goals })), currency: state.currency, markers: result.retirement ? [{ year: result.retirement.slice(0, 4), label: 'Aposentadoria' }] : [] }
  const wealth = compact ? planningChart({ ...common, title: 'Patrimônio ao longo do tempo', series: [
    { key: 'netWorth', label: 'Patrimônio líquido total', color: '#475569', dash: '5 3' },
    { key: 'financialAssets', label: 'Patrimônio financeiro', color: '#047857' },
    { key: 'liquidAssets', label: 'Liquidez, pode ser negativa', color: '#0369a1' },
  ] }) : ''
  const pensionNote = result.settings.pensionMode === 'external' ? 'crédito externo, fora do saldo do orçamento' : 'paga com o orçamento'
  if (compact) {
    return '<section class="panel settings-card">' + summary + wealth + '<p><a href="/viabilidade" data-route>Ver avaliação completa, ano a ano</a></p></section>'
  }
  const flow = renderCashFlowLineChart({ ...common, plan: state.plan, title: 'Fluxos anuais do orçamento, avaliação anual detalhada', baseYear: Number(result.rows[0].year) })
  return '<section class="panel settings-card">' + summary + '<p>Fluxos anuais completos, no fim do ano. Previdência: ' + pensionNote + '. Liberações transferem patrimônio já existente, sem criar receita.</p><ul>' + result.issues.map(issue => '<li>' + escapeHtml(issue) + '</li>').join('') + '</ul>' + flow + renderFinancialReconciliation({ rows: result.rows, currency: state.currency }) + links + '</section>'
}
