import test from 'node:test'
import assert from 'node:assert/strict'
import { state } from '../src/app/state.js'
import { createExportableState } from '../src/app/state-storage.js'
import { renderCashFlowTimeline, timelineView } from '../src/features/cash-flow/timeline.js'
import { cashFlowChartView } from '../src/shared/cash-flow-line-chart.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { privateCurrency } from '../src/shared/formatters.js'

function projectionFixture() {
  const year = new Date().getUTCFullYear()
  return createExportableState({ isDemo: false, currency: 'BRL', plan: {
    currentAge: 50, retirementAge: 51, targetAge: 53, horizonReferenceMonth: `${year}-01`, retirementMonth: `${year + 1}-06`, annualRealReturn: 0.04, annualInflation: 0.03,
    investments: [{ id: 'available', name: 'Reserva disponível', amount: 100000, liquidity: 'available' }, { id: 'restricted', name: 'Previdência restrita', amount: 20000, liquidity: 'restricted' }],
    finappMethod: { openingConfirmed: true, pensionConfirmed: true, chfBrlRate: 6.5 }
  }, cashFlow: { referenceMonth: `${year}-08`, retirementMonth: `${year + 1}-06`, items: [
    { id: 'salary', type: 'income', categoryId: 'salary', description: 'Salário previsto', amount: 2000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', startDate: `${year}-01-01`, endMode: 'retirement' },
    { id: 'housing', type: 'expense', categoryId: 'housing', description: 'Moradia prevista', amount: 1000, currency: 'BRL', frequency: 'monthly', recordKind: 'planned' },
    { id: 'recorded', type: 'expense', categoryId: 'housing', description: 'Não incluir realizado na projeção', amount: 123456789, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: `${year}-08-05` }
  ], nonFinancialAssets: [{ id: 'house', name: 'Casa', category: 'real-estate', amount: 200000, currency: 'BRL', startYear: year }] } })
}

function withProjection(run) {
  const previous = structuredClone(state), view = { ...timelineView }, chart = { ...cashFlowChartView }
  try {
    Object.assign(state, projectionFixture())
    Object.assign(timelineView, { period: 'target', selectedYear: null })
    Object.assign(cashFlowChartView, { basis: 'real', flow: 'budget', selectedYear: null })
    run()
  } finally {
    Object.assign(state, previous)
    Object.assign(timelineView, view)
    Object.assign(cashFlowChartView, chart)
  }
}

test('projeção prioriza financeiro e liquidez e mantém os fluxos anuais em seção expansível', () => withProjection(() => {
  const before = structuredClone(state)
  const html = renderCashFlowTimeline({ part: 'annual' })
  const primary = html.slice(html.indexOf('aria-label="Evolução do patrimônio financeiro'), html.indexOf('<summary>Comparar patrimônio'))
  assert.match(primary, /Patrimônio financeiro e liquidez ao fim de cada ano/)
  assert.match(primary, /Exibir Patrimônio financeiro/)
  assert.match(primary, /Exibir Liquidez disponível/)
  assert.doesNotMatch(primary, /Exibir Bens|Exibir Despesas|Exibir Receitas/)
  assert.match(html, /<details class="disclosure" data-projection-flow-details><summary>Ver receitas, despesas e saldo previstos por ano/)
  assert.ok(html.indexOf('Patrimônio financeiro e liquidez ao fim') < html.indexOf('Ver receitas, despesas e saldo previstos por ano'))
  assert.match(html, /Do caixa ao patrimônio financeiro/)
  assert.match(html, /Ano-base/)
  assert.match(html, /Idade-alvo/)
  assert.match(html, /Aposentadoria/)
  assert.match(html, /1 CHF = 6,5 BRL/)
  assert.match(html, /pode diferir do câmbio utilizado no orçamento mensal/)
  assert.doesNotMatch(html, /data-planning-horizon|data-budget-retirement-form|Não incluir realizado na projeção/)
  assert.deepEqual(state, before)
}))

test('base nominal usa os mesmos saldos anuais da viabilidade, sem mudar as premissas', () => withProjection(() => {
  const before = structuredClone(state)
  cashFlowChartView.basis = 'nominal'
  const annual = finappViability(state)
  const rows = annualRowsInPriceBasis(annual.rows, { basis: 'nominal', annualInflation: state.plan.annualInflation, baseYear: new Date().getUTCFullYear() })
  const html = renderCashFlowTimeline({ part: 'annual' })
  assert.ok(html.includes(privateCurrency(rows.at(-1).financialAssets, false, true, state.currency)))
  assert.ok(html.includes(privateCurrency(rows.at(-1).liquidAssets, false, true, state.currency)))
  assert.deepEqual(state, before)
}))

test('fluxos mensais preservam composição e diferenciam recorte e conferência do mês', () => withProjection(() => {
  const html = renderCashFlowTimeline({ part: 'monthly' })
  assert.match(html, /Fluxos projetados por mês/)
  assert.match(html, /Início do recorte mensal/)
  assert.match(html, /data-monthly-budget-detail=/)
  assert.match(html, /data-monthly-budget-dialog/)
  assert.match(html, /Receitas previstas/)
  assert.match(html, /Despesas e metas previstas/)
  assert.match(html, /não saldo bancário/)
  assert.match(html, /não equivale aos anos completos/)
  assert.match(html, /Ver totais anuais/)
  assert.doesNotMatch(html, /Não incluir realizado na projeção|Receitas realizadas|Despesas realizadas|data-planning-horizon|data-budget-retirement-form/)
}))

test('premissas concentra controles e filtro de imóveis, privacidade remove gráficos e composição', () => withProjection(() => {
  const premises = renderCashFlowTimeline({ part: 'premises' })
  assert.equal((premises.match(/data-planning-horizon/g) || []).length, 1)
  assert.equal((premises.match(/data-budget-retirement-form/g) || []).length, 1)
  assert.match(premises, /data-property-solvency/)
  state.valuesHidden = true
  const annual = renderCashFlowTimeline({ part: 'annual' })
  assert.doesNotMatch(annual, /<svg|data-chart-detail-template|data-chart-detail-panel|Salário previsto|Moradia prevista|Reserva disponível|Previdência restrita/)
  assert.doesNotMatch(renderCashFlowTimeline({ part: 'premises' }), /data-property-solvency/)
}))
