import test from 'node:test'
import assert from 'node:assert/strict'
import { isRendimentoStatement, parseRendimentoStatement } from '../src/domain/rendimento-statement.js'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { pdfTextLines } from '../src/domain/statement-file.js'
import { inspectStatementText } from '../src/domain/statement-import.js'
import { reviewStatementBatch } from '../src/domain/statement-batch.js'
import { previewAccountBalances } from '../src/domain/statement-account-balances.js'
import { rendimentoTextItems, syntheticRendimentoPages } from '../scripts/fixtures/rendimento-pdf.mjs'

const statement = syntheticRendimentoPages().map(rows => pdfTextLines(rendimentoTextItems(rows))).join('\n\f\n')
const file = (text = statement) => {
  const parsed = parsePdfStatement(text)
  const inspection = { ...inspectStatementText(parsed.text), sourceAccount: parsed.sourceAccount, format: parsed.format, period: parsed.period }
  return { fileName: 'rendimento.pdf', inspection, mapping: inspection.suggestedMapping }
}

test('Banco Rendimento PDF becomes BRL debits and credits in date order, with account and period', () => {
  assert.equal(isRendimentoStatement(statement), true)
  const parsed = parsePdfStatement(statement)
  assert.equal(parsed.format, 'rendimento')
  assert.equal(parsed.sourceAccount, 'Rendimento:0001-9:0000123456')
  assert.deepEqual(parsed.period, { start: '2026-10-01', end: '2026-11-03' })
  assert.deepEqual(parsed.accountBalances, [{ currency: 'BRL', amount: 2721.58 }])
  const { rows } = reviewStatementBatch([file()], { defaultCurrency: 'CHF' })
  assert.equal(rows.length, 14)
  assert.ok(rows.every(row => row.item.currency === 'BRL' && !row.error))
  assert.deepEqual(rows.slice(0, 3).map(row => [row.item.startDate, row.item.type, row.item.amount, row.item.description]), [
    ['2026-10-01', 'expense', 299.9, 'PACOTE PREMIUM PF'],
    ['2026-10-05', 'expense', 89.9, 'Env Pgto Pix Cp :00000000-PIX Marketplace'],
    ['2026-10-20', 'expense', 300, 'Env Pgto Pix Cp :00000000-CLIENTE EXEMPLO']
  ])
  // The day split across pages keeps its movement.
  assert.deepEqual(rows[3].item.startDate, '2026-10-27')
  const credit = rows.find(row => row.item.description.includes('Corretora Exemplo'))
  assert.deepEqual([credit.item.type, credit.item.amount, credit.item.startDate], ['income', 9700, '2026-10-29'])
  // A payment and its reversal with the same document number are distinct movements.
  const reversal = rows.filter(row => row.item.startDate === '2026-10-30')
  assert.deepEqual(reversal.map(row => [row.item.type, row.item.amount, row.item.statementReference]), [
    ['expense', 418.18, 'Rendimento:2026-10-30:1000001:1'],
    ['income', 418.18, 'Rendimento:2026-10-30:1000001:2']
  ])
  assert.equal(new Set(rows.map(row => row.item.statementImportKey)).size, 14)
})

test('reimporting the statement updates the same movements and the account balance once', () => {
  const first = reviewStatementBatch([file()])
  const existing = first.rows.map((row, index) => ({ ...row.item, id: `item-${index}`, recordKind: 'actual', imported: true }))
  const again = reviewStatementBatch([file()], { existingItems: existing })
  assert.ok(again.rows.every(row => row.updateTargetId && !row.duplicate))
  const [balance] = previewAccountBalances([{ ...parsePdfStatement(statement).accountBalances[0], bank: 'rendimento', sourceAccount: 'Rendimento:0001-9:0000123456', asOfDate: '2026-11-03' }], [], { currency: 'CHF' })
  assert.deepEqual([balance.label, balance.amount, balance.status, balance.target], ['Conta Rendimento (BRL)', 2721.58, 'update', 'new'])
})

test('Banco Rendimento PDF is rejected when balances do not add up or a page is missing', () => {
  assert.throws(() => parseRendimentoStatement(statement.replace('-2.315,00', '-2.316,00')), /saldos do extrato/)
  const [first] = statement.split('\f')
  assert.throws(() => parseRendimentoStatement(`${first}\n           Banco Rendimento S/A`), /incompleto/)
  // Removing a whole day breaks the chain of daily balances.
  const withoutDay = statement.replace(/\s*Documento[^\n]*\n\s*05\/10\/2026[\s\S]*?Saldo Final\s+R\$ 1\.314,20/, '')
  assert.throws(() => parseRendimentoStatement(withoutDay), /dias consecutivos/)
  assert.throws(() => parseRendimentoStatement(statement.replace(/(Saldo Atual\s+R\$ )2\.721,58/, '$12.000,00')), /Saldo atual/)
})
