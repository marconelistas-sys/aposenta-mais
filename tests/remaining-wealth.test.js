import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingWealth, remainingWealthPeaks, renderRemainingWealth, remainingWealthComposition } from '../src/shared/remaining-wealth.js'
import { annualFinappRecurrence } from '../src/domain/finapp-viability.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { assessPropertySolvency } from '../src/domain/property-solvency.js'
import { renderCashFlowLineChart, cashFlowChartView } from '../src/shared/cash-flow-line-chart.js'
import { cashFlowDetailPanels } from '../src/shared/cash-flow-detail.js'

function renderComparison(options) {
  const before = cashFlowChartView.wealth
  try { cashFlowChartView.wealth = 'comparison'; return renderCashFlowLineChart(options) }
  finally { cashFlowChartView.wealth = before }
}

const plan = { currentAge: 60, targetAge: 62, horizonReferenceMonth: '2030-01', annualInflation: .1 }
const fixture = () => annualFinappRecurrence({
  openingFinancial: 1000, openingLiquid: 400, annualReturn: 0, openingYearPeriod: 1,
  years: [2030, 2031, 2032].map(year => ({ year, income: 0, costs: 400, goals: 0, pensionCredits: 0, releases: 0, pensionRestricted: 600, assets: 2000, liabilities: 800, realEstateAssets: 2000, excludedRealEstateAssets: 0,
    breakdown: { income: [], costs: [{ id: 'cost', name: 'Despesa', amount: 400, originalAmount: 400, currency: 'BRL', frequency: 'annual', months: 12 }], goals: [], pension: [], releases: [] }
  }))
})

test('callout components reconcile with both balances, including deficits and property excluded from solvency', () => {
  const rows = assessPropertySolvency(fixture().map(row => ({ ...row, excludedRealEstateAssets: 2000 })), false)
  const before = structuredClone(rows)
  for (const row of rows) for (const key of ['financialNet', 'grossAssets']) {
    const composition = remainingWealthComposition(row, key)
    assert.equal(composition.components.reduce((sum, part) => sum + part.amount, 0), remainingWealth(row)[key])
    assert.equal(composition.financialDetails.reduce((sum, part) => sum + part.amount, 0), row.financialAssets)
    assert.equal(composition.total, remainingWealth(row)[key])
  }
  assert.equal(remainingWealthComposition(rows[1], 'financialNet').components[1].amount, -800)
  assert.equal(remainingWealthComposition(rows[1], 'grossAssets').components.find(part => part.label === 'Imóveis').amount, 2000)
  assert.equal(remainingWealthComposition(rows[1], 'financialNet').financialDetails[0].amount, -400)
  assert.deepEqual(rows, before)
})

test('callouts follow the displayed nominal year and do not invent unavailable component details', () => {
  const row = annualRowsInPriceBasis(fixture(), { basis: 'nominal', annualInflation: .1, baseYear: 2030 })[1]
  const composition = remainingWealthComposition(row, 'grossAssets')
  assert.ok(Math.abs(composition.components[0].amount - 220) < 1e-7)
  assert.equal(composition.components[1].amount, 2200)
  assert.equal(composition.total, 2420)
  const partial = { year: 2031, financialAssets: 200, assets: 2000, liabilities: 800 }
  const model = remainingWealthComposition(partial, 'grossAssets')
  assert.equal(model.components.length, 2)
  assert.deepEqual(model.financialDetails, [])
  assert.equal(remainingWealthComposition({}, 'grossAssets'), null)
  assert.equal(remainingWealthComposition(partial, 'unknown'), null)
  const html = renderRemainingWealth(row, 'EUR')
  assert.match(html, /nominais do ano selecionado/)
  assert.match(html, /2\.420,00/)
  assert.doesNotMatch(html, /R\$/)
  assert.doesNotMatch(renderRemainingWealth(partial, 'BRL'), /Saldo financeiro restrito/)
})

test('each rendered year exposes labelled controls and hidden mode excludes callout content', () => {
  const rows = fixture()
  const html = cashFlowDetailPanels(rows, plan, 'BRL').map(detail => detail.html).join('')
  assert.equal((html.match(/data-wealth-trigger aria-expanded="false"/g) || []).length, 12)
  assert.equal((html.match(/data-wealth-callout hidden role="region"/g) || []).length, 12)
  for (const row of rows) {
    assert.ok(html.includes(`aria-label="Composição: Financeiro líquido de dívidas em ${row.year}"`))
    assert.ok(html.includes(`aria-label="Composição: Receitas em ${row.year}"`))
    assert.ok(html.includes(`aria-label="Composição: Despesas e metas em ${row.year}"`))
  }
  assert.match(html, /O que compõe este valor em 2031/)
  assert.deepEqual(cashFlowDetailPanels(rows, plan, 'BRL', true), [])
  assert.doesNotMatch(renderCashFlowLineChart({ rows, plan, currency: 'BRL', hidden: true }), /data-wealth-callout|Dívidas a descontar/)
})

