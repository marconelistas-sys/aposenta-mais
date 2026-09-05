import test from 'node:test'
import assert from 'node:assert/strict'
import { planningHorizon, annualCashFlow, annualClosing } from '../src/domain/planning-horizon.js'
import { planningChart } from '../src/shared/planning-chart.js'
import { createExportableState } from '../src/app/state-storage.js'
import { parseFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { simulateRisk } from '../src/domain/risk-simulation.js'
import { state } from '../src/app/state.js'
import { renderCashFlowTimeline, timelineView } from '../src/features/cash-flow/timeline.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'

const plan = { currentAge: 53, targetAge: 85, retirementAge: 65, horizonReferenceMonth: '2026-01' }
function empty() { return createExportableState({ isDemo: false, plan: { ...plan, currentAssets: 0, monthlyContribution: 0, expectedMonthlyBenefit: 0 }, cashFlow: { items: [], currentEmergencyReserve: 0, emergencyReserveTarget: 0 } }) }
test('horizonte usa idade-alvo independente da aposentadoria e fecha dezembro do ano-alvo', () => {
  const result = planningHorizon(plan, '2026-09')
  assert.equal(result.endMonth, '2058-12')
  assert.equal(result.months, 388)
  assert.equal(planningHorizon({ ...plan, retirementAge: 70 }, '2026-09').endMonth, '2058-12')
  assert.equal(planningHorizon(plan, '2027-01', new Date('2030-01-01')).endMonth, '2058-12')
})
test('horizonte rejeita idade ausente, passada, fracionária, mês e intervalos impossíveis', () => {
  for (const targetAge of [null, 53, 52, 85.5, 111]) assert.throws(() => planningHorizon({ ...plan, targetAge }, '2026-09'))
  assert.throws(() => planningHorizon(plan, '2059-01'))
  assert.throws(() => planningHorizon(plan, '2026-13'))
})
test('totais anuais preservam meses parciais, contribuição separada e saldo negativo', () => {
  const points = [{ month: '2026-11', income: 100, expenses: 200, pension: 20, balance: -100 }, { month: '2026-12', income: 50, expenses: 100, pension: 10, balance: -50 }, { month: '2027-01', income: 300, expenses: 100, pension: 0, balance: 200 }]
  const result = annualCashFlow(points)
  assert.equal(result[0].months, 2)
  assert.equal(result[0].income, 150)
  assert.equal(result[0].spending, 270)
  assert.equal(result[0].pension, 30)
  assert.equal(result[0].balance, -150)
  assert.equal(result[1].months, 1)
})
test('estoques e percentis usam fechamento, não soma dos meses', () => {
  const result = annualClosing([{ month: '2026-01', p10: 10, netWorth: 100 }, { month: '2026-12', p10: 5, netWorth: 70 }, { month: '2027-03', p10: 6, netWorth: 80 }])
  assert.equal(result[0].p10, 5)
  assert.equal(result[0].netWorth, 70)
  assert.equal(result[1].month, '2027-03')
})
test('risco até idade-alvo ignora meses manuais sem mutar configuração e respeita limite explícito', () => {
  const settings = { ...defaultRiskSettings, months: 12 }
  const input = prepareRiskInput(empty(), settings, new Date('2026-09-01'))
  assert.equal(input.timelines[0].length, 388)
  assert.equal(input.timelines[0].at(-1).month, '2058-12')
  assert.equal(settings.months, 12)
  const manual = prepareRiskInput(empty(), { ...settings, horizonMode: 'months' }, new Date('2026-09-01'))
  assert.equal(manual.timelines[0].length, 12)
  const tooLong = empty(); tooLong.plan.currentAge = 18; tooLong.plan.targetAge = 110
  assert.throws(() => prepareRiskInput(tooLong, settings, new Date('2026-09-01')), /720 meses/)
})
test('Monte Carlo entrega duas faixas ordenadas com a mesma semente', () => {
  const input = prepareRiskInput(empty(), { ...defaultRiskSettings, horizonMode: 'months', months: 2, simulations: 50 }, new Date('2026-09-01'))
  input.buckets = [{ amount: 100, annualRealReturn: 0.05, liquid: true }]
  input.annualVolatility = 0.2
  const result = simulateRisk(input)
  for (const row of result.series) assert.ok(row.p10 <= row.p25 && row.p25 <= row.p50 && row.p50 <= row.p75 && row.p75 <= row.p90)
  assert.deepEqual(simulateRisk(input), result)
})
test('arquivo de horizonte não pode substituir registros e preserva dados e aposentadoria', () => {
  const raw = { format: 'aposenta-finapp-import', version: 2, scope: 'horizon', investmentCurrency: 'BRL', items: [], investments: [], pending: [], planParameters: { currentAge: 53, targetAge: 90, horizonReferenceMonth: '2026-01' } }
  const parsed = parseFinappImport(JSON.stringify(raw))
  const before = empty(), original = structuredClone(before)
  assert.throws(() => mergeFinappImport(before, parsed, 'replace'), /só atualiza/)
  const next = mergeFinappImport(before, parsed, 'horizon').state
  assert.equal(next.plan.targetAge, 90)
  assert.equal(next.plan.retirementAge, before.plan.retirementAge)
  assert.deepEqual(next.cashFlow, before.cashFlow)
  assert.deepEqual(next.plan.investments, before.plan.investments)
  assert.deepEqual(before, original)
  assert.equal(createExportableState(next).plan.targetAge, 90)
})
test('gráficos têm eixos, legenda, zero, barras, valores negativos e ocultação sem SVG', () => {
  const input = { title: '<Fluxo>', rows: [{ year: '2026', income: 100, balance: -100 }], currency: 'BRL', series: [{ key: 'income', label: 'Entradas', type: 'bar', color: '#0ea5e9' }, { key: 'balance', label: 'Saldo', color: '#047857' }] }
  const html = planningChart(input)
  assert.ok(html.includes('<rect'))
  assert.ok(html.includes('&lt;Fluxo&gt;'))
  assert.ok(html.includes('tabindex="0"'))
  assert.ok(!html.includes('NaN'))
  const hidden = planningChart({ ...input, hidden: true })
  assert.ok(!hidden.includes('<svg'))
  assert.ok(!hidden.includes('100'))
})
test('fluxo até idade-alvo mostra dezembro final e tabela anual, ocultação cobre gráficos', () => {
  const old = structuredClone(state), previous = timelineView.period
  try {
    Object.assign(state, empty()); state.cashFlow.referenceMonth = '2026-09'; timelineView.period = 'target'
    assert.match(renderCashFlowTimeline(), /2058-12/)
    assert.match(renderCashFlowTimeline(), /Ver totais anuais/)
    assert.match(renderPlanningOverview(), /Evolução patrimonial base/)
    assert.match(renderPlanningOverview(), /Fluxos anuais do orçamento/)
    state.valuesHidden = true
    assert.ok(!renderCashFlowTimeline().includes('<svg'))
    assert.ok(!renderPlanningOverview().includes('<svg'))
  } finally { Object.assign(state, old); timelineView.period = previous }
})
