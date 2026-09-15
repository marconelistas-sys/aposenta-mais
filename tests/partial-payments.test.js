import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState, createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { financialPayload } from '../src/shared/sync-contract.js'
import { accountBalances } from '../src/domain/accounts.js'
import { cashFlowTimeline } from '../src/domain/cash-flow-timeline.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { paymentCalendarEvents, paymentEventKey, paymentCandidates, paymentMatchStatus, linkCalendarPayment, unlinkCalendarPayment, sanitizePaymentMatches } from '../src/domain/calendar-payments.js'
import { renderPaymentList, renderPaymentSelectionPreview, bindPaymentDialog, paymentView } from '../src/features/cash-flow/payments.js'

const now = new Date('2026-09-14T12:00:00Z')
const month = '2026-09'
const source = (amount = 1000, movements = [400, 600]) => sanitizeStoredState({
  currency: 'BRL', plan: { currentAge: 60, retirementAge: 61, targetAge: 62, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', currentAssets: 10000, annualRealReturn: 0, investments: [{ id: 'cash', name: 'Disponível', amount: 10000, liquidity: 'available', annualRealReturn: 0 }], finappMethod: { openingConfirmed: true, pensionConfirmed: true } },
  cashFlow: { referenceMonth: month, retirementMonth: '2027-01', items: [{ id: 'bill', categoryId: 'housing', description: 'Aluguel', amount, currency: 'BRL', type: 'expense', frequency: 'monthly', recordKind: 'planned', startDate: '2026-01-05' }],
    ledger: { accounts: [{ id: 'account', name: 'Conta BRL', currency: 'BRL', openingDate: '2026-01-01', openingBalance: 10000 }], movements: movements.map((value, index) => ({ id: `m${index}`, type: 'expense', accountId: 'account', amount: value, date: `2026-09-0${index + 6}` })) }
  }
})
const eventOf = flow => paymentCalendarEvents(flow, month).events[0]
const add = (flow, movementId) => ({ ...flow, paymentMatches: linkCalendarPayment(flow, { month, eventKey: paymentEventKey(eventOf(flow)), movementId }, now) })

test('partial then complete associations preserve accounts, recorded budget and both projections', () => {
  const value = source(), original = structuredClone(value)
  const partial = add(value.cashFlow, 'm0')
  const first = paymentMatchStatus(eventOf(partial), partial)
  assert.equal(first.status, 'partial')
  assert.equal(first.matchedAmount, 400)
  assert.equal(first.remainingAmount, 600)
  assert.equal(first.progress, .4)
  const complete = add(partial, 'm1')
  const next = paymentMatchStatus(eventOf(complete), complete)
  assert.equal(next.status, 'linked')
  assert.equal(next.matchedAmount, 1000)
  assert.equal(next.remainingAmount, 0)
  assert.equal(next.progress, 1)
  assert.equal(next.links.length, 2)
  const changed = { ...value, cashFlow: complete }
  assert.deepEqual(accountBalances(complete.ledger, '2026-09-14'), accountBalances(value.cashFlow.ledger, '2026-09-14'))
  assert.deepEqual(cashFlowTimeline(changed, month, 24), cashFlowTimeline(value, month, 24))
  assert.deepEqual(finappViability(changed, undefined, now), finappViability(value, undefined, now))
  assert.deepEqual(value, original)
})

test('cent rounding completes exactly and candidates cannot exceed the remaining amount', () => {
  const value = source(.3, [.1, .2, .21])
  const first = add(value.cashFlow, 'm0')
  assert.equal(paymentMatchStatus(eventOf(first), first).remainingAmount, .2)
  assert.deepEqual(paymentCandidates(eventOf(first), first, now).map(item => item.id), ['m1'])
  const before = structuredClone(first)
  assert.throws(() => add(first, 'm2'), /valor até o restante/)
  assert.deepEqual(first, before)
  const complete = add(first, 'm1')
  assert.equal(paymentMatchStatus(eventOf(complete), complete).remainingAmount, 0)
  assert.throws(() => add(complete, 'm2'), /totalmente associado/)
})

test('used movements stay unavailable to other events, and wrong currency, type and future dates remain excluded', () => {
  const flow = add(source().cashFlow, 'm0')
  flow.ledger.accounts.push({ id: 'eur', name: 'EUR', currency: 'EUR', openingDate: '2026-01-01', openingBalance: 0 })
  const base = flow.ledger.movements[1]
  flow.ledger.movements.push({ ...base, id: 'foreign', accountId: 'eur' }, { ...base, id: 'income', type: 'income' }, { ...base, id: 'future', date: '2026-09-15' }, { ...base, id: 'transfer', type: 'transfer', destinationId: 'eur', receivedAmount: 100 })
  assert.deepEqual(paymentCandidates(eventOf(flow), flow, now).map(item => item.id), ['m1'])
  const october = paymentCalendarEvents(flow, '2026-10').events[0]
  assert.throws(() => linkCalendarPayment(flow, { month: '2026-10', eventKey: paymentEventKey(october), movementId: 'm0' }, now), /ainda não utilizado/)
})

test('undo removes only the selected association and leaves the movement and other associations intact', () => {
  const flow = add(add(source().cashFlow, 'm0'), 'm1')
  const before = structuredClone(flow)
  const event = eventOf(flow)
  const undone = { ...flow, paymentMatches: unlinkCalendarPayment(flow, { eventKey: paymentEventKey(event), movementId: 'm0' }) }
  assert.equal(paymentMatchStatus(event, undone).status, 'partial')
  assert.equal(paymentMatchStatus(event, undone).remainingAmount, 400)
  assert.deepEqual(undone.paymentMatches.map(match => match.movementId), ['m1'])
  assert.deepEqual(undone.ledger, flow.ledger)
  assert.throws(() => unlinkCalendarPayment(flow, { eventKey: 'another', movementId: 'm0' }), /não encontrado/)
  assert.deepEqual(flow, before)
  const orphan = { ...flow, items: [] }
  assert.equal(unlinkCalendarPayment(orphan, { eventKey: paymentEventKey(event), movementId: 'm1' }).length, 1)
})

test('changed or removed partial payments require review and cannot be counted as a complete payment', () => {
  for (const change of ['amount', 'remove', 'event']) {
    let flow = add(add(source().cashFlow, 'm0'), 'm1')
    if (change === 'amount') flow.ledger.movements[0].amount = 350
    if (change === 'remove') flow.ledger.movements.shift()
    if (change === 'event') flow.items[0].amount = 950
    const status = paymentMatchStatus(eventOf(flow), flow)
    assert.equal(status.status, 'review')
    assert.equal(status.matchedAmount, null)
    assert.equal(status.remainingAmount, null)
    assert.equal(status.progress, null)
    assert.deepEqual(paymentCandidates(eventOf(flow), flow, now), [])
    assert.throws(() => add(flow, 'm0'), /Revise/)
    if (change !== 'event') {
      flow = { ...flow, paymentMatches: unlinkCalendarPayment(flow, { eventKey: paymentEventKey(eventOf(flow)), movementId: 'm0' }) }
      assert.equal(paymentMatchStatus(eventOf(flow), flow).remainingAmount, 400)
    }
  }
})

test('conflicting imported associations exceeding the event are flagged instead of silently capped', () => {
  const flow = source(1000, [400, 700]).cashFlow
  const first = add(flow, 'm0').paymentMatches[0], second = add(flow, 'm1').paymentMatches[0]
  flow.paymentMatches = sanitizePaymentMatches([first, second, first])
  assert.equal(flow.paymentMatches.length, 2)
  assert.equal(paymentMatchStatus(eventOf(flow), flow).status, 'review')
  assert.equal(paymentMatchStatus(eventOf(flow), flow).progress, null)
})

test('multiple associations and old single associations survive export, sync payload and restoration', () => {
  for (const count of [1, 2]) {
    const value = source()
    value.cashFlow = add(value.cashFlow, 'm0')
    if (count === 2) value.cashFlow = add(value.cashFlow, 'm1')
    const exported = createExportableState(value)
    const restored = sanitizeStoredState(JSON.parse(JSON.stringify(financialPayload(exported))))
    assert.deepEqual(restored.cashFlow.paymentMatches, value.cashFlow.paymentMatches)
    assert.equal(paymentMatchStatus(eventOf(restored.cashFlow), restored.cashFlow).status, count === 1 ? 'partial' : 'linked')
  }
  const old = source(1000, [1000])
  old.cashFlow = add(old.cashFlow, 'm0')
  const restored = sanitizeStoredState(createExportableState(old))
  assert.equal(paymentMatchStatus(eventOf(restored.cashFlow), restored.cashFlow).status, 'linked')
})

test('receipts may also be associated in parts without accepting expense movements', () => {
  const value = source()
  Object.assign(value.cashFlow.items[0], { type: 'income', categoryId: 'salary' })
  value.cashFlow.ledger.movements.forEach(item => { item.type = 'income' })
  const first = add(value.cashFlow, 'm0')
  assert.equal(paymentMatchStatus(eventOf(first), first).status, 'partial')
  assert.equal(paymentMatchStatus(eventOf(first), add(first, 'm1')).status, 'linked')
})

test('UI shows partial progress, the selected remainder and per-movement undo without exposing hidden amounts', () => {
  const previous = structuredClone(state), view = { ...paymentView }
  try {
    const value = source()
    value.cashFlow = add(value.cashFlow, 'm0')
    Object.assign(state, value)
    const eventKey = paymentEventKey(eventOf(state.cashFlow))
    Object.assign(paymentView, { selectedKey: eventKey, filter: 'partial' })
    const html = renderPaymentList(month)
    assert.match(html, /1 parciais/)
    assert.match(html, /data-payment-status="partial"/)
    assert.match(html, /aria-valuenow="40.00"/)
    assert.match(html, /Já associado/)
    assert.match(html, /Falta associar/)
    assert.match(html, /data-payment-movement="m0"/)
    assert.match(html, /Associar outro movimento/)
    const preview = renderPaymentSelectionPreview(month, eventKey, 'm1')
    assert.match(preview, /Este movimento completa o valor previsto/)
    assert.match(preview, /R\$\s*0,00/)
    assert.match(renderPaymentSelectionPreview(month, eventKey, 'm0'), /Selecione um movimento/)
    state.valuesHidden = true
    const hidden = renderPaymentList(month)
    assert.doesNotMatch(hidden, /400,00|600,00|role="meter"|data-payment-dialog|data-payment-selection-preview/)
    assert.equal(renderPaymentSelectionPreview(month, eventKey, 'm1'), '')
  } finally { Object.assign(state, previous); Object.assign(paymentView, view) }
})

test('selecting a different movement resets confirmation and updates the preview before saving', () => {
  const previous = structuredClone(state)
  try {
    Object.assign(state, source())
    const fields = { month: { value: month }, eventKey: { value: paymentEventKey(eventOf(state.cashFlow)) }, movementId: { value: 'm0' }, confirmed: { checked: true } }
    const output = { innerHTML: '' }
    let change
    const form = { elements: { namedItem: name => fields[name] }, querySelector: () => output, addEventListener: (name, handler) => { if (name === 'change') change = handler } }
    const dialog = { querySelector: () => form, addEventListener() {} }
    bindPaymentDialog({ querySelector: () => dialog })
    const before = structuredClone(state)
    change({ target: { name: 'movementId' } })
    assert.equal(fields.confirmed.checked, false)
    assert.match(output.innerHTML, /R\$\s*600,00/)
    assert.match(output.innerHTML, /continuará parcialmente associado/)
    assert.deepEqual(state, before)
  } finally { Object.assign(state, previous) }
})
