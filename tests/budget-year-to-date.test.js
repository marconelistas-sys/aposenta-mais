import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBudgetYearToDate } from '../src/domain/budget-year-to-date.js'
import { budgetExpenseAccumulated } from '../src/domain/budget-expense-overruns.js'
import { buildBudgetYear, budgetExpenseCategories } from '../src/domain/budget-overview.js'
import { renderBudgetYearToDate, budgetYearToDateView, resetBudgetYearToDate } from '../src/features/cash-flow/budget-year-to-date.js'
import { entryDetails } from '../src/shared/budget-category-entries.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { bundledExchangeRates } from '../src/shared/exchange-rates.js'

const today = new Date(2026, 10, 3)
const plan = { id: 'health-plan', description: 'Saúde planejada', categoryId: 'health', type: 'expense', amount: 870, currency: 'CHF', frequency: 'monthly', recordKind: 'planned' }
const actual = (id, categoryId, type, amount, date, extra = {}) => ({ id, description: id, categoryId, type, amount, currency: 'CHF', recordKind: 'actual', frequency: 'occasional', startDate: date, ...extra })

function fixture(items = [plan], referenceMonth = '2026-09') {
  return { currency: 'CHF', valuesHidden: false, exchangeRates: bundledExchangeRates, customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, referenceMonth, commitments: [], annualGoals: [], consortia: [], items } }
}
const monthly = amounts => amounts.map((amount, index) => actual(`health-${index}`, 'health', 'expense', amount, `2026-${String(index + 1).padStart(2, '0')}-09`))
const health = model => model.categories.expenses.find(row => row.categoryId === 'health')

test.beforeEach(() => resetBudgetYearToDate())

test('category type is back-compatible and passes through the accumulated model', () => {
  const state = fixture([plan, { ...plan, id: 'salary', categoryId: 'salary', type: 'income', amount: 5000 }])
  const year = buildBudgetYear(state, 2026)
  assert.deepEqual(budgetExpenseCategories(year.annual).categories.map(row => row.categoryId), ['health'])
  assert.deepEqual(budgetExpenseCategories(year.annual, 'income').categories.map(row => row.categoryId), ['salary'])
  assert.equal(budgetExpenseAccumulated(year, '09', 'income').categories[0].annualPlanned, 60000)
  assert.equal(budgetExpenseAccumulated(year, '09').categories[0].categoryId, 'health')
})

test('pace above plan keeps the annual quota remaining', () => {
  const state = fixture([plan, ...monthly([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])])
  const snapshot = structuredClone(state)
  const model = buildBudgetYearToDate(state)
  const row = health(model)
  assert.equal(model.monthCount, 9)
  assert.equal(model.lastMonth, '2026-09')
  assert.equal(model.isDecember, false)
  assert.equal(row.plannedToDate, 7830)
  assert.equal(row.annualPlanned, 10440)
  assert.equal(row.actual, 9000)
  assert.equal(row.paceDelta, 1170)
  assert.equal(row.remaining, 1440)
  assert.equal(row.status, 'above-pace')
  assert.ok(Math.abs(row.pacePercent - 1170 / 7830) < 1e-9)
  assert.equal(model.totals.expenses.annualPlanned, 10440)
  assert.equal(model.totals.balance.actual, -9000)
  assert.deepEqual(state, snapshot)
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /Acumulado de janeiro a setembro de 2026/)
  assert.match(html, /Acima do ritmo/)
  assert.match(html, /1\.170,00 acima do planejado até set · Restam CHF\s1\.440,00 da cota anual/)
})

