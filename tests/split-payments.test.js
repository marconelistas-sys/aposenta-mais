import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { accountBalances } from '../src/domain/accounts.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { paymentCalendarEvents, paymentEventKey, paymentCandidates, paymentMatchStatus, linkCalendarPayment, unlinkCalendarPayment, paymentMovementAllocation, paymentAllocatedCents, sanitizePaymentMatches } from '../src/domain/calendar-payments.js'
import { renderPaymentList, renderPaymentSelectionPreview, bindPaymentDialog, paymentView } from '../src/features/cash-flow/payments.js'

const now = new Date('2026-09-14T12:00:00Z')
const source = (total = 1000, amounts = [600, 400]) => sanitizeStoredState({ currency: 'BRL', cashFlow: {
  referenceMonth: '2026-09', items: amounts.map((amount, index) => ({ id: `bill${index}`, description: `Conta ${index}`, categoryId: 'housing', type: 'expense', recordKind: 'planned', frequency: 'occasional', amount, currency: 'BRL', startDate: index ? '2026-10-05' : '2026-09-05' })),
  ledger: { accounts: [{ id: 'bank', name: 'Conta', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 2000 }], movements: [{ id: 'payment', accountId: 'bank', type: 'expense', date: '2026-09-10', amount: total }] }
} })
const eventOf = (flow, month) => paymentCalendarEvents(flow, month).events[0]
const add = (flow, month, amount) => ({ ...flow, paymentMatches: linkCalendarPayment(flow, { month, eventKey: paymentEventKey(eventOf(flow, month)), movementId: 'payment', amount }, now) })
const available = flow => paymentMovementAllocation(flow.ledger.movements[0], flow).availableCents

test('one payment can cover different months without double counting the movement or projection', () => {
  const value = source(), before = structuredClone(value)
  const first = add(value.cashFlow, '2026-09', 600)
  assert.equal(available(first), 40000)
  const candidate = paymentCandidates(eventOf(first, '2026-10'), first, now, { allowSplit: true })[0]
  assert.equal(candidate.amount, 1000)
  assert.equal(candidate.availableAmount, 400)
  assert.equal(candidate.suggestedAmount, 400)
  const next = add(first, '2026-10', 400)
  assert.equal(available(next), 0)
  for (const month of ['2026-09', '2026-10']) assert.equal(paymentMatchStatus(eventOf(next, month), next).status, 'linked')
  assert.deepEqual(next.paymentMatches.map(match => match.allocatedCents), [60000, 40000])
  assert.deepEqual(accountBalances(next.ledger, '2026-09-14'), accountBalances(value.cashFlow.ledger, '2026-09-14'))
  assert.deepEqual(cashFlowTimeline({ ...value, cashFlow: next }, '2026-09', 12), cashFlowTimeline(value, '2026-09', 12))
  assert.deepEqual(value, before)
})

test('both movement capacity and event remainder are enforced and failed allocations are atomic', () => {
  const flow = source(1000, [800, 800]).cashFlow
  assert.throws(() => add(flow, '2026-09', 800.01), /restante deste vencimento/)
  const first = add(flow, '2026-09', 700), before = structuredClone(first)
  assert.throws(() => add(first, '2026-10', 300.01), /saldo ainda não associado/)
  assert.throws(() => add(first, '2026-09', 50), /ainda não utilizado/)
  for (const amount of [0, -1, NaN, Infinity, '', .001, 1.234]) assert.throws(() => add(first, '2026-10', amount), /positivo|casas decimais/)
  assert.deepEqual(first, before)
})

test('cent allocations consume the movement exactly and undo releases only that portion', () => {
  const flow = add(add(source(.3, [.1, .2]).cashFlow, '2026-09', .1), '2026-10', .2)
  assert.equal(available(flow), 0)
  const undone = { ...flow, paymentMatches: unlinkCalendarPayment(flow, { eventKey: paymentEventKey(eventOf(flow, '2026-09')), movementId: 'payment' }) }
  assert.equal(available(undone), 10)
  assert.equal(paymentMatchStatus(eventOf(undone, '2026-10'), undone).status, 'linked')
  assert.equal(paymentMatchStatus(eventOf(undone, '2026-09'), undone).status, 'pending')
  assert.equal(available(add(undone, '2026-09', .1)), 0)
})

test('editing or removing a shared movement invalidates all allocations rather than freeing its amount', () => {
  for (const edit of ['amount', 'date', 'remove']) {
    const flow = add(add(source().cashFlow, '2026-09', 600), '2026-10', 400)
    if (edit === 'amount') flow.ledger.movements[0].amount = 1200
    if (edit === 'date') flow.ledger.movements[0].date = '2026-09-11'
    if (edit === 'remove') flow.ledger.movements = []
    for (const month of ['2026-09', '2026-10']) {
      const assessment = paymentMatchStatus(eventOf(flow, month), flow)
      assert.equal(assessment.status, 'review')
      assert.equal(assessment.matchedAmount, null)
    }
    assert.equal(available(flow), 0)
  }
})

