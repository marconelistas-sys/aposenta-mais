import test from 'node:test'
import assert from 'node:assert/strict'
import { projectionLifeContext, projectionPeriodLabel, renderFinancialYearChange } from '../src/shared/projection-life.js'
import { planningChart } from '../src/shared/planning-chart.js'
import { projectAnnualInvestments } from '../src/domain/annual-investment-projection.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { cashFlowChartView, renderCashFlowLineChart } from '../src/shared/cash-flow-line-chart.js'

const plan = { currentAge: 40, retirementAge: 42, horizonReferenceMonth: '2030-11', retirementMonth: '2032-07', targetAge: 45, annualInflation: 0.1 }
const rows = [2030, 2032, 2035].map(year => ({ year, income: 100, costs: 50, goals: 0, freeCashFlow: 50, previousFinancial: 1000, financialReturn: 100, pensionCredits: 20, withdrawalTax: 0, financialAssets: 1170, financialChange: 170, liquidAssets: 500, assets: 0, liabilities: 0, netWorth: 1170 }))

test('idade usa o ano de referência salvo, sem presumir aniversário ou fase de acumulação', () => {
  const life = projectionLifeContext(rows, plan, [], 2026)
  assert.deepEqual(life.periods.map(row => row.age), [40, 42, 45])
  assert.deepEqual(life.periods.map(row => row.phase), ['Antes da aposentadoria', 'Ano da aposentadoria', 'Após a aposentadoria'])
  assert.equal(projectionPeriodLabel(rows[1], life.periods[1]), '2032, idade estimada 42 · Ano da aposentadoria')
  assert.equal(projectionLifeContext(rows, { ...plan, currentAge: undefined }).periods[0].age, null)
  assert.deepEqual(projectionLifeContext(rows, { ...plan, retirementMonth: '2040-01' }).periods.map(row => row.phase), Array(3).fill('Antes da aposentadoria'))
})

test('marcos agrupam eventos coincidentes e ignoram anos fora do gráfico', () => {
  const source = rows.map((row, index) => ({ ...row, releases: [0, 200, 100][index] }))
  const before = structuredClone(source)
  const life = projectionLifeContext(source, plan, [{ year: 2032, label: 'Falta de liquidez' }, { year: 2090, label: 'Fora do horizonte' }, { year: 2032, label: 'Aposentadoria' }])
  assert.deepEqual(life.milestones.map(row => row.year), [2030, 2032, 2035])
  assert.deepEqual(life.milestones[1].labels, ['Aposentadoria', 'Falta de liquidez', 'Maior liberação de saldo restrito'])
  assert.deepEqual(source, before)
  assert.equal(projectionLifeContext([], plan).milestones.length, 0)
})

test('leitura anual e tabela trazem idade, marcos ficam fora do SVG e valores ocultos removem tudo', () => {
  const input = { title: 'Patrimônio', rows, series: [{ key: 'financialAssets', label: 'Financeiro', color: '#475569' }], currency: 'CHF', annualReadout: true, financialBreakdown: true, selectedYear: '2032', markers: [{ year: 2032, label: 'Aposentadoria' }], lifeContext: projectionLifeContext(rows, plan) }
  const html = planningChart(input)
  assert.match(html, /data-chart-milestone="1" aria-pressed="true"/)
  assert.match(html, /Idade estimada 42 · Ano da aposentadoria · Fechamento do ano/)
  assert.match(html, /<th scope="row">2032<\/th><td>42<\/td>/)
  assert.match(html, /Por que o saldo financeiro mudou neste ano/)
  assert.doesNotMatch(html.match(/<svg[\s\S]*?<\/svg>/)[0], /Aposentadoria/)
  assert.doesNotMatch(planningChart({ ...input, hidden: true }), /2032|CHF|marco|data-chart|Idade/)
})

test('imposto já descontado pelo motor também fecha a apresentação real e nominal', () => {
  const source = [2030, 2031].map(year => ({ year, income: 0, costs: 1000, goals: 0, pensionCredits: 0, pensionFlows: [], assets: 0, liabilities: 0 }))
  const model = { currency: 'CHF', openingYearPeriod: 1, taxRegime: 'manual', manualTaxRate: 0.1, plan: { annualRealReturn: 0, investments: [{ id: 'p', name: 'Previdência', amount: 10000, liquidity: 'available', assetClass: 'pension' }] } }
  const projected = projectAnnualInvestments(source, model)
  assert.deepEqual(projected.map(row => row.financialAssets), [8900, 7800])
  assert.deepEqual(projected.map(row => row.withdrawalTax), [100, 100])
  const before = structuredClone(projected)
  for (const basis of ['real', 'nominal']) {
    const display = annualRowsInPriceBasis(projected, { basis, baseYear: 2030, annualInflation: 0.1 })
    for (const row of display) assert.ok(Math.abs(row.previousFinancial + row.financialReturn + row.freeCashFlow + row.pensionCredits - row.withdrawalTax - row.financialAssets) < 1e-8)
    if (basis === 'nominal') {
      assert.ok(Math.abs(display[1].withdrawalTax - 110) < 1e-8)
      assert.match(renderFinancialYearChange(display[1], 'CHF'), /Imposto sobre resgates<\/dt><dd>-CHF\s*110/)
    }
  }
  assert.deepEqual(projected, before)
})

test('liberação aparece separada da soma e recortes sem patrimônio não inventam saldo', () => {
  const html = renderFinancialYearChange({ ...rows[0], releases: 500 }, 'CHF')
  assert.match(html, /Liberação de saldo restrito: CHF\s*500/)
  assert.match(html, /sem criar receita ou ganho/)
  assert.match(html, /Saldo financeiro final<\/dt><dd>CHF\s*1\.170/)
  assert.equal(renderFinancialYearChange({ year: 2030, income: 100 }, 'CHF'), '')
})

test('consumidor compartilhado expõe contexto e fechamento, preservando privacidade e dados', () => {
  const before = structuredClone(rows)
  const html = renderCashFlowLineChart({ rows, plan, currency: 'CHF', baseYear: 2030 })
  assert.match(html, /2032, idade estimada 42 · Ano da aposentadoria<\/option>/)
  assert.match(html, /Idade estimada 42 · Ano da aposentadoria · Total durante o ano/)
  assert.match(html, /não o saldo de hoje/)
  assert.match(html, /não o mês exato da aposentadoria/)
  assert.doesNotMatch(renderCashFlowLineChart({ rows, plan, currency: 'CHF', hidden: true }), /2030|CHF|marco|Idade/)
  assert.deepEqual(rows, before)
})

test('marco da maior liberação usa a série real e não muda ao alternar a base de preços', () => {
  const previous = cashFlowChartView.basis
  const source = rows.map((row, index) => ({ ...row, releases: [1500, 0, 1000][index] }))
  try {
    for (const basis of ['real', 'nominal']) {
      cashFlowChartView.basis = basis
      const html = renderCashFlowLineChart({ rows: source, plan, currency: 'CHF', baseYear: 2030 })
      assert.match(html, /data-chart-milestone="0"[^>]*><span>Primeiro fechamento · Maior liberação de saldo restrito/)
    }
  } finally { cashFlowChartView.basis = previous }
})
