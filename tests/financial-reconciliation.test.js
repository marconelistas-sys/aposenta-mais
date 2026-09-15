import test from 'node:test'
import assert from 'node:assert/strict'
import { annualFinappRecurrence, finappViability } from '../src/domain/finapp-viability.js'
import { annualRiskPath } from '../src/domain/finapp-risk.js'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { renderViability } from '../src/features/plan/viability.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'
import { renderCashFlowTimeline, timelineView } from '../src/features/cash-flow/timeline.js'
import { renderFinancialReconciliation } from '../src/shared/financial-reconciliation.js'

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const row = (extra = {}) => ({ year: '2026', income: 0, costs: 8000, goals: 0, pensionCredits: 0, releases: 0, pensionRestricted: 0, assets: 0, liabilities: 0, ...extra })
const run = (years, extra = {}) => annualFinappRecurrence({ openingFinancial: 100000, openingLiquid: 100000, annualReturn: 0.05, openingYearPeriod: 1, years, ...extra })

test('retorno compensa parte do déficit, sem virar receita nem duplicar ganho', () => {
  const actual = run([row()])[0]
  assert.equal(actual.income, 0)
  assert.equal(actual.freeCashFlow, -8000)
  close(actual.financialReturn, 5000)
  assert.equal(actual.financialChange, -3000)
  assert.equal(actual.financialAssets, 97000)
  close(actual.liquidReturn, 5000)
  assert.equal(actual.liquidChange, -3000)
})

test('FCX negativo pode coexistir com crescimento dos ativos financeiros', () => {
  const actual = run([row({ costs: 3000 })])[0]
  assert.equal(actual.freeCashFlow, -3000)
  assert.equal(actual.financialChange, 2000)
  assert.equal(actual.financialAssets, 102000)
})

test('rendimentos respeitam fração inicial, perdas, taxa zero e déficit acumulado', () => {
  for (const annualReturn of [-0.2, 0, 0.05]) {
    const rows = run([row(), row({ year: '2027', costs: 200000 }), row({ year: '2028' })], { annualReturn, openingYearPeriod: 0.5 })
    rows.forEach((actual, index) => {
      close(actual.financialReturn, actual.previousFinancial * (index === 0 ? (1 + annualReturn) ** 0.5 - 1 : annualReturn))
      close(actual.financialAssets, actual.previousFinancial + actual.financialReturn + actual.freeCashFlow + actual.pensionCredits)
      close(actual.financialChange, actual.financialReturn + actual.freeCashFlow + actual.pensionCredits)
      close(actual.liquidChange, actual.liquidAssets - actual.previousLiquid)
    })
    assert.ok(rows.at(-1).previousFinancial < 0)
  }
})

test('retorno restrito e liberação não são receita nem duplicam patrimônio', () => {
  const restricted = run([row({ costs: 2000 })], { openingLiquid: 10000 })[0]
  close(restricted.financialReturn, 5000)
  close(restricted.liquidReturn, 500)
  assert.equal(restricted.financialChange, 3000)
  assert.equal(restricted.liquidAssets, 8500)
  const released = run([row({ costs: 2000, releases: 94500 })], { openingLiquid: 10000 })[0]
  assert.equal(released.financialAssets, restricted.financialAssets)
  assert.equal(released.freeCashFlow, restricted.freeCashFlow)
  assert.equal(released.liquidAssets, 103000)
})

test('previdência e metas conciliam uma vez, sem rendimento imediato de fluxos de fim de ano', () => {
  const actual = run([row({ income: 1000, costs: 2000, goals: 500, pensionCredits: 300 })])[0]
  close(actual.financialReturn, 5000)
  assert.equal(actual.financialChange, 3800)
  assert.equal(actual.financialAssets, 103800)
})

test('Monte Carlo com taxas iguais preserva resultado sem reaplicar rendimento exposto', () => {
  const rows = run([row(), row({ year: '2027' })], { openingYearPeriod: 0.5 })
  const base = { rows, openingFinancial: 100000, settings: { openingYearPeriod: 0.5 } }
  const path = annualRiskPath(base, [0.05, 0.05])
  path.forEach((actual, index) => close(actual.financialAssets, rows[index].financialAssets))
})