test('quota exceeded by 560 and exact exhaustion use cents', () => {
  const exceeded = health(buildBudgetYearToDate(fixture([plan, actual('big', 'health', 'expense', 11000, '2026-02-10')])))
  assert.equal(exceeded.status, 'quota-exceeded')
  assert.equal(exceeded.remaining, -560)
  const exact = health(buildBudgetYearToDate(fixture([plan, actual('exact', 'health', 'expense', 10440, '2026-02-10')])))
  assert.equal(exact.status, 'quota-exhausted')
  assert.equal(exact.remaining, 0)
  const html = renderBudgetYearToDate(fixture([plan, actual('big', 'health', 'expense', 11000, '2026-02-10')]), { today })
  assert.match(html, /Cota anual ultrapassada/)
  assert.match(html, /560,00 acima da cota anual/)
  assert.match(html, /budget-ytd-over/)
})

test('realized after the selected month is excluded', () => {
  const model = buildBudgetYearToDate(fixture([plan, ...monthly([870, 870]), actual('later', 'health', 'expense', 99999, '2026-10-05')]))
  assert.equal(health(model).actual, 1740)
  assert.equal(model.totals.expenses.actual, 1740)
  assert.deepEqual(model.coverage.expenses.monthsWithActual, ['2026-01', '2026-02'])
  assert.equal(model.coverage.expenses.monthsWithoutActual.length, 7)
})

test('spending ahead of a plan that only exists in November is anticipated, not unplanned', () => {
  const november = { ...plan, id: 'nov', amount: 1200, frequency: 'occasional', startDate: '2026-11-10' }
  const state = fixture([november, actual('early', 'health', 'expense', 300, '2026-05-02')])
  const model = buildBudgetYearToDate(state)
  const row = health(model)
  assert.equal(row.plannedToDate, 0)
  assert.equal(row.annualPlanned, 1200)
  assert.equal(row.status, 'anticipated')
  assert.equal(row.pacePercent, null)
  assert.equal(model.unplanned.expenses.length, 0)
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /Gasto antecipado/)
  assert.match(html, /Previsto após [a-zç]+ de \d{4} \(compõe a cota anual\)/)
})

test('categories without an annual plan are listed apart with the plan action', () => {
  const state = fixture([plan, actual('cinema', 'leisure', 'expense', 80, '2026-04-02')])
  const model = buildBudgetYearToDate(state)
  assert.deepEqual(model.unplanned.expenses.map(row => row.categoryId), ['leisure'])
  assert.equal(model.categories.expenses.some(row => row.categoryId === 'leisure'), false)
  assert.equal(model.totals.expenses.actual, 80)
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /Sem planejamento no ano: 1 categoria\(s\)/)
  assert.match(html, /data-plan-budget-category="leisure" data-plan-budget-month="2026-09"/)
})

test('income uses its own statuses and wording', () => {
  const salary = { ...plan, id: 'salary', categoryId: 'salary', type: 'income', amount: 5000 }
  const bonus = { ...plan, id: 'bonus', categoryId: 'business', type: 'income', amount: 1000, frequency: 'occasional', startDate: '2026-03-01' }
  const state = fixture([plan, salary, bonus, actual('s1', 'salary', 'income', 5000, '2026-01-25'), actual('s2', 'salary', 'income', 5000, '2026-02-25'), actual('b1', 'business', 'income', 1500, '2026-03-02')])
  const model = buildBudgetYearToDate(state)
  const rows = Object.fromEntries(model.categories.income.map(row => [row.categoryId, row]))
  assert.equal(rows.salary.status, 'below-forecast')
  assert.equal(rows.salary.remaining, 50000)
  assert.equal(rows.business.status, 'annual-reached')
  assert.equal(model.totals.income.plannedToDate, 46000)
  assert.equal(model.totals.balance.plannedToDate, 46000 - 7830)
  budgetYearToDateView.type = 'income'
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /aria-pressed="true">Receitas/)
  assert.match(html, /Abaixo do previsto/)
  assert.match(html, /Previsão anual atingida/)
  assert.match(html, /Falta receber CHF\s50\.000,00 no ano/)
  assert.ok(html.indexOf('data-budget-ytd-category="salary"') < html.indexOf('data-budget-ytd-category="business"'))
})

