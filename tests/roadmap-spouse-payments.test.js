import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, sanitizeCashFlow, createExportableState } from '../src/app/state-storage.js'
import { state, replaceFinancialData, updatePlan, addCashFlowItem, updateCashFlowItem } from '../src/app/state.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { financialCalendar } from '../src/domain/financial-calendar.js'
import { calculateMultiCurrencyCashFlow } from '../src/domain/cash-flow.js'
import { accountBalances } from '../src/domain/accounts.js'
import { paymentCalendarEvents, paymentEventKey, paymentCandidates, paymentMatchStatus, linkCalendarPayment, sanitizePaymentMatches } from '../src/domain/calendar-payments.js'
import { consortiumEvents } from '../src/domain/consortium.js'
import { renderPaymentList, paymentView } from '../src/features/cash-flow/payments.js'
import { planChecks } from '../src/domain/plan-checks.js'

const now = new Date('2026-09-14T12:00:00Z')
const salary = { id: 'salary', categoryId: 'salary', description: 'Salário cônjuge', amount: 1000, currency: 'BRL', type: 'income', frequency: 'monthly', recordKind: 'planned', householdOwner: 'spouse', endMode: 'spouse-retirement', startDate: '2026-01-01' }
const bill = { id: 'rent', categoryId: 'housing', description: 'Moradia', amount: 100, currency: 'BRL', type: 'expense', frequency: 'monthly', recordKind: 'planned', startDate: '2026-01-05' }
const source = (cash = {}, plan = {}) => sanitizeStoredState({ plan: { currentAge: 50, retirementAge: 65, spouseEnabled: true, spouseCurrentAge: 55, spouseRetirementAge: 60, spouseRetirementMonth: '2026-11', retirementMonth: '2030-01', expectedMonthlyBenefit: 0, spouseExpectedMonthlyBenefit: 0, ...plan }, cashFlow: { items: [salary], retirementMonth: '2030-01', ...cash } })
const paymentSource = () => source({ items: [bill], ledger: { accounts: [{ id: 'a', name: 'Conta BRL', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 1000 }, { id: 'b', name: 'Conta EUR', currency: 'EUR', openingDate: '2026-01-01', openingBalance: 1000 }], movements: [{ id: 'm', type: 'expense', accountId: 'a', amount: 100, date: '2026-09-06' }] } })

test('spouse salary stops before own retirement month across monthly budget and calendar, preserving manual dates', () => {
  const s = source({ items: [salary, { ...salary, id: 'manual', endMode: 'date', endDate: '2026-12-31' }] })
  const rows = cashFlowTimeline(s, '2026-10', 3)
  assert.deepEqual(rows.map(row => row.income), [2000, 1000, 1000])
  assert.equal(financialCalendar(s.cashFlow, '2026-10').events.length, 2)
  assert.equal(financialCalendar(s.cashFlow, '2026-11').events.length, 1)
  assert.equal(s.cashFlow.retirementMonth, '2030-01')
})

test('disabled or unconfirmed spouse does not leave linked salary indefinitely active and produces an actionable check', () => {
  const s = source({}, { spouseEnabled: false })
  assert.equal(cashFlowTimeline(s, '2026-10', 1)[0].income, 0)
  assert.ok(planChecks(s, now).some(check => check.id === 'spouse-income-end'))
  assert.deepEqual(financialCalendar(s.cashFlow, '2026-10').events, [])
})

test('editing spouse retirement moves only explicitly linked salary and survives export and restore', () => {
  replaceFinancialData(source())
  updatePlan({ spouseRetirementMonth: '2027-01' })
  assert.equal(state.cashFlow.spouseRetirementMonth, '2027-01')
  assert.equal(cashFlowTimeline(state, '2026-11', 1)[0].income, 1000)
  const restored = sanitizeStoredState(createExportableState(state))
  assert.equal(restored.cashFlow.items[0].endMode, 'spouse-retirement')
  assert.equal(restored.cashFlow.spouseRetirementMonth, '2027-01')
  updatePlan({ spouseEnabled: false })
  assert.equal(state.cashFlow.spouseRetirementMonth, null)
})

test('new spouse link requires spouse ownership and a confirmed date, while manual dates remain usable', () => {
  replaceFinancialData(source({ items: [] }))
  assert.throws(() => addCashFlowItem({ ...salary, householdOwner: 'shared' }), /titularidade/)
  assert.throws(() => addCashFlowItem({ ...salary, type: 'expense' }), /receita planejada/)
  addCashFlowItem(salary)
  const saved = state.cashFlow.items[0]
  updateCashFlowItem(saved.id, { ...saved, endMode: 'date', endDate: '2026-12-31' })
  updatePlan({ spouseRetirementMonth: '2026-10' })
  assert.equal(cashFlowTimeline(state, '2026-11', 1)[0].income, 1000)
})

