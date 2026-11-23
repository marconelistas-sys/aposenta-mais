import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, upsertStatementItems, updateCashFlowItem, updateCashFlow, removeCashFlowItem } = await import('../src/app/state.js')
const { sanitizeCashFlow } = await import('../src/app/state-storage.js')
const { inspectStatementText } = await import('../src/domain/statement-import.js')
const { reviewStatementBatch } = await import('../src/domain/statement-batch.js')
const { buildBudgetYear } = await import('../src/domain/budget-overview.js')
const { analyzeStatementPlanning } = await import('../src/domain/statement-planning.js')
const { linkAssetPurchases, reconcileAssetPurchases } = await import('../src/domain/asset-purchases.js')
const { transferBudgetAmount } = await import('../src/domain/own-transfers.js')

const statement = 'data;descricao;valor;moeda\n2026-11-11;Compra com Cartão RECREIO BH;-3000;BRL\n2026-11-12;Supermercado;-120;BRL\n2026-11-13;Pix Enviado RECREIO B.H.;-134500;BRL'
const isCar = item => /RECREIO/.test(item.description)
// Same steps as the review dialog: the rows marked as asset purchase carry the chosen target.
function importStatement(target = 'new:vehicle') {
  const inspection = inspectStatementText(statement)
  const rows = reviewStatementBatch([{ fileName: 'bb.csv', inspection, mapping: inspection.suggestedMapping }], { existingItems: state.cashFlow.items }).rows
  const items = rows.map(row => isCar(row.item) ? { ...row.item, assetPurchaseTarget: row.item.assetPurchaseId || target } : row.item)
  const result = upsertStatementItems(items)
  state.cashFlow = sanitizeCashFlow(JSON.parse(JSON.stringify(state.cashFlow)), 'BRL')
  return result
}
function reset() {
  state.currency = 'BRL'
  state.cashFlow.items = []
  state.cashFlow.nonFinancialAssets = []
  state.cashFlow.ownStatementAccounts = []
}
const actualExpenses = () => buildBudgetYear(state, 2026).annual.actual.expenses

test('payments marked with the same new type form one asset worth their sum', () => {
  const { assets, links, created } = linkAssetPurchases([
    { key: 'a', target: 'new:vehicle', amount: 3000, currency: 'BRL', date: '2026-11-11' },
    { key: 'b', target: 'new:vehicle', amount: 134500, currency: 'BRL', date: '2026-11-13' }
  ], [], { newId: () => 'car' })
  assert.equal(created, 1)
  assert.deepEqual(assets, [{ id: 'car', name: 'Veículo comprado em 11/2026', currency: 'BRL', amount: 137500, startYear: 2026, endYear: 2035, everyYears: 1, realGrowth: -0.1, category: 'vehicle', fromPurchases: true }])
  assert.deepEqual([...links.values()], ['car', 'car'])
  assert.throws(() => linkAssetPurchases([{ key: 'c', target: 'car', amount: 10, currency: 'CHF', date: '2026-11-13' }], assets), /mesma moeda/)
  assert.throws(() => linkAssetPurchases([{ key: 'c', target: 'missing', amount: 10, currency: 'BRL', date: '2026-11-13' }], assets), /não encontrado/)
})

test('an asset purchase is out of the budget and of the statement analysis', () => {
  const item = { type: 'expense', recordKind: 'actual', amount: 134500, currency: 'BRL', assetPurchaseId: 'car', startDate: '2026-11-13', description: 'Pix' }
  assert.equal(transferBudgetAmount(item), 0)
  const result = analyzeStatementPlanning([item, { ...item, assetPurchaseId: undefined, amount: 100, startDate: '2026-10-05' }], { start: '2026-10-01', end: '2026-11-30', complete: true, currency: 'BRL', asOf: '2026-12-01' })
  assert.equal(result.expense, 50)
})

test('importing the purchase creates one vehicle, keeps the payments out of expenses and survives reload and reimport', () => {
  reset()
  const result = importStatement()
  assert.deepEqual([result.added, result.assetLinked, result.assetCreated], [3, 2, 1])
  assert.equal(state.cashFlow.nonFinancialAssets.length, 1)
  const car = state.cashFlow.nonFinancialAssets[0]
  assert.deepEqual([car.category, car.amount, car.fromPurchases], ['vehicle', 137500, true])
  assert.ok(state.cashFlow.items.filter(isCar).every(item => item.assetPurchaseId === car.id))
  assert.equal(actualExpenses(), 120)
  assert.deepEqual(importStatement(), { added: 0, updated: 3, assetLinked: 2 })
  assert.equal(state.cashFlow.nonFinancialAssets.length, 1)
  assert.equal(state.cashFlow.nonFinancialAssets[0].amount, 137500)
  assert.equal(state.cashFlow.items.length, 3)
})

test('editing links, changes the value and unlinks an existing payment', () => {
  reset()
  const inspection = inspectStatementText(statement)
  upsertStatementItems(reviewStatementBatch([{ fileName: 'bb.csv', inspection, mapping: inspection.suggestedMapping }]).rows.map(row => row.item))
  assert.equal(actualExpenses(), 137620)
  const [down, rest] = state.cashFlow.items.filter(isCar)
  updateCashFlowItem(down.id, { assetTarget: 'new:vehicle' })
  const car = state.cashFlow.nonFinancialAssets[0]
  updateCashFlowItem(rest.id, { assetTarget: car.id })
  assert.equal(state.cashFlow.nonFinancialAssets[0].amount, 137500)
  assert.equal(actualExpenses(), 120)
  // Saving the first payment again keeps the same asset.
  updateCashFlowItem(down.id, { assetTarget: 'new:vehicle', amount: 3500 })
  assert.deepEqual(state.cashFlow.nonFinancialAssets.map(row => [row.id, row.amount]), [[car.id, 138000]])
  updateCashFlowItem(down.id, { assetTarget: '' })
  assert.equal(state.cashFlow.nonFinancialAssets[0].amount, 134500)
  assert.equal(actualExpenses(), 3620)
  removeCashFlowItem(rest.id)
  assert.equal(state.cashFlow.nonFinancialAssets[0].amount, 134500)
})

