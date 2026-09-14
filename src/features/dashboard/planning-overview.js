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
  catch (error) { return '<section class="panel settings-card"><h2>Avaliação anual até a idade-alvo</h2><p role="status">' + escapeHtml(error.message) + '</p>' + (compact ? '<p><a href="/plano" data-route>Configurar idade-alvo</a></p>' : links) + '</section>' }
  const last = result.rows.at(-1)
  const status = result.issues.length ? 'Revisão necessária antes de concluir avaliação' : result.viable ? 'Cobertura anual suficiente nas premissas informadas' : 'Insuficiência nas premissas informadas'
  const common = { rows: result.rows.map(row => ({ ...row, outflows: row.costs + row.goals })), currency: state.currency, markers: result.retirement ? [{ year: result.retirement.slice(0, 4), label: 'Aposentadoria' }] : [] }
  const wealth = planningChart({ ...common, title: compact ? 'Patrimônio ao longo do tempo' : 'Evolução patrimonial base, avaliação anual detalhada', series: [
    { key: 'netWorth', label: 'Patrimônio líquido total', color: '#475569', dash: '5 3' },
    { key: 'financialAssets', label: 'Patrimônio financeiro', color: '#047857' },
    { key: 'liquidAssets', label: 'Liquidez, pode ser negativa', color: '#0369a1' },
    { key: 'restrictedFinancial', label: 'Financeiro restrito', color: '#7c3aed', dash: '2 3' }
  ] })
  const pensionNote = result.settings.pensionMode === 'external' ? 'crédito externo, fora do saldo do orçamento' : 'paga com o orçamento'
  if (compact) {
    return '<section class="panel settings-card"><h2>' + status + '</h2><p>Até dezembro de ' + last.year + '. Liquidez final: ' + privateCurrency(last.liquidAssets, false, true, state.currency) + '. ' + (result.firstFailure ? 'Primeiro fechamento insuficiente: ' + result.firstFailure.year + '.' : 'Sem insuficiência nos fechamentos anuais calculados.') + '</p>' + (result.issues.length ? '<p class="badge badge--warn">' + result.issues.length + ' ' + (result.issues.length === 1 ? 'pendência de revisão' : 'pendências de revisão') + '</p>' : '') + wealth + '<p><a href="/viabilidade" data-route>Ver avaliação completa, ano a ano</a></p></section>'
  }
  const flow = renderCashFlowLineChart({ ...common, plan: state.plan, title: 'Fluxos anuais do orçamento, avaliação anual detalhada', baseYear: Number(result.rows[0].year) })
  return '<section class="panel settings-card"><h2>' + status + '</h2><p>Até dezembro de ' + last.year + '. Liquidez final: ' + privateCurrency(last.liquidAssets, false, true, state.currency) + '. ' + (result.firstFailure ? 'Primeiro fechamento insuficiente: ' + result.firstFailure.year + '.' : 'Sem insuficiência nos fechamentos anuais calculados.') + '</p><p>Taxa global do plano e fluxos anuais completos, no fim do ano. Previdência: ' + pensionNote + '. Liberações transferem patrimônio já existente, sem criar receita. Não prova liquidez dentro de cada ano.</p><ul>' + result.issues.map(issue => '<li>' + escapeHtml(issue) + '</li>').join('') + '</ul><div class="planning-overview-grid">' + flow + wealth + '</div>' + renderFinancialReconciliation({ rows: result.rows, currency: state.currency }) + links + '</section>'
}
