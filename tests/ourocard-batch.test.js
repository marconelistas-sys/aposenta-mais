import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticOurocardText } from '../scripts/fixtures/ourocard-pdf.mjs'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'

function fixture(month = '10', fileName = `${month}.pdf`, source = syntheticOurocardText()) {
  const parsed = parsePdfStatement(source.replaceAll('25/10/2025', `25/${month}/2025`).replaceAll('15/10/2025', `15/${month}/2025`))
  const inspection = inspectStatementText(parsed.text)
  Object.assign(inspection, { sourceAccount: parsed.sourceAccount, creditCardBill: parsed.creditCardBill })
  return { fileName, inspection, mapping: inspection.suggestedMapping }
}
const selected = review => review.rows.filter(row => !row.duplicate && !row.internalTransfer && row.item).map(row => row.item)

test('imports several bills at once, skips repeated files and retains purchases in distinct bills', () => {
  const review = reviewStatementBatch([fixture(), fixture('11'), fixture('10', 'copy.pdf')])
  assert.equal(review.rows.length, 33)
  assert.equal(review.rows.filter(row => row.duplicate).length, 11)
  const plan = planStatementUpdates([], selected(review))
  assert.deepEqual([plan.added, plan.updated, plan.items.length], [22, 0, 22])
  assert.equal(new Set(plan.items.map(item => item.statementImportKey)).size, 22)
})

test('reimporting a reordered renamed batch after storage updates existing IDs without duplicates', () => {
  const first = planStatementUpdates([], selected(reviewStatementBatch([fixture(), fixture('11')])))
  const saved = sanitizeCashFlow(JSON.parse(JSON.stringify({ items: first.items })), 'BRL').items
  const ids = saved.map(item => item.id).sort()
  saved.find(item => item.description === 'AMAZON BR SAO PAULO').categoryId = 'education'
  saved.find(item => item.description === 'AMAZON BR SAO PAULO').categoryOrigin = 'confirmed'
  const review = reviewStatementBatch([fixture('11', 'renamed.pdf'), fixture('10', 'another-name.pdf'), fixture('11', 'duplicate.pdf')], { existingItems: saved })
  const next = planStatementUpdates(saved, selected(review))
  assert.deepEqual([next.added, next.updated, next.items.length], [0, 22, 22])
  assert.deepEqual(next.items.map(item => item.id).sort(), ids)
  assert.equal(next.items.find(item => item.id === saved.find(item => item.categoryOrigin === 'confirmed').id).categoryId, 'education')
})

test('card purchases use automatic categories, refunds retain their type, unknown merchants stay reviewable', () => {
  const rows = reviewStatementBatch([fixture()]).rows
  for (const [description, category] of [['AMAZON BR SAO PAULO', 'shopping'], ['BB SEGUROS A*BB S SAO PAULO', 'insurance'], ['NETFLIX.COM SAO PAULO', 'subscriptions'], ['Amazon Prime Canais SAO PAULO', 'subscriptions'], ['AmazonPrimeBR SAO PAULO', 'subscriptions']]) {
    const row = rows.find(row => row.item.description === description)
    assert.equal(row.item.categoryId, category, description)
    assert.equal(row.classification.needsReview, false, description)
    assert.equal(row.item.type, 'expense')
  }
  assert.equal(rows.find(row => row.item.amount === 83 && row.item.type === 'income').item.categoryId, 'refund')
  assert.equal(rows.find(row => row.item.description.includes('LOJA EXEMPLO')).classification.needsReview, true)
})

test('confirmed history takes precedence over automatic card classification in every bill in the batch', () => {
  const existingItems = [{ id: 'confirmed', type: 'expense', categoryId: 'education', description: 'AmazonPrimeBR SAO PAULO', imported: true, recordKind: 'actual', categoryOrigin: 'confirmed' }]
  const rows = reviewStatementBatch([fixture(), fixture('11')], { existingItems }).rows.filter(row => row.item.description === 'AmazonPrimeBR SAO PAULO')
  assert.equal(rows.length, 2)
  assert.ok(rows.every(row => row.item.categoryId === 'education' && row.classification.origin === 'history'))
})

test('two identical legitimate purchases remain distinct while reimport updates both', () => {
  const text = syntheticOurocardText().replaceAll('284,71', '121,07').replaceAll('1.693,31', '1.529,67').replaceAll('1.610,31', '1.446,67')
  const file = fixture('10', 'equal-purchases.pdf', text)
  const first = planStatementUpdates([], selected(reviewStatementBatch([file])))
  assert.equal(first.items.filter(item => item.amount === 121.07).length, 2)
  const review = reviewStatementBatch([file, { ...file, fileName: 'copy.pdf' }], { existingItems: first.items })
  const next = planStatementUpdates(first.items, selected(review))
  assert.deepEqual([next.added, next.updated, next.items.length], [0, 11, 11])
})

test('supports twelve complete PDF bills in one batch and rejects thirteen', () => {
  const files = Array.from({ length: 12 }, (_, index) => fixture(String(index + 1).padStart(2, '0')))
  assert.equal(selected(reviewStatementBatch(files)).length, 132)
  assert.throws(() => reviewStatementBatch([...files, fixture()]), /12/)
})
