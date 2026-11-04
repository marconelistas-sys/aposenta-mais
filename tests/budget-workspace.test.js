import { cashFlowItemLimit } from '../src/shared/limits.js'
import { renderMonthTracking } from '../src/features/cash-flow/month-tracking.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetEntriesView, filterBudgetEntries, readBudgetFilters, resetBudgetEntriesView } from '../src/features/cash-flow/budget-entries-view.js'
import { budgetOwnerView } from '../src/shared/household-owner.js'
import { state, resetState } from '../src/app/state.js'
import { renderBudgetEntries, renderBudgetEntryResults, renderCashFlow, updateBudgetEntryResults } from '../src/features/cash-flow/cash-flow.js'
import { primaryNavigation } from '../src/app/navigation.js'

const item = (id, patch = {}) => ({ id, description: 'Salário principal', category: { name: 'Salário' }, type: 'income', amount: 1200, convertedAmount: 1200, currency: 'BRL', recordKind: 'planned', frequency: 'monthly', isActive: true, householdOwner: 'primary', ...patch })
const items = [item('salary'), item('future', { isActive: false }), item('undated', { frequency: 'occasional' }), item('expense', { description: 'Farmácia', category: { name: 'Saúde' }, type: 'expense', householdOwner: 'spouse', recordKind: 'actual', frequency: 'occasional', startDate: '2026-09-05' }), item('annual', { frequency: 'annual' })]

test.beforeEach(() => { resetState(); resetBudgetEntriesView() })

test('default period excludes inactive and undated one-off items, while all periods exposes them', () => {
  assert.deepEqual(filterBudgetEntries(items).map(x => x.id), ['salary', 'expense', 'annual'])
  assert.equal(filterBudgetEntries(items, { ...budgetEntriesView, period: 'all' }).length, 5)
})

test('search ignores accents and case, combines category, owner, type and record filters without mutating data', () => {
  const snapshot = structuredClone(items)
  const filters = { ...budgetEntriesView, search: ' SAUDE ', type: 'expense', recordKind: 'actual' }
  assert.deepEqual(filterBudgetEntries(items, filters, 'spouse').map(x => x.id), ['expense'])
  assert.deepEqual(filterBudgetEntries(items, filters, 'primary'), [])
  assert.deepEqual(filterBudgetEntries(items, { ...budgetEntriesView, search: 'SALARIO' }).map(x => x.id), ['salary', 'annual'])
  assert.deepEqual(items, snapshot)
})

test('filters stay in view state only and reset when changing accounts', () => {
  const before = JSON.stringify(state)
  const values = { search: 'farmácia', period: 'all', type: 'expense', recordKind: 'actual', owner: 'spouse' }
  readBudgetFilters({ elements: { namedItem: name => ({ value: values[name] }) } })
  assert.equal(budgetEntriesView.search, 'farmácia')
  assert.equal(budgetOwnerView.selected, 'spouse')
  assert.equal(JSON.stringify(state), before)
  resetBudgetEntriesView()
  assert.deepEqual(budgetEntriesView, { search: '', period: 'active', type: 'all', recordKind: 'all' })
  assert.equal(budgetOwnerView.selected, 'all')
})

test('budget has its own destination, list before modal forms, and cash flow links to it', () => {
  assert.ok(primaryNavigation.some(x => x.href === '/orcamento'))
  const html = renderBudgetEntries()
  assert.ok(html.indexOf('data-budget-results') < html.indexOf('data-new-cash-item-dialog'))
  assert.match(html, /data-new-cash-item-dialog aria-labelledby="cash-new-title"/)
  assert.match(html, /data-cash-item-edit-form/)
  assert.match(html, /data-statement-file/)
  assert.match(html, /data-open-budget-import/)
  const flow = renderCashFlow()
  assert.match(flow, /href="\/orcamento\?aba=resumo"/)
  assert.doesNotMatch(flow, /data-cash-item-form|data-cash-item-edit-form|data-budget-results/)
})

