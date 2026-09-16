import test from 'node:test'
import assert from 'node:assert/strict'
import { renderIncomeCostBars } from '../src/shared/income-cost-bars.js'

const entry = (id, amount, extra = {}) => ({ id, name: id, amount, originalAmount: amount, currency: 'BRL', source: 'Orçamento', budgetGroup: 'variable', budgetItemId: id, category: 'Consumo', months: 2, ...extra })
const row = (overrides = {}) => ({
  year: '2026', months: 6, income: 1000, costs: 500, goals: 100,
  breakdown: { income: [entry('Salário', 700), entry('Bônus', 300)], costs: [entry('Aluguel', 500)], goals: [entry('Viagem', 100)] },
  ...overrides
})

test('duas barras hoveráveis mostram receitas e despesas, dimensionadas uma em relação à outra', () => {
  const html = renderIncomeCostBars(row(), 'BRL')
  assert.equal((html.match(/data-wealth-row/g) || []).length, 2)
  assert.match(html, /Receitas/)
  assert.match(html, /Despesas e metas/)
  assert.match(html, /remaining-wealth-bar--income" style="width:100\.0000%"/)
  assert.match(html, /remaining-wealth-bar--costs" style="width:60\.0000%"/)
})

test('o callout de cada barra lista os lançamentos individuais, do maior para o menor', () => {
  const html = renderIncomeCostBars(row(), 'BRL')
  const incomeIndex = html.indexOf('Receitas')
  const costsIndex = html.indexOf('Despesas e metas')
  assert.ok(html.indexOf('Salário') > incomeIndex && html.indexOf('Salário') < costsIndex)
  assert.ok(html.indexOf('Bônus') > incomeIndex && html.indexOf('Bônus') < costsIndex)
  assert.ok(html.indexOf('Aluguel') > costsIndex)
  assert.ok(html.indexOf('Viagem') > costsIndex)
  assert.ok(html.indexOf('Salário') < html.indexOf('Bônus'), 'maior valor listado primeiro')
})

test('composição inconciliável entre custos, metas e o total do período não renderiza nada', () => {
  const html = renderIncomeCostBars(row({ costs: 999 }), 'BRL')
  assert.equal(html, '')
})

test('período sem receitas nem despesas não gera NaN, Infinity nem barras preenchidas', () => {
  const html = renderIncomeCostBars(row({ income: 0, costs: 0, goals: 0, breakdown: { income: [], costs: [], goals: [] } }), 'BRL')
  assert.doesNotMatch(html, /NaN|Infinity/)
  assert.match(html, /width:0\.0000%/)
})
