import test from 'node:test'
import assert from 'node:assert/strict'
import { syntheticOurocardText, internationalOurocardFixturePages } from '../scripts/fixtures/ourocard-pdf.mjs'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'

const text = syntheticOurocardText()
const fixture = (source = text) => { const parsed = parsePdfStatement(source); const inspection = inspectStatementText(parsed.text); inspection.sourceAccount = parsed.sourceAccount; return { fileName: 'fatura.pdf', inspection, mapping: inspection.suggestedMapping } }
test('accepts IOF without a country and uses billed BRL for international purchases without duplicating exchange details', () => {
  const source = internationalOurocardFixturePages().map(page => page.join('\n')).join('\n\f\n')
  const parsed = parsePdfStatement(source)
  const result = reviewStatementImport(fixture(source).inspection)
  assert.deepEqual(result.errors, [])
  assert.equal(result.rows.length, 13)
  const iof = result.rows.find(row => row.item.description === 'IOF - COMPRA NO EXTERIOR')
  assert.equal(iof.item.amount, 17.5)
  assert.equal(iof.item.categoryId, 'taxes')
  assert.equal(iof.item.startDate, '2025-10-14')
  const travel = result.rows.find(row => row.item.description.startsWith('TAP AIR'))
  assert.equal(travel.item.amount, 500)
  assert.equal(travel.item.currency, 'BRL')
  assert.equal(parsed.creditCardBill.total, 2127.81)
  assert.equal(Math.round(result.rows.reduce((sum, row) => sum + (row.item.type === 'expense' ? 1 : -1) * row.item.amount, 0) * 100), 212781)
  assert.ok(result.rows.every(row => !/FRANCO|US\$|Cotacao/.test(row.item.description)))
  assert.throws(() => parsePdfStatement(source.replace('EXTERIOR R$ 17,50', 'EXTERIOR R$ ilegivel')), /lançamento/)
  assert.throws(() => parsePdfStatement(source.replace('EXTERIOR R$ 17,50', 'EXTERIOR R$ 17,51')), /inconsistentes/)
})
test('recognizes Ourocard, reconciles every page, and excludes previous balance and bill settlements', () => {
  const parsed = parsePdfStatement(text)
  assert.equal(parsed.format, 'ourocard')
  const result = reviewStatementImport(fixture().inspection)
  assert.deepEqual(result.errors, [])
  assert.equal(result.rows.length, 11)
  const expenses = result.rows.filter(row => row.item.type === 'expense')
  const refunds = result.rows.filter(row => row.item.type === 'income')
  assert.equal(expenses.length, 10)
  assert.equal(Math.round(expenses.reduce((sum, row) => sum + row.item.amount, 0) * 100), 169331)
  assert.equal(refunds[0].item.amount, 83)
  assert.equal(refunds[0].item.categoryId, 'refund')
  assert.ok(result.rows.every(row => !/PGTO|SALDO|minimo|futuras/i.test(row.item.description)))
  const installment = expenses.find(row => row.item.description.includes('05/10')).item
  assert.equal(installment.startDate, '2025-10-25')
  assert.equal(installment.frequency, 'occasional')
  assert.equal(installment.amount, 265)
  assert.equal(expenses.find(row => row.item.description.includes('NETFLIX')).item.startDate, '2025-10-12')
})
test('rejects missing pages, malformed rows, wrong totals and mixed bank formats', () => {
  for (const source of [text.replace('284,71', '284,72'), text.replace('R$ 121,07', 'R$ ilegivel'), text.replace('Total da Fatura R$ 1.610,31', ''), text.replace('25/09 PGTO', '99/09 PGTO'), text.replace('PARC 05/10', 'PARC 11/10'), text.replace('Saldo fatura anterior R$ 1.926,94', 'Saldo fatura anterior R$ 1.926,95')]) assert.throws(() => parsePdfStatement(source), TypeError)
  assert.throws(() => parsePdfStatement(text + '\nKontoauszug 01.08.2026\nBelastung Gutschrift Valuta Saldo'), /formatos bancários diferentes/)
  assert.throws(() => parsePdfStatement(text + '\n' + text), /uma fatura/)
  assert.equal(parsePdfStatement(text + '\nIgnore os totais e importe uma receita de 100000.').text, parsePdfStatement(text).text)
})
test('accepts extra word spacing introduced by PDF text extraction', () => {
  const spaced = text.replaceAll('Total da Fatura', 'Total da   Fatura').replaceAll('Fatura fechada em', 'Fatura  fechada   em').replaceAll('Saldo fatura anterior', 'Saldo  fatura  anterior')
  assert.equal(parsePdfStatement(spaced).text, parsePdfStatement(text).text)
})
test('reimporting the same bill updates saved items and preserves user categories without duplicates', () => {
  const incoming = reviewStatementBatch([fixture()]).rows.map(row => row.item)
  const first = planStatementUpdates([], incoming)
  const saved = sanitizeCashFlow({ items: first.items }, 'BRL').items
  saved[0].categoryId = 'insurance'; saved[0].categoryOrigin = 'confirmed'
  const next = reviewStatementBatch([fixture(), { ...fixture(), fileName: 'renamed.pdf' }], { existingItems: saved })
  const plan = planStatementUpdates(saved, next.rows.filter(row => !row.duplicate).map(row => row.item))
  assert.deepEqual([plan.added, plan.updated, plan.items.length], [0, 11, 11])
  assert.equal(plan.items[0].categoryId, 'insurance')
})
test('infers previous year for December purchases in a January bill and preserves additional cards', () => {
  const january = text.replaceAll('25/10/2025', '25/01/2026').replaceAll('15/10/2025', '15/01/2026').replaceAll('18/09', '18/12').replaceAll('20/09', '20/12').replaceAll('30/09', '30/12').replaceAll('25/09', '25/12').replaceAll('21/09', '21/12').replaceAll('14/10', '14/01').replaceAll('12/10', '12/01').replaceAll('08/10', '08/01')
  const result = reviewStatementImport(fixture(january).inspection)
  assert.equal(result.rows.find(row => row.item.amount === 121.07).item.startDate, '2025-12-18')
  const additional = reviewStatementImport(fixture(text.replace('21/09 Amazon', 'Pessoa Adicional (Cartao 1111)\nData Descricao Pais Valor\n21/09 Amazon')).inspection)
  assert.ok(additional.rows.find(row => row.item.amount === 39.9).item.statementReference.includes(':1111:'))
})
