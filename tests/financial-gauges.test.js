import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetGauge } from '../src/shared/budget-gauge.js'
import { readinessGauge } from '../src/shared/readiness-gauge.js'

test('budget circle uses income as fixed basis and preserves overspending', () => {
  const html = budgetGauge({ income: 2000, expenses: 3000 })
  assert.match(html, /150%/)
  assert.match(html, /Excede as receitas em 50%/)
  assert.match(html, /stroke-dasharray="100.000 100"/)
  assert.match(html, /Círculo completo = 100% das receitas/)
  assert.match(budgetGauge({ income: 2000, expenses: 1500 }), /25% das receitas ainda livres/)
  assert.match(budgetGauge({ income: 2000, expenses: 2000 }), /Toda a receita comprometida/)
})

test('unknown, zero, negative and unrepresentable budget inputs never produce a circle', () => {
  for (const [income, expenses] of [[0, 100], [100, 0], [undefined, 100], [NaN, 100], [-10, 100], [100, -10], [100, Infinity], [Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const html = budgetGauge({ income, expenses })
    assert.doesNotMatch(html, /<svg|NaN|Infinity|stroke-dasharray/)
  }
})

test('hidden instruments omit proportions, geometry and derived statuses', () => {
  for (const value of [.1, .95, 1.5, NaN]) {
    assert.equal(budgetGauge({ income: 1, expenses: value, hidden: true }), budgetGauge({ hidden: true }))
    assert.equal(readinessGauge({ progress: value, hidden: true }), readinessGauge({ hidden: true }))
    assert.doesNotMatch(readinessGauge({ progress: value, hidden: true }), /<svg|stroke|%|--good|--behind/)
  }
})

test('readiness distinguishes absent data, zero, incomplete goals and exceeded goals', () => {
  for (const progress of [undefined, NaN, Infinity, -1, Number.MAX_VALUE]) {
    assert.match(readinessGauge({ progress }), /Dados insuficientes/)
    assert.doesNotMatch(readinessGauge({ progress }), /<svg/)
  }
  assert.match(readinessGauge({ progress: 0 }), /0%/)
  assert.doesNotMatch(readinessGauge({ progress: .95 }), /--good|Meta de patrimônio atingida/)
  assert.match(readinessGauge({ progress: 1 }), /Meta de patrimônio atingida na projeção/)
  assert.match(readinessGauge({ progress: 1.5 }), /150%/)
  assert.match(readinessGauge({ progress: 1.5 }), /O percentual mostra o excedente/)
})
