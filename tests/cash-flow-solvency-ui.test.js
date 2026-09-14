import test from 'node:test'
import assert from 'node:assert/strict'
import { renderCashFlowLineChart, cashFlowChartView } from '../src/shared/cash-flow-line-chart.js'
import { renderCashFlowResult } from '../src/shared/cash-flow-result.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'
import { state } from '../src/app/state.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'

const row = {
  year: '2027', income: 100, costs: 300, goals: 0, freeCashFlow: -200,
  pensionCredits: 0, releases: 0, previousFinancial: 1000, financialReturn: 100,
  financialChange: -100, financialAssets: 900, previousLiquid: 300, liquidAssets: 100,
  liquidReturn: 0, liquidChange: -200, netWorth: 10900, netFinancial: 900,
  assets: 10000, liabilities: 0, restrictedFinancial: 800
}
const chart = { rows: [row], plan: { annualInflation: 0.1 }, currency: 'BRL', title: 'Fluxo anual', baseYear: 2026 }

test('fluxo e patrimônio usam gráficos próprios com os mesmos anos e estoques corretos', () => {
  const html = renderCashFlowLineChart(chart)
  assert.equal((html.match(/<svg /g) || []).length, 2)
  assert.match(html, /Escala própria/)
  assert.match(html, /Patrimônio total líquido de dívidas/)
  assert.match(html, /Patrimônio financeiro/)
  assert.match(html, /Liquidez/)
  assert.match(html, /2027 · Patrimônio total líquido de dívidas: R\$\s*10\.900,00/)
  assert.match(html, /2027 · Resultado final do ano: -R\$\s*100,00/)
  assert.doesNotMatch(html, /NaN|undefined/)
})

test('inflação converte também o patrimônio sem alterar os dados financeiros', () => {
  const before = structuredClone(chart)
  const basis = cashFlowChartView.basis
  try {
    cashFlowChartView.basis = 'nominal'
    const html = renderCashFlowLineChart(chart)
    assert.match(html, /2027 · Patrimônio total líquido de dívidas: R\$\s*11\.990,00/)
    assert.match(html, /2027 · Liquidez: R\$\s*110,00/)
    assert.deepEqual(chart, before)
  } finally { cashFlowChartView.basis = basis }
})

test('resultado distingue consumo patrimonial, falta de liquidez e patrimônio líquido negativo', () => {
  assert.match(renderCashFlowResult(row, 'BRL'), /não significa insolvência/)
  assert.match(renderCashFlowResult({ ...row, liquidAssets: -100 }, 'BRL'), /falta liquidez/)
  assert.match(renderCashFlowResult({ ...row, netWorth: -100 }, 'BRL'), /dívidas superam o patrimônio/)
  const hidden = renderCashFlowLineChart({ ...chart, hidden: true })
  assert.doesNotMatch(hidden, /<svg|10\.900|2027/)
})

function familyPlan() {
  const year = new Date().getUTCFullYear()
  return sanitizeStoredState({ valuesHidden: false, plan: {
    currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: `${year}-01`,
    retirementMonth: `${year + 1}-01`, annualRealReturn: 0, expectedMonthlyBenefit: 0,
    currentAssets: 10000, investments: [{ id: 'cash', name: 'Reserva', amount: 10000, liquidity: 'available', returnType: 'real', returnValue: 0 }],
    finappMethod: { openingConfirmed: true, pensionConfirmed: true }
  }, cashFlow: { retirementMonth: `${year + 1}-01`, items: [
    { id: 'expense', type: 'expense', categoryId: 'housing', amount: 100, frequency: 'monthly', currency: 'BRL' }
  ] } })
}

test('visão geral destaca três estados e não confunde orçamento negativo com insolvência', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, familyPlan())
    let html = renderPlanningOverview({ compact: true })
    assert.match(html, /data-plan-sustainability="sustainable"/)
    assert.match(html, /Plano familiar sustentável nas premissas informadas/)
    assert.match(html, /SUSTENTABILIDADE FAMILIAR ATÉ DEZEMBRO DE/)
    assert.match(html, /liquidez dentro de cada ano/)
    state.plan.investments[0].liquidity = 'restricted'
    html = renderPlanningOverview({ compact: true })
    assert.match(html, /data-plan-sustainability="insufficient"/)
    assert.match(html, /Patrimônio total positivo não garante recursos disponíveis/)
    state.plan.investments[0].liquidity = 'available'
    state.plan.finappMethod.openingConfirmed = false
    html = renderPlanningOverview({ compact: true })
    assert.match(html, /data-plan-sustainability="incomplete"/)
    state.plan.investments[0].amount = 0
    state.plan.currentAssets = 0
    html = renderPlanningOverview({ compact: true })
    assert.match(html, /data-plan-sustainability="insufficient"/)
    assert.match(html, /Primeiro fechamento com insuficiência/)
    assert.match(html, /Premissas a confirmar/)
    state.valuesHidden = true
    html = renderPlanningOverview({ compact: true })
    assert.doesNotMatch(html, /data-plan-sustainability|<svg|Recursos insuficientes/)
  } finally { Object.assign(state, before) }
})