function fixture(extra = {}) {
  return createExportableState({ isDemo: false, plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0.05, investments: [{ id: 'cash', name: 'Caixa', amount: 100000, liquidity: 'available' }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2027-01', items: [{ id: 'yield', type: 'income', categoryId: 'investment-income', amount: 100, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', endDate: '2028-12-31', recordKind: 'planned', ...extra }] } })
}

test('rendimento previsto na carteira exige revisão, sem apagar receita por inferência', () => {
  const value = fixture(), before = structuredClone(value)
  const result = finappViability(value, undefined, new Date('2026-01-01'))
  assert.equal(result.rows[0].income, 1200)
  close(result.rows[0].financialReturn, 5000)
  assert.ok(result.issues.some(issue => issue.includes('duplica o rendimento')))
  assert.equal(result.viable, false)
  assert.deepEqual(value, before)
})

test('realizados, TXT, eventuais sem data e receitas fora do horizonte não geram suspeita de duplicação', () => {
  for (const extra of [{ recordKind: 'actual' }, { source: 'txt' }, { frequency: 'occasional', startDate: null }, { endDate: '2025-12-31', startDate: '2025-01-01' }, { startDate: '2030-01-01', endDate: '2031-12-31' }, { categoryId: 'rent-income' }]) {
    const result = finappViability(fixture(extra), undefined, new Date('2026-01-01'))
    assert.ok(!result.issues.some(issue => issue.includes('duplica o rendimento')))
  }
})

test('conciliação mostra retorno, variação e identidade sem vazar valores ocultos', () => {
  const rows = run([row()]), before = structuredClone(rows)
  const html = renderFinancialReconciliation({ rows, currency: 'BRL' })
  assert.match(html, /5\.000,00/)
  assert.match(html, /97\.000,00/)
  assert.match(html, /Valorização não realizada/)
  assert.match(html, /taxas individuais da Carteira e os ajustes por ano/)
  assert.match(html, /capitaliza o déficit/)
  assert.doesNotMatch(renderFinancialReconciliation({ rows, currency: 'BRL', hidden: true }), /2026|5\.000|97\.000|<table/)
  assert.deepEqual(rows, before)
  assert.equal(renderFinancialReconciliation({ rows: [], currency: 'BRL' }), '')
  assert.doesNotMatch(renderFinancialReconciliation({ rows: [{ ...rows[0], year: '<script>alert(1)</script>' }], currency: 'BRL' }), /<script/)
})

test('dashboard, viabilidade, pós-aposentadoria e fluxo usam a mesma conciliação e privacidade', () => {
  const previous = structuredClone(state), period = timelineView.period
  try {
    Object.assign(state, fixture())
    const year = new Date().getUTCFullYear()
    state.plan.horizonReferenceMonth = state.cashFlow.referenceMonth = `${year}-01`
    state.plan.retirementMonth = state.cashFlow.retirementMonth = `${year + 1}-01`
    timelineView.period = 'target'
    for (const render of [renderPlanningOverview, renderViability, () => renderViability({ postRetirementOnly: true }), renderCashFlowTimeline]) {
      const html = render()
      assert.match(html, /Do caixa ao patrimônio financeiro/)
      assert.match(html, /Variação do patrimônio financeiro no ano/)
      assert.match(html, /Resultado do retorno real/)
      state.valuesHidden = true
      const hidden = render()
      assert.doesNotMatch(hidden, /<svg|5\.000,00|Conciliação de rendimentos e patrimônio/)
      state.valuesHidden = false
    }
    timelineView.period = '12'
    assert.doesNotMatch(renderCashFlowTimeline(), /Do caixa ao patrimônio financeiro|Variação dos ativos financeiros, após rendimento/)
  } finally { Object.assign(state, previous); timelineView.period = period }
})
