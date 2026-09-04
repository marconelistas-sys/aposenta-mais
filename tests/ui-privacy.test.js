import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const { addScenario, deleteLocalData, replaceFinancialData, resetState, state } = await import('../src/app/state.js')
const { renderDashboard } = await import('../src/features/dashboard/dashboard.js')
const { renderPrivacy } = await import('../src/features/privacy/privacy.js')
const { renderSimulations } = await import('../src/features/simulations/simulations.js')
const { renderCashFlow } = await import('../src/features/cash-flow/cash-flow.js')

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

test('escapa HTML no nome de um cenário salvo', () => {
  resetState()
  addScenario('<img src=x onerror=alert(1)>', state.plan)

  const html = renderSimulations()

  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;img/)
})

test('exclusão remove dados persistidos sem restaurá-los', () => {
  resetState()
  addScenario('Privado', state.plan)
  memory.set('aposenta-plus-state-v1', '{"legado":true}')

  const result = deleteLocalData()

  assert.equal(result.success, true)
  assert.equal(memory.has('aposenta-plus-state-v1'), false)
  assert.equal(memory.has('aposenta-plus-state-v2'), false)
  assert.equal(memory.has('aposenta-plus-state-v3'), false)
  assert.equal(state.scenarios.length, 0)
  assert.equal(state.dataDeleted, true)
})

test('fluxo de caixa explica dados locais e oculta valores', () => {
  resetState()
  state.valuesHidden = true

  const html = renderCashFlow()

  assert.match(html, /Dados mantidos neste dispositivo/)
  assert.match(html, /Receitas eventuais não foram usadas/)
  assert.match(html, /R\$ •••••/)
})

test('aviso explica armazenamento, retenção, controles e limites', () => {
  const html = renderPrivacy()

  assert.match(html, /Entrar na conta não envia o plano automaticamente/i)
  assert.match(html, /consentimento/i)
  assert.match(html, /armazenamento local/i)
  assert.match(html, /até você usar “Apagar meus dados”/i)
  assert.match(html, /não criptografia/i)
  assert.match(html, /LGPD/)
})

test('restauração remota sanitiza dados e preserva preferências do dispositivo', () => {
  resetState()
  state.valuesHidden = true
  replaceFinancialData({
    plan: { currentAge: 51, secret: 'remover' },
    cashFlow: { recurringIncome: 18000 },
    scenarios: []
  })

  assert.equal(state.plan.currentAge, 51)
  assert.equal('secret' in state.plan, false)
  assert.equal(state.cashFlow.recurringIncome, 18000)
  assert.equal(state.valuesHidden, true)
})
