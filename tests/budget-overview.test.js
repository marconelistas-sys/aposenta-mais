import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBudgetYear, budgetBarBreakdown, budgetOverviewYears } from '../src/domain/budget-overview.js'
import { renderBudgetOverview, budgetOverviewView, resetBudgetOverview } from '../src/features/cash-flow/budget-overview.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'
const item = (id, patch = {}) => ({ id, type: 'expense', categoryId: 'groceries', description: id, amount: 120, currency: 'BRL', frequency: 'monthly', recordKind: 'planned', ...patch })
function fixture() {
  return { currency: 'BRL', exchangeRates: bundledExchangeRates, customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, referenceMonth: '2026-10', annualGoals: [], commitments: [], consortia: [], items: [
    item('salary', { type: 'income', categoryId: 'salary', amount: 2000 }),
    item('monthly', { startDate: '2026-03-01', endDate: '2026-05-31' }),
    item('annual', { frequency: 'annual', amount: 1200 }),
    item('one-off', { frequency: 'occasional', startDate: '2026-08-03', amount: 300 }),
    item('imported', { source: 'txt', recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-03', amount: 350 }),
    item('undated', { frequency: 'occasional' })
  ] } }
}
test.beforeEach(resetBudgetOverview)

test('compares twelve months, respects recurrence boundaries and divides annual values by twelve', () => {
  const model = buildBudgetYear(fixture(), 2026)
  assert.equal(model.months.length, 12)
  assert.equal(model.months[0].planned.expenses, 100)
  assert.equal(model.months[2].planned.expenses, 220)
  assert.equal(model.months[7].planned.expenses, 400)
  assert.equal(model.months[7].actual.expenses, 350)
  assert.equal(model.months[8].actual.count, 0)
  assert.equal(model.annual.planned.expenses, 1860)
  assert.equal(model.annual.planned.income, 24000)
  assert.equal(model.annual.actual.expenses, 350)
  assert.equal(model.annual.actualMonths, 1)
  assert.equal(model.annual.planned.balance, 22140)
})

test('every breakdown reconciles to the bar total, including negative balance and mixed currencies', () => {
  const state = fixture()
  state.cashFlow.items.push(item('CHF merchant', { currency: 'CHF', frequency: 'occasional', recordKind: 'actual', startDate: '2026-08-05', amount: 50 }))
  const model = buildBudgetYear(state, 2026)
  for (const period of [...model.months, model.annual]) for (const kind of ['planned', 'actual']) for (const metric of ['income', 'expenses', 'balance']) {
    const groups = budgetBarBreakdown(period, kind, metric)
    assert.ok(Math.abs(groups.reduce((sum, group) => sum + group.amount, 0) - period[kind][metric]) < 1e-8)
    for (const group of groups) assert.ok(Math.abs(group.entries.reduce((sum, entry) => sum + entry.amount, 0) - group.amount) < 1e-8)
  }
  assert.ok(model.months[7].actual.expenses > 350)
  assert.ok(budgetBarBreakdown(model.months[7], 'actual', 'balance')[0].amount < 0)
})

test('includes annual goals, calendar and custom categories without mutating financial data', () => {
  const state = fixture()
  state.customCategories = [{ id: 'custom-x', name: 'Projeto', type: 'expense', budgetGroup: 'variable' }]
  state.cashFlow.items.push(item('project', { categoryId: 'custom-x', amount: 10 }))
  state.cashFlow.annualGoals = [{ id: 'trip', name: 'Férias', currency: 'BRL', amount: 1200, startYear: 2026, endYear: 2026, everyYears: 1, realGrowth: 0, categoryId: 'travel' }]
  state.cashFlow.commitments = [{ id: 'goal', name: 'Compra', kind: 'goal', currency: 'BRL', date: '2026-06-15', amount: 200, saved: 50, categoryId: 'shopping' }]
  const before = structuredClone(state)
  const model = buildBudgetYear(state, 2026)
  assert.equal(model.months[5].planned.expenses, 360)
  assert.ok(budgetBarBreakdown(model.annual, 'planned', 'expenses').some(group => group.category === 'Projeto'))
  assert.deepEqual(state, before)
})

test('default view and annual comparison expose accessible bars and differentiate missing records', () => {
  const html = renderBudgetOverview(fixture())
  assert.equal((html.match(/data-budget-bar="/g) || []).length, 48)
  assert.match(html, /data-budget-overview-metric="expenses" aria-pressed="true"/)
  assert.match(html, /Receitas e despesas em 2026/)
  assert.match(html, /data-budget-bar-metric="income"/)
  assert.match(html, /data-budget-bar-metric="expenses"/)
  assert.match(html, /Sem registros/)
  assert.match(html, /Realizado em 1 de 12 meses/)
  budgetOverviewView.period = 'years'
  assert.equal((renderBudgetOverview(fixture()).match(/data-budget-bar="/g) || []).length, 20)
  budgetOverviewView.metric = 'balance'
  const balance = renderBudgetOverview(fixture())
  assert.match(balance, /Saldo por ano/)
  assert.equal((balance.match(/data-budget-bar="/g) || []).length, 10)
  assert.doesNotMatch(balance, /data-budget-bar-metric="income"/)
})

test('hidden mode removes amounts, bar heights and composition from the document', () => {
  const html = renderBudgetOverview({ ...fixture(), valuesHidden: true })
  assert.match(html, /Valores ocultos/)
  assert.doesNotMatch(html, /data-budget-bar|24000|24\.000|height:|1860|1\.860/)
})

test('year selector includes imported historical records and resets when changing accounts', () => {
  const state = fixture()
  state.cashFlow.items.push(item('old', { startDate: '2020-01-01' }))
  assert.ok(budgetOverviewYears(state).includes(2020))
  budgetOverviewView.year = 2020
  budgetOverviewView.metric = 'balance'
  resetBudgetOverview()
  assert.deepEqual(budgetOverviewView, { year: null, period: 'months', metric: 'expenses', income: true, planned: true, actual: true })
  assert.throws(() => buildBudgetYear(state, 0), /Ano/)
})

test('retirement-linked income stops in its retirement month and historical descriptions are escaped', () => {
  const state = fixture()
  state.plan.retirementMonth = '2026-07'
  state.cashFlow.items[0].endMode = 'retirement'
  state.cashFlow.items[4].description = '<img src=x onerror=alert(1)>'
  const model = buildBudgetYear(state, 2026)
  assert.equal(model.months[5].planned.income, 2000)
  assert.equal(model.months[6].planned.income, 0)
  assert.doesNotMatch(renderBudgetOverview(state), /<img src=x/)
})

test('monthly expenses peak at 240 thousand uses a 250 thousand ceiling', () => {
  const state = fixture()
  state.cashFlow.items = [item('peak', { amount: 240000 })]
  const html = renderBudgetOverview(state)
  const axis = html.match(/class="budget-chart-axis"[^>]*>(.*?)<\/div>/s)[1]
  assert.match(axis, /250\s+mil/)
  assert.doesNotMatch(axis, /500\s+mil/)
  assert.match(html, /height:238\.08px/)
})

test('scale stays above visible planned and actual peaks across magnitudes', () => {
  for (const amount of [0.01, 1, 99, 100, 1001, 249999, 999999]) {
    resetBudgetOverview()
    const state = fixture()
    state.cashFlow.items = [item('planned', { amount: amount / 2 }), item('actual', { amount, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-03' })]
    const html = renderBudgetOverview(state)
    const height = Number(html.match(/data-budget-bar="2026-08:actual:expenses" data-budget-bar-metric="expenses"[^>]*height:([\d.]+)px/)[1])
    assert.ok(height > 210 && height < 248, `peak ${amount}, height ${height}`)
  }
})


test('receipt and record-kind filters affect all bars without changing the underlying totals', () => {
  const state = fixture()
  const before = buildBudgetYear(state, 2026)
  for (const income of [true, false]) for (const planned of [true, false]) for (const actual of [true, false]) {
    Object.assign(budgetOverviewView, { income, planned, actual })
    const html = renderBudgetOverview(state)
    const count = 12 * (income ? 2 : 1) * (Number(planned) + Number(actual))
    const identifiers = [...html.matchAll(/data-budget-bar="([^"]+)"/g)].map(match => match[1])
    assert.equal(identifiers.length, count)
    assert.equal(new Set(identifiers).size, count, 'each bar identifies one distinct period, kind and metric')
    assert.equal(html.includes('budget-bar--planned budget-bar--expenses'), planned)
    assert.equal(html.includes('budget-bar--actual budget-bar--expenses'), actual)
    assert.equal(html.includes('budget-bar--planned budget-bar--income'), income && planned)
    assert.equal(html.includes('budget-bar--actual budget-bar--income'), income && actual)
    assert.doesNotMatch(html, /NaN|Infinity/)
    if (!planned && !actual) assert.match(html, /Selecione Realizado ou Planejado/)
    assert.deepEqual(buildBudgetYear(state, 2026), before)
  }
})

test('planned and actual records remain separate even when their amounts match', () => {
  const state = fixture()
  state.cashFlow.items = [
    item('planned-income', { type: 'income', categoryId: 'salary', amount: 2000 }),
    item('actual-income', { type: 'income', categoryId: 'salary', amount: 2000, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-01' }),
    item('planned-expense', { amount: 200 }),
    item('actual-expense', { amount: 250, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-01' })
  ]
  const month = buildBudgetYear(state, 2026).months[7]
  assert.equal(month.planned.income, 2000)
  assert.equal(month.actual.income, 2000)
  assert.equal(month.planned.expenses, 200)
  assert.equal(month.actual.expenses, 250)
  assert.deepEqual(month.entries.planned.map(entry => entry.id), ['planned-income', 'planned-expense'])
  assert.deepEqual(month.entries.actual.map(entry => entry.id), ['actual-income', 'actual-expense'])
})

test('balance scale ignores a negative hidden series', () => {
  Object.assign(budgetOverviewView, { metric: 'balance', planned: true, actual: false })
  const html = renderBudgetOverview(fixture())
  assert.equal((html.match(/data-budget-bar="/g) || []).length, 12)
  assert.doesNotMatch(html, /budget-bar--actual/)
  assert.match(html, /class="is-zero" style="top:248px"/)
})
