import test from 'node:test'
import assert from 'node:assert/strict'
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const { saveGuidedBudget, beginGuidedPlan } = await import('../src/app/guided-plan.js')
const { state } = await import('../src/app/state.js')
const { renderBudgetStep } = await import('../src/features/welcome/budget-step.js')
test('cadastro guiado preserva moeda, frequência e datas', () => {
  beginGuidedPlan()
  saveGuidedBudget(new Map(Object.entries({ categoryId: 'housing', amount: '1200', currency: 'CHF', frequency: 'annual', startDate: '2027-02-20', endMode: 'date', endDate: '2028-02-29', description: 'Seguro' })))
  assert.equal(state.cashFlow.items[0].currency, 'CHF')
  assert.equal(state.cashFlow.items[0].frequency, 'annual')
  assert.equal(state.cashFlow.items[0].endDate, '2028-02-29')
  assert.match(renderBudgetStep(), /Moeda do lançamento/)
  assert.match(renderBudgetStep(), /Anual/)
})
test('data impossível, único sem data e intervalo invertido não salvam', () => {
  const before = JSON.stringify(state)
  const base = { categoryId: 'salary', amount: '1000', currency: 'USD', frequency: 'occasional', endMode: 'none' }
  for (const patch of [{}, { startDate: '2027-02-30' }, { startDate: '2027-03-01', endMode: 'date', endDate: '2027-01-01' }]) assert.throws(() => saveGuidedBudget(new Map(Object.entries({ ...base, ...patch }))))
  assert.equal(JSON.stringify(state), before)
})
