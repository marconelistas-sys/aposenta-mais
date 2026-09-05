import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'
const date = new Date('2026-01-01T00:00:00Z')
const fixture = liquidity => sanitizeStoredState({ plan: { currentAge: 40, retirementAge: 41, annualRealReturn: 0, investments: [{ id: 'a', name: 'A', amount: 1000, monthlyContribution: 0, liquidity, returnType: 'default' }] }, cashFlow: { currentEmergencyReserve: 0, emergencyReserveTarget: 0, items: [{ id: 'e', type: 'expense', categoryId: 'housing', amount: 100, currency: 'BRL', frequency: 'monthly' }] } })
test('déficits consomem saldo disponível sem criar saldo negativo', () => {
  const state = fixture('available')
  const before = JSON.stringify(state)
  const result = compareVariableContributions(state, date, { withdrawDeficits: true })
  assert.equal(result.projectedAssets, 0)
  assert.equal(result.withdrawnTotal, 1000)
  assert.equal(result.unfundedTotal, 200)
  assert.equal(result.firstUnfundedMonth, '2026-11')
  assert.equal(JSON.stringify(state), before)
})
test('liquidez restrita ou desconhecida e reserva não financiam resgate automático', () => {
  for (const liquidity of ['restricted', 'unknown']) {
    const state = fixture(liquidity)
    state.cashFlow.currentEmergencyReserve = 99999
    const result = compareVariableContributions(state, date, { withdrawDeficits: true })
    assert.equal(result.withdrawnTotal, 0)
    assert.equal(result.projectedAssets, 1000)
    assert.equal(result.unfundedTotal, 1200)
  }
})
test('comparação padrão continua sem retiradas', () => {
  const result = compareVariableContributions(fixture('available'), date)
  assert.equal(result.projectedAssets, 1000)
  assert.equal(result.withdrawnTotal, 0)
})