test('matching a payment preserves balances, budget and planned schedule without creating another movement', () => {
  const s = paymentSource()
  const event = paymentCalendarEvents(s.cashFlow, '2026-09').events[0]
  const original = structuredClone(s.cashFlow)
  const matches = linkCalendarPayment(s.cashFlow, { month: '2026-09', eventKey: paymentEventKey(event), movementId: 'm' }, now)
  assert.deepEqual(s.cashFlow, original)
  const updated = { ...s.cashFlow, paymentMatches: matches }
  assert.equal(paymentMatchStatus(event, updated).status, 'linked')
  assert.deepEqual(accountBalances(updated.ledger, '2026-09-14'), accountBalances(original.ledger, '2026-09-14'))
  assert.deepEqual(calculateMultiCurrencyCashFlow(updated, 'BRL', s.exchangeRates, 0, [], now), calculateMultiCurrencyCashFlow(original, 'BRL', s.exchangeRates, 0, [], now))
  assert.equal(updated.ledger.movements.length, 1)
})

test('same movement cannot confirm another occurrence and transfer, currency, amount and future mismatches are excluded', () => {
  const s = paymentSource()
  const event = paymentCalendarEvents(s.cashFlow, '2026-09').events[0]
  s.cashFlow.ledger.movements.push(...[
    { id: 'income', type: 'income' }, { id: 'foreign', accountId: 'b' }, { id: 'amount', amount: 100.01 }, { id: 'future', date: '2026-10-01' }, { id: 'transfer', type: 'transfer', destinationId: 'b', receivedAmount: 100 }
  ].map(patch => ({ ...s.cashFlow.ledger.movements[0], ...patch })))
  assert.deepEqual(paymentCandidates(event, s.cashFlow, now).map(row => row.id), ['m'])
  s.cashFlow.paymentMatches = linkCalendarPayment(s.cashFlow, { month: '2026-09', eventKey: paymentEventKey(event), movementId: 'm' }, now)
  const october = paymentCalendarEvents(s.cashFlow, '2026-10').events[0]
  assert.throws(() => linkCalendarPayment(s.cashFlow, { month: '2026-10', eventKey: paymentEventKey(october), movementId: 'm' }, now), /ainda não utilizado/)
})

test('changed or removed movements and changed planned amounts require review', () => {
  const s = paymentSource()
  const event = paymentCalendarEvents(s.cashFlow, '2026-09').events[0]
  s.cashFlow.paymentMatches = linkCalendarPayment(s.cashFlow, { month: '2026-09', eventKey: paymentEventKey(event), movementId: 'm' }, now)
  const changed = structuredClone(s.cashFlow)
  changed.ledger.movements[0].amount = 99
  assert.equal(paymentMatchStatus(event, changed).status, 'review')
  changed.ledger.movements = []
  assert.equal(paymentMatchStatus(event, changed).status, 'review')
  assert.equal(paymentMatchStatus({ ...event, amount: 101 }, s.cashFlow).status, 'review')
  const revoked = { ...s.cashFlow, paymentMatches: [] }
  assert.equal(paymentMatchStatus(event, revoked).status, 'pending')
  assert.equal(revoked.ledger.movements.length, 1)
})

test('matches survive sanitization and export while duplicate and malformed records are rejected', () => {
  const s = paymentSource()
  const event = paymentCalendarEvents(s.cashFlow, '2026-09').events[0]
  s.cashFlow.paymentMatches = linkCalendarPayment(s.cashFlow, { month: '2026-09', eventKey: paymentEventKey(event), movementId: 'm' }, now)
  const match = s.cashFlow.paymentMatches[0]
  assert.equal(sanitizePaymentMatches([match, match, { ...match, eventKey: 'other', movementId: undefined }]).length, 1)
  const restored = sanitizeStoredState(createExportableState(s))
  assert.equal(paymentMatchStatus(event, restored.cashFlow).status, 'linked')
  assert.deepEqual(sanitizeCashFlow(s.cashFlow).paymentMatches, s.cashFlow.paymentMatches)
})

