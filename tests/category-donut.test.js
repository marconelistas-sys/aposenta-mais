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

test('a single positive segment is shown as text with label, value and 100%, without a ring', () => {
  const html = categoryDonut({ segments: [{ key: 'fixed-income', label: 'Renda fixa', value: 1000, valueLabel: 'R$ 1.000,00' }], ariaLabel: 'Distribuição por classe' })
  assert.doesNotMatch(html, /<svg|category-donut-segment|stroke-dasharray|category-donut-legend/)
  assert.match(html, /data-category-single/)
  assert.match(html, /<strong class="category-donut-single__share">100%<\/strong> em Renda fixa/)
  assert.match(html, /<span class="category-donut-single__value">R\$ 1\.000,00<\/span>/)
  // The colour dot is decorative; the class name and share are readable text.
  assert.match(html, /<span class="category-donut-dot" style="background:[^"]+" aria-hidden="true"><\/span>/)
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  assert.equal(plain, '100% em Renda fixa R$ 1.000,00')
})

test('zero, negative or non-finite companions do not turn a single class back into a ring', () => {
  const html = categoryDonut({ segments: [
    { key: 'cash', label: 'Caixa', value: 500, valueLabel: 'R$ 500,00' },
    { key: 'equity', label: 'Ações', value: 0, valueLabel: 'R$ 0,00' },
    { key: 'fund', label: 'Fundos', value: -20, valueLabel: '-R$ 20,00' },
    { key: 'pension', label: 'Previdência', value: NaN, valueLabel: 'NaN' }
  ] })
  assert.match(html, /100%<\/strong> em Caixa/)
  assert.doesNotMatch(html, /<svg|Ações|Fundos|Previdência/)
})

test('the "other" bucket always uses the muted color regardless of its position', () => {
  const html = categoryDonut({ segments: [{ key: 'other', label: 'Outras categorias', value: 100, valueLabel: 'R$ 100,00' }, { key: 'moradia', label: 'Moradia', value: 50, valueLabel: 'R$ 50,00' }] })
  assert.match(html, /<circle class="category-donut-segment"[^>]*stroke="var\(--color-ink-muted\)"[^>]*stroke-dasharray="66\.067 100"/)
  assert.match(html, /<circle class="category-donut-segment"[^>]*stroke="var\(--chart-terracotta\)"/)
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
