import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, addCashFlowItem, updateCashFlowItem, removeCashFlowItem } = await import('../src/app/state.js')
const { parseStoredState, serializeExportableState } = await import('../src/app/state-storage.js')
const { transferBudgetAmount } = await import('../src/domain/own-transfers.js')

function setup() {
  resetState()
  state.currency = 'BRL'
  state.plan.investments = [{ id: 'cdb', name: 'CDB Banco X', amount: 1000, monthlyContribution: 0, assetClass: 'fixed-income', liquidity: 'available', returnType: 'default', returnValue: null, indexAnnualRate: null, balanceAsOf: '2026-09-30' }]
  state.cashFlow.items = []
  addCashFlowItem({ type: 'expense', categoryId: 'other-expense', description: 'Aplicação mensal', amount: 300, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-10-10' })
  return state.cashFlow.items.at(-1).id
}

test('a realized expense classified as investment leaves the budget and updates the chosen investment', () => {
  const id = setup()
  const saved = updateCashFlowItem(id, { statementInternalTransfer: true, investmentTarget: 'cdb' })
  assert.deepEqual(saved.investmentChange, { name: 'CDB Banco X', created: false, applied: true, counted: true, baseDate: '2026-09-30', balanceAsOf: '2026-10-10' })
  const item = state.cashFlow.items.find(row => row.id === id)
  assert.equal(item.statementInvestmentId, 'cdb')
  assert.equal(transferBudgetAmount(item), 0)
  assert.equal(state.plan.investments[0].amount, 1300)
  assert.equal(state.plan.currentAssets, 1300)
  // Saving again, even after editing the description, does not add the amount twice.
  updateCashFlowItem(id, { description: 'Aplicação CDB', statementInternalTransfer: true, investmentTarget: 'cdb' })
  assert.equal(state.plan.investments[0].amount, 1300)
  const stored = parseStoredState(serializeExportableState(state))
  assert.equal(stored.cashFlow.items.find(row => row.id === id).statementInvestmentId, 'cdb')
})

test('classification can create an investment once, and removing it brings the expense back to the budget', () => {
  const id = setup()
  const saved = updateCashFlowItem(id, { statementInternalTransfer: true, investmentTarget: 'new' })
  assert.equal(saved.investmentChange.created, true)
  assert.equal(state.plan.investments.length, 2)
  const created = state.plan.investments.find(row => row.id !== 'cdb')
  assert.deepEqual([created.name, created.amount, created.needsDetails, created.balanceAsOf], ['Aplicação mensal', 300, true, '2026-10-10'])
  updateCashFlowItem(id, { statementInternalTransfer: true, investmentTarget: 'new' })
  assert.equal(state.plan.investments.length, 2)
  updateCashFlowItem(id, { statementInternalTransfer: false })
  const item = state.cashFlow.items.find(row => row.id === id)
  assert.equal(item.statementInvestmentId, undefined)
  assert.equal(transferBudgetAmount(item), 300)
})

test('older movements link without changing the balance, and planned items cannot update it', () => {
  const id = setup()
  state.plan.investments[0].balanceAsOf = '2026-10-31'
  const saved = updateCashFlowItem(id, { statementInternalTransfer: true, investmentTarget: 'cdb' })
  assert.equal(saved.investmentChange.applied, false)
  assert.equal(saved.investmentChange.counted, false)
  assert.equal(state.plan.investments[0].amount, 1000)
  addCashFlowItem({ type: 'expense', categoryId: 'other-expense', description: 'Plano', amount: 50, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', startDate: '2026-10-01' })
  assert.throws(() => updateCashFlowItem(state.cashFlow.items.at(-1).id, { statementInternalTransfer: true, investmentTarget: 'cdb' }), /realizados/)
})

test('two expenses classified one at a time add up even when the second is older', () => {
  const later = setup()
  addCashFlowItem({ type: 'expense', categoryId: 'other-expense', description: 'Aplicação mensal', amount: 200, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-10-03' })
  const earlier = state.cashFlow.items.at(-1).id
  updateCashFlowItem(later, { statementInternalTransfer: true, investmentTarget: 'new' })
  const created = state.plan.investments.find(row => row.id !== 'cdb')
  const saved = updateCashFlowItem(earlier, { statementInternalTransfer: true, investmentTarget: created.id })
  assert.equal(saved.investmentChange.applied, true)
  assert.equal(state.plan.investments.find(row => row.id === created.id).amount, 500)
  // Changing the amount and deleting a movement are reflected in the balance.
  updateCashFlowItem(earlier, { amount: 250, statementInternalTransfer: true, investmentTarget: created.id })
  assert.equal(state.plan.investments.find(row => row.id === created.id).amount, 550)
  removeCashFlowItem(later)
  assert.equal(state.plan.investments.find(row => row.id === created.id).amount, 250)
})