test('coverage lists missing months and the attention sort is configurable', () => {
  const groceries = { ...plan, id: 'food', categoryId: 'groceries', amount: 2000 }
  const state = fixture([plan, groceries, actual('h', 'health', 'expense', 9000, '2026-03-02'), actual('g', 'groceries', 'expense', 100, '2026-03-02')])
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /Realizado registrado em 1 de 9 meses\. Sem registros: jan, fev, abr, mai, jun, jul, ago, set\. Ausência de registros não confirma ausência de gastos\./)
  assert.ok(html.indexOf('data-budget-ytd-category="health"') < html.indexOf('data-budget-ytd-category="groceries"'))
  budgetYearToDateView.sort = 'quota'
  const byQuota = renderBudgetYearToDate(state, { today })
  assert.ok(byQuota.indexOf('data-budget-ytd-category="groceries"') < byQuota.indexOf('data-budget-ytd-category="health"'))
})

test('December planned to date equals the annual quota', () => {
  const state = fixture([plan, ...monthly([870])], '2026-12')
  const model = buildBudgetYearToDate(state)
  assert.equal(model.isDecember, true)
  assert.equal(health(model).plannedToDate, health(model).annualPlanned)
  assert.match(renderBudgetYearToDate(state, { today: new Date(2027, 0, 5) }), /Em dezembro, o planejado até o mês é igual à cota anual\./)
})

test('empty, future and no-realized states', () => {
  assert.match(renderBudgetYearToDate(fixture([]), { today }), /Nenhum planejamento cadastrado para 2026\.[\s\S]*data-new-cash-item/)
  const noActual = renderBudgetYearToDate(fixture([plan]), { today })
  assert.match(noActual, /Nenhum realizado registrado de janeiro a setembro\./)
  assert.match(noActual, /budget-ytd-tick/)
  assert.match(noActual, /class="budget-ytd-fill" style="width:0%"/)
  assert.match(renderBudgetYearToDate(fixture([plan], '2027-02'), { today }), /Fevereiro de 2027 ainda não chegou/)
  assert.doesNotMatch(noActual, /ainda não chegou/)
  const zero = buildBudgetYearToDate(fixture([plan, { ...plan, id: 'z', categoryId: 'leisure', amount: 0 }]))
  assert.equal(zero.categories.expenses.some(row => row.categoryId === 'leisure'), false)
  assert.throws(() => buildBudgetYearToDate(fixture([plan]), '2026-13'), RangeError)
  assert.throws(() => buildBudgetYearToDate(fixture([plan]), 'set'), RangeError)
})

test('hidden values render no amounts or bars', () => {
  const state = { ...fixture([plan, ...monthly([900])]), valuesHidden: true }
  const html = renderBudgetYearToDate(state, { today })
  assert.match(html, /Valores ocultos\. Exiba os valores para consultar o acumulado\./)
  assert.doesNotMatch(html, /CHF|R\$|budget-ytd-bullet|budget-ytd-card/)
})

test('converted currencies are disclosed', () => {
  const state = fixture([plan, { ...plan, id: 'eur', categoryId: 'groceries', currency: 'EUR', amount: 100 }])
  assert.match(renderBudgetYearToDate(state, { today }), /Valores em CHF com as taxas de câmbio atuais\. Convertidos de EUR\./)
})

test('entry details keep their default output for existing callers', () => {
  const group = { categoryId: 'health', category: 'Saúde', entries: { planned: [{ id: 'x', description: 'X', month: '2026-11', amount: 10, currency: 'CHF' }], actual: [] } }
  const state = fixture([])
  const html = entryDetails(group, state)
  assert.match(html, /^<details class="budget-category-details" data-budget-category-details="health"><summary>Saúde<small>Ver lançamentos<\/small><\/summary>/)
  assert.doesNotMatch(html, /compõe a cota/)
  assert.match(entryDetails(group, state, { accumulated: true }), /data-budget-overrun-category-details="health"/)
  const custom = entryDetails(group, state, { attribute: 'data-x', lastMonth: '2026-09', summary: '<b>S</b>', className: 'extra' })
  assert.match(custom, /class="budget-category-details extra" data-x="health"><summary><b>S<\/b><\/summary>/)
  assert.match(custom, /Previsto após [a-zç]+ de \d{4} \(compõe a cota anual\)/)
})

