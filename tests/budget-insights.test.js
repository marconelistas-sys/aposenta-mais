import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeBudget } from '../src/domain/budget-insights.js'
import { renderBudgetInsights } from '../src/features/cash-flow/budget-insights.js'

const points = [
  { month: '2028-02', income: 1100, expenses: 1000 },
  { month: '2028-03', income: 900, expenses: 1000 },
  { month: '2029-03', income: 1200, expenses: 1000 }
]
test('reserva cobre despesas e sensibilidade inclui orçamento original sem mutação', () => {
  const original = JSON.stringify(points)
  const result = analyzeBudget(points, 6000, '2028-03')
  assert.equal(result.coverageMonths, 6)
  assert.equal(result.sensitivity[1].firstDeficit, '2028-03')
  assert.equal(result.sensitivity[1].worstBalance, -100)
  assert.equal(result.sensitivity[0].deficitMonths, 0)
  assert.equal(result.sensitivity[3].deficitMonths, 2)
  assert.equal(result.checkpoints[0].point.income, 1100)
  assert.equal(result.checkpoints[1].point.income, 900)
  assert.equal(result.checkpoints[2].point.income, 1200)
  assert.equal(JSON.stringify(points), original)
})
test('ausência de despesas, reserva zero e períodos fora da série têm estados explícitos', () => {
  assert.equal(analyzeBudget([{ month: '2028-01', income: 0, expenses: 0 }], 10).coverageMonths, null)
  assert.equal(analyzeBudget(points, 0).coverageMonths, 0)
  assert.equal(analyzeBudget(points, 0, '2030-01').checkpoints[0].point, null)
  assert.throws(() => analyzeBudget([], 0))
  assert.throws(() => analyzeBudget(points, -1))
  assert.throws(() => analyzeBudget([{ income: NaN, expenses: 0 }], 0))
})
test('interface oculta resultados financeiros e explica limites das adaptações', () => {
  const state = { currency: 'BRL', valuesHidden: true, cashFlow: { currentEmergencyReserve: 6000, retirementMonth: '2028-03' } }
  const html = renderBudgetInsights(state, points)
  assert.match(html, /Valor oculto/)
  assert.match(html, /•••••/)
  assert.doesNotMatch(html, /6\.0 meses|1\.100|1\.000/)
  assert.match(html, /Não soma investimentos/)
  assert.match(html, /Orçamento cadastrado/)
})