test('conflicting imported portions over the original payment flag every affected event for review', () => {
  const flow = source(1000, [800, 800]).cashFlow
  flow.paymentMatches = [add(flow, '2026-09', 800).paymentMatches[0], add(flow, '2026-10', 800).paymentMatches[0]]
  assert.equal(available(flow), 0)
  for (const month of ['2026-09', '2026-10']) assert.equal(paymentMatchStatus(eventOf(flow, month), flow).status, 'review')
})

test('legacy full links keep their snapshot amount and split allocations survive export and restoration', () => {
  const value = source()
  value.cashFlow = add(add(value.cashFlow, '2026-09', 600), '2026-10', 400)
  const restored = sanitizeStoredState(JSON.parse(JSON.stringify(financialPayload(createExportableState(value)))))
  assert.deepEqual(restored.cashFlow.paymentMatches, value.cashFlow.paymentMatches)
  assert.equal(available(restored.cashFlow), 0)
  const old = source(600, [600, 400]).cashFlow
  old.paymentMatches = linkCalendarPayment(old, { month: '2026-09', eventKey: paymentEventKey(eventOf(old, '2026-09')), movementId: 'payment' }, now)
  delete old.paymentMatches[0].allocatedCents
  assert.equal(paymentAllocatedCents(old.paymentMatches[0]), 60000)
  assert.equal(paymentMatchStatus(eventOf(old, '2026-09'), old).status, 'linked')
  old.ledger.movements[0].amount = 1000
  assert.equal(paymentAllocatedCents(old.paymentMatches[0]), 60000)
  assert.equal(available(old), 0)
})

test('sanitization rejects duplicate pairs and invalid cents without turning a bad portion into a full payment', () => {
  const flow = add(add(source().cashFlow, '2026-09', 600), '2026-10', 400)
  const [first, second] = flow.paymentMatches
  assert.deepEqual(sanitizePaymentMatches([first, second, first]), [first, second])
  for (const allocatedCents of [null, '100', 0, -1, .5, 1e12]) assert.deepEqual(sanitizePaymentMatches([{ ...first, allocatedCents }]), [])
})

test('UI identifies the portion used here and previews both remainders without changing state', () => {
  const before = structuredClone(state), view = { ...paymentView }
  try {
    const value = source()
    value.cashFlow = add(value.cashFlow, '2026-09', 600)
    Object.assign(state, value)
    Object.assign(paymentView, { selectedKey: paymentEventKey(eventOf(state.cashFlow, '2026-10')), filter: 'all' })
    const snapshot = structuredClone(state)
    const html = renderPaymentList('2026-10')
    assert.match(html, /name="amount"/)
    assert.match(html, /Disponível: R\$\s*400,00 de R\$\s*1\.000,00/)
    const preview = renderPaymentSelectionPreview('2026-10', paymentView.selectedKey, 'payment', 200)
    assert.match(preview, /Ainda disponível neste movimento/)
    assert.match(preview, /R\$\s*200,00/)
    assert.match(renderPaymentSelectionPreview('2026-10', paymentView.selectedKey, 'payment', 401), /excede/)
    const september = renderPaymentList('2026-09')
    assert.match(september, /Associado aqui/)
    assert.match(september, /R\$\s*600,00/)
    assert.deepEqual(state, snapshot)
    state.valuesHidden = true
    assert.doesNotMatch(renderPaymentList('2026-10'), /400,00|1\.000,00|name="amount"|role="meter"/)
  } finally { Object.assign(state, before); Object.assign(paymentView, view) }
})

test('amount editing uses the monetary mask and resets confirmation while updating the allocation preview', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, source())
    const amount = { name: 'amount', type: 'text', value: '', min: '.01', max: '1000000000', required: true, disabled: true, setCustomValidity(value) { this.error = value } }
    const fields = { month: { value: '2026-09' }, eventKey: { value: paymentEventKey(eventOf(state.cashFlow, '2026-09')) }, movementId: { value: 'payment' }, confirmed: { checked: true }, amount }
    const output = { innerHTML: '' }, handlers = {}
    const form = { elements: { namedItem: name => fields[name] }, querySelector: () => output, addEventListener: (name, callback) => { handlers[name] = callback } }
    bindPaymentDialog({ querySelector: () => ({ querySelector: () => form, addEventListener() {} }) })
    handlers.change({ target: { name: 'movementId' } })
    assert.equal(amount.value, '600,00')
    assert.equal(amount.disabled, false)
    assert.equal(amount.max, '600')
    assert.equal(amount.error, '')
    fields.confirmed.checked = true
    amount.value = '200,00'
    handlers.input({ target: { name: 'amount' } })
    assert.equal(fields.confirmed.checked, false)
    assert.match(output.innerHTML, /R\$\s*800,00/)
    assert.match(output.innerHTML, /R\$\s*400,00/)
  } finally { Object.assign(state, before) }
})
