import test from 'node:test'
import assert from 'node:assert/strict'
import { propertyValues, assessPropertySolvency, solvencyMilestones } from '../src/domain/property-solvency.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { renderCashFlowLineChart } from '../src/shared/cash-flow-line-chart.js'
import { renderPropertyFilter, renderSolvencyAssessment } from '../src/shared/property-solvency.js'
import { renderCashFlowResult } from '../src/shared/cash-flow-result.js'
import { sanitizeStoredState, serializeExportableState, parseStoredState, storageKeys } from '../src/app/state-storage.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { state, selectPlanOwner } from '../src/app/state.js'
import { savePropertySolvencyPreference } from '../src/app/property-solvency.js'
import { ownedStorage } from '../src/app/owned-storage.js'
import { saveAnnualPlanning, renderAnnualPlanning } from '../src/features/plan/annual-planning.js'
import { renderPlanningOverview } from '../src/features/dashboard/planning-overview.js'
import { renderWealth } from '../src/features/wealth/wealth.js'

const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const asset = (id, category, amount, extra = {}) => ({ id, name: id, category, amount, currency: 'BRL', startYear: 2026, endYear: 2030, everyYears: 1, realGrowth: 0, ...extra })
const assets = () => [asset('home', 'real-estate', 10000, { includeInSolvency: false }), asset('rental', 'real-estate', 20000), asset('car', 'vehicle', 1000), asset('unknown', undefined, 500)]
function plan() {
  return sanitizeStoredState({ valuesHidden: false, currency: 'BRL', plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, annualInflation: .1, currentAssets: 1000, investments: [{ id: 'cash', name: 'Cash', amount: 1000, liquidity: 'available', returnType: 'real', returnValue: 0 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2027-01', nonFinancialAssets: assets(), items: [{ id: 'expense', type: 'expense', categoryId: 'housing', amount: 100, currency: 'BRL', frequency: 'monthly' }] } })
}
function exampleRows() {
  return assessPropertySolvency([{ year: '2026', netWorth: 9800, realEstateAssets: 10000, excludedRealEstateAssets: 10000, income: 100, costs: 300, goals: 0, pensionCredits: 0, previousFinancial: 1000, previousLiquid: 500, financialAssets: 900, financialReturn: 100, financialChange: -100, liquidAssets: 300, freeCashFlow: -200, liabilities: 1100, assets: 10000 }], false)
}

test('filter removes only classified properties, honors individual selection, currencies and active years', () => {
  const flow = { nonFinancialAssets: assets() }
  const rates = plan().exchangeRates
  assert.deepEqual(propertyValues(flow, '2026-12', 'BRL', rates), { realEstateAssets: 30000, excludedRealEstateAssets: 10000 })
  flow.includeRealEstateInSolvency = false
  assert.deepEqual(propertyValues(flow, '2026-12', 'BRL', rates), { realEstateAssets: 30000, excludedRealEstateAssets: 30000 })
  assert.deepEqual(propertyValues(flow, '2031-12', 'BRL', rates), { realEstateAssets: 0, excludedRealEstateAssets: 0 })
  flow.nonFinancialAssets = [asset('usd', 'real-estate', 100, { currency: 'USD', realGrowth: .1 })]
  const customRates = { ...rates, rates: { ...rates.rates, USD: 1, BRL: 5 } }
  assert.deepEqual(propertyValues(flow, '2027-12', 'BRL', customRates), { realEstateAssets: 550, excludedRealEstateAssets: 550 })
})

test('projection preserves cash, returns, debts, total wealth and budget sustainability under either filter', () => {
  const source = plan(), before = structuredClone(source)
  const included = finappViability(source, undefined, new Date('2026-01-01'))
  const excluded = finappViability({ ...source, cashFlow: { ...source.cashFlow, includeRealEstateInSolvency: false } }, undefined, new Date('2026-01-01'))
  for (let i = 0; i < included.rows.length; i++) {
    const a = included.rows[i], b = excluded.rows[i]
    for (const key of ['income', 'costs', 'financialReturn', 'financialAssets', 'liquidAssets', 'netWorth', 'netFinancial', 'liabilities']) assert.equal(a[key], b[key], key)
    assert.equal(a.solvencyNetWorth - b.solvencyNetWorth, 20000)
    assert.equal(b.solvencyNetWorth, b.netWorth - 30000)
  }
  assert.equal(included.firstFailure.year, excluded.firstFailure.year)
  assert.equal(included.viable, excluded.viable)
  assert.deepEqual(source, before)
})

test('excluding property does not remove its debt and can reveal negative selected wealth', () => {
  const row = exampleRows()[0]
  assert.equal(row.solvencyNetWorth, -200)
  assert.equal(row.netWorth, 9800)
  assert.equal(row.liabilities, 1100)
  assert.match(renderCashFlowResult(row, 'BRL'), /dívidas superam o patrimônio considerado/)
  const html = renderSolvencyAssessment([row], 'BRL')
  assert.match(html, /data-property-assessment="insufficient"/)
  assert.match(html, /Todas as dívidas continuam descontadas/)
  assert.match(html, /9\.800,00/)
})

test('nominal conversion keeps selected wealth reconciled and original real rows intact', () => {
  const rows = exampleRows(), before = structuredClone(rows)
  rows[0].year = '2027'; before[0].year = '2027'
  const [nominal] = annualRowsInPriceBasis(rows, { basis: 'nominal', annualInflation: .1, baseYear: 2026 })
  assert.ok(Math.abs(nominal.solvencyNetWorth + 220) < 1e-8)
  assert.ok(Math.abs(nominal.solvencyNetWorth - (nominal.netWorth - nominal.excludedRealEstateAssets)) < 1e-8)
  assert.equal(nominal.realEstateAssets, 11000)
  assert.deepEqual(rows, before)
})

test('old plans retain inclusion, malformed preferences are ignored and export/sync keep explicit choices', () => {
  const legacy = plan()
  assert.equal(legacy.cashFlow.includeRealEstateInSolvency, undefined)
  const data = { ...legacy, cashFlow: { ...legacy.cashFlow, includeRealEstateInSolvency: false } }
  const restored = parseStoredState(serializeExportableState(data))
  assert.equal(restored.cashFlow.includeRealEstateInSolvency, false)
  assert.equal(restored.cashFlow.nonFinancialAssets[0].includeInSolvency, false)
  assert.equal(financialPayload(restored).cashFlow.includeRealEstateInSolvency, false)
  assert.equal(sanitizeStoredState({ ...data, cashFlow: { ...data.cashFlow, includeRealEstateInSolvency: 'false' } }).cashFlow.includeRealEstateInSolvency, undefined)
})

test('filter is isolated per account and quota failure leaves saved and live preferences unchanged', () => {
  const before = structuredClone(state), owner = ownedStorage.owner
  try {
    selectPlanOwner('property-a'); Object.assign(state, plan()); savePropertySolvencyPreference(false)
    selectPlanOwner('property-b'); Object.assign(state, plan()); savePropertySolvencyPreference(true)
    selectPlanOwner('property-a'); assert.equal(state.cashFlow.includeRealEstateInSolvency, false)
    const persisted = ownedStorage.getItem(storageKeys.current), live = structuredClone(state)
    const save = globalThis.localStorage.setItem
    globalThis.localStorage.setItem = () => { throw new Error('Quota') }
    try { assert.throws(() => savePropertySolvencyPreference(true), /Quota/) }
    finally { globalThis.localStorage.setItem = save }
    assert.deepEqual(state, live)
    assert.equal(ownedStorage.getItem(storageKeys.current), persisted)
  } finally { ownedStorage.select(owner); Object.assign(state, before) }
})

test('asset editing preserves the individual choice and reclassification removes the property-only flag', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, plan())
    const data = new FormData()
    for (const [key, value] of Object.entries(state.cashFlow.nonFinancialAssets[0])) data.set(key, String(value))
    data.set('kind', 'nonFinancialAssets'); data.set('realGrowth', '0'); data.delete('includeInSolvency')
    saveAnnualPlanning(data)
    assert.equal(state.cashFlow.nonFinancialAssets.find(row => row.id === 'home').includeInSolvency, false)
    data.set('includeInSolvency', 'on'); saveAnnualPlanning(data)
    assert.equal(state.cashFlow.nonFinancialAssets.find(row => row.id === 'home').includeInSolvency, true)
    data.set('category', 'vehicle'); saveAnnualPlanning(data)
    assert.equal(state.cashFlow.nonFinancialAssets.find(row => row.id === 'home').includeInSolvency, undefined)
    data.set('category', 'unclassified'); saveAnnualPlanning(data)
    assert.equal(state.cashFlow.nonFinancialAssets.find(row => row.id === 'home').category, undefined)
  } finally { Object.assign(state, before) }
})

test('chart exposes chosen wealth, milestone navigation and a classification path without leaking hidden values', () => {
  const rows = exampleRows(), source = plan()
  const html = renderCashFlowLineChart({ rows, plan: source.plan, cashFlow: { ...source.cashFlow, includeRealEstateInSolvency: false }, currency: 'BRL', title: 'Fluxo', baseYear: 2026 })
  assert.match(html, /data-property-solvency\s+\/>/)
  assert.match(html, /2026 · Patrimônio considerado, sem imóveis: -R\$\s*200,00/)
  assert.match(html, /data-solvency-year="2026"/)
  assert.match(html, /Primeiro déficit do orçamento/)
  assert.match(html, /bem\(ns\) sem tipo informado/)
  const hidden = renderCashFlowLineChart({ rows, plan: source.plan, cashFlow: source.cashFlow, currency: 'BRL', title: 'Fluxo', hidden: true })
  assert.doesNotMatch(hidden, /<svg|data-property|data-solvency|200,00/)
  assert.equal(renderPropertyFilter(source.cashFlow, true), '')
})

test('milestones identify first events even when later years recover', () => {
  const rows = [{ year: '2026', freeCashFlow: 1, liquidAssets: 1, solvencyNetWorth: 10 }, { year: '2027', freeCashFlow: -1, liquidAssets: 1, solvencyNetWorth: -1 }, { year: '2028', freeCashFlow: 1, liquidAssets: -1, solvencyNetWorth: 10 }]
  assert.deepEqual(solvencyMilestones(rows).map(item => item.row.year), ['2027', '2028', '2027', '2028'])
})

test('dashboard and wealth use the saved choice, keep budget insufficiency and expose asset editing', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, plan()); state.cashFlow.includeRealEstateInSolvency = false
    const year = new Date().getUTCFullYear()
    state.plan.horizonReferenceMonth = `${year}-01`
    state.plan.retirementMonth = `${year + 1}-01`; state.cashFlow.retirementMonth = `${year + 1}-01`
    const html = renderPlanningOverview({ compact: true })
    assert.match(html, /data-plan-sustainability="insufficient"/)
    assert.match(html, /Patrimônio considerado, sem imóveis/)
    assert.match(html, /data-property-solvency/)
    assert.match(renderWealth(), /data-annual-planning="nonFinancialAssets"/)
    assert.match(renderAnnualPlanning('nonFinancialAssets'), /Excluído individualmente da solvência/)
    state.valuesHidden = true
    assert.doesNotMatch(renderPlanningOverview({ compact: true }), /data-property|<svg/)
    assert.doesNotMatch(renderWealth(), /data-property-solvency|name="includeInSolvency"/)
  } finally { Object.assign(state, before) }
})
