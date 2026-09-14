import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, addScenario } = await import('../src/app/state.js')
const { sanitizePlan, serializeExportableState, parseStoredState } = await import('../src/app/state-storage.js')
const { renderSimulations } = await import('../src/features/simulations/simulations.js')
const { projectRetirementWithSchedules } = await import('../src/domain/retirement.js')

function numericInputs(html) {
  return [...html.matchAll(/<input\s[\s\S]*?\/>/g)].map(([tag]) => Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))).filter(input => input.type === 'number')
}

for (const [label, amounts] of [
  ['patrimônio com centavos', { currentAssets: 123456.78, monthlyContribution: 1234.56, targetMonthlyIncome: 4567.89, expectedMonthlyBenefit: 2345.67 }],
  ['valores convertidos de moeda sem arredondamento destrutivo', { currentAssets: 987654.321987, monthlyContribution: 1234.56789, targetMonthlyIncome: 5432.19876, expectedMonthlyBenefit: 2345.98765 }],
  ['limites aceitos pelo armazenamento', { currentAssets: 1000000000, monthlyContribution: 10000000, targetMonthlyIncome: 10000000, expectedMonthlyBenefit: 1000000 }]
]) {
  test(`novo cenário aceita ${label} ao editar apenas a idade e preserva valores ao salvar`, () => {
    resetState()
    state.plan = sanitizePlan({ ...state.plan, investments: [], ...amounts, annualRealReturn: 0.04321, annualInflation: 0.02345, annualWithdrawalRate: 0.03765 })
    const original = structuredClone(state.plan)
    const inputs = numericInputs(renderSimulations())
    const edited = { ...state.plan }
    for (const input of inputs) {
      const value = Number(input.value)
      assert.ok(Number.isFinite(value), input.name)
      assert.ok(value >= Number(input.min) && value <= Number(input.max), `${input.name} rejeita valor armazenado`)
      if (!['currentAge', 'retirementAge'].includes(input.name)) assert.equal(input.step, 'any', `${input.name} não deve exigir múltiplos de um incremento`)
      edited[input.name] = input.name.startsWith('annual') ? value / 100 : value
    }
    edited.retirementAge += 1
    projectRetirementWithSchedules(edited, [])
    addScenario('Alteração de idade', edited)
    const restored = parseStoredState(serializeExportableState(state))
    for (const [field, value] of Object.entries(amounts)) assert.equal(restored.scenarios[0].plan[field], value)
    assert.equal(restored.scenarios[0].plan.retirementAge, original.retirementAge + 1)
    assert.deepEqual(state.plan, original)
  })
}
