import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetPressure } from '../src/domain/budget-pressure.js'
import { renderBudgetPressure } from '../src/shared/budget-pressure.js'
import { simulateExpenseReduction } from '../src/domain/expense-impact.js'
import { annualRowsInPriceBasis } from '../src/domain/inflation-display.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { state, replaceFinancialData } from '../src/app/state.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { annualCashFlow } from '../src/domain/planning-horizon.js'
import { cashFlowDetailPanels } from '../src/shared/cash-flow-detail.js'
import { renderBudgetEntries } from '../src/features/cash-flow/cash-flow.js'
import { budgetEntriesView, resetBudgetEntriesView } from '../src/features/cash-flow/budget-entries-view.js'
import { expenseImpactView, resetExpenseImpact, calculateExpenseImpact, renderExpenseImpact, renderExpenseImpactResult } from '../src/features/cash-flow/expense-impact.js'
const now = new Date('2026-01-15T12:00:00Z')
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`)
const entry = (id, amount, extra = {}) => ({ id, name: id, amount, originalAmount: amount, currency: 'BRL', source: 'Orçamento', budgetGroup: 'variable', budgetItemId: id, category: 'Consumo', months: 2, ...extra })
const row = { year: '2026', months: 6, income: 1000, costs: 900, goals: 100, financialReturn: 0, breakdown: { income: [entry('Income', 1000)], costs: [entry('Small', 200), entry('Large', 500), entry('Pension', 200, { budgetGroup: 'pension' })], goals: [entry('Goal', 100)], pension: [entry('Pension', 200), entry('External pension', 500)], releases: [entry('Release', 4000)] } }
const fixture = (rate = 0) => sanitizeStoredState({ currency: 'BRL', plan: { currentAge: 50, retirementAge: 51, retirementMonth: '2027-01', targetAge: 52, horizonReferenceMonth: '2026-01', currentAssets: 10000, monthlyContribution: 0, annualRealReturn: rate, expectedMonthlyBenefit: 0, finappMethod: { openingYearPeriod: 1, openingConfirmed: true, pensionConfirmed: true, pensionMode: 'external' }, investments: [{ id: 'fund', name: 'Reserva', amount: 10000, monthlyContribution: 0, annualRealReturn: rate, returnType: 'real', liquidity: 'available', assetClass: 'fixed-income' }] }, cashFlow: { referenceMonth: '2026-01', retirementMonth: '2027-01', items: [
  { id: 'income', description: 'Aluguel recebido', type: 'income', categoryId: 'rent-income', currency: 'BRL', amount: 1000, frequency: 'monthly', recordKind: 'planned', startDate: '2026-01-01', endDate: '2028-12-31' },
  { id: 'expense', description: 'Mercado', type: 'expense', categoryId: 'groceries', currency: 'BRL', amount: 500, frequency: 'monthly', recordKind: 'planned', startDate: '2026-01-01', endDate: '2028-12-31' }
] } })

test('pressure ranks all outflows, counts funded pension once and excludes external pension and releases', () => {
  const snapshot = structuredClone(row)
  const result = budgetPressure(row)
  assert.equal(result.reconciled, true)
  assert.deepEqual(result.entries.map(item => item.id), ['Large', 'Pension', 'Small', 'Goal'])
  assert.equal(result.outflows, 1000)
  assert.equal(result.entries[0].share, 0.5)
  assert.equal(result.entries[1].kind, 'Previdência paga pelo orçamento')
  assert.equal(result.entries[1].adjustable, false)
  close(result.entries[0].monthly, 500 / 6)
  assert.deepEqual(row, snapshot)
})

test('nominal inflation scales money exactly once while preserving pressure shares and original currency values', () => {
  const nominal = annualRowsInPriceBasis([{ ...row, year: '2027' }], { basis: 'nominal', annualInflation: 0.1, baseYear: 2026 })[0]
  const result = budgetPressure(nominal)
  close(result.outflows, 1100)
  close(result.entries[0].share, 0.5)
  assert.equal(result.entries[0].originalAmount, 500)
  assert.match(renderBudgetPressure(nominal, 'BRL'), /nominais do ano selecionado/)
})

test('zero income and incomplete composition avoid misleading percentages and positive assessments', () => {
  const html = renderBudgetPressure({ ...row, income: 0 }, 'BRL')
  assert.match(html, /Sem receitas previstas/)
  assert.doesNotMatch(html, /Infinity|NaN|orçamento saudável/)
  assert.match(renderBudgetPressure({ ...row, costs: 901 }, 'BRL'), /Não foi possível conciliar/)
})

test('partial-year pressure uses included months and preserves the complete sorted detail', () => {
  const s = fixture()
  const points = cashFlowTimeline(s, '2026-07', 6, { includeBreakdown: true })
  const year = annualCashFlow(points)[0]
  const result = budgetPressure({ ...year, costs: year.expenses, goals: 0 })
  assert.equal(result.months, 6)
  assert.equal(result.entries[0].monthly, 500)
  const html = cashFlowDetailPanels([{ ...row, freeCashFlow: 0, pensionCredits: 0 }], s.plan, 'BRL')[0].html
  assert.ok(html.indexOf('O que mais pesa') < html.indexOf('Composição completa'))
  assert.match(html, /Média mensal = total dividido por 6/)
  assert.match(html, /data-expense-impact="Large"/)
  assert.doesNotMatch(html, /data-expense-impact="Pension"/)
})

test('monthly pressure ignores list filters and disappears under privacy mode', () => {
  replaceFinancialData(fixture())
  resetBudgetEntriesView()
  const extract = () => renderBudgetEntries().split('class="panel budget-month-pressure"')[1]?.split('class="panel budget-workspace"')[0]
  const original = extract()
  budgetEntriesView.search = 'nothing'
  budgetEntriesView.recordKind = 'actual'
  assert.equal(extract(), original)
  state.valuesHidden = true
  assert.equal(extract(), undefined)
  assert.deepEqual(cashFlowDetailPanels([row], state.plan, 'BRL', true), [])
  state.valuesHidden = false
  resetBudgetEntriesView()
})

test('zero reduction exactly reproduces baseline financial results without changing the state', () => {
  const s = fixture(0.05), snapshot = structuredClone(s)
  const result = simulateExpenseReduction(s, { itemId: 'expense', percent: 0, startYear: 2027 }, now)
  for (let index = 0; index < result.changed.length; index++) for (const key of ['financialAssets', 'liquidAssets', 'netWorth', 'freeCashFlow', 'withdrawalTax']) close(result.changed[index][key], result.baseline.rows[index][key])
  assert.equal(result.totalReduction, 0)
  assert.deepEqual(s, snapshot)
})

test('single-expense scenario respects start year and differs from accumulated spending when returns are nonzero', () => {
  const s = fixture(0.1)
  const result = simulateExpenseReduction(s, { itemId: 'expense', percent: 10, startYear: 2027 }, now)
  close(result.totalReduction, 1200)
  close(result.finalDifference, 1260)
  close(result.changed[0].financialAssets, result.baseline.rows[0].financialAssets)
  close(result.changed[1].freeCashFlow - result.baseline.rows[1].freeCashFlow, 600)
})

test('scenario matches a separately edited recurring expense split at the selected year', () => {
  const s = fixture(0.07)
  const result = simulateExpenseReduction(s, { itemId: 'expense', percent: 20, startYear: 2027 }, now)
  const edited = structuredClone(s)
  edited.cashFlow.items[1].endDate = '2026-12-31'
  edited.cashFlow.items.push({ ...s.cashFlow.items[1], id: 'reduced', amount: 400, startDate: '2027-01-01' })
  const expected = finappViability(edited, undefined, now)
  for (let index = 0; index < expected.rows.length; index++) for (const key of ['costs', 'financialAssets', 'liquidAssets', 'financialReturn']) close(result.changed[index][key], expected.rows[index][key])
})

test('expired or one-off expenses are never renewed and ineligible records cannot be simulated', () => {
  const s = fixture()
  s.cashFlow.items[1].endDate = '2026-12-31'
  assert.equal(simulateExpenseReduction(s, { itemId: 'expense', percent: 100, startYear: 2027 }, now).totalReduction, 0)
  for (const patch of [{ categoryId: 'debt' }, { categoryId: 'private-pension' }, { recordKind: 'actual' }, { source: 'txt' }, { type: 'income' }]) {
    const copy = fixture()
    Object.assign(copy.cashFlow.items[1], patch)
    assert.throws(() => simulateExpenseReduction(copy, { itemId: 'expense', percent: 10, startYear: 2027 }, now), /despesa planejada de consumo/)
  }
  s.cashFlow.items[1] = { ...s.cashFlow.items[1], frequency: 'occasional', startDate: '2027-02-01', endDate: null }
  close(simulateExpenseReduction(s, { itemId: 'expense', percent: 10, startYear: 2027 }, now).totalReduction, 50)
})

test('invalid percentages and dates fail, with no synthetic extension of the saved horizon', () => {
  const s = fixture()
  for (const percent of [-1, 101, NaN]) assert.throws(() => simulateExpenseReduction(s, { itemId: 'expense', percent, startYear: 2027 }, now), /redução/)
  assert.throws(() => simulateExpenseReduction(s, { itemId: 'expense', percent: 10, startYear: 2029 }, now), /horizonte/)
  assert.throws(() => simulateExpenseReduction(s, { itemId: 'expense', percent: 10, startYear: 2027, targetAge: 75 }, now), /idade-alvo salva/)
})

test('simulation view clears on privacy and flags changes in the underlying plan', () => {
  const s = fixture()
  // UI uses the current clock, keep a valid target horizon regardless of the test date.
  s.plan.horizonReferenceMonth = new Date().toISOString().slice(0, 7)
  replaceFinancialData(s)
  resetExpenseImpact()
  expenseImpactView.input = { itemId: 'expense', targetAge: s.plan.targetAge, percent: 10, startYear: new Date().getFullYear() }
  calculateExpenseImpact(new Map([['percent', '10'], ['startYear', String(new Date().getFullYear())]]))
  assert.match(renderExpenseImpactResult(), /Menor desembolso acumulado/)
  state.plan.annualRealReturn += 0.01
  assert.match(renderExpenseImpactResult(), /dados do plano mudaram/)
  state.valuesHidden = true
  assert.equal(renderExpenseImpact(), '')
  assert.equal(renderExpenseImpactResult(), '')
  resetExpenseImpact()
  state.valuesHidden = false
})

test('balanced periods are described as balanced rather than as a positive surplus', () => {
  const html = renderBudgetPressure(row, 'BRL')
  assert.match(html, /receitas e saídas estão equilibradas/)
  assert.doesNotMatch(html, /O saldo positivo/)
  const monthly = renderBudgetPressure(row, 'BRL', { monthly: true, limit: 1 })
  assert.doesNotMatch(monthly, /Consulte a lista completa abaixo/)
})

test('foreign currency reduction respects included months and leaves funded pension and contracts unchanged', () => {
  const s = fixture()
  s.cashFlow.items[1] = { ...s.cashFlow.items[1], currency: 'EUR', frequency: 'annual', amount: 1200, startDate: '2027-07-01', endDate: '2027-12-31' }
  s.cashFlow.items.push({ ...s.cashFlow.items[1], id: 'pension', categoryId: 'private-pension', frequency: 'monthly', amount: 50, currency: 'BRL' })
  s.plan.finappMethod.pensionMode = 'cash-funded'
  const result = simulateExpenseReduction(s, { itemId: 'expense', percent: 10, startYear: 2027 }, now)
  const expense = result.baseline.rows[1].breakdown.costs.find(item => item.budgetItemId === 'expense')
  close(result.totalReduction, expense.amount * 0.1)
  assert.equal(result.baseline.rows[1].pensionCredits, result.changed[1].pensionCredits)
  assert.equal(result.baseline.rows[1].liabilities, result.changed[1].liabilities)
  assert.equal(result.deltas[2].reduction, 0)
})
