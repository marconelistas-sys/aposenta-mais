import test from 'node:test'
import assert from 'node:assert/strict'
import { nonFinancialAssetsSummary, assetValueSeries } from '../src/domain/non-financial-assets.js'

const car = { id: 'car', name: 'Automóvel', currency: 'BRL', amount: 137500, startYear: 2026, endYear: 2060, everyYears: 1, realGrowth: -0.1, category: 'vehicle', fromPurchases: true }
const home = { id: 'home', name: 'Imóvel', currency: 'BRL', amount: 750000, startYear: 2026, endYear: 2073, everyYears: 1, realGrowth: 0, category: 'real-estate' }
const composition = { gross: 1500000, netWorth: 1400000, groups: [{ key: 'available', amount: 500000 }] }
function state(assets, extra = {}) {
  return {
    currency: 'BRL',
    exchangeRates: undefined,
    plan: { retirementMonth: '2035-06', currentAge: 50, targetAge: 95 },
    cashFlow: { nonFinancialAssets: assets, items: [{ id: 'a', assetPurchaseId: 'car' }, { id: 'b', assetPurchaseId: 'car' }], ...extra }
  }
}

test('car value today, this year depreciation and value at retirement in today money', () => {
  const summary = nonFinancialAssetsSummary(state([home, car]), { date: '2026-11-23', composition })
  const row = summary.rows.find(item => item.id === 'car')
  assert.deepEqual([row.status, row.valueNow, row.depreciationThisYear, row.depreciationSinceStart], ['active', 137500, 13750, 0])
  assert.ok(Math.abs(row.valueAtRetirement - 137500 * 0.9 ** 9) < 0.01)
  assert.deepEqual(row.origin, { fromPurchases: true, purchases: 2 })
  assert.equal(row.exitYear, 2061)
  assert.deepEqual(row.warnings, ['Conta no patrimônio até 2060. Se você troca de carro, encurte o período.'])
  assert.equal(summary.rows.find(item => item.id === 'home').inSolvency, true)
  assert.deepEqual(summary.groups.map(group => [group.label, group.total]), [['Imóveis', 750000], ['Veículos', 137500]])
  assert.deepEqual(summary.totals, { total: 887500, shareOfGross: 887500 / 1500000, netWorthWithoutAssets: 512500, perAvailable: 887500 / 500000, available: 500000, depreciationThisYear: 13750, vehicleDepreciationThisYear: 13750, valueAtRetirement: Math.round((750000 + 137500 * 0.9 ** 9) * 100) / 100 })
  assert.deepEqual(summary.warnings, ['Mais da metade do patrimônio está em bens, que não viram dinheiro sem venda.'])
  // A year later the car lost one step and the loss so far is visible.
  const next = nonFinancialAssetsSummary(state([car]), { date: '2027-03-01', composition }).rows[0]
  assert.deepEqual([next.valueNow, next.depreciationSinceStart], [123750, 13750])
})

test('future and finished assets stay visible with value zero, and flags follow the data', () => {
  const future = { ...car, id: 'future', name: 'Carro 2029', startYear: 2029, realGrowth: 0, fromPurchases: undefined }
  const ended = { ...home, id: 'old', name: 'Casa antiga', startYear: 2010, endYear: 2020, category: undefined }
  const chf = { ...home, id: 'flat', name: 'Apartamento', currency: 'CHF', amount: 500000, realGrowth: 0.05, endYear: 2040, includeInSolvency: false }
  const summary = nonFinancialAssetsSummary(state([future, ended, chf], { includeRealEstateInSolvency: true }), { date: '2026-11-23', composition })
  const byId = Object.fromEntries(summary.rows.map(row => [row.id, row]))
  assert.deepEqual([byId.future.status, byId.future.valueNow, byId.future.depreciationThisYear], ['planned', 0, 0])
  assert.ok(byId.future.warnings.some(text => /costumam perder valor/.test(text)))
  assert.deepEqual([byId.old.status, byId.old.valueNow, byId.old.category], ['ended', 0, 'unclassified'])
  assert.ok(byId.old.warnings.some(text => /Sem tipo/.test(text)))
  assert.equal(byId.flat.inSolvency, false)
  assert.ok(byId.flat.valueNow > 500000)
  assert.ok(byId.flat.warnings.some(text => /fora do usual/.test(text)))
  assert.ok(byId.flat.warnings.some(text => /antes do fim do plano/.test(text)))
  assert.ok(byId.flat.warnings.some(text => /convertido pelo câmbio/.test(text)))
  assert.equal(nonFinancialAssetsSummary(state([home], { includeRealEstateInSolvency: false }), { date: '2026-11-23', composition }).rows[0].inSolvency, false)
})

test('the last year has no depreciation and the series goes from start to end', () => {
  const short = { ...car, startYear: 2026, endYear: 2026 }
  assert.equal(nonFinancialAssetsSummary(state([short]), { date: '2026-05-01', composition }).rows[0].depreciationThisYear, 0)
  const series = assetValueSeries(car, { currency: 'BRL' })
  assert.deepEqual([series.length, series[0], series[1]], [35, { year: 2026, value: 137500 }, { year: 2027, value: 123750 }])
  assert.deepEqual(nonFinancialAssetsSummary(state([]), { date: '2026-05-01', composition }).totals.total, 0)
})