test('list counts results separately from stored capacity and shows amounts per occurrence', () => {
  const html = renderBudgetEntryResults({ convertedItems: items })
  assert.match(html, /3 de 5 lançamentos exibidos/)
  assert.doesNotMatch(html, /data-edit-cash-item="future"/)
  assert.match(html, /Mensal · Detalhes/)
  assert.match(renderBudgetEntries(), new RegExp(`${state.cashFlow.items.length} de 10.000 registros no cadastro`))
  assert.match(renderBudgetEntries(), /Registros anuais mostram o valor anual/)
})

test('derived entries link to their source and cannot be edited or deleted as manual entries', () => {
  const html = renderBudgetEntryResults({ convertedItems: [item('goal', { annualGoalId: 'g' }), item('consortium', { consortiumId: 'c' }), item('commitment', { commitmentId: 'd' }), item('ledger:1')] })
  for (const href of ['/consorcios', '/contas']) assert.ok(html.includes(`href="${href}"`))
  assert.match(html, /href="\/calendario"/)
  assert.doesNotMatch(html, /data-edit-cash-item|data-remove-cash-item/)
})

test('annual goal entries edit their provision in place instead of leaving the budget page', () => {
  const html = renderBudgetEntries()
  assert.match(html, /data-annual-goal-dialog/)
  assert.match(html, /data-annual-planning="annualGoals"/)
  const results = renderBudgetEntryResults({ convertedItems: [item('goal', { annualGoalId: 'g' })] })
  assert.match(results, /data-edit-annual-goal="g"/)
  assert.doesNotMatch(results, /href="\/calendario"/)
})

test('empty filters provide recovery, imported origins and unsafe names remain safe', () => {
  budgetEntriesView.search = '<script>'
  const empty = renderBudgetEntryResults({ convertedItems: items })
  assert.match(empty, /Nenhum lançamento encontrado/)
  assert.match(empty, /data-reset-budget-filters/)
  assert.match(renderBudgetEntries(), /value="&lt;script&gt;"/)
  resetBudgetEntriesView()
  const html = renderBudgetEntryResults({ convertedItems: [item('x', { source: 'txt', description: '<img src=x>' })] })
  assert.match(html, /&lt;img src=x&gt;/)
  assert.match(html, /Importado de extrato/)
  assert.doesNotMatch(html, /<img src=x>/)
})

test('privacy covers list and details, and filtering replaces only result content', () => {
  state.valuesHidden = true
  const html = renderBudgetEntryResults({ convertedItems: [item('x', { amount: 987654.32 })] })
  assert.match(html, /•••••/)
  assert.doesNotMatch(html, /987|654/)
  const target = { innerHTML: '' }
  const root = { querySelector(selector) { assert.equal(selector, '[data-budget-results]'); return target } }
  updateBudgetEntryResults(root)
  assert.match(target.innerHTML, /lançamentos exibidos/)
  assert.doesNotMatch(target.innerHTML, /data-budget-filters|data-new-cash-item-dialog/)
})

test('empty budget offers creation and capacity limit explains the disabled action beside the button', () => {
  const empty = renderBudgetEntryResults({ convertedItems: [] })
  assert.match(empty, /Seu orçamento ainda não tem lançamentos/)
  assert.match(empty, /data-new-cash-item/)
  assert.doesNotMatch(empty, /data-reset-budget-filters/)
  state.cashFlow.items = Array.from({ length: cashFlowItemLimit }, (_, index) => ({ ...state.cashFlow.items[0], id: `entry-${index}` }))
  const heading = renderBudgetEntries().split('</section>')[0]
  assert.match(heading, /data-new-cash-item disabled/)
  assert.match(heading, /Limite de 10.000 registros atingido/)
})

test('family summary remains independent of list filters including ownership', () => {
  const before = renderMonthTracking(state, { compact: true })
  assert.ok(renderBudgetEntries().includes(before))
  budgetEntriesView.type = 'expense'
  budgetEntriesView.search = 'nothing'
  budgetOwnerView.selected = 'spouse'
  const after = renderMonthTracking(state, { compact: true })
  assert.ok(renderBudgetEntries().includes(after))
  assert.equal(after, before)
})