const consortium = { id: 'c', name: 'Consórcio', currency: 'BRL', referenceMonth: '2026-09', stage: 'pending', useType: 'asset', credit: 100000, principal: 80000, months: 80, administration: 800, reserve: 400, insurance: 2, annualAdjustment: 0, ownBid: 10000, embeddedBid: 20000, purchaseValue: 110000, assetReturn: 0, creditReturn: 0, awardMonth: '2026-09', earlyMonth: null, lateMonth: null, useMonth: '2026-09' }

test('consortium checklist separates installment, own bid and purchase top-up, never an embedded bid', () => {
  const s = source({ items: [], consortia: [consortium] })
  const events = paymentCalendarEvents(s.cashFlow, '2026-09').events
  assert.equal(events.length, 3)
  assert.equal(events.find(event => event.id.endsWith('own-bid')).amount, 10000)
  assert.equal(events.find(event => event.id.endsWith('top-up')).amount, 30000)
  assert.ok(!events.some(event => event.id.includes('embedded')))
  const total = events.reduce((sum, event) => sum + Math.round(event.amount * 100), 0)
  assert.equal(total, Math.round(consortiumEvents(s.cashFlow.consortia, '2026-09')[0].amount * 100))
  assert.ok(events.every(event => event.estimatedDate))
})

test('debt and goal payment events use calendar amounts including amortizations without creating new obligations', () => {
  const s = source({ items: [], commitments: [{ id: 'debt', name: 'Dívida', kind: 'debt', currency: 'BRL', date: '2026-09-05', amount: 1200, installments: 12, annualRate: 0, amortization: 'price', monthlyFee: 0, extraPayments: [{ month: '2026-09', amount: 100 }] }, { id: 'goal', name: 'Meta', kind: 'goal', currency: 'BRL', date: '2026-09-10', amount: 300, saved: 100 }] })
  const events = paymentCalendarEvents(s.cashFlow, '2026-09').events
  assert.deepEqual(events.map(event => event.amount), [200, 200])
  assert.deepEqual(events, financialCalendar(s.cashFlow, '2026-09').events)
})

test('calendar payment UI hides money, explains no duplicate posting, and shows orphaned matches for recovery', () => {
  const s = paymentSource()
  const event = paymentCalendarEvents(s.cashFlow, '2026-09').events[0]
  s.cashFlow.paymentMatches = linkCalendarPayment(s.cashFlow, { month: '2026-09', eventKey: paymentEventKey(event), movementId: 'm' }, now)
  replaceFinancialData(s)
  state.valuesHidden = true
  paymentView.selectedKey = paymentEventKey(event)
  paymentView.filter = 'all'
  const html = renderPaymentList('2026-09')
  assert.match(html, /•••••/)
  assert.doesNotMatch(html, /100,00|data-payment-dialog/)
  assert.match(html, /não adiciona outro realizado/)
  state.cashFlow.items = []
  assert.match(renderPaymentList('2026-09'), /vínculos sem vencimento correspondente/)
  assert.match(renderPaymentList('2026-09'), /data-payment-unlink/)
  state.valuesHidden = false
})

test('annual projection and monthly risk stop the spouse salary in the same month and retain the linked date in detail', async () => {
  const { finappViability } = await import('../src/domain/finapp-viability.js')
  const { prepareRiskInput, defaultRiskSettings } = await import('../src/domain/risk-plan.js')
  const s = source({}, { targetAge: 80 })
  const annual = finappViability(s, s.plan.finappMethod, now, { includeBreakdown: true })
  assert.equal(annual.rows[0].income, 10000)
  assert.equal(annual.rows[1].income, 0)
  const monthly = prepareRiskInput(s, { ...defaultRiskSettings, method: 'monthly', horizonMode: 'months', months: 12, simulations: 50 }, now)
  assert.deepEqual(monthly.timelines[0].slice(0, 3).map(row => row.income), [1000, 1000, 0])
  const detail = cashFlowTimeline(s, '2026-10', 1, { includeBreakdown: true })[0].breakdown.income[0]
  assert.equal(detail.retirement, '2026-11')
})

test('closing payment dialog returns focus to the triggering event', async () => {
  const { bindPaymentDialog } = await import('../src/features/cash-flow/payments.js')
  let close, focused = false
  paymentView.selectedKey = 'entry:2026-09-05'
  const button = { dataset: { paymentOpen: paymentView.selectedKey }, focus: () => { focused = true } }
  bindPaymentDialog({ querySelector: () => ({ addEventListener: (name, handler) => { assert.equal(name, 'close'); close = handler } }), querySelectorAll: () => [button] })
  close()
  assert.equal(focused, true)
})
