import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { prepareScenarioComparison } from '../src/domain/scenario-comparison.js'
import { scenarioComparisonView } from '../src/features/simulations/comparison-view.js'
import { simulationCashFlow, simulationInputFromData, scenarioEditor } from '../src/features/simulations/scenario-editor.js'
import { state } from '../src/app/state.js'

const today = new Date('2026-01-01T12:00:00Z')
function fixture(currency = 'BRL') {
  return createExportableState({ isDemo: false, currency, plan: {
    currentAge: 60, retirementAge: 62, targetAge: 65, horizonReferenceMonth: '2026-01', retirementMonth: '2028-01', currentAssets: 100000, monthlyContribution: 0, annualRealReturn: 0, annualInflation: 0.02, defaultReturnSource: 'manual', targetMonthlyIncome: 2000,
    investments: [{ id: 'cash', name: 'Caixa', currency, amount: 100000, assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0 }],
    finappMethod: { openingConfirmed: true, pensionConfirmed: true, pensionMode: 'external' }
  }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2028-01', items: [{ id: 'cost', description: 'Custo de vida', type: 'expense', categoryId: 'housing', currency, amount: 2000, frequency: 'monthly', startDate: '2026-01-01', recordKind: 'planned' }] } })
}
const hypothesis = source => ({ plan: structuredClone(source.plan), cashFlow: structuredClone(source.cashFlow), currency: source.currency })
const compare = (source, candidate = hypothesis(source), options = {}) => prepareScenarioComparison(source, candidate, { today, ...options })
function formData(plan, changes = {}) {
  return new Map(Object.entries({ ...plan, ...changes }).map(([key, value]) => [key, String(key.startsWith('annual') ? value * 100 : value)]))
}

test('comparação usa o orçamento após aposentar e preserva insuficiência negativa', () => {
  const source = fixture(), before = structuredClone(source)
  const result = compare(source)
  assert.equal(result.available, true)
  assert.deepEqual(result.rows.map(row => row.hypothesis.financialAssets), [76000, 52000, 28000, 4000, -20000, -44000])
  assert.equal(result.endYear, 2031)
  assert.equal(result.hypothesis.firstLiquidityYear, '2030')
  assert.equal(result.hypothesis.firstFinancialYear, '2030')
  assert.equal(result.hypothesis.status, 'shortfall')
  assert.equal(result.hypothesis.minimumLiquidity.amount, -44000)
  assert.equal(result.sameProjection, true)
  assert.deepEqual(source, before)
  const html = scenarioComparisonView(result)
  assert.match(html, /Falta de recursos em 2030/)
  assert.match(html, /planning-chart-zero/)
  assert.match(html, /-R\$\s*44\.000/)
  assert.match(html, /Consultar valores de todos os anos/)
})

test('hipótese ainda não salva compara saldo contra o mesmo ano sem alterar o plano', () => {
  const source = fixture(), candidate = hypothesis(source), before = structuredClone(source)
  candidate.plan.investments[0].amount = candidate.plan.currentAssets = 200000
  const result = compare(source, candidate)
  assert.equal(result.financialDifference, 100000)
  assert.equal(result.hypothesis.ending.financialAssets, 56000)
  assert.equal(result.hypothesis.status, 'covered')
  assert.equal(result.reference.status, 'shortfall')
  assert.deepEqual(source, before)
  assert.equal(source.scenarios.length, 0)
})

test('aporte e benefício estimado não inventam receita nem poupança no orçamento', () => {
  const source = fixture(), candidate = hypothesis(source)
  candidate.plan.monthlyContribution = 1000
  candidate.plan.expectedMonthlyBenefit = 5000
  const result = compare(source, candidate)
  assert.equal(result.sameProjection, true)
  assert.equal(result.contributionDifference, 1000)
  assert.equal(result.financialDifference, 0)
  assert.equal(result.hypothesis.monthlyBudgetBalance, -2000)
  const html = scenarioComparisonView(result)
  assert.match(html, /data-simulation-contribution-gap/)
  assert.match(html, /supera a sobra média/)
  assert.match(html, /não criam lançamentos no orçamento/)
})

test('horizontes diferentes comparam somente os anos comuns sem prolongar contratos', () => {
  const source = fixture(), candidate = hypothesis(source)
  candidate.plan.targetAge = 63
  const result = compare(source, candidate)
  assert.deepEqual(result.rows.map(row => row.year), [2026, 2027, 2028, 2029])
  assert.equal(result.reference.report.horizon.endYear, 2031)
  assert.equal(result.hypothesis.report.horizon.endYear, 2029)
  assert.equal(result.reference.ending.financialAssets, result.hypothesis.ending.financialAssets)
  assert.equal(result.financialDifference, 0)
  assert.equal(result.hypothesis.firstLiquidityYear, null)
  assert.match(scenarioComparisonView(result), /2026 a 2029: intervalo comum/)
})

test('patrimônio restrito não paga despesas e liberação não cria ganho', () => {
  const source = fixture()
  source.plan.investments[0].liquidity = 'restricted'
  const candidate = hypothesis(source)
  candidate.plan.finappMethod.releases = [{ investmentId: 'cash', year: 2028 }]
  const result = compare(source, candidate)
  assert.equal(result.reference.firstLiquidityYear, '2026')
  assert.equal(result.reference.rows[0].financialAssets, 76000)
  assert.equal(result.reference.rows[0].liquidAssets, -24000)
  assert.equal(result.rows[2].reference.financialAssets, result.rows[2].hypothesis.financialAssets)
  assert.equal(result.rows[2].hypothesis.liquidAssets, 28000)
})

test('moeda original preserva premissas e orçamento próprio antes de converter resultados', () => {
  const source = fixture('BRL'), foreign = fixture('CHF')
  source.exchangeRates.rates.BRL = 10
  source.exchangeRates.rates.CHF = 2
  foreign.plan.annualInflation = 0.1
  const candidate = hypothesis(foreign), before = structuredClone(candidate)
  const result = compare(source, candidate)
  assert.equal(result.hypothesis.plan.annualInflation, 0.1)
  assert.equal(result.hypothesis.currency, 'CHF')
  assert.equal(result.rows[0].hypothesis.financialAssets, 380000)
  assert.equal(result.rows[0].reference.financialAssets, 76000)
  assert.equal(result.hypothesis.firstLiquidityYear, '2030')
  assert.deepEqual(candidate, before)
})

test('cenário salvo pode ser referência e mantém seu orçamento, sem confundir o plano atual', () => {
  const source = fixture(), saved = hypothesis(source)
  saved.cashFlow.items[0].amount = 1000
  source.scenarios = [{ ...saved, id: 'saved', name: '<img src=x>' }]
  const result = compare(source, hypothesis(source), { referenceId: 'saved' })
  assert.equal(result.reference.ending.financialAssets, 28000)
  assert.equal(result.hypothesis.ending.financialAssets, -44000)
  assert.equal(result.referenceId, 'saved')
  const html = scenarioComparisonView(result, { references: source.scenarios })
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
})

test('pendências e horizonte inválido produzem diagnóstico incompleto ou erro explícito', () => {
  const source = fixture(), candidate = hypothesis(source)
  candidate.plan.investments[0].amount = candidate.plan.currentAssets = 500000
  candidate.plan.finappMethod.openingConfirmed = false
  const result = compare(source, candidate)
  assert.equal(result.hypothesis.status, 'incomplete')
  assert.match(scenarioComparisonView(result), /Avaliação incompleta, revise as premissas/)
  candidate.plan.targetAge = candidate.plan.currentAge
  const invalid = compare(source, candidate)
  assert.equal(invalid.available, false)
  assert.match(scenarioComparisonView(invalid), /Não foi possível concluir a comparação/)
})

test('prévia preserva data confirmada e uma mudança explícita sincroniza a aposentadoria', () => {
  const previous = structuredClone(state), editing = scenarioEditor.scenario
  try {
    Object.assign(state, fixture())
    scenarioEditor.scenario = null
    state.cashFlow.retirementMonth = '2028-07'
    const plan = structuredClone(state.plan)
    assert.equal(simulationCashFlow(plan).retirementMonth, '2028-07')
    plan.retirementMonth = '2029-01'; plan.retirementAge = 63
    assert.equal(simulationCashFlow(plan).retirementMonth, '2029-01')
    assert.equal(state.cashFlow.retirementMonth, '2028-07')
  } finally { Object.assign(state, previous); scenarioEditor.scenario = editing }
})

test('editar carteira mista atualiza saldos e aportes nativos e mantém a prévia ao aplicar', () => {
  const previous = structuredClone(state), editing = scenarioEditor.scenario
  try {
    Object.assign(state, fixture())
    scenarioEditor.scenario = null
    state.exchangeRates.rates.BRL = 10
    state.exchangeRates.rates.CHF = 2
    state.plan.monthlyContribution = 200
    state.plan.investments[0].amount = state.plan.investments[0].nativeAmount = 50000
    state.plan.investments[0].monthlyContribution = state.plan.investments[0].nativeMonthlyContribution = 150
    state.plan.investments.push({ ...state.plan.investments[0], id: 'chf', currency: 'CHF', amount: 50000, nativeAmount: 10000, monthlyContribution: 50, nativeMonthlyContribution: 10 })
    const before = structuredClone(state)
    const plan = simulationInputFromData(formData(state.plan, { currentAssets: 200000, monthlyContribution: 400 }))
    assert.equal(plan.investments[1].nativeAmount, 20000)
    assert.equal(plan.investments[1].nativeMonthlyContribution, 20)
    assert.equal(plan.investments[1].amount, 100000)
    assert.equal(plan.investments[0].nativeAmount, undefined)
    assert.equal(plan.investments[0].nativeMonthlyContribution, undefined)
    const candidate = { plan, cashFlow: simulationCashFlow(plan), currency: 'BRL' }
    const preview = compare(state, candidate)
    assert.equal(preview.financialDifference, 100000)
    const applied = createExportableState({ ...state, ...candidate })
    assert.deepEqual(compare(applied).hypothesis.rows, preview.hypothesis.rows)
    assert.deepEqual(state, before)
  } finally { Object.assign(state, previous); scenarioEditor.scenario = editing }
})

test('cenário salvo usa sua moeda ao editar carteira estrangeira e aceita saldo inicial zero', () => {
  const previous = structuredClone(state), editing = scenarioEditor.scenario
  try {
    Object.assign(state, fixture())
    state.exchangeRates.rates.BRL = 10
    state.exchangeRates.rates.CHF = 2
    state.exchangeRates.rates.USD = 1
    scenarioEditor.scenario = { ...hypothesis(fixture('CHF')), id: 'foreign', name: 'Exterior' }
    const base = scenarioEditor.scenario.plan
    base.investments[0] = { ...base.investments[0], currency: 'USD', amount: 100000, nativeAmount: 50000 }
    const plan = simulationInputFromData(formData(base, { currentAssets: 200000 }))
    assert.equal(plan.investments[0].nativeAmount, 100000)
    const preview = compare(state, { plan, cashFlow: simulationCashFlow(plan), currency: 'CHF' })
    assert.equal(preview.rows[0].hypothesis.financialAssets, 880000)
    base.investments[0].amount = base.investments[0].nativeAmount = base.currentAssets = 0
    const fromZero = simulationInputFromData(formData(base, { currentAssets: 200000 }))
    assert.equal(fromZero.investments[0].nativeAmount, 100000)
  } finally { Object.assign(state, previous); scenarioEditor.scenario = editing }
})

test('status antecede o gráfico e a seleção de ano é mantida ou limitada ao intervalo', () => {
  const result = compare(fixture())
  const html = scenarioComparisonView(result, { metric: 'liquidity', selectedYear: 2030 })
  assert.ok(html.indexOf('simulation-status-summary') < html.indexOf('data-planning-chart'))
  assert.match(html, /data-chart-selected-index="4"/)
  assert.ok(html.indexOf('data-apply-simulation') > html.indexOf('data-planning-chart'))
  const short = hypothesis(fixture())
  short.plan.targetAge = 63
  assert.match(scenarioComparisonView(compare(fixture(), short), { selectedYear: 2031 }), /data-chart-selected-index="3"/)
})
