import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseStoredState,
  sanitizePlan,
  sanitizeStoredState,
  stateVersion
} from '../src/app/state-storage.js'

test('recupera estado padrão quando o armazenamento contém null ou JSON inválido', () => {
  assert.equal(parseStoredState('null').version, stateVersion)
  assert.equal(parseStoredState('{invalido').version, stateVersion)
})

test('ignora números inválidos e propriedades desconhecidas do plano', () => {
  const plan = sanitizePlan({ currentAge: '40', currentAssets: -1, unknown: 123 })
  assert.equal(plan.currentAge, 39)
  assert.equal(plan.currentAssets, 120000)
  assert.equal('unknown' in plan, false)
})

test('migra estado antigo e limita cenários a três', () => {
  const scenarios = Array.from({ length: 5 }, (_, index) => ({
    id: `s-${index}`,
    name: `Cenário ${index}`,
    plan: {}
  }))
  const state = sanitizeStoredState({ activeChartRange: 'invalid', scenarios })

  assert.equal(state.version, stateVersion)
  assert.equal(state.activeChartRange, 'retirement')
  assert.equal(state.scenarios.length, 3)
})

test('preserva um plano salvo na versão antiga como dado do usuário', () => {
  const state = sanitizeStoredState({ plan: { currentAge: 45 } })
  assert.equal(state.plan.currentAge, 45)
  assert.equal(state.isDemo, false)
})
