import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'
const date = new Date('2026-01-01T00:00:00Z')
const fixture = endDate => sanitizeStoredState({ plan: { currentAge: 40, retirementAge: 41, currentAssets: 10000, monthlyContribution: 100, annualRealReturn: 0 }, cashFlow: { currentEmergencyReserve: 0, emergencyReserveTarget: 0, items: [{ id: 'salary', categoryId: 'salary', type: 'income', amount: 1000, currency: 'BRL', frequency: 'monthly', endDate }] } })
test('salário encerrado interrompe aportes, preservando capital inicial e estado', () => {
  const state = fixture('2026-06-30')
  const original = JSON.stringify(state)
  const result = compareVariableContributions(state, date)
  assert.equal(result.projectedAssets, 10600)
  assert.equal(result.baseline.projectedAssets, 11200)
  assert.equal(result.firstReducedMonth, '2026-07')
  assert.equal(result.reducedMonths, 6)
  assert.equal(JSON.stringify(state), original)
})
test('capacidade suficiente reproduz aporte constante com retorno específico', () => {
  const state = fixture(null)
  state.plan.investments = [{ amount: 10000, monthlyContribution: 100, returnType: 'real', returnValue: 0.07 }]
  const result = compareVariableContributions(state, date)
  assert.ok(Math.abs(result.projectedAssets - result.baseline.projectedAssets) < 1e-6)
})
test('reserva é formada sem aporte extra e déficit fica explicitamente não financiado', () => {
  const state = fixture('2026-01-31')
  state.cashFlow.emergencyReserveTarget = 1000
  state.cashFlow.reserveBuildMonths = 1
  state.cashFlow.items.push({ id: 'e', categoryId: 'housing', type: 'expense', amount: 500, currency: 'BRL', frequency: 'monthly' })
  const result = compareVariableContributions(state, date)
  assert.equal(result.contributionTotal, 0)
  assert.equal(result.projectedAssets, 10000)
  assert.equal(result.deficitTotal, 5500)
})
test('previdência mensal entra uma vez quando capacidade suporta todos os aportes', () => {
  const state = fixture(null)
  state.cashFlow.items.push({ id: 'p', categoryId: 'private-pension', type: 'expense', amount: 50, currency: 'BRL', frequency: 'monthly' })
  const result = compareVariableContributions(state, date)
  assert.equal(result.projectedAssets, 11800)
  assert.equal(result.projectedAssets, result.baseline.projectedAssets)
})
