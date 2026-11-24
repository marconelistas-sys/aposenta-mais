import test from 'node:test'
import assert from 'node:assert/strict'

const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key)
}

const {
  addCashFlowItem,
  addCustomCategory,
  addScenario,
  loadScenario,
  resetState,
  state,
  updateCashFlowItem,
  updatePlan
} = await import('../src/app/state.js')
const { renderSimulations } = await import('../src/features/simulations/simulations.js')

test('salva e restaura plano, orçamento e moeda do cenário', () => {
  resetState()
  addCashFlowItem({
    type: 'expense',
    categoryId: 'health',
    description: 'Plano de saúde',
    amount: 350,
    currency: 'CHF',
    frequency: 'monthly'
  })
  addScenario('Base familiar', { ...state.plan, retirementAge: 67, annualRealReturn: 0.04 })
  const scenario = state.scenarios[0]

  updatePlan({ retirementAge: 70 })
  state.cashFlow.items.length = 0
  loadScenario(scenario.id)

  assert.equal(state.plan.retirementAge, 67)
  assert.equal(state.plan.annualRealReturn, 0.04)
  assert.ok(state.cashFlow.items.some((item) => item.description === 'Plano de saúde'))
  assert.equal(state.currency, scenario.currency)
})

test('cria categoria e aceita lançamento associado', () => {
  resetState()
  addCustomCategory('Animais', 'expense')
  const category = state.customCategories.find((item) => item.name === 'Animais')

  addCashFlowItem({
    type: 'expense',
    categoryId: category.id,
    description: 'Veterinário',
    amount: 200,
    currency: 'BRL',
    frequency: 'occasional'
  })

  assert.ok(state.cashFlow.items.some((item) => item.categoryId === category.id))
})

test('edita lançamento sem trocar identificador ou origem', () => {
  resetState()
  addCashFlowItem({
    type: 'expense',
    categoryId: 'groceries',
    description: 'Compra importada',
    amount: 100,
    currency: 'BRL',
    frequency: 'occasional',
    startDate: '2026-09-04',
    recordKind: 'actual',
    imported: true
  })
  const original = state.cashFlow.items.at(-1)

  const updated = updateCashFlowItem(original.id, {
    categoryId: 'health',
    type: 'expense',
    description: 'Farmácia corrigida',
    amount: 125,
    currency: 'CHF',
    frequency: 'monthly',
    startDate: '2026-09-05',
    recordKind: 'planned'
  })

  assert.equal(updated.id, original.id)
  assert.equal(updated.source, 'txt')
  assert.equal(updated.recordKind, 'actual')
  assert.equal(updated.frequency, 'occasional')
  assert.equal(updated.description, 'Farmácia corrigida')
  assert.equal(updated.amount, 125)
})

test('rejeita edição inválida sem alterar o lançamento', () => {
  resetState()
  const original = state.cashFlow.items[0]

  assert.throws(() => updateCashFlowItem(original.id, {
    recordKind: 'actual',
    startDate: '',
    endDate: ''
  }), /Informe a data/)
  assert.deepEqual(state.cashFlow.items[0], original)
})

test('simulações comparam o planejamento completo sem exigir salvar e preservam carregar cenário', () => {
  resetState()
  addScenario('Conservador', { ...state.plan, annualRealReturn: 0.03 })
  const html = renderSimulations()
  assert.match(html, /O que sua decisão muda ao longo da vida/)
  assert.match(html, /Patrimônio financeiro, ano a ano/)
  assert.match(html, /data-simulation-reference/)
  assert.match(html, /Conservador<\/option>/)
  assert.match(html, /data-load-scenario=/)
  assert.match(html, /3% real ao ano/)
  assert.match(html, /Consultar valores de todos os anos/)
  assert.equal((html.match(/data-chart-toggle=/g) || []).length, 2)
  assert.match(html, /Hipótese em teste/)
  assert.match(html, /Primeiro ano com falta de liquidez/)
})
