import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticOurocardText } from '../scripts/fixtures/ourocard-pdf.mjs'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates, mergeStatementItem } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'
import { linkCreditCardPayments, isCreditCardPayment } from '../src/domain/credit-card-payments.js'
import { buildMonthlyBudget } from '../src/domain/monthly-budget.js'
import { renderBudgetEntryResults } from '../src/features/cash-flow/cash-flow.js'
import { state } from '../src/app/state.js'
import { defaultCashFlow } from '../src/data/mock-cash-flow.js'
import { analyzeStatementPlanning } from '../src/domain/statement-planning.js'

function bill() {
  const parsed = parsePdfStatement(syntheticOurocardText())
  const inspection = inspectStatementText(parsed.text)
  Object.assign(inspection, { sourceAccount: parsed.sourceAccount, creditCardBill: parsed.creditCardBill })
  return reviewStatementBatch([{ fileName: 'fatura.pdf', inspection, mapping: inspection.suggestedMapping }]).rows.map(row => row.item)
}
const payment = (patch = {}) => ({ id: 'bank-payment', type: 'expense', categoryId: 'other-expense', description: 'Pagto cartão crédito VISA 0000', amount: 1610.31, currency: 'BRL', startDate: '2025-10-25', recordKind: 'actual', frequency: 'occasional', ...patch })
const link = items => linkCreditCardPayments(items).find(item => item.id === 'bank-payment')
const month = items => buildMonthlyBudget({ currency: 'BRL', customCategories: [], plan: {}, cashFlow: { ...defaultCashFlow, annualGoals: [], commitments: [], consortia: [], items } }, '2025-10')

// All rows in one month make the gross expenses, refunds and net budget
// independently checkable: 700 + 400 - 100 = a 1,000 bill settlement.
function simpleBill() {
  return [700, 400, -100].map((amount, index) => ({
    id: `purchase-${index}`, type: amount > 0 ? 'expense' : 'income',
    categoryId: amount > 0 ? 'shopping' : 'refund', description: amount > 0 ? 'Compra' : 'Estorno',
    amount: Math.abs(amount), currency: 'BRL', startDate: '2025-10-10',
    recordKind: 'actual', frequency: 'occasional', imported: true,
    statementAccount: 'BB:Ourocard:0000', statementReference: `Ourocard:2025-10-15:0000:entry-${index}`,
    creditCardBill: { cardLast4: '0000', closingDate: '2025-10-15', dueDate: '2025-10-25', total: 1000, entryCount: 3, entryIndex: index + 1 }
  }))
}
const settlement = (patch = {}) => payment({ amount: 1000, imported: true, statementAccount: 'BB:checking:123', statementReference: 'payment-123', statementImportKey: 'reference:["BB:checking:123","payment-123"]', ...patch })

test('absent, partial and complete bills count each covered amount once', () => {
  const detail = simpleBill()
  for (const [rows, expenses, income, status, remaining] of [
    [[], 1000, 0, 'unmatched', undefined],
    [[detail[0]], 1000, 0, 'partial', 300],
    [[detail[0], detail[2]], 1100, 100, 'partial', 400],
    [[detail[2]], 1100, 100, 'partial', 1100],
    [detail, 1100, 100, 'linked', 0]
  ]) {
    for (const items of [[...rows, settlement()], [settlement(), ...rows]]) {
      const before = structuredClone(items)
      const budget = month(items)
      assert.equal(budget.actual.expenses, expenses)
      assert.equal(budget.actual.income, income)
      assert.equal(budget.actual.balance, -1000)
      assert.equal(link(items).creditCardPaymentStatus, status)
      assert.equal(link(items).creditCardPaymentLink?.remainingAmount, remaining)
      assert.equal(link(items).amount, 1000)
      assert.deepEqual(items, before)
    }
  }
})

test('missing refunds never create a negative payment or discard known purchases', () => {
  const rows = simpleBill().slice(0, 2)
  const budget = month([...rows, settlement()])
  assert.equal(budget.actual.expenses, 1100)
  assert.equal(budget.actual.income, 0)
  assert.equal(link([...rows, settlement()]).creditCardPaymentStatus, 'partial')
  assert.equal(link([...rows, settlement()]).creditCardPaymentLink.remainingAmount, 0)
})