test('balance card shows surplus, deficit and zero with sign, tone and text', () => {
  const salary = { ...plan, id: 'salary', categoryId: 'salary', type: 'income', amount: 5000 }
  const deficit = renderBudgetYearToDate(fixture([plan, ...monthly([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000])]), { today })
  assert.match(deficit, /budget-ytd-card--balance" data-budget-ytd-balance="deficit"/)
  assert.match(deficit, /budget-ytd-chip--danger">[\s\S]*?Déficit acumulado<\/span>/)
  assert.match(deficit, /<dt>Saldo acumulado até set<\/dt><dd class="budget-ytd-balance-value is-unfavorable">−CHF\s9\.000,00<\/dd>/)
  assert.match(deficit, /<dt>Planejado até set<\/dt><dd>−CHF\s7\.830,00<\/dd>/)
  assert.match(deficit, /budget-ytd-card--balance[\s\S]*<dd class="budget-ytd-delta is-unfavorable">−CHF\s1\.170,00<small>abaixo do planejado/)

  const surplus = renderBudgetYearToDate(fixture([plan, salary, ...monthly([870, 870]), actual('s1', 'salary', 'income', 5000, '2026-01-25'), actual('s2', 'salary', 'income', 5000, '2026-02-25')]), { today })
  assert.match(surplus, /data-budget-ytd-balance="surplus"/)
  assert.match(surplus, /budget-ytd-chip--success">[\s\S]*?Superávit acumulado<\/span>/)
  assert.match(surplus, /<dd class="budget-ytd-balance-value is-favorable">\+CHF\s8\.260,00<\/dd>/)
  assert.match(surplus, /<dt>Planejado até set<\/dt><dd>\+CHF\s37\.170,00<\/dd>/)

  const even = renderBudgetYearToDate(fixture([plan, { ...salary, amount: 870 }, ...monthly([870]), actual('s1', 'salary', 'income', 870, '2026-01-25')]), { today })
  assert.match(even, /data-budget-ytd-balance="even"/)
  assert.match(even, /budget-ytd-chip--neutral">[\s\S]*?Saldo zerado<\/span>/)
  assert.match(even, /<dd class="budget-ytd-balance-value">CHF\s0,00<\/dd>/)

  const none = renderBudgetYearToDate(fixture([plan]), { today })
  assert.doesNotMatch(none, /data-budget-ytd-balance=|Superávit|Déficit|Saldo zerado/)
  assert.match(none, /<dd class="budget-ytd-balance-value">Sem registros<\/dd>/)
})

test('annual quota excess is unfavorable and income above the annual forecast is favorable', () => {
  const expense = renderBudgetYearToDate(fixture([plan, actual('big', 'health', 'expense', 11000, '2026-02-10')]), { today })
  assert.match(expense, /<dt>Excesso sobre a cota anual<\/dt><dd class="is-unfavorable">\+CHF\s560,00<\/dd>/)
  const withinQuota = renderBudgetYearToDate(fixture([plan, ...monthly([870])]), { today })
  assert.match(withinQuota, /<dt>Saldo da cota anual<\/dt><dd>CHF\s9\.570,00<\/dd>/)
  const bonus = { ...plan, id: 'bonus', categoryId: 'business', type: 'income', amount: 1000, frequency: 'occasional', startDate: '2026-03-01' }
  const income = renderBudgetYearToDate(fixture([plan, bonus, actual('b1', 'business', 'income', 1500, '2026-03-02')]), { today })
  assert.match(income, /<dt>Acima da previsão anual<\/dt><dd class="is-favorable">\+CHF\s500,00<\/dd>/)
})
