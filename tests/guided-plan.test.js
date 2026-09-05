import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, upsertInvestment } = await import('../src/app/state.js')
const { beginGuidedPlan, saveGuidedGoal, saveGuidedAssets } = await import('../src/app/guided-plan.js')
const { renderGuidedPlan } = await import('../src/features/welcome/guided-plan.js')
const { projectRetirement } = await import('../src/domain/retirement.js')
const { loadStoredState } = await import('../src/app/state-storage.js')

test('início guiado remove saldos demonstrativos, mas preserva planos reais', () => {
  resetState()
  beginGuidedPlan()
  assert.equal(state.plan.currentAssets, 0)
  assert.equal(state.plan.monthlyContribution, 0)
  assert.deepEqual(state.cashFlow.items, [])
  assert.equal(state.isDemo, false)
  saveGuidedAssets(new Map([['currentAssets', '100000'], ['monthlyContribution', '500']]))
  const before = JSON.stringify(state)
  beginGuidedPlan()
  assert.equal(JSON.stringify(state), before)
})

test('objetivo inválido não altera estado e taxa informada é mantida', () => {
  const data = new Map([['currentAge', '40'], ['retirementAge', '65'], ['targetMonthlyIncome', '7000'], ['expectedMonthlyBenefit', '2000'], ['annualRealReturn', '3.25'], ['retirementMonth', '2051-09']])
  saveGuidedGoal(data)
  assert.equal(state.plan.annualRealReturn, 0.0325)
  const before = JSON.stringify(state)
  data.set('retirementAge', '39')
  assert.throws(() => saveGuidedGoal(data))
  assert.equal(JSON.stringify(state), before)
})

test('patrimônio inicial chega ao motor, persiste e não duplica investimentos', () => {
  saveGuidedAssets(new Map([['currentAssets', '100000'], ['monthlyContribution', '0']]))
  const result = projectRetirement({ ...state.plan, annualRealReturn: 0 })
  assert.equal(result.currentAssets, 100000)
  assert.equal(result.projectedAssets, 100000)
  const persisted = loadStoredState(globalThis.localStorage)
  assert.equal(persisted.plan.currentAssets, 100000)
  upsertInvestment({ id: 'one', name: 'Investimento', amount: 70000, monthlyContribution: 400, returnType: 'default' })
  saveGuidedAssets(new Map([['currentAssets', '999999'], ['monthlyContribution', '9999']]))
  assert.equal(state.plan.currentAssets, 70000)
  assert.equal(projectRetirement({ ...state.plan, annualRealReturn: 0 }).currentAssets, 70000)
})

test('quatro etapas renderizam e revisão mostra patrimônio e limites', () => {
  for (const step of ['objetivo', 'orcamento', 'patrimonio', 'revisao']) {
    assert.match(renderGuidedPlan(step), /aria-current="step"/)
  }
  assert.match(renderGuidedPlan('revisao'), /Patrimônio inicial considerado/)
  assert.match(renderGuidedPlan('revisao'), /aportes informados constantes/)
  state.valuesHidden = true
  assert.doesNotMatch(renderGuidedPlan('patrimonio'), /70\.000/)
})

test('botão Adicionar possui linha própria e adaptação móvel no CSS', async () => {
  const css = await readFile(new URL('../src/styles/app.css', import.meta.url), 'utf8')
  assert.match(css, /\.cash-entry-grid > button\[type='submit'\] \{\s*grid-column: 1 \/ -1;/)
  assert.match(css, /\.cash-entry-grid > button\[type='submit'\], \.welcome-actions > \.button \{ width: 100%; \}/)
})
