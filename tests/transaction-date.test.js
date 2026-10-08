import test from 'node:test'
import assert from 'node:assert/strict'
import { transactionDateLabel, transactionTime } from '../src/shared/transaction-date.js'
import { parseStatementText } from '../src/domain/statement-import.js'
import { sanitizeCashFlowItem } from '../src/app/state-storage.js'
import { renderBudgetEntryResults } from '../src/features/cash-flow/cash-flow.js'

test('transaction dates show the bank time without timezone shifts or invented hours', () => {
  const item = { startDate: '2026-09-09', recordKind: 'actual', transactionTime: '18:03' }
  assert.equal(transactionDateLabel(item), '9 de setembro de 2026 às 18:03')
  assert.equal(transactionDateLabel({ ...item, transactionTime: undefined }), '9 de setembro de 2026')
  assert.equal(transactionDateLabel({ ...item, startDate: '2026-02-30' }), '')
  assert.equal(transactionDateLabel({}), '')
  assert.equal(transactionTime('25:03'), null)
  assert.equal(transactionTime('18:03:45'), '18:03')
  assert.equal(transactionDateLabel({ ...item, recordKind: 'planned', frequency: 'monthly' }), 'Início: 9 de setembro de 2026')
})

test('CSV times survive storage and appear directly in the budget entry list', () => {
  const imported = parseStatementText('data;descricao;valor;moeda;hora;categoria\n09/09/2026;SBB Contact xxxx;-12;CHF;18:03;transport').items[0]
  assert.equal(imported.transactionTime, '18:03')
  const saved = sanitizeCashFlowItem(imported)
  assert.equal(saved.transactionTime, '18:03')
  assert.equal(sanitizeCashFlowItem({ ...saved, transactionTime: '<script>' }).transactionTime, undefined)
  const html = renderBudgetEntryResults({ convertedItems: [{ ...saved, isActive: true, convertedAmount: 12, category: { name: 'Transporte' } }] })
  assert.match(html, /data-budget-item-date>9 de setembro de 2026 às 18:03<\/span>/)
  assert.match(html, /SBB Contact xxxx/)
})

test('OFX preserves explicit bank clock times and leaves date-only transactions without a time', () => {
  const ofx = posted => `<OFX><CURDEF>CHF<BANKTRANLIST><STMTTRN><DTPOSTED>${posted}<TRNAMT>-12<FITID>1<MEMO>SBB</STMTTRN></BANKTRANLIST></OFX>`
  assert.equal(parseStatementText(ofx('20260909180300[+2:CEST]')).items[0].transactionTime, '18:03')
  assert.equal(parseStatementText(ofx('20260909')).items[0].transactionTime, undefined)
})
