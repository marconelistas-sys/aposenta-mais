import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { state } = await import('../src/app/state.js')
const { changeAccounts } = await import('../src/app/accounts.js')
const { accountBalances } = await import('../src/domain/accounts.js')
const asData = value => new Map(Object.entries(value).map(([key, value]) => [key, value === null ? '' : String(value)]))
test('edita saldo e nome preservando movimento e identidade', () => {
  state.cashFlow.ledger = { accounts: [{ id: 'a', name: 'A', currency: 'BRL', openingBalance: 100, openingDate: '2026-01-01' }], movements: [{ id: 'm', type: 'expense', accountId: 'a', amount: 10, date: '2026-02-01' }] }
  changeAccounts('account', asData({ ...state.cashFlow.ledger.accounts[0], name: 'Corrigido', openingBalance: 200 }))
  assert.equal(state.cashFlow.ledger.accounts[0].id, 'a')
  assert.equal(state.cashFlow.ledger.movements[0].id, 'm')
  assert.equal(accountBalances(state.cashFlow.ledger, '2026-03-01')[0].balance, 190)
})
test('moeda incompatível, conta inexistente e data posterior aos movimentos não alteram dados', () => {
  const before = JSON.stringify(state)
  for (const patch of [{ currency: 'CHF' }, { openingDate: '2026-03-01' }, { id: 'missing' }]) assert.throws(() => changeAccounts('account', asData({ ...state.cashFlow.ledger.accounts[0], ...patch })))
  assert.equal(JSON.stringify(state), before)
})
test('editar movimento substitui original sem duplicar lançamento', () => {
  changeAccounts('movement', asData({ ...state.cashFlow.ledger.movements[0], amount: 20 }))
  assert.equal(state.cashFlow.ledger.movements.length, 1)
  assert.equal(accountBalances(state.cashFlow.ledger, '2026-03-01')[0].balance, 180)
})
