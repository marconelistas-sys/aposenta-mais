import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState, sanitizeCashFlowItem, sanitizeInvestment } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { annualRiskPath } from '../src/domain/finapp-risk.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { parseFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'
import { renderReleaseSource } from '../src/shared/release-sources.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { projectRetirementWithSchedules, projectAssetSeriesWithSchedules } from '../src/domain/retirement.js'

const today = new Date('2026-01-01T00:00:00Z')
function fixture({ linked = true, rate = 0, releaseYear = 2030, mode = 'external' } = {}) {
  return createExportableState({ isDemo: false, currency: 'CHF', plan: { currentAge: 53, targetAge: 60, horizonReferenceMonth: '2026-01', retirementMonth: '2030-01', annualRealReturn: 0.02, investments: [{ id: 'bvk', name: 'BVK', assetClass: 'pension', amount: 1000, liquidity: 'restricted', returnType: 'real', returnValue: rate }], finappMethod: { pensionMode: mode, openingConfirmed: true, pensionConfirmed: true, releases: releaseYear ? [{ investmentId: 'bvk', year: releaseYear }] : [] } }, cashFlow: { referenceMonth: '2026-01', items: [{ id: 'marcone', type: 'expense', categoryId: 'private-pension', description: 'Contribuição prev. Marcone', amount: 10, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', endDate: '2029-12-31', source: 'manual', recordKind: 'planned', ...(linked ? { pensionInvestmentId: 'bvk' } : {}) }] } })
}
const project = value => finappViability(value, value.plan.finappMethod, today, { includeBreakdown: true })

test('saldo inicial e aportes formam uma BVK, liberada somente na disponibilidade do fundo', () => {
  const value = fixture(), before = structuredClone(value)
  const result = project(value)
  const beforeRelease = result.rows.find(row => row.year === '2029')
  assert.equal(beforeRelease.financialAssets, 1480)
  assert.equal(beforeRelease.liquidAssets, 0)
  assert.equal(beforeRelease.releases, 0)
  assert.equal(beforeRelease.wealthBreakdown.financial.filter(item => item.kind === 'pension').length, 1)
  const release = result.rows.find(row => row.year === '2030')
  assert.equal(release.releases, 1480)
  assert.equal(release.liquidAssets, 1480)
  assert.equal(release.pensionCredits, 0)
  assert.deepEqual(release.breakdown.releases.map(item => item.id), ['opening:bvk'])
  const detail = release.breakdown.releases[0]
  assert.equal(detail.openingPrincipal, 1000)
  assert.equal(detail.contributionPrincipal, 480)
  assert.equal(detail.accumulatedReturn, 0)
  assert.deepEqual(detail.contributionSources, [{ id: 'marcone', name: 'Contribuição prev. Marcone', amount: 480 }])
  const html = renderReleaseSource(detail)
  assert.match(html, /Conferir investimento na Carteira/)
  assert.match(html, /review=budget&amp;id=marcone&amp;field=pensionInvestmentId/)
  assert.equal(result.rows.find(row => row.year === '2031').releases, 0)
  assert.deepEqual(value, before)
  assert.equal(buildMonthlyBudget(value).planned.expenses, 0, 'Desconto em folha permanece fora do orçamento')
})

test('aportes vinculados rendem pela taxa do fundo e o risco anual usa a mesma posição', () => {
  const value = fixture({ rate: 0.1, releaseYear: 2027 })
  value.cashFlow.items[0].endDate = '2027-12-31'
  const result = project(value)
  assert.ok(Math.abs(result.rows[0].financialAssets - 1220) < 1e-9)
  assert.ok(Math.abs(result.rows[1].releases - 1462) < 1e-9)
  const detail = result.rows[1].breakdown.releases[0]
  assert.ok(Math.abs(detail.accumulatedReturn - 222) < 1e-9)
  const path = annualRiskPath(result, result.rows.map(() => value.plan.annualRealReturn))
  result.rows.forEach((row, index) => assert.ok(Math.abs(path[index].financialAssets - row.financialAssets) < 1e-9))
})

test('projeções mensais e carteira aplicam a taxa da BVK aos aportes vinculados', () => {
  const value = fixture({ rate: 0.12 })
  value.plan.retirementMonth = '2027-01'
  const schedules = retirementContributionSchedules(value.cashFlow, value.currency, value.exchangeRates)
  assert.equal(schedules[0].investmentId, 'bvk')
  const rate = Math.expm1(Math.log1p(0.12) / 12)
  const expected = 1000 * 1.12 + 10 * Math.expm1(Math.log1p(rate) * 12) / rate
  const result = projectRetirementWithSchedules(value.plan, schedules, today)
  assert.ok(Math.abs(result.projectedAssets - expected) < 1e-8)
  const series = projectAssetSeriesWithSchedules(value.plan, schedules, 1, today)
  assert.ok(Math.abs(series.at(-1).assets - expected) < 1e-8)
  assert.equal(result.scheduledContributionTotal, 120)
})

test('vínculo converte aportes em CHF uma vez quando a projeção usa BRL', () => {
  const value = fixture()
  value.currency = 'BRL'
  value.exchangeRates.rates = { EUR: 1, BRL: 6, CHF: 1, USD: 1 }
  value.plan.investments[0].amount = 6000
  const release = project(value).rows.find(row => row.year === '2030')
  assert.equal(release.releases, 8880)
  assert.equal(release.breakdown.releases.length, 1)
  assert.equal(release.breakdown.releases[0].contributionPrincipal, 2880)
  assert.equal(value.cashFlow.items[0].amount, 10)
  assert.equal(value.cashFlow.items[0].currency, 'CHF')
})

test('várias contribuições vinculadas somam uma vez, sem liberar fundos sem disponibilidade', () => {
  const value = fixture({ releaseYear: null })
  value.cashFlow.items.push({ ...value.cashFlow.items[0], id: 'employer', description: 'Parte empregador', amount: 5 })
  const result = project(value)
  const row = result.rows.find(row => row.year === '2029')
  assert.equal(row.financialAssets, 1720)
  assert.equal(row.liquidAssets, 0)
  assert.equal(row.releases, 0)
  assert.equal(row.wealthBreakdown.financial.filter(item => item.kind === 'pension').length, 1)
  assert.ok(result.notices.some(message => /BVK.*sem ano/.test(message)))
})

test('previdência financiada transfere uma vez e destinos ausentes não produzem uma projeção incorreta', () => {
  const value = fixture({ mode: 'cash-funded' })
  value.cashFlow.items.push({ ...value.cashFlow.items[0], id: 'salary', type: 'income', categoryId: 'salary', description: 'Receita', pensionInvestmentId: undefined })
  const result = project(value)
  assert.equal(result.rows[0].freeCashFlow, 0)
  assert.equal(result.rows[0].financialAssets, 1120)
  value.cashFlow.items[0].pensionInvestmentId = 'missing'
  assert.throws(() => project(value), /investimento.*existente/)
})

test('migração recupera só os registros confirmados, preserva premissas e respeita desvinculação explícita', () => {
  const legacy = fixture({ linked: false })
  legacy.plan.investments[0].id = 'finapp:initial_assets:1'
  legacy.plan.investments[0].name = 'BVK (Fundo de Pensão Suíço)'
  legacy.cashFlow.items[0].id = 'finapp:pension_contributions:2'
  legacy.plan.finappMethod.releases = []
  const recovered = createExportableState(legacy)
  assert.equal(recovered.cashFlow.items[0].pensionInvestmentId, 'finapp:initial_assets:1')
  assert.deepEqual(recovered.plan.finappMethod.releases, [{ investmentId: 'finapp:initial_assets:1', year: 2030 }])
  assert.deepEqual(createExportableState(recovered), recovered)
  assert.equal(legacy.cashFlow.items[0].pensionInvestmentId, undefined)
  legacy.plan.finappMethod.releases = [{ investmentId: 'finapp:initial_assets:1', year: 2034 }]
  assert.equal(createExportableState(legacy).plan.finappMethod.releases[0].year, 2034)
  legacy.cashFlow.items[0].pensionInvestmentId = null
  assert.equal(createExportableState(legacy).cashFlow.items[0].pensionInvestmentId, null)
  delete legacy.cashFlow.items[0].pensionInvestmentId
  legacy.plan.investments[0].name = 'Outro fundo'
  assert.equal(createExportableState(legacy).cashFlow.items[0].pensionInvestmentId, undefined)
})

test('exportação, payload de sincronização e cenários preservam o vínculo', () => {
  const value = fixture()
  value.scenarios = [{ id: 'example', name: 'Cenário', currency: value.currency, plan: value.plan, cashFlow: value.cashFlow }]
  const restored = createExportableState(financialPayload(value))
  assert.equal(restored.cashFlow.items[0].pensionInvestmentId, 'bvk')
  assert.equal(restored.scenarios[0].cashFlow.items[0].pensionInvestmentId, 'bvk')
  assert.ok(!Object.hasOwn(sanitizeCashFlowItem({ ...value.cashFlow.items[0], recordKind: 'actual' }), 'pensionInvestmentId'))
})

function file() {
  return { format: 'aposenta-finapp-import', version: 2, investmentCurrency: 'BRL', items: [sanitizeCashFlowItem({ ...fixture().cashFlow.items[0], id: 'finapp:pension_contributions:5', pensionInvestmentId: 'finapp:initial_assets:8' })], investments: [sanitizeInvestment({ ...fixture().plan.investments[0], id: 'finapp:initial_assets:8' })], investmentReleases: [{ investmentId: 'finapp:initial_assets:8', year: 2030 }], pending: [] }
}

test('importação conserva vínculo e liberação, aceita repetição antiga e preserva o ano editado', () => {
  const parsed = parseFinappImport(JSON.stringify(file()))
  const empty = createExportableState({ isDemo: false, plan: { currentAssets: 0, monthlyContribution: 0 }, cashFlow: { items: [] } })
  const imported = mergeFinappImport(empty, parsed).state
  assert.equal(imported.cashFlow.items[0].pensionInvestmentId, 'finapp:initial_assets:8')
  assert.equal(imported.plan.finappMethod.releases[0].year, 2030)
  imported.plan.finappMethod.releases[0].year = 2034
  assert.equal(mergeFinappImport(imported, parsed).state.plan.finappMethod.releases[0].year, 2034)
  const legacy = file()
  delete legacy.items[0].pensionInvestmentId
  delete legacy.investmentReleases
  const repeated = mergeFinappImport(imported, parseFinappImport(JSON.stringify(legacy)))
  assert.equal(repeated.added, 0)
  assert.equal(repeated.state.cashFlow.items[0].pensionInvestmentId, 'finapp:initial_assets:8')
})

test('importação rejeita vínculos quebrados e liberações duplicadas', () => {
  const broken = file()
  broken.items[0].pensionInvestmentId = 'missing'
  assert.throws(() => parseFinappImport(JSON.stringify(broken)), /Destino/)
  const duplicate = file()
  duplicate.investmentReleases.push(duplicate.investmentReleases[0])
  assert.throws(() => parseFinappImport(JSON.stringify(duplicate)), /liberação inválido/)
})
