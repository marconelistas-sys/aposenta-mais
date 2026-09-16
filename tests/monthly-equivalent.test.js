import test from 'node:test'
import assert from 'node:assert/strict'

import { monthlyEquivalent, moneyWithMonthly, moneyWithMonthlyText, periodMonths } from '../src/shared/monthly-equivalent.js'
import { renderBudgetComparison } from '../src/shared/budget-comparison.js'
import { renderIncomeCostBars } from '../src/shared/income-cost-bars.js'
import { formatCurrency } from '../src/shared/formatters.js'

const money = value => formatCurrency(value, true, 'BRL')
const plain = html => html.replace(/ /g, ' ')

test('equivalente mensal divide pelos meses incluídos e usa 12 por padrão', () => {
  assert.equal(periodMonths(undefined), 12)
  assert.equal(periodMonths(4), 4)
  assert.equal(monthlyEquivalent(12000), 1000)
  assert.equal(monthlyEquivalent(4000, 4), 1000)
  assert.equal(monthlyEquivalent(Number.NaN), null)
})

test('valor anual vem acompanhado do mensal, exceto com valores ocultos', () => {
  assert.match(plain(moneyWithMonthly(money, 12000, 12)), /R\$ 12\.000,00 <small class="monthly-equivalent">R\$ 1\.000,00\/mês<\/small>/)
  assert.equal(plain(moneyWithMonthlyText(money, 6000, 6)), 'R$ 6.000,00 (R$ 1.000,00/mês)')
  assert.doesNotMatch(moneyWithMonthly(() => 'Oculto', 12000, 12, { hidden: true }), /mês/)
})

const row = { year: '2026', months: 4, income: 20000, costs: 8000, goals: 0, freeCashFlow: 12000, breakdown: {
  income: [{ id: 'i', name: 'Salário', category: 'Salário', amount: 20000, months: 4, frequency: 'monthly' }],
  costs: [{ id: 'c', name: 'Aluguel', category: 'Moradia', source: 'Orçamento', amount: 8000, months: 4, frequency: 'monthly' }],
  goals: [], pension: []
} }

test('comparação anual mostra o mensal do ano parcial', () => {
  const html = plain(renderBudgetComparison(row, 'BRL'))
  assert.match(html, /R\$ 20\.000,00 <small class="monthly-equivalent">R\$ 5\.000,00\/mês/)
  assert.match(html, /R\$ 8\.000,00 <small class="monthly-equivalent">R\$ 2\.000,00\/mês/)
})

test('barras de receitas e despesas mostram mensal nos totais e nos lançamentos', () => {
  const html = plain(renderIncomeCostBars(row, 'BRL'))
  assert.match(html, /R\$ 5\.000,00\/mês/)
  assert.match(html, /R\$ 2\.000,00\/mês/)
})
