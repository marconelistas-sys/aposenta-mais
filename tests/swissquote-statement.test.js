import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseSwissquoteStatement } from '../src/domain/swissquote-statement.js'
const parseYuhStatement = parseSwissquoteStatement
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { pdfTextLines } from '../src/domain/statement-file.js'
import { reviewStatementBatch } from '../src/domain/statement-batch.js'
import { previewAccountBalances } from '../src/domain/statement-account-balances.js'
import { swissquoteTextItems, syntheticSwissquotePages } from '../scripts/fixtures/swissquote-pdf.mjs'

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

const swissquote = syntheticSwissquotePages().map(rows => pdfTextLines(swissquoteTextItems(rows))).join('\n\f\n')
const swissquoteFile = (text = swissquote) => {
  const parsed = parsePdfStatement(text)
  const inspection = { ...inspectStatementText(parsed.text), sourceAccount: parsed.sourceAccount, format: parsed.format, period: parsed.period }
  for (const row of inspection.rows) row.internalTransfer = parsed.internalTransferReferences.has(row.cells[inspection.suggestedMapping.reference])
  return { fileName: 'swissquote.pdf', inspection, mapping: inspection.suggestedMapping }
}

test('Swissquote PDF in English becomes debits and credits per currency, with account, period and balances', () => {
  const parsed = parsePdfStatement(swissquote)
  assert.equal(parsed.format, 'swissquote')
  assert.equal(parsed.sourceAccount, 'CH9900000000000000002')
  assert.deepEqual(parsed.period, { start: '2026-10-01', end: '2026-10-31' })
  assert.deepEqual(parsed.accountBalances, [{ currency: 'CHF', amount: 1234.5 }, { currency: 'USD', amount: 950 }])
  const { rows } = reviewStatementBatch([swissquoteFile()], { defaultCurrency: 'CHF' })
  assert.deepEqual(rows.map(row => [row.item.startDate, row.item.type, row.item.amount, row.item.currency, row.item.description]), [
    ['2026-10-02', 'income', 2000, 'CHF', 'Cliente Exemplo · Payment from'],
    ['2026-10-05', 'expense', 15.5, 'CHF', 'Custody fees'],
    ['2026-10-20', 'expense', 1000, 'CHF', 'CHF - USD · Forex debit'],
    ['2026-10-20', 'income', 1250, 'USD', 'CHF - USD · Forex credit'],
    ['2026-10-25', 'expense', 300, 'USD', 'Fornecedor Exemplo Ltd · Payment to']
  ])
  // Currency exchanges stay out of the budget, like in Yuh.
  assert.deepEqual(rows.filter(row => row.internalTransfer).map(row => row.item.currency), ['CHF', 'USD'])
  assert.equal(new Set(rows.map(row => row.item.statementImportKey)).size, 5)
  // Text outside the table is ignored.
  assert.ok(rows.every(row => row.item.amount !== 100000))
})

test('reimporting the Swissquote statement updates the movements and proposes one account per currency', () => {
  const first = reviewStatementBatch([swissquoteFile()])
  const existing = first.rows.map((row, index) => ({ ...row.item, id: `item-${index}`, recordKind: 'actual', imported: true }))
  assert.ok(reviewStatementBatch([swissquoteFile()], { existingItems: existing }).rows.every(row => row.updateTargetId && !row.duplicate))
  const balances = parsePdfStatement(swissquote).accountBalances.map(row => ({ ...row, bank: 'swissquote', sourceAccount: 'CH9900000000000000002', asOfDate: '2026-10-31' }))
  assert.deepEqual(previewAccountBalances(balances, [], { currency: 'CHF' }).map(row => [row.label, row.amount, row.status, row.target]), [
    ['Conta Swissquote (CHF)', 1234.5, 'update', 'new'],
    ['Conta Swissquote (USD)', 950, 'update', 'new']
  ])
})

test('Swissquote PDF is rejected when balances or totals do not add up, or a page is missing', () => {
  assert.throws(() => parseSwissquoteStatement(swissquote.replace(/(Custody fees\s+\d+\s+)15\.50/, '$115.60')), /Swissquote não correspondem aos saldos/)
  assert.throws(() => parseSwissquoteStatement(swissquote.replace("1'015.50 CHF", "1'015.40 CHF")), /totais/)
  assert.throws(() => parseSwissquoteStatement(swissquote.split('\f').slice(0, 2).join('\f')), /incompleto/)
  assert.throws(() => parseSwissquoteStatement(swissquote.replace('Account statement in USD', 'Account statement in GBP')), /Moeda/)
  assert.throws(() => parseSwissquoteStatement(swissquote.replace('From 01.10.2026', 'From 02.10.2026')), /períodos/)
})
