import { annualRowsInPriceBasis } from '../domain/inflation-display.js'
import { escapeHtml } from './formatters.js'
import { planningChart } from './planning-chart.js'
import { cashFlowDetailPanels } from './cash-flow-detail.js'
import { renderCashFlowResult } from './cash-flow-result.js'

// View preference only. It never changes saved amounts or real risk assumptions.
export const cashFlowChartView = { basis: 'real' }

export function renderCashFlowLineChart({ rows, plan, currency, hidden = false, title, markers = [], selectedYear, baseYear = new Date().getUTCFullYear() }) {
  if (hidden) return '<p>Valores ocultos. Gráfico e composição ocultos.</p>'
  if (!rows.length) return '<p>Nenhum dado neste período.</p>'
  const basis = cashFlowChartView.basis === 'nominal' ? 'nominal' : 'real'
  let display
  try { display = annualRowsInPriceBasis(rows, { basis, annualInflation: plan.annualInflation, baseYear }) }
  catch (error) { return `<p role="status">${escapeHtml(error.message)}</p>` }
  const nominal = basis === 'nominal'
  const hasReturn = display.every(row => Number.isFinite(row.financialReturn))
  const basisLabel = nominal ? 'nominais, dinheiro de cada ano' : `reais, poder de compra de ${baseYear}`
  const rate = (plan.annualInflation * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const series = [
    { key: 'income', label: 'Receitas', color: '#0369a1' },
    { key: 'outflows', label: 'Despesas e metas', color: '#c2410c', dash: '6 3' },
    ...(hasReturn ? [{ key: 'financialReturn', label: nominal ? 'Rendimento nominal implícito' : 'Rendimento real', color: '#7c3aed', dash: '2 3' }] : []),
    { key: hasReturn ? 'financialChange' : 'freeCashFlow', label: hasReturn ? 'Resultado final do ano' : 'Saldo do orçamento, antes dos rendimentos', color: '#1e293b', width: 3, emphasize: true }
  ]
  return `<section class="cash-flow-line-view" data-cash-flow-line-view>
    <label class="cash-flow-price-control">Valores deste gráfico e da composição <select data-cash-flow-price-basis><option value="real" ${nominal ? '' : 'selected'}>Poder de compra atual, reais</option><option value="nominal" ${nominal ? 'selected' : ''}>Dinheiro futuro, nominais</option></select></label>
    <p>Valores ${basisLabel}. Inflação anual do plano: ${rate}%. A linha escura mostra ${hasReturn ? 'o resultado após receitas, despesas, rendimentos e créditos previdenciários' : 'o saldo antes dos rendimentos'}. Valores abaixo de zero indicam ${hasReturn ? 'redução dos ativos financeiros no ano' : 'déficit no orçamento'}.</p>
    ${renderCashFlowResult(display.at(-1), currency, { final: true })}
    ${planningChart({ title: `${title} · ${basisLabel}`, rows: display, series, currency, markers, selectedYear, interpolation: 'linear', details: cashFlowDetailPanels(display, plan, currency) })}
    <details class="disclosure"><summary>Como a inflação entra nesta projeção</summary><p>Na visão real, os valores já estão em poder de compra de ${baseYear} e o retorno já desconta inflação. Não se deve aumentar apenas as despesas pela inflação e manter receitas e rendimento em valores reais.</p><p>Na visão nominal, o índice acumulado é (1 + inflação anual) elevado ao número de anos desde ${baseYear}. O ano-base tem índice 1. O rendimento nominal implícito também inclui a atualização do saldo inicial, para conciliar aberturas e fechamentos. A hipótese de inflação é constante, não uma previsão.</p><p>Manter um lançamento constante em termos reais pressupõe que ele acompanha a inflação. Salários ou benefícios sem reajuste perdem poder de compra e exigem outra regra. O modelo ainda não separa indexação por contrato ou inflação por categoria. Parcelas, consórcios e metas conservam as regras atualmente cadastradas.</p><p>A conversão usa a inflação da moeda de apresentação após o câmbio fixo. Não projeta inflação ou câmbio de cada país. Dados originais na composição e os demais gráficos, tabelas e riscos continuam em valores reais. Alternar a visão não altera a viabilidade, não acrescenta receita e não duplica inflação.</p><a href="/plano" data-route>Revisar inflação e retorno do plano</a></details>
  </section>`
}
