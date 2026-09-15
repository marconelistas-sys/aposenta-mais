import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { annualCashFlow, planningHorizon, cashFlowProjectionState } from '../src/domain/planning-horizon.js'
import { renderCashFlowTimeline, timelineView } from '../src/features/cash-flow/timeline.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'
import { renderViability } from '../src/features/plan/viability.js'
import { cashFlowDetailPanels } from '../src/shared/cash-flow-detail.js'
import { planningChart } from '../src/shared/planning-chart.js'

const today = new Date('2026-01-01T00:00:00Z')
const sum = entries => entries.reduce((total, row) => total + row.amount, 0)
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const item = (id, type, categoryId, amount, extra = {}) => ({ id, description: id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', startDate: '2026-01-01', endDate: '2028-12-31', ...extra })
function fixture() {
  return createExportableState({ isDemo: false, currency: 'BRL', exchangeRates: { rates: { EUR: 1, USD: 1, BRL: 6.7, CHF: 1 } },
    plan: { currentAge: 53, retirementAge: 54, targetAge: 55, horizonReferenceMonth: '2026-01', retirementMonth: '2027-04', annualRealReturn: 0.05, finappMethod: { openingConfirmed: true, pensionConfirmed: true, openingYearPeriod: 0.5, releases: [{ investmentId: 'restricted', year: 2028 }] }, investments: [{ id: 'cash', name: 'Saldo disponível', amount: 100000, liquidity: 'available' }, { id: 'restricted', name: 'Saldo restrito', amount: 10000, liquidity: 'restricted' }] },
    cashFlow: { referenceMonth: '2026-01', retirementMonth: '2027-04', items: [
      item('Salário', 'income', 'salary', 1000, { currency: 'CHF', endDate: null, endMode: 'retirement' }),
      item('Bônus', 'income', 'other-income', 1200, { frequency: 'annual', startDate: '2026-07-01' }),
      item('Benefício', 'income', 'pension', 500, { startDate: '2027-04-01' }),
      item('Moradia', 'expense', 'housing', 500, { currency: 'CHF' }),
      item('Seguro', 'expense', 'insurance', 120, { frequency: 'annual' }),
      item('Evento', 'expense', 'other-expense', 200, { frequency: 'occasional', startDate: '2027-02-01', endDate: null }),
      item('Previdência', 'expense', 'private-pension', 100, { endDate: '2027-12-31' }),
      item('Realizado', 'expense', 'housing', 9999, { recordKind: 'actual' }),
      item('Sem data', 'expense', 'other-expense', 9999, { frequency: 'occasional', startDate: null }),
      item('TXT', 'income', 'salary', 9999, { source: 'txt' })
    ], annualGoals: [{ id: 'trip', name: 'Meta viagem', amount: 100.01, currency: 'CHF', startYear: 2026, endYear: 2028, everyYears: 2, realGrowth: 0.02 }],
    commitments: [{ id: 'debt', name: 'Dívida', kind: 'debt', amount: 1200, currency: 'BRL', date: '2026-01-01', installments: 12, annualRate: 0.1 }],
    consortia: [{ id: 'contract', name: 'Consórcio', currency: 'BRL', referenceMonth: '2026-01', stage: 'pending', useType: 'asset', credit: 10000, principal: 8000, months: 80, administration: 0, reserve: 0, insurance: 0, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0, awardMonth: null, earlyMonth: null, lateMonth: null, useMonth: null }] }
  })
}

test('composição concilia cada receita, custo, meta, previdência e liberação sem mudar projeção', () => {
  for (const pensionMode of ['external', 'cash-funded']) for (const costMultiplier of [0.7, 1, 1.5]) {
    const value = fixture(), before = structuredClone(value)
    const settings = { ...value.plan.finappMethod, pensionMode }
    const base = finappViability(value, settings, today, { costMultiplier })
    const result = finappViability(value, settings, today, { costMultiplier, includeBreakdown: true })
    result.rows.forEach((row, index) => {
      const { breakdown, wealthBreakdown, ...plain } = row
      assert.deepEqual(plain, base.rows[index])
      close(sum(wealthBreakdown.financial), row.financialAssets)
      close(sum(wealthBreakdown.assets), row.assets)
      close(sum(wealthBreakdown.liabilities), row.liabilities)
      close(sum(breakdown.income), row.income)
      close(sum(breakdown.costs), row.costs)
      close(sum(breakdown.goals), row.goals)
      close(sum(breakdown.pension), row.pensionCredits)
      close(sum(breakdown.releases), row.releases)
      close(sum(breakdown.income) - sum(breakdown.costs) - sum(breakdown.goals), row.freeCashFlow)
      assert.ok(!Object.values(breakdown).flat().some(entry => ['Realizado', 'Sem data', 'TXT'].includes(entry.name)))
    })
    const detail = result.rows[0].breakdown
    assert.equal(detail.costs.filter(entry => entry.source === 'Consórcio').length, 1)
    assert.equal(detail.costs.filter(entry => entry.source === 'Compromisso').length, 1)
    assert.equal(detail.costs.some(entry => entry.name === 'Previdência'), pensionMode === 'cash-funded')
    const salary = detail.income.find(entry => entry.name === 'Salário')
    assert.equal(salary.originalAmount, 12000)
    close(salary.amount, 80400)
    assert.equal(salary.months, 12)
    assert.deepEqual(value, before)
  }
})

test('detalhes respeitam meses de início, aposentadoria e fim, sem repetir valor anual', () => {
  const result = finappViability(fixture(), undefined, today, { includeBreakdown: true })
  const first = result.rows[0].breakdown, second = result.rows[1].breakdown, last = result.rows[2].breakdown
  assert.equal(first.income.find(row => row.name === 'Bônus').amount, 600)
  assert.equal(second.income.find(row => row.name === 'Salário').months, 3)
  assert.equal(second.income.find(row => row.name === 'Benefício').amount, 4500)
  assert.equal(second.costs.find(row => row.name === 'Evento').amount, 200)
  assert.equal(second.costs.find(row => row.name === 'Evento').months, 1)
  assert.ok(!last.income.some(row => row.name === 'Salário'))
  assert.equal(second.goals.length, 0)
  assert.equal(last.pension.length, 0)
  assert.equal(last.releases[0].name, 'Saldo restrito')
})

test('recorte mensal agrega composição parcial sem mudar FCX e inclui consórcios uma vez', () => {
  for (const pensionMode of ['external', 'cash-funded']) {
    const value = fixture(); value.plan.finappMethod.pensionMode = pensionMode
    const plain = cashFlowTimeline(value, '2026-07', 12)
    const detailed = cashFlowTimeline(value, '2026-07', 12, { includeBreakdown: true })
    assert.deepEqual(detailed.map(({ breakdown, ...row }) => row), plain)
    const result = annualCashFlow(detailed)
    assert.deepEqual(result.map(({ breakdown, ...row }) => row), annualCashFlow(plain))
    result.forEach(row => {
      close(sum(row.breakdown.income), row.income)
      close(sum(row.breakdown.costs) + sum(row.breakdown.goals), row.expenses)
      close(sum(row.breakdown.pension), row.pension)
      assert.equal(row.breakdown.costs.filter(entry => entry.source === 'Consórcio').length, 1)
    })
    assert.equal(result[0].months, 6)
    assert.equal(result[0].breakdown.income.find(row => row.name === 'Bônus').amount, 600)
  }
})

test('simulação até 100 usa cópia, mantém contratos, saldos e idade-alvo salva', () => {
  const value = fixture(), before = structuredClone(value)
  const projection = cashFlowProjectionState(value, '100')
  const horizon = planningHorizon(projection.plan, '2026-01', today)
  assert.equal(horizon.endMonth, '2073-12')
  const result = finappViability(projection, undefined, today, { includeBreakdown: true })
  assert.equal(result.rows.length, 48)
  assert.equal(result.rows.at(-1).year, '2073')
  assert.equal(result.rows.at(-1).income, 0)
  assert.equal(result.rows.at(-1).costs, 0)
  assert.equal(result.rows.at(-1).breakdown.income.length, 0)
  assert.equal(result.rows.at(-1).breakdown.costs.length, 0)
  assert.equal(result.openingFinancial, 110000)
  assert.deepEqual(value, before)
  assert.equal(cashFlowProjectionState(value, 'target'), value)
  assert.equal(createExportableState(value).plan.targetAge, 55)
})

test('horizonte até 100 atende idade mínima e rejeita período passado ou incompatível', () => {
  const value = fixture()
  value.plan.currentAge = 18
  assert.equal(planningHorizon(cashFlowProjectionState(value, '100').plan, '2026-01', today).months, 996)
  value.plan.currentAge = 100
  assert.throws(() => planningHorizon(cashFlowProjectionState(value, '100').plan, '2026-01', today))
  value.plan.currentAge = 53
  assert.throws(() => planningHorizon(cashFlowProjectionState(value, '100').plan, '2074-01', today))
})

test('painel mostra origens, moedas, detalhes e ano/idade, com proteção contra HTML e privacidade', () => {
  const value = fixture()
  value.cashFlow.items[0].description = '<img src=x onerror=alert(1)>'
  const result = finappViability(value, undefined, today, { includeBreakdown: true })
  const details = cashFlowDetailPanels(result.rows, value.plan, value.currency)
  assert.match(details[0].html, /idade estimada 53/)
  assert.match(details[0].html, /&lt;img/)
  assert.doesNotMatch(details[0].html, /<img/)
  assert.match(details[0].html, /CHF/)
  assert.match(details[0].html, /Total na moeda original/)
  assert.match(details[0].html, /Antes da aposentadoria em 2027-04/)
  const input = { title: 'Fluxo', rows: result.rows, currency: 'BRL', details, series: [{ key: 'income', label: 'Receitas' }] }
  const html = planningChart(input)
  assert.match(html, /data-chart-drilldown/)
  assert.match(html, /Enter ou Espaço fixa o ano/)
  assert.equal((html.match(/<template data-chart-detail-template=/g) || []).length, 3)
  assert.match(html, /data-chart-selected-index="0"/)
  assert.doesNotMatch(planningChart({ ...input, hidden: true }), /template|Saldo restrito|CHF|2026|img|svg/)
  assert.deepEqual(cashFlowDetailPanels(result.rows, value.plan, 'BRL', true), [])
  assert.doesNotMatch(planningChart({ ...input, details: [] }), /data-chart-drilldown/)
})

test('telas expõem composição, 100 anos e estados vazios, sem alterar a conta nem expor nomes ocultos', () => {
  const before = structuredClone(state), view = { ...timelineView }
  try {
    Object.assign(state, fixture())
    const thisYear = new Date().getUTCFullYear()
    state.plan.horizonReferenceMonth = state.cashFlow.referenceMonth = `${thisYear}-01`
    state.plan.retirementMonth = state.cashFlow.retirementMonth = `${thisYear + 1}-04`
    const original = structuredClone(state)
    timelineView.period = '100'
    const html = renderCashFlowTimeline()
    assert.match(html, /Até 100 anos, simulação/)
    assert.match(html, new RegExp(`Composição de ${thisYear + 47}, idade estimada 100`))
    assert.match(html, /Idade-alvo salva/)
    assert.match(html, /Nenhuma receita prevista/)
    assert.match(html, /não são prorrogados/)
    assert.match(html, /data-chart-detail-panel/)
    assert.deepEqual(state, original)
    timelineView.period = '12'
    assert.match(renderCashFlowTimeline(), /data-chart-detail-panel/)
    for (const render of [renderPlanningOverview, renderViability, () => renderViability({ postRetirementOnly: true }), renderCashFlowTimeline]) {
      assert.match(render(), /data-chart-drilldown/)
      state.valuesHidden = true
      assert.doesNotMatch(render(), /data-chart-detail-template|data-chart-detail-panel|Salário|Moradia|Saldo restrito|<svg/)
      state.valuesHidden = false
    }
  } finally { Object.assign(state, before); Object.assign(timelineView, view) }
})
