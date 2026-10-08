import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState, sanitizeCashFlowItem } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRiskPath } from '../src/domain/finapp-risk.js'
import { calculateMultiCurrencyCashFlow, retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { projectRetirementWithSchedules } from '../src/domain/retirement.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { parseFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'

const today = new Date('2026-01-01T00:00:00Z')
function fixture(mode = 'external') {
  const item = (id, type, categoryId, amount, dates = {}) => ({ id, description: id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', source: 'manual', startDate: '2026-01-01', ...dates })
  return createExportableState({ isDemo: false, currency: 'BRL', plan: { currentAge: 53, retirementAge: 57, targetAge: 60, horizonReferenceMonth: '2026-01', retirementMonth: '2030-01', currentAssets: 0, monthlyContribution: 0, annualRealReturn: 0, expectedMonthlyBenefit: 0, investments: [], finappMethod: { pensionMode: mode, openingConfirmed: true, pensionConfirmed: true, releases: [] } }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2030-01', currentEmergencyReserve: 0, emergencyReserveTarget: 0, items: [
    item('INSS', 'expense', 'private-pension', 100, { endDate: '2029-12-31', pensionCapitalRelease: false }),
    item('Salário', 'income', 'salary', 2000, { endDate: '2029-12-31' }),
    item('Moradia', 'expense', 'housing', 500),
    item('Benefício INSS', 'income', 'pension', 1000, { startDate: '2030-01-01' })
  ] } })
}
const project = value => finappViability(value, value.plan.finappMethod, today, { includeBreakdown: true })

for (const mode of ['external', 'cash-funded']) {
  test(`INSS não acumula capital e só o benefício cadastrado entra nas receitas, origem ${mode}`, () => {
    const value = fixture(mode), original = structuredClone(value)
    const result = project(value)
    assert.equal(result.rows[0].costs, mode === 'external' ? 6000 : 7200)
    assert.equal(result.rows[0].financialChange, mode === 'external' ? 18000 : 16800)
    for (const row of result.rows) {
      assert.equal(row.pensionCredits, 0)
      assert.equal(row.releases, 0)
      assert.equal(row.pensionRestricted, 0)
      assert.deepEqual(row.pensionFlows, [])
      assert.deepEqual(row.breakdown.pension, [])
      assert.ok(!row.wealthBreakdown.financial.some(item => item.kind === 'pension'))
    }
    const retired = result.rows.find(row => row.year === '2030')
    assert.equal(retired.income, 12000)
    assert.equal(retired.freeCashFlow, 6000)
    assert.deepEqual(retired.breakdown.income.map(item => item.name), ['Benefício INSS'])
    assert.equal(buildMonthlyBudget(value, '2026-01').planned.expenses, mode === 'external' ? 500 : 600)
    const risk = annualRiskPath(result, result.rows.map(() => 0))
    result.rows.forEach((row, index) => assert.equal(risk[index].financialAssets, row.financialAssets))
    const timeline = cashFlowTimeline(value, '2026-01', 12, { includeBreakdown: true })
    assert.ok(timeline.every(row => row.pension === 0 && row.breakdown.pension.length === 0))
    assert.equal(timeline[0].expenses, mode === 'external' ? 500 : 600)
    assert.deepEqual(value, original)
  })
}

test('projeção mensal não transforma INSS em patrimônio nem estima automaticamente seu benefício', () => {
  const value = fixture()
  const schedules = retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates)
  assert.deepEqual(schedules, [])
  assert.equal(projectRetirementWithSchedules(value.plan, schedules, today).projectedAssets, 0)
  value.cashFlow.items = value.cashFlow.items.filter(item => item.description !== 'Benefício INSS')
  assert.equal(project(value).rows.find(row => row.year === '2030').income, 0)
})

test('INSS e previdência resgatável coexistem sem alterar os créditos dos cadastros antigos', () => {
  const value = fixture('cash-funded')
  value.cashFlow.items.push({ ...value.cashFlow.items[0], id: 'Complementar', description: 'Complementar', amount: 200, pensionCapitalRelease: undefined })
  const schedules = retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates)
  assert.equal(schedules.length, 1)
  assert.equal(schedules[0].amount, 200)
  const result = project(value)
  assert.equal(result.rows[0].pensionCredits, 2400)
  assert.equal(result.rows[0].costs, 9600)
  assert.equal(result.rows.find(row => row.year === '2029').releases, 9600)
  const month = calculateMultiCurrencyCashFlow(value.cashFlow, value.currency, value.exchangeRates, 0, [], today)
  assert.equal(month.pensionContributions, 300)
  assert.equal(month.pensionCapitalContributions, 200)
  assert.equal(month.totalRetirementContributionCapacity, 1400)
})

test('a opção persiste em exportação, sincronização e cenários, somente em contribuições elegíveis', () => {
  const value = fixture()
  value.scenarios = [{ id: 'benefit-only', name: 'Somente benefício', currency: value.currency, plan: value.plan, cashFlow: value.cashFlow }]
  const restored = createExportableState(financialPayload(value))
  assert.equal(restored.cashFlow.items[0].pensionCapitalRelease, false)
  assert.equal(restored.scenarios[0].cashFlow.items[0].pensionCapitalRelease, false)
  assert.ok(!Object.hasOwn(sanitizeCashFlowItem({ ...value.cashFlow.items[0], recordKind: 'actual' }), 'pensionCapitalRelease'))
  assert.ok(!Object.hasOwn(sanitizeCashFlowItem({ ...value.cashFlow.items[0], categoryId: 'housing' }), 'pensionCapitalRelease'))
})

test('somente benefício impede vínculo contraditório e recuperação automática de Marcone e BVK', () => {
  const value = fixture()
  value.cashFlow.items[0].id = 'finapp:pension_contributions:2'
  value.cashFlow.items[0].description = 'Contribuição prev. Marcone'
  value.plan.investments = [{ id: 'finapp:initial_assets:1', name: 'BVK (Fundo de Pensão Suíço)', assetClass: 'pension', liquidity: 'restricted', amount: 1000, returnType: 'real', returnValue: 0 }]
  const restored = createExportableState(value)
  assert.equal(restored.cashFlow.items[0].pensionInvestmentId, undefined)
  assert.deepEqual(restored.plan.finappMethod.releases, [{ investmentId: 'finapp:initial_assets:1', year: 2030 }], 'A disponibilidade do saldo inicial é independente da contribuição')
  restored.cashFlow.items[0].pensionInvestmentId = 'finapp:initial_assets:1'
  assert.throws(() => project(restored), /somente.*benefício.*não pode/)
})

test('reimportação antiga preserva a opção sem criar novos registros ou conflitos', () => {
  const item = { ...fixture().cashFlow.items[0], id: 'finapp:pension_contributions:20' }
  const file = { format: 'aposenta-finapp-import', version: 2, investmentCurrency: 'BRL', items: [item], investments: [], pending: [] }
  const empty = createExportableState({ plan: { currentAssets: 0, monthlyContribution: 0, investments: [] }, cashFlow: { items: [] } })
  const imported = mergeFinappImport(empty, parseFinappImport(JSON.stringify(file))).state
  assert.equal(imported.cashFlow.items[0].pensionCapitalRelease, false)
  delete file.items[0].pensionCapitalRelease
  const repeated = mergeFinappImport(imported, parseFinappImport(JSON.stringify(file)))
  assert.equal(repeated.added, 0)
  assert.equal(repeated.state.cashFlow.items[0].pensionCapitalRelease, false)
})