test('removing the asset returns its payments to the budget, and a typed value stops following purchases', () => {
  reset()
  importStatement()
  const car = state.cashFlow.nonFinancialAssets[0]
  assert.deepEqual(reconcileAssetPurchases(state.cashFlow.items, [{ ...car, fromPurchases: undefined, amount: 120000 }]).assets[0].amount, 120000)
  updateCashFlow({ nonFinancialAssets: [] })
  assert.ok(state.cashFlow.items.every(item => !item.assetPurchaseId))
  assert.equal(actualExpenses(), 137620)
  // A stored link without its asset is dropped on load too.
  const loaded = sanitizeCashFlow({ items: [{ ...state.cashFlow.items[0], assetPurchaseId: 'gone' }], nonFinancialAssets: [] }, 'BRL')
  assert.equal(loaded.items[0].assetPurchaseId, undefined)
})

const { possibleDuplicateAssets, mergeAssets } = await import('../src/domain/asset-purchases.js')
const { mergeNonFinancialAssets, markNonFinancialAssetsDistinct } = await import('../src/app/state.js')
const planned = { id: 'finapp:assets:2', name: 'Automóvel', currency: 'BRL', amount: 90000, startYear: 2029, endYear: 2060, everyYears: 1, realGrowth: 0 }
const bought = { id: 'new-car', name: 'Veículo comprado em 11/2026', currency: 'BRL', amount: 137500, startYear: 2026, endYear: 2035, everyYears: 1, realGrowth: -0.1, category: 'vehicle', fromPurchases: true }
const payments = [{ id: 'p1', type: 'expense', recordKind: 'actual', amount: 3000, currency: 'BRL', startDate: '2026-11-11', assetPurchaseId: 'new-car' }, { id: 'p2', type: 'expense', recordKind: 'actual', amount: 134500, currency: 'BRL', startDate: '2026-11-13', assetPurchaseId: 'new-car' }]

test('a car planned for later and the same car bought now are suggested as one, keeping the planned row', () => {
  assert.deepEqual(possibleDuplicateAssets([planned, bought], payments), [{ keepId: 'finapp:assets:2', keepName: 'Automóvel', removeId: 'new-car', removeName: 'Veículo comprado em 11/2026' }])
  const { assets, items } = mergeAssets([planned, bought], payments, 'finapp:assets:2', 'new-car')
  assert.deepEqual(assets, [{ ...planned, category: 'vehicle', startYear: 2026, endYear: 2060, realGrowth: -0.1, fromPurchases: true, amount: 137500 }])
  assert.ok(items.every(item => item.assetPurchaseId === 'finapp:assets:2'))
  // Already corrected row without payments next to a new bought car: same outcome.
  const corrected = { ...planned, amount: 137500, startYear: 2026, realGrowth: -0.1, category: 'vehicle', fromPurchases: true }
  assert.equal(possibleDuplicateAssets([corrected, bought], payments)[0].keepId, 'finapp:assets:2')
  assert.equal(mergeAssets([corrected, bought], payments, 'finapp:assets:2', 'new-car').assets[0].amount, 137500)
})

test('two bought cars, different types or confirmed different assets are not suggested', () => {
  const second = { ...bought, id: 'second', name: 'Moto' }
  assert.deepEqual(possibleDuplicateAssets([bought, second], [...payments, { ...payments[0], id: 'p3', assetPurchaseId: 'second' }]), [])
  assert.deepEqual(possibleDuplicateAssets([{ ...planned, category: 'other', name: 'Barco' }, bought], payments), [])
  assert.deepEqual(possibleDuplicateAssets([{ ...planned, distinctFrom: ['new-car'] }, bought], payments), [])
  assert.equal(possibleDuplicateAssets([planned, { ...planned, id: 'copy' }], []).length, 1)
  assert.throws(() => mergeAssets([planned, { ...bought, currency: 'CHF' }], payments, 'finapp:assets:2', 'new-car'), /moedas diferentes/)
})

test('merging in the app keeps one car worth the payments, and marking distinct survives reload', () => {
  reset()
  importStatement()
  const created = state.cashFlow.nonFinancialAssets[0]
  updateCashFlow({ nonFinancialAssets: [planned, created] })
  const kept = mergeNonFinancialAssets('finapp:assets:2', created.id)
  assert.deepEqual([state.cashFlow.nonFinancialAssets.length, kept.amount, kept.startYear, kept.category], [1, 137500, 2026, 'vehicle'])
  assert.ok(state.cashFlow.items.filter(isCar).every(item => item.assetPurchaseId === 'finapp:assets:2'))
  assert.equal(actualExpenses(), 120)
  updateCashFlow({ nonFinancialAssets: [...state.cashFlow.nonFinancialAssets, { ...planned, id: 'moto', name: 'Automóvel', amount: 20000 }] })
  markNonFinancialAssetsDistinct('moto', 'finapp:assets:2')
  const loaded = sanitizeCashFlow(JSON.parse(JSON.stringify(state.cashFlow)), 'BRL')
  assert.deepEqual(possibleDuplicateAssets(loaded.nonFinancialAssets, loaded.items), [])
})
