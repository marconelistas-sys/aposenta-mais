import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetExpenseOverruns, budgetExpenseAccumulated, budgetExpenseComparison, budgetAnnualQuota } from '../src/domain/budget-expense-overruns.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'
import { renderBudgetExpenseOverruns, budgetExpenseOverrunView } from '../src/shared/budget-expense-overruns.js'

const row = (categoryId, planned, actual) => ({ categoryId, category: categoryId, planned, actual })
test.beforeEach(() => Object.assign(budgetExpenseOverrunView, { threshold: 10, period: 'month', basis: 'to-date' }))

function annualFixture(amounts = [870, 900, 870, 950, 898, 900, 960, 800, 890]) {
  const planned = { id: 'health-plan', description: 'Saúde planejada', categoryId: 'health', type: 'expense', amount: 870, currency: 'CHF', frequency: 'monthly', recordKind: 'planned' }
  return { currency: 'CHF', valuesHidden: false, exchangeRates: bundledExchangeRates, customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, referenceMonth: '2026-09', commitments: [], annualGoals: [], consortia: [], items: [planned, ...amounts.map((amount, index) => ({ ...planned, id: `health-${index}`, description: `Saúde ${index + 1}`, amount, recordKind: 'actual', frequency: 'occasional', startDate: `2026-${String(index + 1).padStart(2, '0')}-09` }))] } }
}

test('annual quota and year-to-date averages use the same nine months and exclude future actuals', () => {
  const state = annualFixture()
  const snapshot = structuredClone(state)
  const year = buildBudgetYear(state, 2026)
  const accumulated = budgetExpenseAccumulated(year, '09')
  const health = accumulated.categories.find(row => row.categoryId === 'health')
  assert.equal(health.annualPlanned, 10440)
  assert.equal(health.planned, 7830)
  assert.equal(health.actual, 8038)
  assert.equal(accumulated.monthCount, 9)
  assert.equal(accumulated.actualMonths, 9)
  assert.equal(budgetExpenseOverruns(accumulated.categories, 10).exceeded.length, 0)
  assert.equal(budgetExpenseOverruns(accumulated.categories, 2).exceeded.length, 1)
  assert.deepEqual(state, snapshot)
  const future = annualFixture([870, 900, 870, 950, 898, 900, 960, 800, 890, 9999])
  assert.equal(budgetExpenseAccumulated(buildBudgetYear(future, 2026), '09').categories[0].actual, 8038)
  assert.equal(budgetExpenseAccumulated(year, '01').monthCount, 1)
  assert.equal(budgetExpenseAccumulated(year, 'all').monthCount, 12)
})

test('annual comparison dilutes monthly spikes, respects changes in the plan and counts missing months', () => {
  const state = annualFixture([870, 1000, 0, 0, 0, 0, 0, 0, 1000])
  state.cashFlow.items = state.cashFlow.items.filter(item => item.amount > 0)
  state.cashFlow.items[0].endDate = '2026-06-30'
  state.cashFlow.items.push({ ...state.cashFlow.items[0], id: 'new-plan', amount: 900, startDate: '2026-07-01', endDate: null })
  const year = buildBudgetYear(state, 2026)
  const accumulated = budgetExpenseAccumulated(year, '09')
  assert.equal(accumulated.categories[0].planned, 870 * 6 + 900 * 3)
  assert.equal(accumulated.categories[0].annualPlanned, 870 * 6 + 900 * 6)
  assert.equal(accumulated.actualMonths, 3)
  assert.equal(budgetExpenseOverruns(budgetExpenseCategories(year.months[8]).categories).exceeded.length, 1)
  assert.equal(budgetExpenseOverruns(budgetExpenseAccumulated(year, '09').categories).exceeded.length, 0)
  assert.throws(() => budgetExpenseAccumulated(year, '13'), RangeError)
})

test('pace and annual exhaustion answer different questions without including future actuals', () => {
  const state = annualFixture([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 99999])
  const accumulated = budgetExpenseAccumulated(buildBudgetYear(state, 2026), '09')
  assert.equal(accumulated.categories[0].actual, 9000)
  assert.equal(budgetExpenseOverruns(accumulated.categories, 10).exceeded.length, 1)
  assert.equal(budgetExpenseOverruns(budgetExpenseComparison(accumulated.categories, 'annual'), 10).exceeded.length, 0)
  assert.equal(budgetAnnualQuota(accumulated.categories).categories[0].remaining, 1440)
  assert.equal(budgetAnnualQuota(accumulated.categories).exceededCount, 0)
})

test('annual exhaustion is flagged independently of the ten percent filter, including an exact exhausted quota', () => {
  const state = annualFixture([11000])
  const accumulated = budgetExpenseAccumulated(buildBudgetYear(state, 2026), '09')
  const quota = budgetAnnualQuota(accumulated.categories)
  assert.equal(quota.exceededCount, 1)
  assert.equal(quota.categories[0].remaining, -560)
  assert.equal(budgetExpenseOverruns(budgetExpenseComparison(accumulated.categories, 'annual'), 10).exceeded.length, 0)
  Object.assign(budgetExpenseOverrunView, { period: 'year-to-date', basis: 'annual' })
  const html = renderBudgetExpenseOverruns([], state, { accumulated })
  assert.match(html, /Cota anual ultrapassada/)
  assert.match(html, /560,00/)
  assert.match(html, /Nenhuma categoria.*10% da cota anual/)
  const exact = budgetAnnualQuota([{ ...accumulated.categories[0], actual: 10440 }])
  assert.equal(exact.exceededCount, 0)
  assert.equal(exact.categories[0].remaining, 0)
  assert.equal(budgetAnnualQuota([{ ...accumulated.categories[0], annualPlanned: .001 }]).categories.length, 0)
})

