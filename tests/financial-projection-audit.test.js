import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { openSalaryItems } from '../src/domain/cash-flow-checks.js'
import { planChecks } from '../src/domain/plan-checks.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { financialCalendar } from '../src/domain/financial-calendar.js'
import { projectRetirement, projectRetirementWithSchedules, projectAssetSeriesWithSchedules } from '../src/domain/retirement.js'
import { projectPostRetirement, defaultDecumulation } from '../src/domain/post-retirement.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { nominalToRealReturn, realToNominalReturn } from '../src/domain/investment-returns.js'

const today = new Date('2026-01-01T00:00:00Z')
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-10), `${actual} != ${expected}`)
const item = (extra = {}) => ({ id: 'salary', type: 'income', categoryId: 'salary', description: 'Salário cadastrado', amount: 1000, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01', ...extra })
function fixture() {
  return sanitizeStoredState({
    plan: { currentAge: 40, retirementAge: 41, targetAge: 42, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, annualInflation: 0, currentAssets: 10000, monthlyContribution: 100, expectedMonthlyBenefit: 0, targetMonthlyIncome: 0, finappMethod: { openingConfirmed: true, pensionConfirmed: true } },
    cashFlow: { retirementMonth: '2027-01', currentEmergencyReserve: 0, emergencyReserveTarget: 0, items: [item()] }
  })
}

test('salário único, encerrado, realizado, vinculado ou fora do horizonte não gera alerta de recorrência aberta', () => {
  for (const extra of [
    { frequency: 'occasional' },
    { frequency: 'occasional', startDate: null },
    { endDate: '2026-06-30' },
    { endDate: '2025-12-31', startDate: '2025-01-01' },
    { recordKind: 'actual' },
    { source: 'txt' },
    { endMode: 'retirement' },
    { startDate: '2029-01-01' }
  ]) {
    const state = fixture()
    state.cashFlow.items = [item(extra)]
    const before = structuredClone(state)
    assert.equal(openSalaryItems(state.cashFlow, { endMonth: '2028-12' }).length, 0)
    assert.ok(!planChecks(state, today).some(row => row.id === 'salary-open'))
    assert.ok(!finappViability(state, undefined, today).issues.some(message => message.includes('Salário recorrente sem término')))
    assert.deepEqual(state, before)
  }
})

test('alerta identifica somente os salários recorrentes sem término que participam da projeção', () => {
  const state = fixture()
  state.cashFlow.items.push(item({ id: 'bonus', description: 'Bônus único', frequency: 'occasional' }))
  const message = planChecks(state, today).find(row => row.id === 'salary-open').message
  assert.match(message, /Salário cadastrado/)
  assert.doesNotMatch(message, /Bônus único|ativo|inclusive após/)
  assert.ok(finappViability(state, undefined, today).issues.includes(message))
  state.cashFlow.items[0].frequency = 'annual'
  assert.equal(openSalaryItems(state.cashFlow).length, 1)
  state.cashFlow.items[0].amount = 0
  assert.equal(openSalaryItems(state.cashFlow).length, 0)
})

test('vínculo confirmado só no plano é respeitado pelo orçamento, aporte variável e risco mensal', () => {
  const state = fixture()
  state.cashFlow.retirementMonth = null
  state.cashFlow.items[0].endMode = 'retirement'
  assert.ok(!planChecks(state, today).some(row => row.id === 'unresolved'))
  assert.equal(compareVariableContributions(state, today).contributionTotal, 1200)
  const cash = cashFlowTimeline(state, '2026-12', 2)
  assert.deepEqual(cash.map(row => row.income), [1000, 0])
  const risk = prepareRiskInput(state, { ...defaultRiskSettings, horizonMode: 'months', months: 13 }, today)
  assert.equal(risk.timelines[0][11].income, 1000)
  assert.equal(risk.timelines[0][12].income, 0)
})

test('vínculo sem mês confirmado fica fora também do calendário', () => {
  const cashFlow = { items: [item({ endMode: 'retirement' })] }
  assert.equal(financialCalendar(cashFlow, '2026-01').events.length, 0)
})

test('metas e dívidas que já compõem o orçamento não geram aviso de ausência de despesas', () => {
  for (const extra of [
    { annualGoals: [{ id: 'g', name: 'Meta anual', amount: 100, currency: 'BRL', startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0 }] },
    { commitments: [{ id: 'g', name: 'Meta', kind: 'goal', amount: 100, saved: 20, currency: 'BRL', date: '2026-06-01' }] },
    { commitments: [{ id: 'd', name: 'Dívida', kind: 'debt', amount: 100, annualRate: 0, installments: 2, currency: 'BRL', date: '2026-06-01' }] }
  ]) {
    const state = fixture()
    Object.assign(state.cashFlow, extra)
    assert.ok(!planChecks(state, today).some(row => row.id === 'missing-expense'))
  }
  const state = fixture()
  state.cashFlow.commitments = [{ id: 'g', name: 'Meta paga', kind: 'goal', amount: 100, saved: 100, currency: 'BRL', date: '2026-06-01' }]
  assert.ok(planChecks(state, today).some(row => row.id === 'missing-expense'))
})

test('lançamento único sem data não repete mensalmente e impede avaliação anual completa', () => {
  const state = fixture()
  state.cashFlow.items = [item({ frequency: 'occasional', startDate: null })]
  const annual = finappViability(state, undefined, today)
  assert.equal(annual.rows[0].income, 0)
  assert.ok(annual.issues.some(message => message.includes('único sem data')))
  assert.equal(annual.viable, false)
  const post = projectPostRetirement(state, { ...defaultDecumulation, years: 1 }, today)
  assert.ok(post.rows.every(row => row.income === 0))
  close(post.endingAssets, post.initialAssets)
})

test('despesa única reduz aporte variável mesmo sem resgate de patrimônio', () => {
  const state = fixture()
  state.plan.monthlyContribution = 1000
  state.cashFlow.items.push(item({ id: 'expense', type: 'expense', categoryId: 'housing', frequency: 'occasional', amount: 800 }))
  const result = compareVariableContributions(state, today)
  assert.equal(result.rows[0].contribution, 200)
  assert.equal(result.rows[1].contribution, 1000)
  assert.equal(result.projectedAssets, 21200)
  state.cashFlow.items[1].amount = 1200
  state.cashFlow.emergencyReserveTarget = 500
  state.cashFlow.reserveBuildMonths = 1
  const deficit = compareVariableContributions(state, today)
  assert.equal(deficit.rows[0].contribution, 0)
  assert.equal(deficit.rows[1].contribution, 500)
})

test('cenários com aporte ajustado preservam capital ao passar da acumulação para as retiradas', () => {
  for (const contribution of [0, 50, 300]) {
    const state = fixture()
    state.plan.investments = [{ amount: 1000, monthlyContribution: 100, returnType: 'real', returnValue: 0.12, liquidity: 'available' }]
    state.plan.currentAssets = 1000
    state.plan.monthlyContribution = contribution
    const base = projectRetirement(state.plan, today)
    const variable = compareVariableContributions(state, today)
    close(variable.projectedAssets, base.projectedAssets)
    const post = projectPostRetirement({ ...state, cashFlow: { ...state.cashFlow, items: [] } }, { ...defaultDecumulation, years: 1 }, today)
    close(post.initialAssets, base.projectedAssets)
    close(post.endingAssets, base.projectedAssets * 1.12)
  }
})

test('aporte global sem distribuição na carteira usa a taxa global sem criar ou perder capital', () => {
  const state = fixture()
  state.plan.investments = [{ amount: 1000, returnType: 'real', returnValue: 0.12 }]
  state.plan.currentAssets = 1000
  state.plan.monthlyContribution = 50
  close(compareVariableContributions(state, today).projectedAssets, 1720)
  const post = projectPostRetirement({ ...state, cashFlow: { ...state.cashFlow, items: [] } }, { ...defaultDecumulation, years: 1 }, today)
  close(post.initialAssets, 1720)
  close(post.endingAssets, 1254.4 + 600)
})

test('capitalização mensal e aporte necessário conferem com recorrência independente, inclusive taxa quase zero', () => {
  for (const annual of [-0.2, 0, 1e-14, 0.04, 0.3]) {
    const state = fixture()
    state.plan.annualRealReturn = annual
    state.plan.targetMonthlyIncome = 500
    const result = projectRetirement(state.plan, today)
    const growth = Math.pow(1 + annual, 1 / 12)
    let reference = state.plan.currentAssets
    for (let month = 0; month < 12; month++) reference = reference * growth + 100
    close(result.projectedAssets, reference)
    const funded = projectRetirement({ ...state.plan, monthlyContribution: result.requiredMonthlyContribution }, today)
    close(funded.projectedAssets, result.targetAssets)
    const schedules = [{ amount: 75, startDate: '2026-03-01', endDate: '2026-06-30' }]
    let scheduledReference = state.plan.currentAssets
    for (let month = 0; month < 12; month++) scheduledReference = scheduledReference * growth + 100 + (month >= 2 && month <= 5 ? 75 : 0)
    close(projectRetirementWithSchedules(state.plan, schedules, today).projectedAssets, scheduledReference)
    close(projectAssetSeriesWithSchedules(state.plan, schedules, undefined, today).at(-1).assets, scheduledReference)
  }
})

test('conversão entre retorno nominal e real preserva poder de compra', () => {
  for (const inflation of [-0.02, 0, 0.045, 0.2]) for (const nominal of [-0.1, 0, 0.08, 0.3]) {
    const real = nominalToRealReturn(nominal, inflation)
    close(1000 * (1 + real) ** 20, 1000 * (1 + nominal) ** 20 / (1 + inflation) ** 20)
    close(realToNominalReturn(real, inflation), nominal)
  }
})

test('totais anuais conciliam caixa, patrimônio e composição sem duplicar metas em outra moeda', () => {
  const state = fixture()
  state.cashFlow.items[0].endDate = '2026-06-30'
  state.plan.annualRealReturn = 0.05
  state.cashFlow.items.push(item({ id: 'cost', type: 'expense', categoryId: 'housing', amount: 100 }))
  state.cashFlow.annualGoals = [{ id: 'g', name: 'Meta', amount: 100.01, currency: 'CHF', startYear: 2026, endYear: 2028, everyYears: 1, realGrowth: 0.02 }]
  const result = finappViability(state, undefined, today, { includeBreakdown: true })
  assert.equal(result.rows[0].income, 6000)
  for (const row of result.rows) {
    close(row.costs, 1200)
    close(row.goals, row.breakdown.goals.reduce((sum, entry) => sum + entry.amount, 0))
    close(row.financialAssets, row.previousFinancial * 1.05 + row.income - row.costs - row.goals + row.pensionCredits)
    close(row.financialChange, row.financialReturn + row.freeCashFlow + row.pensionCredits)
    close(row.netWorth, row.financialAssets + row.assets - row.liabilities)
  }
})
