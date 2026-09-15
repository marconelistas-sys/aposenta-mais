import { state } from '../../app/state.js'
import { privateCurrency, escapeHtml } from '../../shared/formatters.js'
import { simulateExpenseReduction } from '../../domain/expense-impact.js'
import { planningChart } from '../../shared/planning-chart.js'

export const expenseImpactView = { input: null, result: null, signature: null, trigger: null }
const signature = () => JSON.stringify([state.plan, state.cashFlow, state.currency, state.exchangeRates, state.customCategories])
export function resetExpenseImpact() { Object.assign(expenseImpactView, { input: null, result: null, signature: null, trigger: null }) }
export function calculateExpenseImpact(data) {
  const input = { ...expenseImpactView.input, percent: Number(data.get('percent')), startYear: Number(data.get('startYear')) }
  if (!String(data.get('percent') ?? '').trim()) throw new Error('Informe o percentual de redução.')
  expenseImpactView.result = simulateExpenseReduction(state, input)
  expenseImpactView.input = input
  expenseImpactView.signature = signature()
}
export function renderExpenseImpactResult() {
  const result = expenseImpactView.result
  if (!result || state.valuesHidden) return ''
  if (expenseImpactView.signature !== signature()) return '<p role="status">Os dados do plano mudaram. Calcule novamente para atualizar a comparação.</p>'
  const money = value => privateCurrency(value, false, true, state.currency)
  const base = result.baseline.rows.at(-1), next = result.changed.at(-1)
  const first = result.changed.find(row => Number(row.year) === result.startYear)
  const before = result.baseline.rows.find(row => Number(row.year) === result.startYear)
  const chartRows = result.changed.map((row, index) => ({ year: row.year, current: result.baseline.rows[index].liquidAssets, simulated: row.liquidAssets }))
  const difference = result.finalDifference
  return `<div class="expense-impact-result"><p role="status">Comparação calculada. O plano salvo permanece inalterado.</p><h3>Hipótese de redução de ${result.percent.toLocaleString('pt-BR')}% a partir de ${result.startYear}</h3><p>Menor desembolso acumulado: <strong class="money-value">${money(result.totalReduction)}</strong>. Diferença no patrimônio financeiro final: <strong class="money-value">${money(difference)}</strong>. A diferença patrimonial também incorpora rendimentos e eventuais impostos de resgate recalculados.</p>
  <div class="table-scroll" role="region" tabindex="0" aria-label="Comparação do plano com redução de despesa"><table><thead><tr><th>Indicador</th><th>Plano atual</th><th>Hipótese</th></tr></thead><tbody>${[
    [`Saldo do orçamento em ${result.startYear}`, money(before.freeCashFlow), money(first.freeCashFlow)],
    [`Patrimônio financeiro em ${result.endYear}`, money(base.financialAssets), money(next.financialAssets)],
    [`Liquidez em ${result.endYear}`, money(base.liquidAssets), money(next.liquidAssets)],
    ['Primeira insuficiência anual', result.baseline.firstFailure?.year || 'Não ocorre no horizonte', result.firstFailure?.year || 'Não ocorre no horizonte']
  ].map(([label, a, b]) => `<tr><th scope="row">${label}</th><td><span class="money-value">${a}</span></td><td><span class="money-value">${b}</span></td></tr>`).join('')}</tbody></table></div>
  ${result.totalReduction === 0 ? '<p>Esta hipótese não reduz saídas no período. Confira o percentual, o ano inicial e o prazo do lançamento.</p>' : ''}
  ${result.baseline.issues.length ? `<p>A avaliação tem ${result.baseline.issues.length} pendência(s). A comparação não confirma sustentabilidade enquanto as premissas estiverem incompletas.</p>` : ''}
  ${planningChart({ title: 'Liquidez anual, plano atual e hipótese', rows: chartRows, currency: state.currency, series: [{ key: 'current', label: 'Plano atual', color: '#475569' }, { key: 'simulated', label: 'Hipótese', color: '#047857', dash: '6 3' }] })}
  <p>Projeção em poder de compra atual, ${state.currency}, até ${result.targetAge} anos. Insuficiência significa patrimônio financeiro líquido de dívidas ou liquidez negativos no fechamento anual. Não verifica cada mês. Patrimônio positivo não garante liquidez. O resultado depende das premissas cadastradas.</p></div>`
}
export function renderExpenseImpact() {
  const input = expenseImpactView.input
  if (!input || state.valuesHidden) return ''
  const item = state.cashFlow.items.find(item => item.id === input.itemId)
  if (!item) return ''
  return `<dialog class="cash-edit-dialog expense-impact-dialog" data-expense-impact-dialog aria-labelledby="expense-impact-title"><form data-expense-impact-form><div class="cash-edit-dialog__header"><h2 id="expense-impact-title">E se este gasto diminuir?</h2><button class="icon-button" type="button" data-expense-impact-close aria-label="Fechar simulação">×</button></div><p>${escapeHtml(item.description || item.categoryId)}</p><div class="form-grid form-grid--two"><label class="form-field"><span>Redução (%)</span><input name="percent" type="number" min="0" max="100" step="0.1" value="${input.percent}" required /></label><label class="form-field"><span>A partir de janeiro de</span><input name="startYear" type="number" min="${new Date().getFullYear()}" max="2199" step="1" value="${input.startYear}" required /></label></div><p>A hipótese reduz somente este gasto nos anos completos selecionados, respeitando início e término cadastrados. Escolher o ano atual inclui seus meses já transcorridos. Comparação em poder de compra atual, mesmo que o gráfico esteja em valores nominais. Nenhum valor do plano é salvo.</p><button class="button button--primary" type="submit">Comparar efeito no planejamento</button><div data-expense-impact-output>${renderExpenseImpactResult()}</div><button class="button button--secondary" type="button" data-expense-impact-close>Fechar sem alterar o plano</button></form></dialog>`
}
