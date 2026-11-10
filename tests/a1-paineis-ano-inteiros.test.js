import test from 'node:test'
import assert from 'node:assert/strict'
import { cashFlowDetailPanels } from '../src/shared/cash-flow-detail.js'
import { renderBudgetComparison } from '../src/shared/budget-comparison.js'
import { renderBudgetPressure } from '../src/shared/budget-pressure.js'
import { formatProjectedCurrency } from '../src/shared/formatters.js'

// A1: annual projection panels (Visão geral, Projeção patrimonial, Viabilidade) show whole units.
// The monthly budget slice, without a return result, keeps cents.
const plain = text => String(text).replace(/[  ]/g, ' ')
const cents = /(?:R\$|CHF)\s*-?[\d.]+,\d{2}/
const entry = (id, amount, extra = {}) => ({ id, name: id, amount, originalAmount: amount, currency: 'BRL', category: id, source: 'Orçamento', frequency: 'monthly', months: 12, ...extra })
const row = (overrides = {}) => ({
  year: 2030, months: 12, income: 120000.37, costs: 90000.21, goals: 10000.11, freeCashFlow: 20000.05, pensionCredits: 0, releases: 0,
  breakdown: {
    income: [entry('Salário', 100000.25), entry('Renda BVK', 20000.12, { currency: 'CHF', originalAmount: 2000.12, indexation: 'fixed', contractOriginalAmount: 2400.45, indexationBaseYear: 2026, indexationInflation: 0.0075, indexationInflationSource: 'currency' })],
    costs: [entry('Moradia', 60000.13), entry('Mercado', 30000.08)],
    goals: [entry('Viagem', 10000.11, { frequency: 'occasional' })],
    pension: [], releases: []
  },
  ...overrides
})
const plan = { currentAge: 40, horizonReferenceMonth: '2030-01', targetAge: 90 }
const projected = { financialReturn: 3456.78, financialChange: 23456.83, financialAssets: 500000.5, liquidAssets: 300000.4 }

test('A1: a projected year panel shows whole units in every block, including original currency and the return line', () => {
  const [detail] = cashFlowDetailPanels([row(projected)], plan, 'BRL')
  const html = plain(detail.html)
  assert.doesNotMatch(html, cents)
  assert.match(html, /R\$ 120\.000/)
  assert.match(html, /Resultado do retorno real: R\$ 3\.457\. Variação dos ativos financeiros: R\$ 23\.457\./)
  assert.match(html, /Total na moeda original: R\$ 100\.000\./)
  assert.match(html, /CHF 2\.400 nominais/)
  assert.match(html, /O que mais pesa/)
  assert.match(html, /budget-comparison/)
})

test('A1: the monthly budget slice keeps cents', () => {
  const [detail] = cashFlowDetailPanels([row()], plan, 'BRL')
  const html = plain(detail.html)
  assert.match(html, /Recorte do orçamento mensal/)
  assert.match(html, /R\$ 120\.000,37/)
  assert.match(html, /R\$ 60\.000,13/)
})

test('A1: hidden values still return no panel', () => {
  assert.deepEqual(cashFlowDetailPanels([row(projected)], plan, 'BRL', true), [])
})

test('A1: comparison and pressure keep cents by default and accept a whole-unit formatter', () => {
  const input = row(projected)
  assert.match(plain(renderBudgetComparison(input, 'BRL')), cents)
  assert.match(plain(renderBudgetPressure(input, 'BRL')), cents)
  const money = value => formatProjectedCurrency(value, 'BRL')
  assert.doesNotMatch(plain(renderBudgetComparison(input, 'BRL', { money })), cents)
  assert.doesNotMatch(plain(renderBudgetPressure(input, 'BRL', { money })), cents)
})

test('A1: display only, the projection rows are not changed', () => {
  const rows = [row(projected)], before = structuredClone(rows)
  cashFlowDetailPanels(rows, plan, 'BRL')
  assert.deepEqual(rows, before)
})
