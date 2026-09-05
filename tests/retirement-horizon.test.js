import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { projectRetirement, projectAssetSeriesWithSchedules, retirementMonths } from '../src/domain/retirement.js'
const date = new Date('2026-01-01T00:00:00Z')
test('mês confirmado alinha motor e último ponto parcial do gráfico', () => {
  const state = sanitizeStoredState({ plan: { currentAge: 40, retirementAge: 65, currentAssets: 1000, monthlyContribution: 100, annualRealReturn: 0 }, cashFlow: { retirementMonth: '2027-02' } })
  assert.equal(retirementMonths(state.plan, date), 13)
  const projection = projectRetirement(state.plan, date)
  const series = projectAssetSeriesWithSchedules(state.plan, [], undefined, date)
  assert.equal(projection.projectedAssets, 2300)
  assert.equal(series.at(-1).assets, projection.projectedAssets)
  assert.equal(series.at(-1).year, 13 / 12)
})
test('mês já alcançado não cria aportes e planos antigos seguem idades', () => {
  const state = sanitizeStoredState({ plan: { currentAge: 40, retirementAge: 41 }, cashFlow: { retirementMonth: '2025-12' } })
  assert.equal(projectRetirement(state.plan, date).noTimeRemaining, true)
  assert.equal(projectAssetSeriesWithSchedules(state.plan, [], undefined, date).length, 1)
  assert.equal(retirementMonths({ ...state.plan, retirementMonth: null }, date), 12)
})
