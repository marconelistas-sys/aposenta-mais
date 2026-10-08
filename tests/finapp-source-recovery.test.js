import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRiskPath } from '../src/domain/finapp-risk.js'
import { retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { mergeFinappImport } from '../src/domain/finapp-import.js'

const today = new Date('2026-01-01T00:00:00Z')
function legacy() {
  const investment = (id, name, assetClass, amount) => ({ id: `finapp:initial_assets:${id}`, name, assetClass, amount, liquidity: 'restricted', returnType: 'real', returnValue: 0.05 })
  const contribution = (id, description, amount, endYear) => ({ id: `finapp:pension_contributions:${id}`, description, amount, type: 'expense', categoryId: 'private-pension', currency: 'BRL', frequency: 'monthly', recordKind: 'planned', source: 'manual', startDate: '2026-01-01', endDate: `${endYear}-12-31` })
  return { version: 10, isDemo: false, currency: 'BRL', plan: { currentAge: 53, retirementAge: 54, targetAge: 100, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0.05, investments: [investment(1, 'BVK (Fundo de Pensão Suíço)', 'pension', 1000), investment(4, 'Funpresp', 'pension', 500), investment(7, 'Direito sobre precatório', 'other', 200)], finappMethod: { openingConfirmed: true, pensionConfirmed: true, releases: [] } }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2027-01', items: [contribution(1, 'Contribuição prev. Iara', 20, 2037), contribution(2, 'Contribuição prev. Marcone', 10, 2029), contribution(3, 'Contribuicao INSS Marcone', 5, 2037), { id: 'living', description: 'Moradia', type: 'expense', categoryId: 'housing', amount: 500, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', source: 'manual', startDate: '2026-01-01' }] } }
}

test('recuperação da origem elimina capital fictício do INSS e datas perdidas na importação antiga', () => {
  const raw = legacy(), original = structuredClone(raw)
  const value = createExportableState(raw)
  const inss = value.cashFlow.items.find(item => item.id === 'finapp:pension_contributions:3')
  assert.equal(inss.pensionCapitalRelease, false)
  assert.equal(value.cashFlow.items[0].pensionInvestmentId, 'finapp:initial_assets:4')
  assert.equal(value.cashFlow.items[1].pensionInvestmentId, 'finapp:initial_assets:1')
  assert.deepEqual(value.plan.finappMethod.releases, [
    { investmentId: 'finapp:initial_assets:1', year: 2030 },
    { investmentId: 'finapp:initial_assets:4', year: 2035 },
    { investmentId: 'finapp:initial_assets:7', year: 2027 }
  ])
  assert.deepEqual(value.plan.investments.map(item => item.amount), [1000, 500, 200])
  assert.deepEqual(raw, original)
  assert.deepEqual(createExportableState(value), value)
  assert.equal(retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates).length, 2)
})

test('insolvência não conserva fundos fictícios e todas as disponibilidades comprovadas são respeitadas até 100 anos', () => {
  const value = createExportableState(legacy())
  const result = finappViability(value, undefined, today, { includeBreakdown: true })
  assert.equal(result.firstFailure.year, '2026')
  assert.equal(result.rows.at(-1).year, '2073')
  assert.ok(result.rows[0].restrictedFinancial > 0, 'Um investimento real restrito continua existindo durante um déficit')
  for (const row of result.rows) {
    assert.ok(!row.wealthBreakdown.financial.some(item => /INSS/.test(item.name)))
    assert.ok(!row.pensionFlows.some(item => item.itemId === 'finapp:pension_contributions:3'))
    assert.ok(!row.breakdown.releases.some(item => item.name.includes('INSS')))
    if (Number(row.year) >= 2035) {
      assert.equal(row.restrictedFinancial, 0)
      assert.equal(row.financialAssets, row.liquidAssets)
      assert.ok(!row.wealthBreakdown.financial.some(item => item.liquidity !== 'available'))
    }
  }
  for (const [id, year] of [[7, 2027], [1, 2030], [4, 2035]]) {
    const name = `opening:finapp:initial_assets:${id}`
    const released = result.rows.filter(row => row.breakdown.releases.some(item => item.id === name))
    assert.deepEqual(released.map(row => row.year), [String(year)])
  }
  const risk = annualRiskPath(result, result.rows.map(() => 0.05))
  result.rows.forEach((row, index) => assert.equal(risk[index].financialAssets, row.financialAssets))
})

