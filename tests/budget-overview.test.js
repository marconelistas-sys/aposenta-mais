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

const ids = html => [...html.matchAll(/data-budget-bar="([^"]+)"/g)].map(match => match[1])
const count = (html, pattern) => (html.match(pattern) || []).length
const today = new Date('2026-06-15T12:00:00Z')

test('comparison draws one column per month: actual bars, planned targets and the monthly balance marker', () => {
  const html = renderBudgetOverview(fixture(), { today })
  assert.match(html, /Receitas e despesas em 2026/)
  assert.match(html, /data-budget-overview-metric="expenses" aria-pressed="true"/)
  assert.equal(count(html, /class="budget-chart-column[ "]/g), 12)
  assert.equal(count(html, /class="budget-bar budget-bar--planned budget-bar--income/g), 12)
  assert.equal(count(html, /class="budget-bar budget-bar--planned budget-bar--expenses/g), 12)
  assert.equal(count(html, /class="budget-target"/g), 24, 'every planned bar carries its target tick')
  // Only August has actual records, and only expenses: no actual income bar, no empty placeholder.
  assert.deepEqual(ids(html).filter(id => id.includes(':actual:')), ['2026-08:actual:expenses'])
  assert.doesNotMatch(html, /budget-bar--empty|Sem registros"/)
  // Balance marker: planned everywhere, because no month has actual income yet.
  assert.equal(count(html, /class="budget-net budget-net--planned"/g), 12)
  assert.match(html, /data-budget-bar="2026-08:planned:balance"[^>]*aria-label="agosto de 2026, Saldo planejado: \+R\$\s1\.600,00, positivo\. Sem receita realizada lançada\. Mês futuro"/)
  assert.match(html, /aria-label="agosto de 2026, Despesas realizadas: R\$\s350,00, R\$\s50,00 abaixo do planejado/)
  assert.match(html, /aria-label="setembro de 2026, Despesas planejadas: R\$\s100,00\. Mês futuro"/)
  assert.match(html, /aria-label="fevereiro de 2026, Receitas planejadas: R\$\s2\.000,00\. Sem receitas realizadas"/)
  assert.match(html, /Realizado em 1 de 12 meses/)
})

test('future months are marked from today, and the selected month holds the single tab stop', () => {
  const html = renderBudgetOverview(fixture(), { today })
  assert.equal(count(html, /budget-chart-column--future/g), 6)
  assert.equal(count(html, /budget-chart-column--forecast-start/g), 1)
  assert.equal(count(html, />Previsto</g), 1)
  assert.match(html, /budget-key--future/)
  assert.equal(count(html, /tabindex="0"/g), 1)
  const selected = html.match(/<div class="budget-chart-column budget-chart-column--selected[^"]*" aria-current="date">(.*?)<span class="budget-chart-label">/s)[1]
  assert.match(selected, /data-budget-bar="2026-10:planned:income"[^>]*tabindex="0"/)
  const past = renderBudgetOverview(fixture(), { today: new Date('2027-02-01T12:00:00Z') })
  assert.doesNotMatch(past, /budget-chart-column--future|budget-key--future|Previsto/)
  const ahead = renderBudgetOverview(fixture(), { today: new Date('2025-02-01T12:00:00Z') })
  assert.equal(count(ahead, /budget-chart-column--future/g), 12)
  assert.equal(count(ahead, /budget-chart-column--forecast-start/g), 0, 'no divider when the whole year is ahead')
})

test('years and balance views keep the same API for the composition panel', () => {
  budgetOverviewView.period = 'years'
  const years = renderBudgetOverview(fixture(), { today })
  assert.equal(count(years, /class="budget-chart-column[ "]/g), 5)
  assert.equal(ids(years).length, 16)
  assert.ok(ids(years).includes('2026:actual:expenses'))
  assert.match(years, /<div class="budget-chart-column budget-chart-column--selected" aria-current="date">/)
  assert.equal(count(years, /budget-chart-column--future/g), 2)
  budgetOverviewView.metric = 'balance'
  const balance = renderBudgetOverview(fixture(), { today })
  assert.match(balance, /Saldo por ano/)
  assert.deepEqual(ids(balance), ['2024:planned:balance', '2025:planned:balance', '2026:planned:balance', '2026:actual:balance', '2027:planned:balance', '2028:planned:balance'])
  assert.doesNotMatch(balance, /data-budget-bar-metric="income"|budget-net|budget-chart-net/)
  for (const id of ids(years).concat(ids(balance))) assert.match(id, /^\d{4}(-\d{2})?:(planned|actual):(income|expenses|balance)$/)
})

test('a year without records shows a status message instead of an empty axis', () => {
  const state = fixture()
  state.cashFlow.items = []
  const html = renderBudgetOverview(state, { today })
  assert.match(html, /role="status">Nenhum lançamento planejado ou realizado em 2026\./)
  assert.doesNotMatch(html, /data-budget-bar=|budget-chart-ticks/)
})

test('balance sign and tone: positive, zero and negative never share a look', () => {
  const state = fixture()
  const actual = (id, type, amount, date) => item(id, { type, categoryId: type === 'income' ? 'salary' : 'groceries', amount, recordKind: 'actual', frequency: 'occasional', startDate: date })
  state.cashFlow.items = [
    actual('jan-in', 'income', 1000, '2026-01-05'), actual('jan-out', 'expense', 400, '2026-01-06'),
    actual('feb-in', 'income', 500, '2026-02-05'), actual('feb-out', 'expense', 500, '2026-02-06'),
    actual('mar-in', 'income', 300, '2026-03-05'), actual('mar-out', 'expense', 800, '2026-03-06')
  ]
  const html = renderBudgetOverview(state, { today })
  assert.match(html, /data-budget-bar="2026-01:actual:balance"[^>]*aria-label="janeiro de 2026, Saldo realizado: \+R\$\s600,00, positivo"[^>]*class="budget-net budget-net--actual" data-tone="positive"/)
  assert.match(html, /data-budget-bar="2026-02:actual:balance"[^>]*aria-label="fevereiro de 2026, Saldo realizado: R\$\s0,00, zerado"[^>]*data-tone="zero"/)
  assert.match(html, /data-budget-bar="2026-03:actual:balance"[^>]*aria-label="março de 2026, Saldo realizado: −R\$\s500,00, negativo"[^>]*data-tone="negative"/)
  const net = [...html.matchAll(/<span class="budget-chart-net" data-tone="(\w+)" data-kind="(\w+)" aria-hidden="true">([^<]*)<\/span>/g)].map(match => match.slice(1))
  assert.deepEqual(net, [['positive', 'actual', '+600'], ['zero', 'actual', '0'], ['negative', 'actual', '−500']])
  // Expenses sit below zero: the bar starts at the zero line.
  const zero = Number(html.match(/class="is-zero" style="top:([\d.]+)px"/)[1])
  assert.match(html, new RegExp(`data-budget-bar="2026-03:actual:expenses"[^>]*class="budget-bar budget-bar--actual budget-bar--expenses is-negative"[^>]*style="top:${zero}px`))
  budgetOverviewView.metric = 'balance'
  const balance = renderBudgetOverview(state, { today })
  assert.match(balance, /data-budget-bar="2026-03:actual:balance"[^>]*class="budget-bar budget-bar--actual budget-bar--balance is-negative" data-tone="negative"/)
  assert.match(balance, /data-budget-bar="2026-02:actual:balance"[^>]*class="budget-bar budget-bar--actual budget-bar--balance" data-tone="zero"/)
  assert.match(balance, /class="budget-chart-ticks">.*>−520<\/span>/s, 'negative axis label uses the minus sign')
})

test('the values table lists every series, including the ones hidden by the filters', () => {
  Object.assign(budgetOverviewView, { income: false, planned: false })
  const html = renderBudgetOverview(fixture(), { today })
  const table = html.match(/<details class="budget-chart-table">(.*?)<\/details>/s)[1]
  assert.equal(count(table, /<tr>|<tr aria-current/g), 13)
  assert.match(table, /<tr aria-current="date"><th scope="row">Outubro de 2026<\/th>/)
  assert.match(table, /Receitas planejadas.*Receitas realizadas.*Despesas planejadas.*Despesas realizadas.*Saldo planejado.*Saldo realizado/s)
  assert.match(table, /<th scope="row">Agosto de 2026<\/th><td>R\$\s2\.000,00<\/td><td><span aria-hidden="true">—<\/span><span class="sr-only">Sem registros<\/span><\/td><td>R\$\s400,00<\/td><td>R\$\s350,00<\/td><td data-tone="positive">\+R\$\s1\.600,00<\/td><td data-tone="negative">−R\$\s350,00<small>sem receita lançada<\/small><\/td>/)
  budgetOverviewView.metric = 'balance'
  Object.assign(budgetOverviewView, { planned: true, actual: true })
  assert.match(renderBudgetOverview(fixture(), { today }), /aria-label="agosto de 2026, Saldo realizado: −R\$\s350,00, negativo\. Sem receita realizada lançada\. Mês futuro"/)
})

test('hidden mode removes amounts, bar heights and composition from the document', () => {
  const html = renderBudgetOverview({ ...fixture(), valuesHidden: true })
  assert.match(html, /Valores ocultos/)
  assert.doesNotMatch(html, /data-budget-bar|budget-net|budget-chart-table|24000|24\.000|height:|1860|1\.860/)
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

test('monthly expenses peak at 240 thousand uses a 250 thousand floor below zero', () => {
  const state = fixture()
  state.cashFlow.items = [item('peak', { amount: 240000 })]
  const html = renderBudgetOverview(state, { today })
  const axis = html.match(/class="budget-chart-ticks">(.*?)<\/div>/s)[1]
  assert.match(axis, /−250\s+mil/)
  assert.doesNotMatch(axis, /500\s+mil/)
  assert.match(html, /class="is-zero" style="top:0px"/, 'without income the zero line is the top of the plot')
  assert.match(html, /height:249\.6px/)
})

test('scale stays beyond visible planned and actual peaks across magnitudes', () => {
  for (const amount of [0.01, 1, 99, 100, 1001, 249999, 999999]) {
    resetBudgetOverview()
    const state = fixture()
    state.cashFlow.items = [item('planned', { amount: amount / 2 }), item('actual', { amount, recordKind: 'actual', frequency: 'occasional', startDate: '2026-08-03' })]
    const html = renderBudgetOverview(state, { today })
    const height = Number(html.match(/data-budget-bar="2026-08:actual:expenses"[^>]*height:([\d.]+)px/)[1])
    assert.ok(height > 221 && height <= 260, `peak ${amount}, height ${height}`)
    assert.doesNotMatch(html, /NaN|Infinity/)
  }
})


test('receipt and record-kind filters affect all marks without changing the underlying totals', () => {
  const state = fixture()
  const before = buildBudgetYear(state, 2026)
  for (const income of [true, false]) for (const planned of [true, false]) for (const actual of [true, false]) {
    Object.assign(budgetOverviewView, { income, planned, actual })
    const html = renderBudgetOverview(state, { today })
    const identifiers = ids(html)
    const plannedBars = planned ? 12 * (income ? 2 : 1) : 0
    const actualBars = actual ? 1 : 0
    const netMarks = income && planned ? 12 : 0
    assert.equal(count(html, /class="budget-bar budget-bar--planned/g), plannedBars)
    assert.equal(count(html, /class="budget-bar budget-bar--actual/g), actualBars)
    assert.equal(count(html, /class="budget-net /g), netMarks)
    assert.equal(identifiers.length, plannedBars + actualBars + netMarks)
    assert.equal(new Set(identifiers).size, identifiers.length, 'each mark identifies one distinct period, kind and metric')
    assert.equal(html.includes('budget-bar--planned budget-bar--income'), income && planned)
    assert.equal(html.includes('budget-chart-axis-net'), income && (planned || actual))
    assert.equal(count(html, /tabindex="0"/g), identifiers.length ? 1 : 0)
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
  const html = renderBudgetOverview(fixture(), { today })
  assert.equal(ids(html).length, 12)
  assert.doesNotMatch(html, /budget-bar--actual/)
  assert.match(html, /class="is-zero" style="top:260px"/)
})
