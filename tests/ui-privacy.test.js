import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value)
}

const { addScenario, resetState, state } = await import('../src/app/state.js')
const { renderDashboard } = await import('../src/features/dashboard/dashboard.js')
const { renderSimulations } = await import('../src/features/simulations/simulations.js')

test('oculta valores dos cenários e do texto acessível do gráfico', () => {
  resetState()
  state.valuesHidden = true
  addScenario('Aposentar antes', state.plan)

  const scenarios = renderSimulations()
  const dashboard = renderDashboard()

  assert.match(scenarios, /scenario-card[\s\S]*R\$ •••••/)
  assert.match(dashboard, /Projeção calculada de patrimônio em \d+ anos\. Valores ocultos\./)
})

test('limita a persistência a três cenários', () => {
  resetState()
  addScenario('Um', state.plan)
  addScenario('Dois', state.plan)
  addScenario('Três', state.plan)
  assert.throws(() => addScenario('Quatro', state.plan), /até três cenários/)
})

