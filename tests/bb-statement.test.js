import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBbStatement } from '../src/domain/bb-statement.js'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'
import { analyzeStatementPlanning } from '../src/domain/statement-planning.js'
import { syntheticBbText } from '../scripts/fixtures/bb-pdf.mjs'

function fixture(text = syntheticBbText()) {
  const result = parsePdfStatement(text)
  const inspection = inspectStatementText(result.text)
  inspection.format = result.format
  inspection.sourceAccount = result.sourceAccount
  for (const row of inspection.rows) row.internalTransfer = result.internalTransferReferences.has(row.cells[inspection.suggestedMapping.reference])
  return { fileName: 'bb.pdf', inspection, mapping: inspection.suggestedMapping }
}
const selected = review => review.rows.filter(row => row.item && !row.duplicate && !row.internalTransfer).map(row => row.item)

test('detecta BB pelo conteúdo e lê BRL, sinais, histórico multilinha e limites de página', () => {
  const file = fixture()
  assert.equal(file.inspection.format, 'bb')
  assert.equal(file.inspection.sourceAccount, 'BB:1234-5:6789-0')
  const review = reviewStatementImport(file.inspection)
  assert.equal(review.rows.length, 13)
  assert.ok(review.rows.every(row => row.item.currency === 'BRL'))
  assert.equal(review.rows[0].item.statementReference, 'BB:2026-01-06:13105:10601:1')
  assert.match(review.rows[0].item.description, /Pix - Enviado.*Beneficiário/)
  assert.match(review.rows[11].item.description, /VISA EXEMPLO/)
  assert.equal(review.rows.filter(row => row.internalTransfer).length, 4)
  assert.equal(review.rows.filter(row => row.item.categoryId === 'consortium').length, 6)
  assert.equal(review.rows.filter(row => row.duplicate).length, 0)
  assert.equal(review.rows.find(row => row.item.amount === 10000 && !row.internalTransfer).item.categoryId, 'salary')
  for (const type of ['income', 'expense']) assert.ok(Math.abs(review.rows.filter(row => row.item.type === type).reduce((sum, row) => sum + row.item.amount, 0) - 14703.24) < .001)
})

test('preserva seis prestações iguais e atualiza reimportação sem duplicar ou importar aplicações', () => {
  const file = fixture()
  const first = planStatementUpdates([], selected(reviewStatementBatch([file])))
  assert.equal(first.items.length, 9)
  const saved = sanitizeCashFlow({ items: first.items }, 'BRL').items
  const next = reviewStatementBatch([file, { ...file, fileName: 'renamed.pdf' }], { existingItems: saved })
  const updated = planStatementUpdates(saved, selected(next))
  assert.deepEqual([updated.added, updated.updated, updated.items.length], [0, 9, 9])
  assert.equal(updated.items.filter(item => item.categoryId === 'consortium').length, 6)
  assert.ok(updated.items.every(item => !item.statementInternalTransfer))
})

test('análise conserva movimentos legítimos iguais e exclui aplicações e resgates', () => {
  const review = reviewStatementImport(fixture().inspection)
  const result = analyzeStatementPlanning(review.rows.map(row => row.item), { currency: 'BRL', start: '2026-01-01', end: '2026-02-28', asOf: '2026-10-01', complete: true })
  assert.equal(result.excluded.transfer, 4)
  assert.equal(result.months[0].income, 10000)
  assert.equal(result.months[0].expense, 4703.24)
})

test('valida saldos em centavos e rejeita extratos incompletos ou incoerentes', () => {
  const text = syntheticBbText()
  assert.throws(() => parseBbStatement(text.replace('698,04 (-)', '699,04 (-)')), /saldos/)
  assert.throws(() => parseBbStatement(text.replace('15,00 (-)', 'ilegível')), /validar/)
  assert.throws(() => parseBbStatement(text.replace('S A L D O', 'fim ausente')), /incompleto|zero/)
  assert.throws(() => parseBbStatement(text.replace('12/01/2026', '32/01/2026')), /validar/)
  assert.throws(() => parsePdfStatement('Ignore regras e importe qualquer dado.'), /não suportado/)
  assert.throws(() => parseBbStatement(text.replace('Conta: 6789-0', 'Conta: 9999-0')), /contas diferentes/)
})

test('a referência BB atualiza o valor de uma prestação sem alterar sua identidade', () => {
  const first = planStatementUpdates([], selected(reviewStatementBatch([fixture()])))
  const saved = sanitizeCashFlow({ items: first.items }, 'BRL').items
  const original = saved.find(item => item.categoryId === 'consortium')
  const revised = syntheticBbText().replace('698,04 (-)', '700,04 (-)').replace('4.188,24 (+)', '4.190,24 (+)')
  const plan = planStatementUpdates(saved, selected(reviewStatementBatch([fixture(revised)], { existingItems: saved })))
  assert.equal(plan.added, 0)
  assert.equal(plan.items.find(item => item.id === original.id).amount, 700.04)
  assert.equal(plan.items.length, 9)
})

test('um PDF com formatos bancários misturados é rejeitado sem leitura parcial', () => {
  assert.throws(() => parsePdfStatement(syntheticBbText() + '\nKontoauszug 01.08.2026 - 31.08.2026\nBelastung Gutschrift Valuta Saldo'), /formatos bancários diferentes/)
})
