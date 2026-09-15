import test from 'node:test'
import assert from 'node:assert/strict'
import { renderCashFlowLineChart, cashFlowChartView } from '../src/shared/cash-flow-line-chart.js'
import { planningChart } from '../src/shared/planning-chart.js'

const rows = [2030, 2031, 2032].map((year, index) => ({
  year, income: 1000, costs: 1200, goals: 100, freeCashFlow: -300,
  pensionCredits: 50, financialReturn: 100, financialChange: -150,
  previousFinancial: 1000 - index * 150, financialAssets: 850 - index * 150,
  liquidAssets: 100 - index * 150, previousLiquid: 200 - index * 150,
  liquidReturn: 0, liquidChange: -100, netWorth: 2850 - index * 150,
  solvencyNetWorth: 2850 - index * 150, assets: 2000, liabilities: 0
}))
const options = { rows, plan: { annualInflation: .1 }, currency: 'CHF', baseYear: 2030, selectedYear: 2031 }
function render(view = {}, input = options) {
  const previous = { ...cashFlowChartView }
  try {
    Object.assign(cashFlowChartView, { basis: 'real', wealth: 'essential', flow: 'budget' }, view)
    return renderCashFlowLineChart(input)
  } finally { Object.assign(cashFlowChartView, previous) }
}
const figures = html => [...html.matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map(match => match[0])

test('essential charts separate closing balances from yearly flows and expose exact values without hovering', () => {
  const before = structuredClone(options)
  const html = render(), [wealth, budget] = figures(html)
  assert.equal((wealth.match(/data-chart-toggle=/g) || []).length, 2)
  assert.equal((budget.match(/data-chart-toggle=/g) || []).length, 3)
  assert.doesNotMatch(wealth, /<rect[^>]+rx="1"/)
  assert.match(budget, /Saldo do orçamento, antes dos rendimentos/)
  assert.doesNotMatch(budget, /Resultado final do ano|Rendimento real/)
  assert.match(html, /CHF · Poder de compra de 2030/)
  assert.ok(html.indexOf('data-cash-flow-year') < html.indexOf('<figure'))
  for (const figure of [wealth, budget]) {
    assert.match(figure, /data-chart-selected-index="1"/)
    assert.match(figure, /data-chart-snapshot="1" ><h3>Ano 2031/)
    assert.ok(figure.indexOf('planning-chart-legend') < figure.indexOf('<svg'))
    assert.ok(figure.indexOf('data-chart-readout aria-live') > figure.indexOf('</svg>'))
    assert.match(figure, /<th scope="row">2031<\/th>/)
    assert.match(figure, /planning-chart-zero/)
  }
  assert.deepEqual(options, before)
})

test('comparison and financial views preserve the meaning of overlapping wealth and annual change', () => {
  const html = render({ wealth: 'comparison', flow: 'financial' })
  const [wealth, financial] = figures(html)
  assert.equal((wealth.match(/data-chart-toggle=/g) || []).length, 4)
  assert.match(wealth, /Financeiro líquido de dívidas, sem bens/)
  assert.match(wealth, /Patrimônio bruto, com imóveis/)
  assert.match(html, /não devem ser somadas/)
  assert.match(financial, /Variação do patrimônio financeiro no ano/)
  assert.match(financial, /Créditos previdenciários/)
  assert.match(html, /Saldo do orçamento \+ rendimentos \+ créditos previdenciários = variação/)
  assert.doesNotMatch(financial, /Resultado final do ano/)
})

test('price changes retain the selected year, convert once and expose the nominal basis', () => {
  const nominal = render({ basis: 'nominal', wealth: 'comparison', flow: 'financial' })
  assert.equal((nominal.match(/data-chart-selected-index="1"/g) || []).length, 2)
  assert.match(nominal, /CHF · Valores nominais de cada ano/)
  assert.match(nominal, /2031 · Financeiro líquido de dívidas, sem bens: CHF\s*770,00/)
  assert.match(nominal, /Rendimento nominal implícito/)
  const hidden = render({}, { ...options, hidden: true })
  assert.doesNotMatch(hidden, /2030|CHF|<svg|<table|<select/)
})

test('missing series remain absent and text tables do not invent zero balances', () => {
  const html = planningChart({ title: 'Saldo', rows: [{ year: 2030, amount: 1 }, { year: 2031 }], series: [{ key: 'amount', label: 'Saldo', color: '#0369a1' }], currency: 'BRL', annualReadout: true })
  assert.match(html, /<th scope="row">2031<\/th><td>Não informado<\/td>/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})
