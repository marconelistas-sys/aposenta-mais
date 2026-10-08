import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, upsertStatementItems } = await import('../src/app/state.js')
const { sanitizeStoredState } = await import('../src/app/state-storage.js')
const holding = () => ({ id: 'bb', name: 'BB Rende Fácil', amount: 1000, currency: 'BRL', monthlyContribution: 50, assetClass: 'fixed-income', liquidity: 'available', returnType: 'default', balanceAsOf: '2025-12-31' })
const snapshot = (patch = {}) => ({ name: 'BB RENDE FACIL', amount: 2500, currency: 'BRL', asOfDate: '2026-01-31', sourceAccount: 'BB:1234-5:6789-0', ...patch })

test('balance-only import updates portfolio totals and persists its source and date without a budget entry', () => {
  state.currency = 'BRL'
  state.plan.investments = [holding()]
  state.cashFlow.items = []
  assert.deepEqual(upsertStatementItems([], { investmentBalances: [snapshot()] }), { added: 0, updated: 0, investmentUpdated: 1 })
  assert.equal(state.plan.currentAssets, 2500)
  assert.equal(state.cashFlow.items.length, 0)
  const restored = sanitizeStoredState(JSON.parse(JSON.stringify(state)))
  assert.equal(restored.plan.investments[0].balanceAsOf, '2026-01-31')
  assert.equal(restored.plan.investments[0].statementAccount, 'BB:1234-5:6789-0')
  assert.equal(restored.plan.investments[0].balanceSource, 'statement')
  Object.assign(state, restored)
  assert.deepEqual(upsertStatementItems([], { investmentBalances: [snapshot({ amount: 500 })] }), { added: 0, updated: 0 })
  assert.equal(state.plan.currentAssets, 2500)
})

test('invalid or failed storage never partially updates investment balances', () => {
  state.plan.investments = [holding()]
  const before = JSON.stringify(state)
  assert.throws(() => upsertStatementItems([], { investmentBalances: [snapshot(), snapshot({ amount: NaN })] }), /inválido/)
  assert.equal(JSON.stringify(state), before)
  const original = globalThis.localStorage.setItem
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  try {
    assert.throws(() => upsertStatementItems([], { investmentBalances: [snapshot()] }), /QuotaExceededError/)
    assert.equal(JSON.stringify(state), before)
  } finally { globalThis.localStorage.setItem = original }
})
