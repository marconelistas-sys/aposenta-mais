import { state } from '../../app/state.js'
import { finappViability } from '../../domain/finapp-viability.js'
import { planningChart } from '../../shared/planning-chart.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'

export function renderPlanningOverview() {
  const links = '<p><a href="/viabilidade" data-route>Premissas, liberações e auditoria anual</a> · <a href="/riscos" data-route>Risco anual e matriz</a> · <a href="/plano" data-route>Configurar idade-alvo</a></p>'
  if (state.valuesHidden) return '<section class="panel settings-card"><h2>Viabilidade anual até a idade-alvo</h2><p>Valores e gráficos ocultos.</p>' + links + '</section>'
  let result
  try { result = finappViability(state) }
  catch (error) { return '<section class="panel settings-card"><h2>Viabilidade anual até a idade-alvo</h2><p role="status">' + escapeHtml(error.message) + '</p>' + links + '</section>' }
  const last = result.rows.at(-1)
  const status = result.issues.length ? 'Revisão necessária antes de concluir viabilidade' : result.viable ? 'Cobertura anual suficiente nas premissas informadas' : 'Insuficiência nas premissas informadas'
  const common = { rows: result.rows, currency: state.currency, markers: result.retirement ? [{ year: result.retirement.slice(0, 4), label: 'Aposentadoria' }] : [] }
  const flow = planningChart({ ...common, title: 'Fluxos anuais do orçamento, metodologia finapp', series: [
    { key: 'income', label: 'Entradas', type: 'bar', color: '#0ea5e9' },
    { key: 'costs', label: 'Custos', type: 'bar', color: '#f59e0b' },
    { key: 'goals', label: 'Metas', type: 'bar', color: '#e11d48' },
    { key: 'pensionCredits', label: 'Créditos previdenciários', type: 'bar', color: '#8b5cf6' },
    { key: 'releases', label: 'Liberações, não são receita', type: 'bar', color: '#0f766e' },
    { key: 'freeCashFlow', label: 'FCX', color: '#047857' }
  ] })
  const wealth = planningChart({ ...common, title: 'Evolução patrimonial base, metodologia finapp', series: [
    { key: 'netWorth', label: 'Patrimônio líquido total', color: '#475569', dash: '5 3' },
    { key: 'financialAssets', label: 'Ativos financeiros', color: '#047857' },
    { key: 'liquidAssets', label: 'Liquidez, pode ser negativa', color: '#0369a1' },
    { key: 'restrictedFinancial', label: 'Financeiro restrito', color: '#7c3aed', dash: '2 3' }
  ] })
  return '<section class="panel settings-card"><h2>' + status + '</h2><p>Até dezembro de ' + last.year + '. Liquidez final: ' + privateCurrency(last.liquidAssets, false, true, state.currency) + '. ' + (result.firstFailure ? 'Primeiro fechamento insuficiente: ' + result.firstFailure.year + '.' : 'Sem insuficiência nos fechamentos anuais calculados.') + '</p><p>Taxa global do plano e fluxos anuais completos, no fim do ano. Previdência: ' + (result.settings.pensionMode === 'external' ? 'crédito externo, fora do FCX' : 'paga com o orçamento') + '. Liberações transferem patrimônio já existente, sem criar receita. Não prova liquidez dentro de cada ano.</p><ul>' + result.issues.map(issue => '<li>' + escapeHtml(issue) + '</li>').join('') + '</ul><div class="planning-overview-grid">' + flow + wealth + '</div>' + links + '</section>'
}
