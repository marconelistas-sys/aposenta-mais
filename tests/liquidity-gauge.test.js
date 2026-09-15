import test from 'node:test'
import assert from 'node:assert/strict'
import { liquidityGauge } from '../src/shared/liquidity-gauge.js'

test('circle segments split the total by available, restricted and unknown liquidity', () => {
  const html = liquidityGauge({ available: 600, restricted: 300, unknown: 100 })
  assert.match(html, /60%/)
  assert.match(html, /Disponível para resgate — 60%/)
  assert.match(html, /Restrita ou com prazo — 30%/)
  assert.match(html, /Não informada — 10%/)
  assert.match(html, /stroke-dasharray="60.000 100"/)
  assert.match(html, /stroke-dasharray="30.000 100"/)
  assert.match(html, /stroke-dasharray="10.000 100"/)
})

test('a single funded category fills the whole circle without drawing empty segments', () => {
  const html = liquidityGauge({ available: 1000, restricted: 0, unknown: 0 })
  assert.match(html, /100%.*disponível/s)
  assert.equal((html.match(/liquidity-gauge-segment/g) || []).length, 1)
  assert.match(html, /Restrita ou com prazo — 0%/)
  assert.match(html, /Não informada — 0%/)
})

test('zero total, negative and non-finite balances never draw a circle', () => {
  for (const values of [
    { available: 0, restricted: 0, unknown: 0 },
    { available: -10, restricted: 0, unknown: 0 },
    { available: NaN, restricted: 0, unknown: 0 },
    { available: 10, restricted: Infinity, unknown: 0 },
    { available: undefined, restricted: 0, unknown: 0 }
  ]) {
    const html = liquidityGauge(values)
    assert.doesNotMatch(html, /<svg|NaN|Infinity|stroke-dasharray/)
  }
})

test('hidden mode omits proportions, geometry and any derived percentage', () => {
  const html = liquidityGauge({ available: 600, restricted: 300, unknown: 100, hidden: true })
  assert.doesNotMatch(html, /<svg|stroke|%|600|300|100/)
})

test('rounded shares still expose the exact accessible label', () => {
  const html = liquidityGauge({ available: 1, restricted: 1, unknown: 1 })
  assert.match(html, /aria-label="Distribuição da liquidez da carteira: 33,3% disponível para resgate"/)
})
