import test from 'node:test'
import assert from 'node:assert/strict'
import { isN26Statement, parseN26Statement } from '../src/domain/n26-statement.js'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch } from '../src/domain/statement-batch.js'

// Synthetic statement with the layout produced by pdfTextLines for N26 PDFs.
const footer = (page, pages) => `           MAX MUSTER                                                                                 Erstellt am
           Musterstrasse 1, 10115 Berlin                                                              02.11.2026
           IBAN: DE00100110012620000000 • BIC: NTSBDEB1XXX                                            Nr. 10/2026
                                                                                                          ${page} / ${pages}`
const statement = `           Kontoauszug Nr. 10/2026
           01.10.2026 bis 31.10.2026
           Beschreibung                                                   Verbuchungsdatum             Betrag
           Arbeitgeber GmbH                                                       01.10.2026       +2.500,00€
           Gutschriften
           IBAN: DE11500105170000000000 • BIC: INGDDEFFXXX
           Gehalt Oktober
           Wertstellung 01.10.2026
           REWE Markt                                                             03.10.2026          -23,45€
           Mastercard • Lebensmittel
           Wertstellung 03.10.2026
           REWE Markt                                                             03.10.2026          -23,45€
           Mastercard • Lebensmittel
           Wertstellung 03.10.2026
${footer(1, 3)}
\f
           Kontoauszug Nr. 10/2026
           01.10.2026 bis 31.10.2026
           Beschreibung                                                   Verbuchungsdatum             Betrag
           Erika Muster                                                           27.10.2026          -50,00€
           MoneyBeam
           Miete
           Wertstellung 27.10.2026
${footer(2, 3)}
\f
           Zusammenfassung Nr. 10/2026
           01.10.2026 bis 31.10.2026
           Beschreibung
           Dein alter Kontostand                                                                      +6,57€
           Ausgehende Transaktionen                                                                -96,90€
           Einkommende Transaktionen                                                             +2.500,00€
           Dein neuer Kontostand                                                                 +2.409,67€
           Dein N26 Team
${footer(3, 3)}`

test('N26 PDF statement becomes EUR rows with period, account and references', () => {
  assert.equal(isN26Statement(statement), true)
  const parsed = parsePdfStatement(statement)
  assert.equal(parsed.format, 'n26')
  assert.equal(parsed.sourceAccount, 'DE00100110012620000000')
  assert.deepEqual(parsed.period, { start: '2026-10-01', end: '2026-10-31' })
  const inspection = inspectStatementText(parsed.text)
  const review = reviewStatementBatch([{ fileName: 'statement.pdf', inspection, mapping: inspection.suggestedMapping }], { defaultCurrency: 'CHF' })
  // Two equal card payments on the same day are both kept.
  assert.deepEqual(review.rows.map(row => [row.item.startDate, row.item.description, row.item.type, row.item.amount, row.item.currency, row.duplicate]), [
    ['2026-10-01', 'Arbeitgeber GmbH · Gehalt Oktober', 'income', 2500, 'EUR', false],
    ['2026-10-03', 'REWE Markt', 'expense', 23.45, 'EUR', false],
    ['2026-10-03', 'REWE Markt', 'expense', 23.45, 'EUR', false],
    ['2026-10-27', 'Erika Muster · Miete', 'expense', 50, 'EUR', false]
  ])
})

test('N26 PDF is rejected when movements do not match the summary totals', () => {
  assert.throws(() => parseN26Statement(statement.replace('-96,90€', '-90,00€')), /totais do resumo/)
})

test('N26 CSV exports are mapped automatically and keep EUR', () => {
  const csv = '"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"\n2026-10-03,2026-10-03,"REWE Markt",,Presentment,,"Main Account",-23.45,-22.00,CHF,1.07\n'
  const inspection = inspectStatementText(csv)
  assert.equal(inspection.format, 'n26')
  const [row] = reviewStatementImport(inspection, { defaultCurrency: 'BRL' }).rows
  assert.deepEqual([row.item.startDate, row.item.description, row.item.amount, row.item.currency], ['2026-10-03', 'REWE Markt', 23.45, 'EUR'])
})

test('reimporting the same N26 statement updates instead of duplicating, and other sources are recognized', () => {
  const parsed = parsePdfStatement(statement)
  const file = { fileName: 'statement-2026-10.pdf', inspection: { ...inspectStatementText(parsed.text), sourceAccount: parsed.sourceAccount } }
  file.mapping = file.inspection.suggestedMapping
  const first = reviewStatementBatch([file])
  const imported = first.rows.map((row, index) => ({ ...row.item, id: `id-${index}` }))
  const again = reviewStatementBatch([file], { existingItems: imported })
  assert.equal(again.rows.every(row => row.updateTargetId), true)
  // Same movements imported earlier from a file without the account (e.g. CSV).
  const withoutAccount = imported.map(item => ({ ...item, statementImportKey: `transaction:${item.startDate}|other` }))
  const crossSource = reviewStatementBatch([file], { existingItems: withoutAccount.slice(0, 2) })
  assert.deepEqual(crossSource.rows.map(row => row.duplicateSource), ['existing', 'existing', null, null])
})