test('remaining wealth separates net financial assets, gross assets and available liquidity without changing projections', () => {
  const rows = fixture(), before = structuredClone(rows)
  assert.deepEqual(rows.map(remainingWealth), [
    { financialNet: -200, grossAssets: 2600 },
    { financialNet: -600, grossAssets: 2200 },
    { financialNet: -1000, grossAssets: 1800 }
  ])
  rows.forEach(row => {
    const model = remainingWealth(row)
    assert.equal(model.financialNet, row.netFinancial)
    assert.equal(model.grossAssets - row.liabilities, row.netWorth)
  })
  const html = renderRemainingWealth(rows[1], 'BRL')
  assert.match(html, /Falta de liquidez projetada/)
  assert.match(html, /R\$\s*400,00/)
  assert.match(html, /-R\$\s*600,00/)
  assert.match(html, /R\$\s*2\.200,00/)
  assert.deepEqual(rows, before)
})

test('annual chart preserves signed balances and the composition measures each balance against its peak', () => {
  const rows = fixture(), peaks = remainingWealthPeaks(rows, 2032)
  assert.deepEqual(peaks, { financialNet: { value: 0, year: null }, grossAssets: { value: 2600, year: 2030 }, endYear: 2032, complete: true })
  const details = cashFlowDetailPanels(rows, plan, 'BRL')
  assert.ok(details.every(detail => detail.html.includes('Sem saldo positivo de referência')))
  assert.match(details[1].html, /Patrimônio em 2031 comparado ao máximo/)
  assert.match(details[1].html, /84,6% do máximo/)
  assert.match(details[1].html, /até a idade-alvo \(2032\)/)
  const html = renderComparison({ rows, plan, currency: 'BRL', title: 'Fluxo', baseYear: 2030, selectedYear: 2031 })
  const wealthChart = html.split('<section class="cash-flow-wealth-chart annual-chart-section"')[1].split('</section>')[0]
  assert.equal((wealthChart.match(/<rect[^>]+rx="1"/g) || []).length, 0)
  assert.match(wealthChart, /2031 · Financeiro líquido de dívidas, sem bens: -R\$\s*600,00/)
  assert.match(wealthChart, /2031 · Patrimônio bruto, com imóveis: R\$\s*2\.200,00/)
  assert.match(wealthChart, /data-chart-selected-index="1"/)
})

test('gross assets include excluded property while the solvency series still respects the filter', () => {
  const rows = fixture()
  const included = assessPropertySolvency(rows)
  const excluded = assessPropertySolvency(rows.map(row => ({ ...row, excludedRealEstateAssets: 2000 })), false)
  assert.deepEqual(included.map(remainingWealth), excluded.map(remainingWealth))
  assert.equal(included[0].solvencyNetWorth - excluded[0].solvencyNetWorth, 2000)
  const html = renderComparison({ rows: excluded, plan, cashFlow: { includeRealEstateInSolvency: false }, currency: 'BRL', title: 'Fluxo', baseYear: 2030 })
  assert.match(html, /2030 · Patrimônio considerado, sem imóveis: -R\$\s*200,00/)
  assert.match(html, /2030 · Patrimônio bruto, com imóveis: R\$\s*2\.600,00/)
})

test('nominal values derive both balances after a single price conversion', () => {
  const rows = fixture()
  const nominal = annualRowsInPriceBasis(rows, { basis: 'nominal', annualInflation: .1, baseYear: 2030 })
  assert.ok(Math.abs(remainingWealth(nominal[1]).financialNet + 660) < 1e-7)
  assert.equal(remainingWealth(nominal[1]).grossAssets, 2420)
  const before = cashFlowChartView.basis
  try {
    cashFlowChartView.basis = 'nominal'
    const html = renderComparison({ rows, plan, currency: 'BRL', title: 'Fluxo', baseYear: 2030 })
    assert.match(html, /2031 · Patrimônio bruto, com imóveis: R\$\s*2\.420,00/)
    assert.match(html, /2031 · Financeiro líquido de dívidas, sem bens: -R\$\s*660,00/)
  } finally { cashFlowChartView.basis = before }
})

