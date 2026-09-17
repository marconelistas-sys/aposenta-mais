import test from 'node:test'
import assert from 'node:assert/strict'
import { annualGoalEvents, sanitizeAnnualRows } from '../src/domain/annual-planning.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'
import { resetState, state } from '../src/app/state.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { saveAnnualPlanning, renderAnnualPlanning } from '../src/features/plan/annual-planning.js'

const row = { id: 'trip', name: 'Viagem de férias', currency: 'BRL', amount: 12000, startYear: 2026, endYear: 2030, everyYears: 1, realGrowth: 0 }

test('provisão anual guarda e usa a categoria escolhida', () => {
  const [clean] = sanitizeAnnualRows([{ ...row, categoryId: 'travel' }])
  assert.equal(clean.categoryId, 'travel')
  assert.equal(annualGoalEvents([clean], '2026-03')[0].categoryId, 'travel')
  assert.equal(annualGoalEvents([row], '2026-03')[0].categoryId, 'other-expense')
  assert.equal(Object.hasOwn(sanitizeAnnualRows([row])[0], 'categoryId'), false)
})

test('orçamento classifica a provisão na categoria e recorre a outras despesas quando ela não existe', () => {
  const cashFlow = { ...defaultCashFlow, items: [], annualGoals: [{ ...row, categoryId: 'travel' }] }
  const rates = state.exchangeRates
  const travel = calculateMultiCurrencyCashFlow(cashFlow, 'BRL', rates, 0, [], new Date('2026-03-15T12:00:00Z'))
  assert.equal(travel.convertedItems[0].category.id, 'travel')
  const missing = calculateMultiCurrencyCashFlow({ ...defaultCashFlow, items: [], annualGoals: [{ ...row, categoryId: 'custom-apagada' }] }, 'BRL', rates, 0, [], new Date('2026-03-15T12:00:00Z'))
  assert.equal(missing.convertedItems[0].category.id, 'other-expense')
  assert.ok(missing.monthlyExpenses > 0)
})

test('edição salva a categoria e recusa categoria de receita', () => {
  resetState()
  state.cashFlow.annualGoals = [row]
  const form = values => new URLSearchParams({ kind: 'annualGoals', id: 'trip', name: row.name, currency: 'BRL', amount: '12000', startYear: '2026', endYear: '2030', everyYears: '1', realGrowth: '0', ...values })
  saveAnnualPlanning(form({ categoryId: 'travel' }))
  assert.equal(state.cashFlow.annualGoals.find(item => item.id === 'trip').categoryId, 'travel')
  assert.throws(() => saveAnnualPlanning(form({ categoryId: 'salary' })), /categoria de despesa/)
  assert.match(renderAnnualPlanning('annualGoals'), /name="categoryId"/)
  assert.match(renderAnnualPlanning('annualGoals'), /Viagens/)
})

test('compromissos do calendário usam a categoria escolhida', async () => {
  const { sanitizeCommitments, commitmentEvents, prepareCommitmentSchedules } = await import('../src/domain/financial-calendar.js')
  const goal = { id: 'g', name: 'Viagem 2027', kind: 'goal', currency: 'BRL', date: '2027-06-01', amount: 20000, saved: 0, categoryId: 'travel' }
  const [clean] = sanitizeCommitments([goal])
  assert.equal(clean.categoryId, 'travel')
  const debt = { id: 'd', name: 'Financiamento', kind: 'debt', currency: 'BRL', date: '2026-10-01', amount: 12000, installments: 12, annualRate: 0 }
  const events = commitmentEvents([debt, { ...debt, id: 'h', categoryId: 'housing' }], '2026-10', prepareCommitmentSchedules([debt, { ...debt, id: 'h', categoryId: 'housing' }]))
  assert.deepEqual(events.map(item => item.categoryId).sort(), ['debt', 'housing'])
})