test('resumo único do orçamento mostra despesas e saldo realizados do mês, com câmbio e sem transferências próprias', () => {
  state.currency = 'BRL'
  state.valuesHidden = false
  state.exchangeRates = { rates: { EUR: 1, BRL: 6, USD: 1.2, CHF: .9 }, date: '2026-09-01' }
  const actual = (id, type, amount, patch = {}) => ({ id, description: id, type, amount, currency: 'BRL', categoryId: type === 'income' ? 'salary' : 'groceries', recordKind: 'actual', frequency: 'occasional', startDate: '2026-09-05', endDate: '2026-09-05', ...patch })
  Object.assign(state.cashFlow, { referenceMonth: '2026-09', annualGoals: [], commitments: [], consortia: [], items: [
    actual('income', 'income', 1000), actual('expense', 'expense', 125),
    actual('foreign', 'expense', 15, { currency: 'CHF' }),
    actual('transfer', 'expense', 100000, { transferDecision: 'own' }),
    actual('planned', 'expense', 9000, { recordKind: 'planned' }),
    actual('other-month', 'expense', 99, { startDate: '2026-10-05', endDate: '2026-10-05' })
  ] })
  const metric = (html, key) => html.match(new RegExp(`data-cash-summary-actual="${key}"[^>]*>[\\s\\S]*?<dd[^>]*>([^<]+)</dd>`))?.[1]
  let html = renderBudgetEntries()
  assert.match(metric(html, 'income'), /1.000/)
  assert.match(metric(html, 'expenses'), /225/)
  assert.match(metric(html, 'balance'), /775/)
  state.cashFlow.referenceMonth = '2026-10'
  html = renderBudgetEntries()
  assert.equal(metric(html, 'income'), 'Sem registros')
  assert.match(metric(html, 'expenses'), /99/)
  assert.match(metric(html, 'balance'), /-.*99/)
  state.cashFlow.referenceMonth = '2026-11'
  html = renderBudgetEntries()
  assert.equal(metric(html, 'income'), 'Sem registros')
  assert.equal(metric(html, 'expenses'), 'Sem registros')
  assert.equal(metric(html, 'balance'), 'Sem registros')
})

test('resumo único do orçamento oculta valores e sinal do saldo realizado no modo privado', () => {
  state.valuesHidden = true
  Object.assign(state.cashFlow, { referenceMonth: '2026-09', annualGoals: [], commitments: [], consortia: [], items: [{ id: 'secret', description: 'Compra', categoryId: 'groceries', type: 'expense', amount: 987654.32, currency: 'BRL', frequency: 'occasional', startDate: '2026-09-01', recordKind: 'actual' }] })
  const html = renderBudgetEntries()
  const summary = html.match(/<dl class="metric-row cash-month-summary__actual">([\s\S]*?)<\/dl>/)?.[1]
  assert.match(summary, /Receitas realizadas/)
  assert.match(summary, /Despesas realizadas/)
  assert.match(summary, /Saldo realizado/)
  assert.match(summary, /•••/)
  assert.match(summary, /data-tone="neutral"/)
  assert.doesNotMatch(summary, /987|654|negative/)
})


test('resumo sem planejamento não anuncia equilíbrio e projeção não repete acompanhamento', () => {
  resetState()
  state.valuesHidden = false
  Object.assign(state.cashFlow, { referenceMonth: '2026-08', items: [], annualGoals: [], commitments: [], consortia: [] })
  const budget = renderBudgetEntries()
  assert.match(budget, /Sem orçamento cadastrado/)
  assert.doesNotMatch(budget, /Orçamento equilibrado/)
  assert.equal((budget.match(/class="panel settings-card cash-month-summary"/g) || []).length, 1)
  assert.equal((budget.match(/aria-label="Acompanhamento do mês"/g) || []).length, 1)
  assert.equal((budget.match(/data-page-tab="orcamento:/g) || []).length, 4)
  const projection = renderCashFlow()
  assert.doesNotMatch(projection, /cash-month-summary|month-tracking|data-cash-summary-actual/)
  assert.match(projection, /Projeção patrimonial/)
})