test('residual reconciliation uses integer cents', () => {
  const rows = simpleBill().slice(0, 2).map((item, index) => ({ ...item, amount: index ? .2 : .1, creditCardBill: { ...item.creditCardBill, total: .3, entryCount: 2 } }))
  const bank = settlement({ amount: .3 })
  assert.equal(link([rows[0], bank]).creditCardPaymentLink.remainingAmount, .2)
  assert.equal(link([...rows, bank]).creditCardPaymentLink.remainingAmount, 0)
  assert.equal(Math.round(month([rows[0], bank]).actual.expenses * 100), 30)
})

test('conflicting or missing metadata on an existing bill row never creates a false residual', () => {
  const detail = simpleBill()
  for (const patch of [
    { creditCardBill: undefined },
    { currency: 'CHF' },
    { statementAccount: 'different-account' },
    { statementReference: 'different-reference' },
    { creditCardBill: { ...detail[0].creditCardBill, cardLast4: '1111' } },
    { creditCardBill: { ...detail[0].creditCardBill, closingDate: '2025-10-16' } }
  ]) {
    const rows = detail.map((item, index) => index ? item : { ...item, ...patch })
    const reconciled = link([...rows, settlement()])
    assert.equal(reconciled.creditCardPaymentStatus, 'inconsistent')
    assert.equal(reconciled.creditCardPaymentLink, undefined)
  }
})

test('verified duplicate payments count once with absent, partial and full bills', () => {
  for (const detail of [[], simpleBill().slice(0, 1), simpleBill()]) {
    const first = settlement()
    const copy = settlement({ id: 'copy-payment' })
    const expected = month([...detail, first]).actual
    for (const items of [[...detail, first, copy], [copy, first, ...detail]]) {
      const reconciled = linkCreditCardPayments(items)
      assert.deepEqual(month(items).actual, expected)
      assert.equal(reconciled.find(item => item.id === 'copy-payment').creditCardPaymentStatus, 'duplicate')
      assert.equal(reconciled.find(item => item.id === 'copy-payment').amount, 1000)
      assert.deepEqual(linkCreditCardPayments(reconciled), reconciled)
    }
  }
})

test('equal legitimate payments, different accounts and different references are not duplicates', () => {
  for (const copy of [
    settlement({ id: 'copy-payment', statementAccount: 'another-account' }),
    settlement({ id: 'copy-payment', statementReference: 'payment-456', statementImportKey: 'other-key' }),
    settlement({ id: 'copy-payment', statementReference: '', statementImportKey: 'transaction:occurrence-2' }),
    settlement({ id: 'copy-payment', amount: 1001 }),
    payment({ id: 'copy-payment', amount: 1000 })
  ]) {
    const items = [settlement(), copy]
    assert.equal(month(items).actual.expenses, 1000 + copy.amount)
    assert.ok(linkCreditCardPayments(items).every(item => !item.creditCardPaymentDuplicateOf))
  }
  const repeated = [settlement(), settlement({ id: 'second', statementReference: 'payment-456', statementImportKey: 'other-key' })]
  assert.equal(link([...simpleBill(), ...repeated]).creditCardPaymentStatus, 'ambiguous')
})

test('stable import keys deduplicate legacy payments without explicit references', () => {
  const first = settlement({ statementAccount: '', statementReference: '' })
  const copy = { ...first, id: 'copy-payment' }
  assert.equal(month([first, copy]).actual.expenses, 1000)
  assert.equal(month([first, { ...copy, statementImportKey: 'different-occurrence' }]).actual.expenses, 2000)
})

