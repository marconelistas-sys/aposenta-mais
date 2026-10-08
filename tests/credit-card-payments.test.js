import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticOurocardText } from '../scripts/fixtures/ourocard-pdf.mjs'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'
import { linkCreditCardPayments, isCreditCardPayment } from '../src/domain/credit-card-payments.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'

function bill() {
  const parsed = parsePdfStatement(syntheticOurocardText())
  const inspection = inspectStatementText(parsed.text)
  Object.assign(inspection, { sourceAccount: parsed.sourceAccount, creditCardBill: parsed.creditCardBill })
  return reviewStatementBatch([{ fileName: 'fatura.pdf', inspection, mapping: inspection.suggestedMapping }]).rows.map(row => row.item)
}
const payment = (patch = {}) => ({ id: 'bank-payment', type: 'expense', categoryId: 'other-expense', description: 'Pagto cartão crédito VISA 0000', amount: 1610.31, currency: 'BRL', startDate: '2025-10-25', recordKind: 'actual', frequency: 'occasional', ...patch })
const link = items => linkCreditCardPayments(items).find(item => item.id === 'bank-payment')
const month = items => buildMonthlyBudget({ currency: 'BRL', customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, annualGoals: [], commitments: [], consortia: [], items } }, '2025-10')

test('full bill excludes the bank settlement from budget, keeps the record and works in either import order', () => {
  const detail = bill()
  const items = [...detail, payment()]
  const original = structuredClone(items)
  assert.equal(link(items).creditCardPaymentStatus, 'linked')
  assert.equal(link([payment(), ...detail]).creditCardPaymentStatus, 'linked')
  assert.equal(month(items).actual.expenses, month(detail).actual.expenses)
  assert.equal(month(items).actual.income, month(detail).actual.income)
  assert.equal(month([payment()]).actual.expenses, 1610.31)
  assert.equal(link(items).amount, 1610.31)
  assert.deepEqual(items, original)
})

test('bill metadata survives storage and reimport, legacy bills gain metadata without duplication', () => {
  const legacy = bill().map(({ creditCardBill, ...item }) => item)
  assert.equal(link([...legacy, payment()]).creditCardPaymentStatus, 'unmatched')
  const updated = planStatementUpdates([...legacy, payment()], bill())
  assert.deepEqual([updated.added, updated.updated], [0, 11])
  const restored = sanitizeCashFlow(JSON.parse(JSON.stringify({ items: updated.items })), 'BRL').items
  assert.equal(restored.filter(item => item.creditCardBill).length, 11)
  assert.equal(link(restored).creditCardPaymentStatus, 'linked')
  assert.ok(restored.every(item => !item.creditCardPaymentLink))
})

test('missing, deselected or edited bill detail restores inclusion and ignores stale links', () => {
  const detail = bill()
  for (const incomplete of [detail.slice(1), detail.map((item, index) => index ? item : { ...item, amount: item.amount + 1 }), detail.map((item, index) => index ? item : { ...item, creditCardBill: { ...item.creditCardBill, entryIndex: 99 } })]) {
    assert.equal(link([...incomplete, payment()]).creditCardPaymentStatus, 'unmatched')
    assert.equal(month([...incomplete, payment()]).actual.expenses, month(incomplete).actual.expenses + 1610.31)
  }
  const matched = link([...detail, payment()])
  assert.equal(link([matched]).creditCardPaymentLink, undefined)
})

test('different amounts, currencies, dates and identified cards remain included', () => {
  for (const patch of [{ amount: 500 }, { currency: 'CHF' }, { startDate: '2025-11-03' }, { description: 'Pagamento cartão VISA 1111' }]) assert.equal(link([...bill(), payment(patch)]).creditCardPaymentStatus, 'unmatched')
  for (const description of ['Tarifa pagamento cartão', 'Juros pagamento cartão', 'Anuidade cartão', 'Compra VISA 0000']) assert.equal(isCreditCardPayment(payment({ description })), false)
  assert.equal(isCreditCardPayment(payment({ recordKind: 'planned' })), false)
  assert.equal(link([...bill(), payment({ description: 'Pagamento fatura cartão de crédito' })]).creditCardPaymentStatus, 'linked')
})

test('ambiguous bills or duplicate bank settlements never trigger an automatic exclusion', () => {
  const detail = bill()
  const another = detail.map(item => ({ ...item, id: `${item.id}-other`, statementAccount: 'BB:Ourocard:1111', statementReference: item.statementReference.replace(':0000:', ':1111:'), creditCardBill: { ...item.creditCardBill, cardLast4: '1111' } }))
  assert.equal(link([...detail, ...another, payment({ description: 'Pagamento fatura cartão' })]).creditCardPaymentStatus, 'ambiguous')
  assert.equal(link([...detail, ...another, payment()]).creditCardPaymentStatus, 'linked')
  assert.equal(link([...detail, payment(), payment({ id: 'other-bank-payment' })]).creditCardPaymentStatus, 'ambiguous')
})
