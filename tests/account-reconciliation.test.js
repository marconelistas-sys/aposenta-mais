import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileAccount } from '../src/domain/account-reconciliation.js'
const ledger = { accounts: [{ id: 'a', name: 'Conta', currency: 'CHF', openingBalance: 100, openingDate: '2026-01-01' }], movements: [{ id: 'm', type: 'expense', accountId: 'a', amount: 20, date: '2026-02-01' }] }
test('conciliação respeita a data e calcula diferença sem ajustar o saldo', () => {
  const before = JSON.stringify(ledger)
  assert.equal(reconcileAccount(ledger, { accountId: 'a', date: '2026-01-31', reportedBalance: 100 }, '2026-03-01').matches, true)
  const result = reconcileAccount(ledger, { accountId: 'a', date: '2026-02-01', reportedBalance: 85 }, '2026-03-01')
  assert.equal(result.difference, 5)
  assert.equal(result.currency, 'CHF')
  assert.equal(JSON.stringify(ledger), before)
})
test('rejeita conta ausente, data futura, data anterior à abertura e saldo inválido', () => {
  const input = { accountId: 'a', date: '2026-02-01', reportedBalance: 80 }
  for (const patch of [{ accountId: 'x' }, { date: '2026-04-01' }, { date: '2025-12-31' }, { reportedBalance: NaN }, { reportedBalance: 1.234 }]) assert.throws(() => reconcileAccount(ledger, { ...input, ...patch }, '2026-03-01'))
})
test('conferência atualiza após correção do movimento', () => {
  const corrected = { ...ledger, movements: [{ ...ledger.movements[0], amount: 15 }] }
  assert.equal(reconcileAccount(corrected, { accountId: 'a', date: '2026-02-01', reportedBalance: 85 }, '2026-03-01').matches, true)
})