test('missing wealth is not invented for monthly-only periods and hidden mode removes all balances', () => {
  const rows = fixture()
  assert.equal(remainingWealth({ financialAssets: 10 }), null)
  assert.equal(renderRemainingWealth({ income: 10, costs: 20 }, 'BRL'), '')
  assert.deepEqual(cashFlowDetailPanels(rows, plan, 'BRL', true), [])
  const html = renderComparison({ rows, plan, currency: 'BRL', title: 'Fluxo', hidden: true })
  assert.doesNotMatch(html, /remaining-wealth|Patrimônio bruto|2\.600|2030|<svg/)
  const zero = { ...rows[0], financialAssets: 0, assets: 0, liabilities: 0, liquidAssets: 0 }
  assert.doesNotMatch(renderRemainingWealth(zero, 'BRL'), /NaN|Infinity/)
})

test('moving between years fills each meter relative to its own fixed maximum through the target age', () => {
  const rows = fixture().map((row, index) => ({ ...row, financialAssets: [1000, 600, 800][index], assets: [1000, 2400, 700][index], liabilities: 0 }))
  const before = structuredClone(rows)
  const peaks = remainingWealthPeaks(rows, 2032)
  assert.deepEqual(peaks.financialNet, { value: 1000, year: 2030 })
  assert.deepEqual(peaks.grossAssets, { value: 3000, year: 2031 })
  const details = cashFlowDetailPanels(rows, plan, 'BRL')
  for (const [index, expected] of [[0, ['0.0000', '100.0000', '100.0000', '66.6667']], [1, ['0.0000', '100.0000', '60.0000', '100.0000']], [2, ['0.0000', '100.0000', '80.0000', '50.0000']]]) {
    assert.deepEqual([...details[index].html.matchAll(/role="meter"[^>]*aria-valuenow="([\d.]+)"/g)].map(match => match[1]), expected)
    assert.ok(details[index].html.indexOf('remaining-wealth') < details[index].html.indexOf('budget-comparison'))
    assert.match(details[index].html, /Máximo: <strong class="money-value">R\$\s*1\.000,00<\/strong> em 2030/)
  }
  assert.deepEqual(rows, before)
})

test('years beyond the saved target cannot raise the peak, even in a longer scenario', () => {
  const rows = fixture().map(row => ({ ...row, financialAssets: 1000, assets: 2000, liabilities: 0 }))
  rows.push({ ...rows[0], year: 2033, financialAssets: 2000, assets: 8000 })
  const peaks = remainingWealthPeaks(rows, 2032)
  assert.equal(peaks.financialNet.value, 1000)
  assert.equal(peaks.grossAssets.value, 3000)
  const details = cashFlowDetailPanels(rows, { ...plan, targetAge: 100 }, 'BRL', false, { wealthTargetAge: 62 })
  assert.match(details[0].html, /até a idade-alvo \(2032\)/)
  assert.match(details[3].html, /200% do máximo, acima da referência até a idade-alvo/)
  assert.match(details[3].html, /aria-valuenow="100.0000"/)
  const partial = renderRemainingWealth(rows[0], 'BRL', remainingWealthPeaks(rows.slice(0, 1), 2032))
  assert.match(partial, /no período projetado disponível/)
  assert.doesNotMatch(partial, /máximo até a idade-alvo/)
})

test('peak selection follows the displayed price basis and negative amounts leave the meter empty', () => {
  const rows = fixture().map((row, index) => ({ ...row, financialAssets: [1000, 950, -100][index], assets: 0, liabilities: 0 }))
  assert.equal(remainingWealthPeaks(rows, 2032).financialNet.year, 2030)
  const nominal = annualRowsInPriceBasis(rows, { basis: 'nominal', annualInflation: .1, baseYear: 2030 })
  const peaks = remainingWealthPeaks(nominal, 2032)
  assert.equal(peaks.financialNet.year, 2031)
  assert.equal(peaks.financialNet.value, 1045)
  const negative = renderRemainingWealth(nominal[2], 'BRL', peaks)
  assert.match(negative, /0% do máximo, saldo negativo/)
  assert.match(negative, /-R\$\s*121,00/)
  assert.equal((negative.match(/aria-valuenow="0.0000"/g) || []).length, 2)
  assert.doesNotMatch(negative, /NaN|Infinity/)
})
