import test from 'node:test'
import assert from 'node:assert/strict'
import { annualGoalEvents, annualValue, sanitizeAnnualRows, sanitizeMigration } from '../src/domain/annual-planning.js'
import { parseFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'
import { createExportableState, sanitizeInvestment } from '../src/app/state-storage.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { financialCalendar } from '../src/domain/financial-calendar.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { deterministicPath } from '../src/domain/risk-simulation.js'
import { renderAnnualPlanning, saveAnnualPlanning } from '../src/features/plan/annual-planning.js'
import { state } from '../src/app/state.js'

const annual = (overrides = {}) => ({ id: 'finapp:goals:1', name: 'Meta', currency: 'BRL', amount: 1200.01, startYear: 2026, endYear: 2030, everyYears: 2, realGrowth: 0.1, ...overrides })
function fixture() {
  const investment = sanitizeInvestment({ id: 'finapp:initial_assets:1', name: 'Saldo', amount: 100, returnType: 'real', returnValue: 0, liquidity: 'available' })
  return { format: 'aposenta-finapp-import', version: 2, investmentCurrency: 'BRL', items: [], investments: [investment], annualGoals: [annual()], nonFinancialAssets: [annual({ id: 'finapp:assets:1', name: 'Bem', amount: 5000, everyYears: 1, realGrowth: 0 })], planParameters: { currentAge: 53, annualRealReturn: 0.05, annualInflation: 0.04 }, pending: [{ table: 'consortiums', id: 1, reason: 'Revisar saldo', record: { credit_value: 1000 } }] }
}
const parsed = () => parseFinappImport(JSON.stringify(fixture()))

test('I1 substitui registros e reservas, mantém backup intacto e remove dados de demonstração', () => {
  const old = createExportableState({})
  old.plan.investments = [sanitizeInvestment({ id: 'old', name: 'Antigo', amount: 50 })]
  old.cashFlow.commitments = [{ id: 'old-goal', name: 'Antiga', kind: 'goal', currency: 'BRL', date: '2027-01-01', amount: 100, saved: 0 }]
  old.cashFlow.ledger = { accounts: [{ id: 'old-account', name: 'Conta', currency: 'BRL', openingBalance: 0, openingDate: '2026-01-01' }], movements: [] }
  const backup = structuredClone(old)
  const result = mergeFinappImport(old, parsed(), 'replace')
  assert.equal(result.mode, 'replace')
  assert.equal(result.state.isDemo, false)
  assert.equal(result.state.plan.currentAssets, 100)
  assert.equal(result.state.plan.currentAge, 53)
  assert.equal(result.state.plan.annualInflation, 0.04)
  assert.equal(result.state.plan.targetMonthlyIncome, 0)
  assert.equal(result.state.plan.expectedMonthlyBenefit, 0)
  assert.equal(result.state.cashFlow.currentEmergencyReserve, 0)
  assert.equal(result.state.cashFlow.items.length, 0)
  assert.equal(result.state.cashFlow.commitments.length, 0)
  assert.equal(result.state.cashFlow.ledger.accounts.length, 0)
  assert.equal(result.state.scenarios.length, 0)
  assert.equal(result.state.plan.retirementMonth, null)
  assert.deepEqual(old, backup)
  assert.equal(result.added, 3)
})
test('I1 substituição aceita conflito com registro anterior, repetição produz o mesmo resultado', () => {
  const once = mergeFinappImport(createExportableState({}), parsed(), 'replace').state
  once.plan.investments[0].amount = 777
  assert.throws(() => mergeFinappImport(once, parsed()), /Conflito/)
  const twice = mergeFinappImport(once, parsed(), 'replace').state
  assert.equal(twice.plan.currentAssets, 100)
  assert.deepEqual(mergeFinappImport(twice, parsed(), 'replace').state, twice)
})
test('I2 provisões em centavos somam o ano exato, com crescimento e intervalo em anos', () => {
  const row = annual()
  const sum = year => Array.from({ length: 12 }, (_, month) => annualGoalEvents([row], `${year}-${String(month + 1).padStart(2, '0')}`)).reduce((total, rows) => total + Math.round((rows[0]?.amount || 0) * 100), 0) / 100
  assert.equal(sum(2026), 1200.01)
  assert.equal(sum(2027), 0)
  assert.equal(sum(2028), annualValue(row, 2028))
  assert.equal(sum(2031), 0)
})
test('I2 orçamento inclui provisão uma vez sem inventar vencimento no calendário', () => {
  const plan = mergeFinappImport(createExportableState({}), parsed(), 'replace').state
  const timeline = cashFlowTimeline(plan, '2026-01', 24)
  assert.equal(Math.round(timeline.slice(0, 12).reduce((sum, row) => sum + row.expenses, 0) * 100), 120001)
  assert.equal(timeline[12].expenses, 0)
  assert.equal(financialCalendar(plan.cashFlow, '2026-01').events.length, 0)
})
test('I3 bem restrito entra no patrimônio, não cobre déficit e não gera dinheiro na saída', () => {
  const plan = mergeFinappImport(createExportableState({}), parsed(), 'replace').state
  plan.cashFlow.nonFinancialAssets[0].endYear = 2026
  plan.plan.expectedMonthlyBenefit = 0
  const input = prepareRiskInput(plan, { ...defaultRiskSettings, months: 13 }, new Date('2026-01-01T00:00:00Z'))
  const result = deterministicPath(input)
  assert.equal(input.initial.nonLiquidAssets, 5000)
  assert.equal(result.rows[0].nonLiquidAssets, 5000)
  assert.equal(result.rows[12].nonLiquidAssets, 0)
  assert.ok(result.firstShortfall)
  assert.equal(result.rows[12].financialAssets, 0)
  assert.match(input.timelines[0][12].events.join(), /sem venda/)
})
test('I3 dados anuais e pendências sobrevivem à exportação sanitizada', () => {
  const plan = mergeFinappImport(createExportableState({}), parsed(), 'replace').state
  const roundtrip = createExportableState(JSON.parse(JSON.stringify(plan)))
  assert.deepEqual(roundtrip.cashFlow.annualGoals, plan.cashFlow.annualGoals)
  assert.deepEqual(roundtrip.cashFlow.nonFinancialAssets, plan.cashFlow.nonFinancialAssets)
  assert.deepEqual(roundtrip.cashFlow.finappMigration.pending, fixture().pending)
})
test('I2 e I3 rejeitam limites, anos invertidos e projeções não finitas', () => {
  for (const row of [annual({ everyYears: 0 }), annual({ endYear: 2025 }), annual({ realGrowth: -1 }), annual({ amount: 1e9, realGrowth: 1 })]) assert.deepEqual(sanitizeAnnualRows([row]), [])
  const file = fixture(); file.annualGoals[0].everyYears = 0
  assert.throws(() => parseFinappImport(JSON.stringify(file)), /anual inválido/)
})
test('I3 pendências não carregam credenciais nem HTML executável na interface', () => {
  const value = sanitizeMigration({ source: 'finapp', pending: [{ table: 'consortiums', id: 1, reason: 'Conferir', record: { password: 'secret', token: 'token', credit_value: 1000 } }] })
  assert.deepEqual(value.pending[0].record, { credit_value: 1000 })
  const old = structuredClone(state)
  try {
    state.cashFlow.annualGoals = [annual({ name: '<script>example</script>' })]
    state.valuesHidden = true
    const html = renderAnnualPlanning('annualGoals')
    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('1200.01'))
    assert.ok(!html.includes('data-annual-planning='))
  } finally { Object.assign(state, old) }
})
test('I2 edição preserva identificador, não adiciona duplicado e aceita crescimento negativo', () => {
  const old = structuredClone(state)
  try {
    state.cashFlow.annualGoals = [annual()]
    const data = new Map(Object.entries({ ...annual(), kind: 'annualGoals', realGrowth: '-2' }))
    saveAnnualPlanning(data)
    assert.equal(state.cashFlow.annualGoals.length, 1)
    assert.equal(state.cashFlow.annualGoals[0].realGrowth, -0.02)
  } finally { Object.assign(state, old) }
})
