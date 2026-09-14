import test from 'node:test'
import assert from 'node:assert/strict'
import { cashFlowDetailIndex, renderCashFlowDetailNavigation } from '../src/shared/cash-flow-detail.js'
import { planningChart } from '../src/shared/planning-chart.js'

const details = [2030, 2032, 2034].map((year, index) => ({ label: `${year}, idade estimada ${60 + index * 2}`, html: `<h3>Detalhe ${year}</h3>` }))
const input = { title: 'Fluxos anuais', currency: 'BRL', rows: [2030, 2032, 2034].map(year => ({ year, income: 1200 })), series: [{ key: 'income', label: 'Receitas', type: 'bar', color: '#0ea5e9' }], details }

test('ano inicial encontra correspondência exata ou ano disponível mais próximo', () => {
  assert.equal(cashFlowDetailIndex(details, '2032'), 1)
  assert.equal(cashFlowDetailIndex(details, '2020'), 0)
  assert.equal(cashFlowDetailIndex(details, '2040'), 2)
  assert.equal(cashFlowDetailIndex(details, '2033'), 1)
  assert.equal(cashFlowDetailIndex(details, undefined), 0)
  assert.equal(cashFlowDetailIndex(details, '2030-01'), 0)
  assert.equal(cashFlowDetailIndex(details, '<img>'), 0)
  assert.equal(cashFlowDetailIndex([], '2032'), 0)
  assert.equal(cashFlowDetailIndex([null, { label: 'Inválido' }], '2032'), 0)
})

test('ano preservado mantém option, painel, status, cursor e índices sincronizados', () => {
  const html = planningChart({ ...input, selectedYear: '2032' })
  assert.match(html, /data-chart-selected-index="1" data-chart-index="1"/)
  assert.match(html, /<option value="1" selected>2032, idade estimada 62<\/option>/)
  assert.equal((html.match(/<option[^>]* selected>/g) || []).length, 1)
  assert.match(html, /data-chart-detail-content><h3>Detalhe 2032<\/h3>/)
  assert.match(html, /role="status">Ano 2032, idade estimada 62 selecionado/)
  assert.match(html, /data-chart-cursor x1="482" x2="482"[^>]+visibility="visible"/)
  assert.doesNotMatch(html, /data-chart-step="[-\d]+" disabled/)
})

test('reduzir período seleciona o último ano válido e desabilita somente avançar', () => {
  const html = planningChart({ ...input, selectedYear: '2100' })
  assert.match(html, /data-chart-selected-index="2" data-chart-index="2"/)
  assert.match(html, /data-chart-step="1" disabled/)
  assert.doesNotMatch(html, /data-chart-step="-1" disabled/)
  assert.match(html, /data-chart-detail-content><h3>Detalhe 2034<\/h3>/)
})

test('seleção padrão e horizonte de um ano usam limites consistentes', () => {
  const html = planningChart(input)
  assert.match(html, /data-chart-selected-index="0" data-chart-index="0"/)
  assert.match(html, /data-chart-step="-1" disabled/)
  assert.doesNotMatch(html, /data-chart-step="1" disabled/)
  const single = renderCashFlowDetailNavigation(details.slice(0, 1), 99)
  assert.match(single, /data-chart-step="-1" disabled/)
  assert.match(single, /data-chart-step="1" disabled/)
  assert.match(single, /<option value="0" selected>/)
  assert.match(renderCashFlowDetailNavigation(details, NaN), /<option value="0" selected>/)
  assert.equal(renderCashFlowDetailNavigation([null]), '')
})

test('privacidade remove inclusive o ano selecionado e gráficos comuns não ganham composição', () => {
  const hidden = planningChart({ ...input, selectedYear: '2032', hidden: true })
  assert.doesNotMatch(hidden, /2032|template|data-chart|Detalhe/)
  const ordinary = planningChart({ ...input, details: [], selectedYear: '2032' })
  assert.doesNotMatch(ordinary, /data-chart-selected-index|data-chart-drilldown|data-chart-detail/)
  assert.match(ordinary, /data-chart-cursor[^>]+visibility="hidden"/)
})