test('manual choices override absent, partial, full and duplicate reconciliation', () => {
  for (const detail of [[], simpleBill().slice(0, 1), simpleBill()]) {
    assert.equal(month([...detail, settlement({ ignoreCreditCardPayment: false })]).actual.expenses, month(detail).actual.expenses + 1000)
    assert.equal(month([...detail, settlement({ ignoreCreditCardPayment: true })]).actual.expenses, month(detail).actual.expenses)
  }
  for (const ignoreCreditCardPayment of [true, false]) {
    const items = [settlement(), settlement({ id: 'copy-payment', ignoreCreditCardPayment })]
    const expected = ignoreCreditCardPayment ? 0 : 1000
    assert.equal(month(items).actual.expenses, expected)
    assert.equal(month([...items].reverse()).actual.expenses, expected)
  }
  assert.equal(month([settlement({ ignoreCreditCardPayment: false }), settlement({ id: 'copy', ignoreCreditCardPayment: false })]).actual.expenses, 2000)
})

test('storage drops derived decisions, preserves flags and recomputes after edits or deletion', () => {
  const linked = linkCreditCardPayments([...simpleBill(), settlement(), settlement({ id: 'copy' })])
  const saved = sanitizeCashFlow(JSON.parse(JSON.stringify({ items: linked })), 'BRL').items
  assert.ok(saved.every(item => !item.creditCardPaymentLink && !item.creditCardPaymentStatus && !item.creditCardPaymentDuplicateOf))
  assert.equal(month(saved).actual.balance, -1000)
  const bank = saved.filter(item => !item.creditCardBill)
  assert.equal(month(bank).actual.expenses, 1000)
  assert.equal(month([linked.find(item => item.id === 'copy')]).actual.expenses, 1000)
  assert.equal(month([...saved.filter(item => item.id !== 'purchase-1')]).actual.balance, -1000)
  const manual = sanitizeCashFlow({ items: [settlement({ ignoreCreditCardPayment: true })] }, 'BRL').items[0]
  assert.equal(month([{ ...manual, ignoreCreditCardPayment: undefined }]).actual.expenses, 1000)
})

test('reimporting a bank statement updates the payment without duplication or losing manual choice', () => {
  const inspection = inspectStatementText('data;descricao;valor;moeda\n25/10/2025;Pagamento cartão VISA 0000;-1000;BRL')
  inspection.sourceAccount = 'BB:checking:123'
  const file = { fileName: 'bank.csv', inspection, mapping: inspection.suggestedMapping }
  for (const ignoreCreditCardPayment of [undefined, true, false]) {
    const incoming = reviewStatementBatch([file]).rows.map(row => row.item)
    const first = planStatementUpdates([], incoming).items.map(item => ({ ...item, ignoreCreditCardPayment }))
    const review = reviewStatementBatch([file, { ...file, fileName: 'copy.csv' }], { existingItems: first })
    const updated = planStatementUpdates(first, review.rows.filter(row => !row.duplicate).map(row => row.item))
    assert.deepEqual([updated.added, updated.updated, updated.items.length], [0, 1, 1])
    assert.equal(updated.items[0].ignoreCreditCardPayment, ignoreCreditCardPayment)
    assert.equal(month(updated.items).actual.expenses, ignoreCreditCardPayment === true ? 0 : 1000)
  }
})

test('statement planning uses the same partial reconciliation as the budget', () => {
  for (const detail of [[], simpleBill().slice(0, 1), simpleBill()]) {
    const items = [...detail, settlement(), settlement({ id: 'copy-payment' })]
    const analysis = analyzeStatementPlanning(items, { start: '2025-09-01', end: '2025-10-31', currency: 'BRL', asOf: '2025-11-01', complete: true })
    assert.equal(analysis.months[1].expense, month(items).actual.expenses)
    assert.equal(analysis.months[1].income, month(items).actual.income)
  }
})

test('partial reconciliation preserves purchase months and places only the remainder at payment date', () => {
  const detail = simpleBill().slice(0, 1).map(item => ({ ...item, startDate: '2025-09-20' }))
  assert.equal(month([...detail, settlement()]).actual.expenses, 300)
  const analysis = analyzeStatementPlanning([...detail, settlement()], { start: '2025-09-01', end: '2025-10-31', currency: 'BRL', asOf: '2025-11-01', complete: true })
  assert.deepEqual(analysis.months.map(item => item.expense), [700, 300])
})