test('edição e remoção deliberada do ano de liberação persistem depois da recuperação', () => {
  const value = createExportableState(legacy())
  value.plan.finappMethod.releases = value.plan.finappMethod.releases.filter(item => item.investmentId !== 'finapp:initial_assets:7')
  value.plan.finappMethod.releases.find(item => item.investmentId === 'finapp:initial_assets:4').year = 2040
  value.cashFlow.items[0].pensionInvestmentId = null
  const restored = createExportableState(financialPayload(value))
  assert.ok(!restored.plan.finappMethod.releases.some(item => item.investmentId === 'finapp:initial_assets:7'))
  assert.equal(restored.plan.finappMethod.releases.find(item => item.investmentId === 'finapp:initial_assets:4').year, 2040)
  assert.equal(restored.cashFlow.items[0].pensionInvestmentId, null)
})

test('recuperação por posição permite completar uma importação antiga em etapas', () => {
  const raw = legacy()
  raw.plan.investments = raw.plan.investments.filter(item => item.id === 'finapp:initial_assets:1')
  raw.cashFlow.items = raw.cashFlow.items.filter(item => item.id === 'finapp:pension_contributions:2')
  const first = createExportableState(raw)
  first.plan.investments.push(...legacy().plan.investments.filter(item => item.id !== 'finapp:initial_assets:1'))
  first.cashFlow.items.push(...legacy().cashFlow.items.filter(item => item.id !== 'finapp:pension_contributions:2'))
  const second = createExportableState(first)
  assert.equal(second.plan.finappMethod.releases.length, 3)
  assert.equal(second.cashFlow.items.find(item => item.id === 'finapp:pension_contributions:1').pensionInvestmentId, 'finapp:initial_assets:4')
})

test('reimportação preserva a remoção deliberada de uma disponibilidade já recuperada', () => {
  const value = createExportableState(legacy())
  value.plan.finappMethod.releases = value.plan.finappMethod.releases.filter(item => item.investmentId !== 'finapp:initial_assets:7')
  const restored = mergeFinappImport(value, { items: [], investments: [], investmentReleases: [{ investmentId: 'finapp:initial_assets:7', year: 2027 }] }).state
  assert.ok(!restored.plan.finappMethod.releases.some(item => item.investmentId === 'finapp:initial_assets:7'))
})

test('IDs sem nomes comprovados e cadastros manuais não recebem datas ou classificação inventadas', () => {
  const raw = legacy()
  raw.plan.investments.forEach(item => { item.name = 'Outro investimento' })
  raw.cashFlow.items.forEach(item => { item.description = 'Outro lançamento' })
  const value = createExportableState(raw)
  assert.deepEqual(value.plan.finappMethod.releases, [])
  assert.ok(value.cashFlow.items.every(item => !Object.hasOwn(item, 'pensionCapitalRelease') && !item.pensionInvestmentId))
})

test('cenários recuperam INSS, vínculos e datas com as mesmas regras do plano', () => {
  const raw = legacy()
  raw.scenarios = [{ id: 'old', name: 'Importado antigo', currency: 'BRL', plan: raw.plan, cashFlow: raw.cashFlow }]
  const value = createExportableState(raw)
  assert.deepEqual(value.scenarios[0].plan.finappMethod, value.plan.finappMethod)
  assert.equal(value.scenarios[0].cashFlow.items[2].pensionCapitalRelease, false)
  assert.equal(value.scenarios[0].cashFlow.items[0].pensionInvestmentId, 'finapp:initial_assets:4')
})
