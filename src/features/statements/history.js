import { state } from '../../app/state.js'
import { escapeHtml, privateCurrency } from '../../shared/formatters.js'
import { convertCurrency } from '../../shared/exchange-rates.js'
import { categoriesForType } from '../../data/cash-flow-categories.js'
import { householdOwners } from '../../shared/household-owner.js'
import { compareStatementPeriods } from '../../domain/statement-history.js'
import { renderStatementAnalysis } from './statements.js'

export const statementHistoryView = { activeId: null, comparison: null }
export function resetStatementHistoryView() { statementHistoryView.activeId = null; statementHistoryView.comparison = null }

function recurrenceForm(analysis) {
  if (!analysis.recurring.length) return ''
  const rows = analysis.recurring.map((row, index) => {
    const applied = state.cashFlow.items.some(item => item.analysisOrigin === `${analysis.id}:${index}`)
    const categoryOptions = categoriesForType(row.type, state.customCategories).map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('')
    return `<section><label><input type="checkbox" data-recurring-choice="${index}" ${applied ? 'disabled' : ''}> ${escapeHtml(row.description)}${applied ? ' (já aplicada)' : ''}</label>
      <fieldset data-recurring-fields="${index}" disabled><legend>Revisar lançamento mensal</legend><div class="form-grid form-grid--two">
      <label>Descrição<input name="${index}.description" value="${escapeHtml(row.description)}" maxlength="60" required></label>
      <label>Valor mensal (${analysis.currency})<input type="number" name="${index}.amount" value="${Math.round(row.monthly * 100) / 100}" min="0.01" max="1000000000" step="0.01" required></label>
      <label>Categoria<select name="${index}.categoryId" required><option value="">Selecione</option>${categoryOptions}</select></label>
      <label>Titularidade<select name="${index}.householdOwner" required><option value="">Selecione</option>${Object.entries(householdOwners).filter(([key]) => key !== 'unspecified').map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
      <label>Início<input type="date" name="${index}.startDate" required></label><label>Fim<input type="date" name="${index}.endDate" required></label>
      </div></fieldset></section>`
  }).join('')
  return `<details class="disclosure"><summary>Usar recorrências no orçamento</summary><form data-apply-recurrences><input type="hidden" name="analysisId" value="${analysis.id}"><p>Selecione os itens e confirme valor, titularidade e prazo. Salários devem terminar antes da aposentadoria correspondente. Receitas de aposentadoria precisam começar na data prevista. O histórico não garante renda futura.</p>${rows}<label><input name="confirmed" type="checkbox" required> Revisei os valores e prazos e autorizo adicionar somente os itens selecionados como planejados.</label><button type="submit" class="button button--primary">Adicionar ao orçamento planejado</button></form></details>`
}

export function renderStatementHistory() {
  const history = state.cashFlow.statementAnalyses || []
  if (state.valuesHidden) return '<section class="panel"><h2>Histórico de extratos</h2><p>Mostre os valores para consultar análises e sugestões.</p></section>'
  const active = history.find(row => row.id === statementHistoryView.activeId)
  const options = history.map(row => `<option value="${row.id}">${escapeHtml(row.start)} a ${escapeHtml(row.end)} (${row.currency})</option>`).join('')
  let comparison = ''
  if (statementHistoryView.comparison) {
    const [a, b] = statementHistoryView.comparison.map(id => history.find(row => row.id === id))
    if (a && b) {
      try {
        const result = compareStatementPeriods(a, b)
        const money = value => privateCurrency(value, false, true, result.currency)
        comparison = `<section><h3>O que mudou entre os períodos</h3><p>Anterior: ${result.earlier.start} a ${result.earlier.end}. Mais recente: ${result.later.start} a ${result.later.end}.</p><p>Variação da média mensal: receitas ${money(result.incomeChange)}, despesas ${money(result.expenseChange)}, sobra ${money(result.surplusChange)}.</p><p>As médias incluem todos os meses completos de cada período. Esta comparação não modifica o aporte ou a previsão de aposentadoria.</p></section>`
      } catch { comparison = '<p>Selecione dois períodos válidos, sem sobreposição e na mesma moeda.</p>' }
    }
  }
  return `<section class="panel"><h2>Histórico de análises (${history.length}/6)</h2><p>Resumos com até 24 meses completos. O arquivo bruto não é guardado. Os resumos entram na cópia do plano quando você a salvar no Perfil.</p>
    ${history.length ? `<ul>${history.map(row => `<li>${row.start} a ${row.end} · ${row.currency} · ${row.months.length} meses <button type="button" class="button button--secondary" data-open-analysis="${row.id}">Abrir resumo</button> <button type="button" class="button button--secondary" data-delete-analysis="${row.id}">Excluir resumo</button></li>`).join('')}</ul>` : '<p>Nenhuma análise salva.</p>'}
    ${history.length > 1 ? `<form data-compare-analyses><label>Período A<select name="first" required>${options}</select></label><label>Período B<select name="second" required>${options}</select></label><button type="submit" class="button button--secondary">Comparar médias mensais</button></form>${comparison}` : ''}
    </section>${active ? `<section class="panel"><h2>Resumo salvo: ${active.start} a ${active.end}</h2>${renderStatementAnalysis(active, { currency: active.currency, contribution: convertCurrency(state.plan.monthlyContribution, state.currency, active.currency, state.exchangeRates) })}<p>A comparação com o aporte usa o plano atual${state.currency !== active.currency ? ' convertido pela cotação atual do plano' : ''}.</p>${recurrenceForm(active)}</section>` : ''}`
}
