import test from 'node:test'
import assert from 'node:assert/strict'
import { tkbStatementToDelimited } from '../src/domain/tkb-statement.js'
import { parseStatementText, reviewStatementImport, inspectStatementText } from '../src/domain/statement-import.js'
import { pdfTextLines, readStatementFile } from '../src/domain/statement-file.js'

const header = 'Datum   Text                                                Belastung     Gutschrift      Valuta           Saldo'
const statement = [
  'Privatkonto CHF',
  'Kontoauszug 01.08.2026 - 31.08.2026', header,
  "01.08. Saldovortrag                                                                                 10'000.00",
  "03.08. Warenbezug und Dienstleistungen                         4.20                    30.07.26       9'995.80",
  '       Loja exemplo', '       TKB Debit Mastercard',
  '       Originalbetrag USD 5.00',
  "10.08. Zahlungsauftrag e-banking                             823.50                    10.08.26       9'172.30",
  '       (Anzahl Buchungen: 2 / Ref.-Nr. 123)',
  '                              XDNI acc_mth_xml 0 20260901                                          Seite 1 von 2',
  '\f', 'Privatkonto CHF', header,
  '        Empresa exemplo                              323.50',
  '        Rua exemplo',
  '        Outra empresa                                500.00',
  "25.08. Gutschrift / Ref.-Nr. 456                                      8'081.30 25.08.26                  17'253.60",
  '       Empregador exemplo',
  "        Umsatztotal                                          827.70     8'081.30",
  "31.08. Saldo                                                                                       17'253.60"
].join('\n')

test('TKB preserva data contábil, CHF, contrapartes e total de pagamentos agrupados entre páginas', () => {
  const result = parseStatementText(tkbStatementToDelimited(statement))
  assert.equal(result.items.length, 3)
  assert.deepEqual(result.errors, [])
  assert.equal(result.items[0].startDate, '2026-08-03')
  assert.equal(result.items[0].amount, 4.2)
  assert.equal(result.items[0].currency, 'CHF')
  assert.match(result.items[0].description, /^Loja exemplo/)
  assert.equal(result.items[1].amount, 823.5)
  assert.match(result.items[1].description, /^Empresa exemplo/)
  assert.equal(result.items[2].amount, 8081.3)
  assert.equal(result.items[2].type, 'income')
  const review = reviewStatementImport(inspectStatementText(tkbStatementToDelimited(statement)), { existingItems: result.items })
  assert.ok(review.rows.every(row => row.duplicateSource === 'existing'))
})

test('TKB rejeita movimentos ilegíveis, saldo inconsistente e formatos desconhecidos', () => {
  assert.throws(() => tkbStatementToDelimited('Instruções para importar dados'), /Formato PDF não suportado/)
  assert.throws(() => tkbStatementToDelimited(statement.replace('4.20', '5.20')), /saldos/)
  assert.throws(() => tkbStatementToDelimited(statement.replace('4.20', 'ilegível')), /ler um movimento/)
  assert.throws(() => tkbStatementToDelimited(statement.replace('827.70', '800.00')), /totais/)
  assert.throws(() => tkbStatementToDelimited(statement.split('Umsatztotal')[0]), /incompleto/)
})

test('TKB resolve mudança de ano pelo período do extrato', () => {
  const text = statement.replace('01.08.2026 - 31.08.2026', '01.12.2025 - 31.01.2026').replaceAll('03.08.', '03.12.').replaceAll('10.08.', '10.12.').replaceAll('25.08.', '25.01.')
  assert.deepEqual(parseStatementText(tkbStatementToDelimited(text)).items.map(row => row.startDate), ['2025-12-03', '2025-12-10', '2026-01-25'])
})

test('extração PDF mantém posições das colunas e ordena linhas e itens', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] })
  assert.equal(pdfTextLines([item('20.00', 40, 10), item('Text', 40, 20), item('Datum', 0, 20)]), 'Datum     Text\n          20.00')
})

test('leitor de arquivos mantém CSV e limites existentes', async () => {
  const file = { name: 'statement.csv', size: 80, text: async () => 'data;descricao;valor\n2026-08-01;Teste;-10' }
  assert.equal((await readStatementFile(file)).inspection.totalRows, 1)
  await assert.rejects(readStatementFile({ ...file, size: 1024 * 1024 + 1 }), /1 MB/)
})
