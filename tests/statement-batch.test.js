import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectStatementText } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'

function file(text, fileName = 'statement.csv') {
  const inspection = inspectStatementText(text, { maximumRows: 2000, analysisOnly: true })
  return { fileName, inspection, mapping: inspection.suggestedMapping }
}
const csv = 'data;descricao;valor;moeda\n2026-08-01;Migros;-12;CHF'
const selected = review => review.rows.filter(row => row.item && !row.duplicate).map(row => row.item)
function saved(items) { return sanitizeCashFlow({ items }, 'CHF').items }

test('classifica 12 extratos e reimporta atualizando sem multiplicar registros', () => {
  const files = Array.from({ length: 12 }, (_, index) => file(csv.replace('2026-08-01', `2026-${String(index + 1).padStart(2, '0')}-01`), `${index}.csv`))
  const first = reviewStatementBatch(files)
  assert.equal(first.rows.length, 12)
  assert.ok(first.rows.every(row => row.item.categoryId === 'groceries' && !row.classification.needsReview))
  const inserted = planStatementUpdates([], selected(first))
  assert.deepEqual([inserted.added, inserted.updated], [12, 0])
  const existing = saved(inserted.items)
  const next = reviewStatementBatch(files.reverse(), { existingItems: existing })
  assert.ok(next.rows.every(row => row.updateTargetId && !row.duplicate))
  const updated = planStatementUpdates(existing, selected(next))
  assert.deepEqual([updated.added, updated.updated, updated.items.length], [0, 12, 12])
  assert.deepEqual(updated.items.map(item => item.id), existing.map(item => item.id))
})

test('sobreposição entre arquivos não duplica, mas pagamentos iguais no mesmo extrato permanecem distintos', () => {
  const source = file(csv + '\n2026-08-01;Migros;-12;CHF')
  const review = reviewStatementBatch([source, { ...source, fileName: 'renamed.csv' }])
  assert.equal(review.rows.filter(row => row.duplicate).length, 2)
  const first = planStatementUpdates([], selected(review))
  assert.equal(first.items.length, 2)
  const next = reviewStatementBatch([source], { existingItems: saved(first.items) })
  assert.equal(next.rows.filter(row => row.updateTargetId).length, 2)
})

test('OFX usa conta e FITID para atualizar valor e descrição, preservando categoria e titularidade', () => {
  const ofx = '<OFX><CURDEF>CHF\n<BANKID>1\n<ACCTID>2\n<BANKTRANLIST><STMTTRN><DTPOSTED>20260801\n<TRNAMT>-12\n<FITID>abc\n<MEMO>Migros\n</STMTTRN></BANKTRANLIST></OFX>'
  const first = planStatementUpdates([], selected(reviewStatementBatch([file(ofx)])))
  const existing = saved(first.items.map(item => ({ ...item, categoryId: 'shopping', categoryOrigin: 'confirmed', householdOwner: 'spouse' })))
  const revised = file(ofx.replace('-12', '-15').replace('Migros', 'Coop'))
  const review = reviewStatementBatch([revised], { existingItems: existing })
  assert.equal(review.rows[0].item.categoryId, 'shopping')
  const plan = planStatementUpdates(existing, selected(review))
  assert.deepEqual([plan.added, plan.updated], [0, 1])
  assert.equal(plan.items[0].amount, 15)
  assert.equal(plan.items[0].description, 'Coop')
  assert.equal(plan.items[0].categoryId, 'shopping')
  assert.equal(plan.items[0].householdOwner, 'spouse')
  const otherAccount = reviewStatementBatch([file(ofx.replace('<ACCTID>2', '<ACCTID>3'))], { existingItems: existing })
  assert.equal(otherAccount.rows[0].updateTargetId, null)
})

test('migra importações antigas e não sobrescreve lançamentos manuais', () => {
  const old = saved([{ ...selected(reviewStatementBatch([file(csv)]))[0], id: 'old', statementImportKey: undefined }])
  const review = reviewStatementBatch([file(csv)], { existingItems: old })
  assert.equal(review.rows[0].updateTargetId, 'old')
  const plan = planStatementUpdates(old, selected(review))
  assert.equal(plan.updated, 1)
  assert.equal(plan.items[0].id, 'old')
  assert.ok(saved(plan.items)[0].statementImportKey)
  const manual = saved([{ ...old[0], source: 'manual', imported: false }])
  const protectedReview = reviewStatementBatch([file(csv)], { existingItems: manual })
  assert.equal(protectedReview.rows[0].duplicate, true)
  assert.equal(protectedReview.rows[0].updateTargetId, null)
})

test('mapeamentos independentes preservam identificação e mostram arquivo inválido', () => {
  const good = file(csv)
  const bad = file('quando;texto;quantia\n2026-08-02;SBB;-4', 'bad.csv')
  const invalid = reviewStatementBatch([good, bad])
  assert.match(invalid.mappingErrors[0], /bad.csv/)
  bad.mapping = { date: 0, description: 1, amount: 2 }
  const valid = reviewStatementBatch([good, bad])
  assert.equal(valid.mappingErrors.length, 0)
  assert.equal(valid.rows[1].rowNumber, 2003)
  assert.equal(valid.rows[1].item.categoryId, 'transport')
})

test('rejeita mais de 12 arquivos e um lote vazio', () => {
  assert.throws(() => reviewStatementBatch([]), /1 a 12/)
  assert.throws(() => reviewStatementBatch(Array.from({ length: 13 }, () => file(csv))), /1 a 12/)
})

test('um previsto igual não bloqueia o movimento realizado do extrato', () => {
  const planned = { ...selected(reviewStatementBatch([file(csv)]))[0], imported: false, source: 'manual', recordKind: 'planned' }
  const review = reviewStatementBatch([file(csv)], { existingItems: [planned] })
  assert.equal(review.rows[0].duplicate, false)
  assert.equal(review.rows[0].updateTargetId, null)
})
