import test from 'node:test'
import assert from 'node:assert/strict'
import { renderBudgetComparison } from '../src/shared/budget-comparison.js'
import { cashFlowDetailPanels, cashFlowDetailIndex, renderCashFlowDetailNavigation } from '../src/shared/cash-flow-detail.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'

const entry = (id, amount) => ({ id, name: id, amount, originalAmount: amount, currency: 'BRL', category: id, source: 'Orçamento', frequency: 'annual', months: 12 })
const row = (income, costs, goals = 0, year = 2030) => ({
  year, months: 12, income, costs, goals, freeCashFlow: income - costs - goals, pensionCredits: 0,
  breakdown: { income: [entry('Renda', income)], costs: [entry('Moradia', costs)], goals: [entry('Meta', goals)], pension: [], releases: [] }
})
const moneyText = html => html.replaceAll('\u00a0', ' ')
const widths = html => [...html.matchAll(/style="width:([\d.]+)%"/g)].map(match => Number(match[1]))

test('annual comparison clearly distinguishes surplus, expense deficit and goals consuming the surplus', () => {
  for (const [costs, goals, tone, title, balanceLabel, amount] of [
    [100000, 10000, 'surplus', /receitas são maiores que as despesas/, 'Sobra no período', '10.000,00'],
    [130000, 10000, 'deficit', /despesas são maiores que as receitas/, 'Falta no período', '20.000,00'],
    [100000, 30000, 'deficit', /cobrem as despesas, mas não todas as metas/, 'Falta no período', '10.000,00']
  ]) {
    const input = row(120000, costs, goals)
    const snapshot = structuredClone(input)
    const html = moneyText(renderBudgetComparison(input, 'BRL'))
    assert.match(html, new RegExp(`data-balance="${tone}"`))
    assert.match(html, title)
    assert.ok(html.includes(`${balanceLabel}</span><strong class="money-value">R$ ${amount}`))
    assert.match(html, /Após despesas e metas, antes dos rendimentos/)
    assert.deepEqual(input, snapshot)
  }
})

test('both bars share a scale and keep goals separate, including a deficit above 100 percent', () => {
  const html = renderBudgetComparison(row(100, 120, 30), 'BRL')
  assert.deepEqual(widths(html), [66.6667, 80, 20])
  assert.match(html, /150% das receitas/)
  assert.match(html, /Saídas: despesas e metas/)
  assert.match(html, /budget-comparison-legend/)
  const noGoals = renderBudgetComparison(row(100, 50), 'BRL')
  assert.deepEqual(widths(noGoals), [100, 50, 0])
  assert.doesNotMatch(noGoals, /budget-comparison-legend/)
})

test('empty, zero-income and balanced budgets have explicit results without invalid percentages', () => {
  const empty = renderBudgetComparison(row(0, 0), 'BRL')
  assert.match(empty, /Sem receitas ou saídas previstas em 2030/)
  assert.doesNotMatch(empty, /Sobra no período|cobrem exatamente/)
  const noIncome = renderBudgetComparison(row(0, 50), 'BRL')
  assert.match(noIncome, /Sem receitas previstas para cobrir as saídas/)
  assert.match(noIncome, /Falta no período/)
  const equal = renderBudgetComparison(row(50, 50), 'BRL')
  assert.match(equal, /receitas e despesas são iguais/)
  assert.match(equal, /data-balance="balanced"/)
  const equalWithGoals = renderBudgetComparison(row(50, 40, 10), 'BRL')
  assert.match(equalWithGoals, /cobrem exatamente as saídas, sem sobra/)
  const cents = renderBudgetComparison(row(0.3, 0.1, 0.2), 'BRL')
  assert.match(cents, /data-balance="balanced"/)
  assert.doesNotMatch(empty + noIncome + equal + equalWithGoals + cents, /NaN|Infinity|-0,00/)
})

test('partial years and nominal conversion use included totals without annualizing or reinflating', () => {
  const partial = { ...row(6000, 3000, 1000, 2031), months: 6 }
  const real = renderBudgetComparison(partial, 'BRL')
  const nominal = annualRowsInPriceBasis([partial], { basis: 'nominal', annualInflation: .1, baseYear: 2030 })[0]
  const html = moneyText(renderBudgetComparison(nominal, 'BRL'))
  assert.match(html, /6 meses incluídos/)
  assert.match(html, /valores nominais do ano selecionado/)
  assert.match(html, /R\$ 6\.600,00/)
  assert.match(html, /R\$ 2\.200,00/)
  assert.deepEqual(widths(real), widths(html))
})

test('pension credits, releases and returns are not added again to the comparison', () => {
  const input = row(120000, 100000, 10000)
  const baseline = renderBudgetComparison(input, 'BRL')
  input.pensionCredits = 50000
  input.releases = 90000
  input.financialReturn = 150000
  input.breakdown.pension = [entry('External pension', 50000), entry('Moradia', 100000)]
  input.breakdown.releases = [entry('Release', 90000)]
  assert.equal(renderBudgetComparison(input, 'BRL'), baseline)
  assert.equal(renderBudgetComparison({ ...input, costs: 110000 }, 'BRL'), '')
})

test('selected year includes its matching comparison before the ranking, and hidden mode removes it', () => {
  const rows = [row(120000, 100000, 10000), row(120000, 130000, 10000, 2031)]
  const plan = { currentAge: 40, horizonReferenceMonth: '2030-01', targetAge: 90 }
  const details = cashFlowDetailPanels(rows, plan, 'BRL')
  for (const [year, expected] of [[2030, 'surplus'], [2031, 'deficit']]) {
    const html = renderCashFlowDetailNavigation(details, cashFlowDetailIndex(details, year)).split('<template')[0]
    assert.match(html, new RegExp(`Receitas e despesas de ${year}`))
    assert.match(html, new RegExp(`data-balance="${expected}"`))
    assert.ok(html.indexOf('budget-comparison') < html.indexOf('O que mais pesa'))
    assert.doesNotMatch(html, /pressure-totals|pressure-reading/)
    assert.match(html, /percentuais do ranking representam participação nas saídas/)
  }
  assert.deepEqual(cashFlowDetailPanels(rows, plan, 'BRL', true), [])
})
