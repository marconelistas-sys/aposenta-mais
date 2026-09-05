import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeLiquidity } from '../src/domain/liquidity.js'
import { sanitizePlan, createExportableState, sanitizeStoredState } from '../src/app/state-storage.js'
test('liquidez nunca é inferida pela classe e agregado fica não informado', () => {
  const plan = sanitizePlan({ currentAssets: 10000 })
  assert.equal(summarizeLiquidity(plan, 1000).available, 0)
  assert.equal(summarizeLiquidity(plan, 1000).unknown, 10000)
  assert.equal(summarizeLiquidity(plan, 0).coverageMonths, null)
})
test('soma categorias, calcula cobertura e preserva classificação na exportação', () => {
  const state = sanitizeStoredState({ plan: { investments: [
    { id: 'a', name: 'A', amount: 6000, liquidity: 'available' },
    { id: 'b', name: 'B', amount: 2000, liquidity: 'restricted' },
    { id: 'c', name: 'C', amount: 1000 }
  ] } })
  const result = summarizeLiquidity(state.plan, 1000)
  assert.deepEqual(result, { available: 6000, restricted: 2000, unknown: 1000, total: 9000, coverageMonths: 6 })
  assert.equal(createExportableState(state).plan.investments[0].liquidity, 'available')
  assert.equal(createExportableState(state).plan.investments[0].returnType, 'default')
})
