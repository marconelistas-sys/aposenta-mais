import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryDonut } from '../src/shared/category-donut.js'

test('segments are drawn with a small gap and listed in the legend with their label and value', () => {
  const html = categoryDonut({
    segments: [
      { key: 'moradia', label: 'Moradia', value: 600, valueLabel: 'R$ 600,00' },
      { key: 'saude', label: 'Saúde', value: 300, valueLabel: 'R$ 300,00' },
      { key: 'other', label: 'Outras categorias', value: 100, valueLabel: 'R$ 100,00' }
    ]
  })
  assert.equal((html.match(/category-donut-segment/g) || []).length, 3)
  assert.match(html, /stroke-dasharray="59.400 100"/)
  assert.match(html, /stroke-dasharray="29.400 100"/)
  assert.match(html, /stroke-dasharray="9.400 100"/)
  assert.match(html, /Moradia — R\$ 600,00 · 60%/)
  assert.match(html, /Saúde — R\$ 300,00 · 30%/)
  assert.match(html, /Outras categorias — R\$ 100,00 · 10%/)
})

test('a single segment fills the whole circle without a gap', () => {
  const html = categoryDonut({ segments: [{ key: 'fixed-income', label: 'Renda fixa', value: 1000, valueLabel: 'R$ 1.000,00' }] })
  assert.equal((html.match(/category-donut-segment/g) || []).length, 1)
  assert.match(html, /stroke-dasharray="100.000 100"/)
})

test('the "other" bucket always uses the muted color regardless of its position', () => {
  const html = categoryDonut({ segments: [{ key: 'other', label: 'Outras categorias', value: 100, valueLabel: 'R$ 100,00' }] })
  assert.match(html, /stroke="var\(--color-ink-muted\)"/)
})

test('non-finite, negative or all-zero segments never draw a circle', () => {
  for (const segments of [
    [],
    [{ key: 'a', label: 'A', value: 0, valueLabel: '0' }],
    [{ key: 'a', label: 'A', value: -10, valueLabel: '-10' }],
    [{ key: 'a', label: 'A', value: NaN, valueLabel: 'NaN' }]
  ]) {
    const html = categoryDonut({ segments })
    assert.doesNotMatch(html, /<svg|stroke-dasharray/)
  }
})

test('hidden mode omits every segment, label and value', () => {
  const html = categoryDonut({ segments: [{ key: 'a', label: 'Confidencial', value: 600, valueLabel: 'R$ 600,00' }], hidden: true })
  assert.doesNotMatch(html, /<svg|stroke|Confidencial|600/)
})
