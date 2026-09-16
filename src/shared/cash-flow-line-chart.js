import { annualRowsInPriceBasis } from '../domain/inflation-display.js'
import { escapeHtml } from './formatters.js'
import { planningChart } from './planning-chart.js'
import { cashFlowDetailIndex, cashFlowDetailPanels } from './cash-flow-detail.js'
import { renderCashFlowResult } from './cash-flow-result.js'
import { renderPropertyFilter, renderSolvencyAssessment, renderSolvencyShortcuts } from './property-solvency.js'
import { remainingWealth } from './remaining-wealth.js'
import { solvencyWealthLabel } from '../domain/property-solvency.js'

// View preference only. It never changes saved amounts or real risk assumptions.
export const cashFlowChartView = { basis: 'real', selectedYear: null, wealth: 'essential', flow: 'budget' }

export function renderCashFlowLineChart({ rows, plan, cashFlow, currency, hidden = false, title, markers = [], selectedYear, wealthTargetAge = plan.targetAge, baseYear = new Date().getUTCFullYear() }) {
  if (hidden) return '<p>Valores ocultos. Gráfico e composição ocultos.</p>'
  if (!rows.length) return '<p>Nenhum dado neste período.</p>'
  selectedYear ??= cashFlowChartView.selectedYear
  const basis = cashFlowChartView.basis === 'nominal' ? 'nominal' : 'real'
  let display
  try { display = annualRowsInPriceBasis(rows, { basis, annualInflation: plan.annualInflation, baseYear }) }
  catch (error) { return `<p role="status">${escapeHtml(error.message)}</p>` }
  display = display.map(row => ({ ...row, ...remainingWealth(row) }))
  const nominal = basis === 'nominal'
  const hasReturn = display.every(row => Number.isFinite(row.financialReturn))
  const basisLabel = nominal ? 'Valores nominais de cada ano' : `Poder de compra de ${baseYear}`
  const selectedIndex = cashFlowDetailIndex(display.map(row => ({ label: String(row.year) })), selectedYear)
  selectedYear = String(display[selectedIndex].year)
  const wealthComparison = cashFlowChartView.wealth === 'comparison'
  const financialView = hasReturn && cashFlowChartView.flow === 'financial'
  const readoutCaption = `${currency} · ${basisLabel}`
  const rate = (plan.annualInflation * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  const series = financialView ? [
    { key: 'freeCashFlow', label: 'Saldo do orçamento', color: '#0369a1', monthly: true },
    { key: 'financialReturn', label: nominal ? 'Rendimento nominal implícito' : 'Rendimento real', color: '#7c3aed', dash: '2 3' },
    { key: 'pensionCredits', label: 'Créditos previdenciários', color: '#a35c1a', dash: '8 4', monthly: true },
    { key: 'financialChange', label: 'Variação do patrimônio financeiro no ano', color: '#1e293b', width: 3, emphasize: true }
  ] : [
    { key: 'income', label: 'Receitas', color: '#0369a1', monthly: true },
    { key: 'outflows', label: 'Despesas e metas', color: '#c2410c', dash: '6 3', monthly: true },
    { key: 'freeCashFlow', label: 'Saldo do orçamento, antes dos rendimentos', color: '#1e293b', width: 3, emphasize: true, monthly: true }
  ]
  const wealthSeries = [
    { key: display.every(row => Number.isFinite(row.solvencyNetWorth)) ? 'solvencyNetWorth' : 'netWorth', label: solvencyWealthLabel(display.find(row => row.excludedRealEstateAssets > 0) || display.at(-1)), color: '#475569', width: 3, emphasize: true },
    { key: 'liquidAssets', label: 'Liquidez disponível', color: '#0369a1', dash: '2 3' },
    ...(wealthComparison ? [
      { key: 'financialNet', label: 'Financeiro líquido de dívidas, sem bens', color: '#047857', dash: '8 4' },
      { key: 'grossAssets', label: 'Patrimônio bruto, com imóveis', color: '#a35c1a', dash: '10 3 2 3' }
    ] : [])
  ].filter(series => display.some(row => Number.isFinite(row[series.key])))
  const wealth = wealthSeries.length ? `<section class="cash-flow-wealth-chart annual-chart-section" aria-label="Patrimônio que sustenta o orçamento"><div class="annual-chart-heading"><div><span class="annual-chart-kind">SALDO ACUMULADO</span><h3>Quanto resta ao fim de cada ano</h3></div><label>Visão do patrimônio<select data-annual-chart-mode="wealth"><option value="essential" ${wealthComparison ? '' : 'selected'}>Essencial: patrimônio e liquidez</option><option value="comparison" ${wealthComparison ? 'selected' : ''}>Comparar todos os patrimônios</option></select></label></div>
    <p>Patrimônio considerado é o saldo após dívidas e o filtro de imóveis. Liquidez é o recurso disponível para pagar despesas. As linhas compartilham valores e não devem ser somadas.</p>
    <p class="annual-chart-basis">${escapeHtml(readoutCaption)} · Saldos no fechamento de dezembro · Escala própria.</p>
    ${planningChart({ title: 'Patrimônio ao fim de cada ano', rows: display, series: wealthSeries, currency, markers, selectedYear, linkedSelection: true, interpolation: 'linear', annualReadout: true, readoutCaption: `${readoutCaption} · Saldo no fim do ano` })}
    <details class="disclosure"><summary>Entender os tipos de patrimônio</summary><p>Patrimônio bruto soma saldos financeiros e todos os bens antes das dívidas. Financeiro líquido desconta todas as dívidas e exclui os bens. O filtro de imóveis altera somente o patrimônio considerado. Patrimônio positivo pode coexistir com falta de liquidez. Saldos negativos representam insuficiência projetada.</p></details></section>` : ''
  return `<section class="cash-flow-line-view" data-cash-flow-line-view>
    ${hasReturn ? renderPropertyFilter(cashFlow) : ''}
    <div class="annual-chart-toolbar"><label class="cash-flow-price-control">Base dos valores <select data-cash-flow-price-basis><option value="real" ${nominal ? '' : 'selected'}>Poder de compra de ${baseYear}</option><option value="nominal" ${nominal ? 'selected' : ''}>Valores nominais de cada ano</option></select></label><label>Ano selecionado nos dois gráficos<select data-cash-flow-year>${display.map((row, index) => `<option value="${index}" ${index === selectedIndex ? 'selected' : ''}>${escapeHtml(row.year)}</option>`).join('')}</select></label></div>
    <p class="annual-chart-basis">${escapeHtml(readoutCaption)}. ${nominal ? 'Cada ano inclui a inflação acumulada do plano.' : 'Todos os anos usam o mesmo poder de compra, permitindo comparar valores ao longo do tempo.'} Inflação anual do plano: ${rate}%. A base e o ano selecionado valem para ambos os gráficos e para a composição.</p>
    ${renderCashFlowResult(display.at(-1), currency, { final: true })}
    ${renderSolvencyAssessment(display, currency)}
    ${renderSolvencyShortcuts(display)}
    ${wealth}
    <section class="annual-chart-section" aria-label="Fluxos anuais"><div class="annual-chart-heading"><div><span class="annual-chart-kind">TOTAL DURANTE O ANO</span><h3>O que entra e sai durante o ano</h3></div>${hasReturn ? `<label>Visão dos fluxos<select data-annual-chart-mode="flow"><option value="budget" ${financialView ? '' : 'selected'}>Orçamento: receitas, despesas e saldo</option><option value="financial" ${financialView ? 'selected' : ''}>Resultado: saldo, rendimentos e previdência</option></select></label>` : ''}</div>
    <p class="annual-chart-equation">${financialView ? 'Saldo do orçamento + rendimentos + créditos previdenciários = variação do patrimônio financeiro no ano.' : 'Receitas − despesas e metas = saldo do orçamento, antes dos rendimentos.'}</p>
    <p>${financialView ? 'A variação indica quanto os ativos financeiros aumentam ou diminuem durante o ano. Não é o patrimônio acumulado. Créditos previdenciários podem permanecer restritos.' : `Receitas e despesas aparecem como valores positivos para comparação. Quando as despesas superam as receitas, o saldo fica abaixo de zero. ${hasReturn ? 'Rendimentos e créditos previdenciários estão na visão Resultado.' : 'Este recorte não projeta rendimentos.'}`} ${financialView ? 'Variação abaixo de zero indica redução dos ativos financeiros no ano.' : 'Saldo abaixo de zero indica déficit no orçamento.'} Liberações transferem saldo existente, sem criar receita.</p>
    <p class="annual-chart-basis">${escapeHtml(readoutCaption)} · Totais dos meses incluídos em cada ano, com a média mensal ao lado · Escala independente do patrimônio.</p>
    ${planningChart({ title: financialView ? 'Variação anual do patrimônio financeiro' : title || 'Fluxos anuais do orçamento', rows: display, series, currency, markers, selectedYear, interpolation: 'linear', annualReadout: true, readoutCaption: `${readoutCaption} · Total anual e média mensal`, details: cashFlowDetailPanels(display, plan, currency, false, { wealthTargetAge }) })}</section>
    <details class="disclosure"><summary>Como a inflação entra nesta projeção</summary><p>Na visão real, os valores já estão em poder de compra de ${baseYear} e o retorno já desconta inflação. Não se deve aumentar apenas as despesas pela inflação e manter receitas e rendimento em valores reais.</p><p>Na visão nominal, o índice acumulado é (1 + inflação anual) elevado ao número de anos desde ${baseYear}. O ano-base tem índice 1. O rendimento nominal implícito também inclui a atualização do saldo inicial, para conciliar aberturas e fechamentos. A hipótese de inflação é constante, não uma previsão.</p><p>Manter um lançamento constante em termos reais pressupõe que ele acompanha a inflação. Salários ou benefícios sem reajuste perdem poder de compra e exigem outra regra. O modelo ainda não separa indexação por contrato ou inflação por categoria. Parcelas, consórcios e metas conservam as regras atualmente cadastradas.</p><p>A conversão usa a inflação da moeda de apresentação após o câmbio fixo. Não projeta inflação ou câmbio de cada país. Dados originais na composição e os demais gráficos, tabelas e riscos continuam em valores reais. Alternar a visão não altera a viabilidade, não acrescenta receita e não duplica inflação.</p><a href="/plano" data-route>Revisar inflação e retorno do plano</a></details>
  </section>`
}