test('list explains automatic reconciliation and hides residual values in privacy mode', () => {
  const previous = { items: state.cashFlow.items, valuesHidden: state.valuesHidden }
  try {
    for (const [detail, message] of [[[], /Pagamento integral incluído/], [simpleBill().slice(0, 1), /Fatura incompleta/], [simpleBill(), /Fatura completa conciliada/]]) {
      state.cashFlow.items = [...detail, settlement()]
      const budget = month(state.cashFlow.items)
      const html = renderBudgetEntryResults(budget)
      assert.match(html, message)
      assert.equal(/data-ignore-credit-card-payment="bank-payment" checked/.test(html), detail.length === 3)
    }
    state.cashFlow.items = [...simpleBill().slice(0, 1), settlement()]
    state.valuesHidden = true
    const html = renderBudgetEntryResults(month(state.cashFlow.items))
    assert.match(html, /Saldo sem detalhe incluído:/)
    assert.doesNotMatch(html, /300[,.]00/)
  } finally { state.cashFlow.items = previous.items; state.valuesHidden = previous.valuesHidden }
})

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

test('edited or malformed bill detail requires review and stale links are recalculated', () => {
  const detail = bill()
  for (const incomplete of [detail.map((item, index) => index ? item : { ...item, amount: item.amount + 1 }), detail.map((item, index) => index ? item : { ...item, creditCardBill: { ...item.creditCardBill, entryIndex: 99 } })]) {
    assert.equal(link([...incomplete, payment()]).creditCardPaymentStatus, 'inconsistent')
    assert.equal(month([...incomplete, payment()]).actual.expenses, month(incomplete).actual.expenses + 1610.31)
  }
  const matched = link([...detail, payment()])
  assert.equal(link([matched]).creditCardPaymentLink, undefined)
  assert.equal(month([matched]).actual.expenses, 1610.31)
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


test('description detection keeps payments without a bill and respects explicit choices', () => {
  for (const description of ['Pagto cartāo crédito', 'PAGTO CARTAO CREDITO', 'Pgto. fatura', 'Pagamento cartão de crédito']) {
    assert.equal(month([payment({ description })]).actual.expenses, 1610.31)
    assert.equal(month([payment({ description, ignoreCreditCardPayment: false })]).actual.expenses, 1610.31)
  }
  for (const description of ['Compra cartão crédito', 'Juros pagamento cartão', 'Tarifa pagamento cartão']) {
    assert.equal(month([payment({ description })]).actual.expenses, 1610.31)
  }
  assert.equal(month([...bill(), payment({ ignoreCreditCardPayment: false })]).actual.expenses, month(bill()).actual.expenses + 1610.31)
  assert.equal(month([payment({ description: 'Quitação', ignoreCreditCardPayment: true })]).actual.expenses, 0)
})

test('manual inclusion and exclusion survive storage and statement merge', () => {
  for (const ignoreCreditCardPayment of [true, false]) {
    const item = payment({ ignoreCreditCardPayment })
    const restored = sanitizeCashFlow(JSON.parse(JSON.stringify({ items: [item] })), 'BRL').items[0]
    assert.equal(restored.ignoreCreditCardPayment, ignoreCreditCardPayment)
    assert.equal(mergeStatementItem(restored, payment()).ignoreCreditCardPayment, ignoreCreditCardPayment)
  }
})

test('budget list shows missing-bill inclusion and reflects explicit choices', () => {
  const previous = state.cashFlow.items
  try {
    for (const patch of [{}, { ignoreCreditCardPayment: false }, { ignoreCreditCardPayment: true }]) {
      const item = payment(patch)
      state.cashFlow.items = [item]
      const html = renderBudgetEntryResults({ convertedItems: [{ ...item, isActive: true, convertedAmount: item.amount, category: { name: 'Outras despesas' } }] })
      assert.match(html, /Ignorar pagamento de cartão nas despesas/)
      assert.equal(/data-ignore-credit-card-payment="bank-payment" checked/.test(html), patch.ignoreCreditCardPayment === true)
      assert.equal(html.includes('data-auto-credit-card-payment='), typeof patch.ignoreCreditCardPayment === 'boolean')
    }
  } finally { state.cashFlow.items = previous }
})
