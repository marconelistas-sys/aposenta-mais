import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, loadStoredState, storageKeys, createExportableState } from '../src/app/state-storage.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'

const income = { id: 'salary', type: 'income', categoryId: 'salary', amount: 5000, currency: 'BRL', frequency: 'monthly', endMode: 'retirement' }
test('mover aposentadoria afeta só vínculos, sem alterar datas manuais ou rendimentos', () => {
  const state = sanitizeStoredState({ cashFlow: { retirementMonth: '2028-03', items: [income, { ...income, id: 'manual', amount: 100, endMode: 'date', endDate: '2028-02-29' }] } })
  const plan = JSON.stringify(state.plan)
  assert.deepEqual(cashFlowTimeline(state, '2028-02', 2).map(row => row.income), [5100, 0])
  state.cashFlow.retirementMonth = '2028-04'
  assert.deepEqual(cashFlowTimeline(state, '2028-02', 3).map(row => row.income), [5100, 5000, 0])
  assert.equal(calculateMultiCurrencyCashFlow(state.cashFlow, 'BRL', state.exchangeRates, 0, [], new Date('2028-04-01')).monthlyIncome, 0)
  assert.equal(state.cashFlow.items[1].endDate, '2028-02-29')
  assert.equal(JSON.stringify(state.plan), plan)
})

test('migração v9 preserva datas e versão nova mantém campos na exportação e payload remoto', () => {
  const map = new Map([[storageKeys.previous, JSON.stringify({ version: 9, cashFlow: { items: [{ ...income, endMode: undefined, endDate: '2029-01-31' }] } })]])
  const migrated = loadStoredState({ getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) })
  assert.equal(migrated.version, 10)
  assert.equal(migrated.cashFlow.items[0].endMode, 'date')
  assert.equal(migrated.cashFlow.retirementMonth, null)
  const source = sanitizeStoredState({ cashFlow: { retirementMonth: '2029-02', items: [income] } })
  const restored = sanitizeStoredState(financialPayload(createExportableState(source)))
  assert.equal(restored.cashFlow.retirementMonth, '2029-02')
  assert.equal(restored.cashFlow.items[0].endMode, 'retirement')
})

test('vínculo sem mês não presume renda e lançamento realizado não ganha vínculo', () => {
  const state = sanitizeStoredState({ cashFlow: { retirementMonth: 'bad', items: [income] } })
  assert.equal(cashFlowTimeline(state, '2028-02', 1)[0].income, 0)
  const actual = sanitizeStoredState({ cashFlow: { items: [{ ...income, recordKind: 'actual', startDate: '2028-02-01' }] } })
  assert.equal(actual.cashFlow.items[0].endMode, 'none')
})

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const { state, resetState, addCashFlowItem, updateCashFlowItem, setBudgetRetirementMonth } = await import('../src/app/state.js')
test('cadastro exige mês confirmado e edição permite voltar à data manual', () => {
  resetState()
  assert.throws(() => addCashFlowItem(income), /Confirme/)
  setBudgetRetirementMonth('2029-02')
  addCashFlowItem(income)
  const item = state.cashFlow.items.at(-1)
  assert.equal(item.endMode, 'retirement')
  updateCashFlowItem(item.id, { endMode: 'date', endDate: '2028-12-31' })
  assert.equal(state.cashFlow.items.at(-1).endMode, 'date')
  assert.throws(() => setBudgetRetirementMonth('2029-13'))
  assert.throws(() => addCashFlowItem({ ...income, frequency: 'occasional' }))
})
