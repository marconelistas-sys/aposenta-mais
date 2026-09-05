import test from 'node:test'
import assert from 'node:assert/strict'
import { accountBalances, sanitizeLedger, validateMovement } from '../src/domain/accounts.js'
import { createExportableState, sanitizeStoredState } from '../src/app/state-storage.js'
const accounts = [{ id: 'a', name: 'BR', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 1000 }, { id: 'b', name: 'BR2', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 0 }, { id: 'c', name: 'CH', currency: 'CHF', openingDate: '2026-01-01', openingBalance: 10 }]
const transfer = { id: 'm', type: 'transfer', accountId: 'a', destinationId: 'b', date: '2026-02-01', amount: 100, receivedAmount: 100 }
test('transferência preserva total na mesma moeda e respeita data', () => {
  validateMovement(transfer, accounts)
  const ledger = { accounts, movements: [transfer] }
  assert.deepEqual(accountBalances(ledger, '2026-02-01').map(row => row.balance), [900, 100, 10])
  assert.equal(accountBalances(ledger, '2026-01-31')[0].balance, 1000)
  const fx = { ...transfer, destinationId: 'c', receivedAmount: 20 }
  validateMovement(fx, accounts)
  assert.deepEqual(accountBalances({ accounts, movements: [fx] }, '2026-02-01').map(row => row.balance), [900, 0, 30])
})
test('rejeita transferência ambígua e limpa referências inválidas', () => {
  for (const patch of [{ destinationId: 'a' }, { destinationId: 'missing' }, { receivedAmount: 90 }, { date: '2025-01-01' }, { date: '2026-02-30' }, { amount: -1 }]) assert.throws(() => validateMovement({ ...transfer, ...patch }, accounts))
  assert.equal(sanitizeLedger({ accounts, movements: [{ ...transfer, destinationId: 'missing' }] }).movements.length, 0)
})
test('contas viajam na exportação sem alterar patrimônio ou orçamento', () => {
  const source = sanitizeStoredState({ plan: { currentAssets: 123 }, cashFlow: { items: [], ledger: { accounts, movements: [transfer] } } })
  const restored = sanitizeStoredState(createExportableState(source))
  assert.equal(restored.cashFlow.ledger.movements.length, 1)
  assert.equal(restored.plan.currentAssets, 123)
  assert.deepEqual(restored.cashFlow.items, [])
})
test('saldos usam centavos sem resíduos de ponto flutuante', () => {
  const ledger = { accounts: [{ ...accounts[0], openingBalance: 0.1 }], movements: [{ ...transfer, type: 'income', amount: 0.2 }] }
  assert.equal(accountBalances(ledger, '2026-02-01')[0].balance, 0.3)
  assert.throws(() => validateMovement({ ...transfer, amount: 0.123 }, accounts))
})
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { changeAccounts } = await import('../src/app/accounts.js')
const { state } = await import('../src/app/state.js')
test('excluir conta com movimento exige remover movimento primeiro', () => {
  state.cashFlow.ledger = { accounts, movements: [transfer] }
  assert.throws(() => changeAccounts('delete-account', 'a'))
  changeAccounts('delete-movement', 'm')
  assert.equal(accountBalances(state.cashFlow.ledger, '2026-02-01')[0].balance, 1000)
  changeAccounts('delete-account', 'a')
  assert.equal(state.cashFlow.ledger.accounts.length, 2)
})