test('an expense planned later in the year has an annual quota rather than being annually unplanned', () => {
  const state = annualFixture([])
  state.cashFlow.items = [{ id: 'holiday', type: 'expense', categoryId: 'travel', amount: 1000, description: 'Viagem dezembro', currency: 'CHF', recordKind: 'planned', frequency: 'occasional', startDate: '2026-12-10' }, { id: 'advance', type: 'expense', categoryId: 'travel', amount: 300, description: 'Reserva setembro', currency: 'CHF', recordKind: 'actual', frequency: 'occasional', startDate: '2026-09-10' }]
  const accumulated = budgetExpenseAccumulated(buildBudgetYear(state, 2026), '09')
  assert.equal(accumulated.categories[0].planned, 0)
  assert.equal(accumulated.categories[0].annualPlanned, 1000)
  assert.equal(budgetExpenseOverruns(accumulated.categories).unplanned.length, 1)
  const annual = budgetExpenseComparison(accumulated.categories, 'annual')
  assert.equal(budgetExpenseOverruns(annual).unplanned.length, 0)
  assert.equal(budgetAnnualQuota(accumulated.categories).categories[0].remaining, 700)
  Object.assign(budgetExpenseOverrunView, { period: 'year-to-date', basis: 'annual' })
  const html = renderBudgetExpenseOverruns([], state, { accumulated })
  assert.match(html, /data-category-item-id="holiday"/)
  assert.match(html, /dezembro de 2026/)
})

test('December bases match and scheduled plans are summed without an extra annual rate allocation', () => {
  const state = annualFixture([1200, 1300, 1400])
  state.cashFlow.items.push({ id: 'annual-plan', description: 'Seguro anual', type: 'expense', categoryId: 'insurance', amount: 1200, currency: 'CHF', frequency: 'annual', recordKind: 'planned' })
  const year = buildBudgetYear(state, 2026)
  const september = budgetExpenseAccumulated(year, '09')
  assert.equal(september.categories.find(row => row.categoryId === 'insurance').planned, 900)
  assert.equal(september.categories.find(row => row.categoryId === 'insurance').annualPlanned, 1200)
  const december = budgetExpenseAccumulated(year, '12')
  assert.deepEqual(budgetExpenseOverruns(december.categories).exceeded.map(row => row.excess), budgetExpenseOverruns(budgetExpenseComparison(december.categories, 'annual')).exceeded.map(row => row.excess))
})

test('year-to-date rendering provides annual quota, monthly means and editing of every included month', () => {
  const state = annualFixture()
  const accumulated = budgetExpenseAccumulated(buildBudgetYear(state, 2026), '09')
  Object.assign(budgetExpenseOverrunView, { threshold: 2, period: 'year-to-date' })
  const html = renderBudgetExpenseOverruns([], state, { accumulated })
  assert.match(html, /Janeiro até setembro de 2026/)
  assert.match(html, /10.440,00/)
  assert.match(html, /7.830,00/)
  assert.match(html, /8.038,00/)
  assert.match(html, /893,11/)
  assert.match(html, /9 de 9 mês/)
  assert.match(html, /data-budget-overrun-category-details="health"/)
  assert.match(html, /data-category-item-id="health-0"/)
  assert.match(html, /data-category-item-id="health-8"/)
})

test('default threshold shows only overspending strictly above 10%, ordered by monetary excess', () => {
  const model = budgetExpenseOverruns([row('exact', 100, 110), row('over', 100, 110.01), row('large', 300, 430), row('below', 100, 90), row('empty', 100, 0)])
  assert.equal(model.threshold, 10)
  assert.deepEqual(model.exceeded.map(item => item.categoryId), ['large', 'over'])
  assert.equal(model.totalExcess, 140.01)
})

test('threshold changes preserve individual categories and unplanned expenses', () => {
  const categories = [row('food', 300, 430), row('rent', 1400, 1450), row('unplanned', 0, 15), row('zero', 0, 0), row('refund', 0, -10)]
  assert.deepEqual(budgetExpenseOverruns(categories, 0).exceeded.map(item => item.categoryId), ['food', 'rent'])
  const high = budgetExpenseOverruns(categories, 44)
  assert.equal(high.exceeded.length, 0)
  assert.deepEqual(high.unplanned.map(item => item.categoryId), ['unplanned'])
  assert.equal(high.unplanned[0].excessPercent, undefined)
  assert.equal(categories[0].excess, undefined)
})

test('currency rounding keeps decimal ratios exactly on the threshold excluded', () => {
  assert.equal(budgetExpenseOverruns([row('decimal', .1, .11)]).exceeded.length, 0)
  assert.equal(budgetExpenseOverruns([row('decimal', .1, .12)]).exceeded.length, 1)
  assert.equal(budgetExpenseOverruns([row('double', 100, 250)], 100).exceeded.length, 1)
})

test('rendering supports privacy, accessible default control and category editing links', () => {
  budgetExpenseOverrunView.threshold = 10
  const categories = [row('food', 300, 430), row('unplanned', 0, 15)]
  assert.equal(renderBudgetExpenseOverruns(categories, { valuesHidden: true }), '')
  const html = renderBudgetExpenseOverruns(categories, { valuesHidden: false, currency: 'CHF' })
  assert.match(html, /value="10" data-budget-overrun-threshold/)
  assert.match(html, /data-budget-overrun-category="food"/)
  assert.match(html, /43,3%/)
  assert.match(html, /data-budget-expense-categories=/)
  assert.match(html, /Sem planejamento: 1/)
  assert.doesNotMatch(html, /Infinity|NaN/)
})
