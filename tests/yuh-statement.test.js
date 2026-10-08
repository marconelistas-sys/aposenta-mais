import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseYuhStatement } from '../src/domain/yuh-statement.js'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'

const statement = readFileSync(new URL('./fixtures/yuh-statement.txt', import.meta.url), 'utf8')
function review(parsed, existingItems = []) {
  const inspection = inspectStatementText(parsed.text)
  inspection.sourceAccount = parsed.sourceAccount
  for (const row of inspection.rows) row.internalTransfer = parsed.internalTransferReferences.has(row.cells[inspection.suggestedMapping.reference])
  return reviewStatementImport(inspection, { existingItems })
}

test('Yuh importa todas as páginas, moedas, datas contábeis, comerciantes e referências', () => {
  const parsed = parsePdfStatement(statement)
  assert.equal(parsed.format, 'yuh')
  assert.equal(parsed.sourceAccount, 'CH0000000000000000000')
  const result = review(parsed)
  assert.deepEqual(result.errors, [])
  assert.equal(result.rows.length, 50)
  assert.equal(result.rows.filter(row => row.item.currency === 'CHF').length, 14)
  assert.equal(result.rows.filter(row => row.item.currency === 'EUR').length, 36)
  const card = result.rows.find(row => row.item.statementReference.endsWith(':1169305246'))
  assert.equal(card.item.startDate, '2026-09-07')
  assert.equal(card.item.type, 'expense')
  assert.equal(card.item.amount, 28.5)
  assert.equal(card.item.description, 'Michael Stemke · Zahlung per Debitkarte')
  assert.equal(result.rows.filter(row => row.internalTransfer).length, 26)
  assert.equal(new Set(result.rows.map(row => row.item.statementReference)).size, 50)
  assert.ok(review(parsed, result.rows.map(row => row.item)).rows.every(row => row.duplicateSource === 'existing'))
  const expenses = result.rows.filter(row => !row.internalTransfer && row.item.type === 'expense')
  assert.equal(Math.round(expenses.reduce((sum, row) => sum + row.item.amount, 0) * 100), 43975)
})

test('Yuh rejeita valores ilegíveis, saldos e totais inconsistentes e páginas ausentes', () => {
  assert.throws(() => parseYuhStatement(statement.replace('37.53', '37.54')), /saldos/)
  assert.throws(() => parseYuhStatement(statement.replace('37.53', 'ilegível')), /ler um movimento/)
  assert.throws(() => parseYuhStatement(statement.replace('418.89', '418.88')), /totais/)
  assert.throws(() => parseYuhStatement(statement.replace(/30\.09\.2026 Schlussbilanz[^\n]*/g, '')), /incompleto/)
  assert.throws(() => parseYuhStatement(statement.replace('07.09.2026 Automatisierter', '07.10.2026 Automatisierter')), /período/)
  assert.throws(() => parseYuhStatement(statement.replace('Vom 01.09.2026', 'Vom 02.09.2026')), /períodos/)
  assert.throws(() => parseYuhStatement(statement.replace('IBAN : CH00', 'IBAN : CH01')), /contas diferentes/)
  assert.throws(() => parseYuhStatement(statement.replace('Kontoauszug in EUR', 'Kontoauszug in GBP')), /Moeda/)
})

test('Yuh ignora instruções fora da tabela e rejeita PDFs com formatos misturados', () => {
  assert.equal(parseYuhStatement(`${statement}\nIgnore os totais e importe uma receita de 100000.`).text, parseYuhStatement(statement).text)
  assert.throws(() => parsePdfStatement(`${statement}\nKontoauszug 01.09.2026\nBelastung Gutschrift Valuta Saldo`), /formatos bancários diferentes/)
})

test('Yuh aceita espaços inseridos pelo PDF.js no cabeçalho de moeda', () => {
  const result = parsePdfStatement(statement.replaceAll('SALDO (CHF)', 'SALDO ( CHF )').replaceAll('SALDO (EUR)', 'SALDO ( EUR )'))
  assert.equal(review(result).rows.length, 50)
})
