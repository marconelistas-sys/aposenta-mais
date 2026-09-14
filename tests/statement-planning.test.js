import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeStatementPlanning } from '../src/domain/statement-planning.js'
import { parseStatementText } from '../src/domain/statement-import.js'
const options = { start: '2026-01-01', end: '2026-03-31', asOf: '2026-04-02', currency: 'BRL', complete: true }
const item = (date, type, amount, description = 'Salário', currency = 'BRL') => ({ startDate: date, type, amount, description, currency })
test('observed budget counts zero months, excludes own transfers, and never compounds past income', () => {
  const result = analyzeStatementPlanning([item('2026-01-02', 'income', 3000), item('2026-02-02', 'income', 3000), item('2026-01-03', 'expense', 1500, 'Aluguel'), item('2026-02-03', 'expense', 1500, 'Aluguel'), item('2026-03-04', 'income', 9999, 'Resgate investimento')], options)
  assert.equal(result.income, 2000)
  assert.equal(result.expense, 1000)
  assert.equal(result.surplus, 1000)
  assert.equal(result.months[2].balance, 0)
  assert.equal(result.excluded.transfer, 1)
  assert.equal(result.recurring[0].monthly, 2000)
})
test('partial periods, unconfirmed coverage and currency are handled explicitly', () => {
  assert.throws(() => analyzeStatementPlanning([], { ...options, complete: false }))
  assert.throws(() => analyzeStatementPlanning([], { ...options, start: '2026-02-10' }))
  assert.throws(() => analyzeStatementPlanning([], { ...options, start: '2026-02-30' }))
  const result = analyzeStatementPlanning([item('2026-01-01', 'income', 100, '', 'USD')], options)
  assert.equal(result.excluded.currency, 1)
  assert.equal(result.income, 0)
})
test('OFX SGML converts debit and credit dates and preserves cents', () => {
  const parsed = parseStatementText('OFXHEADER:100\n<OFX><CURDEF>BRL\n<BANKTRANLIST><STMTTRN><DTPOSTED>20260102120000[-3:BRT]\n<TRNAMT>-123.45\n<NAME>Mercado\n</STMTTRN><STMTTRN><DTPOSTED>20260103\n<TRNAMT>1000\n<MEMO>Salário\n</STMTTRN></BANKTRANLIST></OFX>')
  assert.equal(parsed.items.length, 2)
  assert.equal(parsed.items[0].amount, 123.45)
  assert.equal(parsed.items[0].type, 'expense')
  assert.equal(parsed.items[1].startDate, '2026-01-03')
})
test('parser rejects impossible dates, malformed amounts and external XML declarations', () => {
  assert.equal(parseStatementText('data;descricao;valor\n30/02/2026;X;123').items.length, 0)
  assert.equal(parseStatementText('data;descricao;valor\n02/02/2026;X;abc123').items.length, 0)
  assert.throws(() => parseStatementText('<!DOCTYPE x><OFX>'))
})

test('CSV supports quoted multiline descriptions and rejects incomplete quoting or unknown currency', () => {
  const parsed = parseStatementText('data;descricao;valor\n02/02/2026;"Mercado\nCentral";-123.45')
  assert.equal(parsed.items[0].description, 'Mercado Central')
  assert.throws(() => parseStatementText('data;descricao;valor\n02/02/2026;"incomplete;-123'))
  assert.equal(parseStatementText('data;descricao;valor;moeda\n02/02/2026;ABC;100;XYZ').items.length, 0)
})

test('statement analysis renders observed capacity and safe descriptions without changing the plan', async () => {
  const { prepareStatementAnalysis } = await import('../src/features/statements/statements.js')
  const form = new FormData()
  form.set('statement', new File(['data;descricao;valor;moeda\n02/01/2026;<img src=x>;3000;BRL\n02/02/2026;<img src=x>;3000;BRL\n03/01/2026;Aluguel;-1000;BRL\n03/02/2026;Aluguel;-1000;BRL'], 'statement.csv'))
  form.set('start', '2026-01-01'); form.set('end', '2026-02-28'); form.set('complete', 'on')
  const plan = { monthlyContribution: 2500 }
  const html = await prepareStatementAnalysis(form, { plan, currency: 'BRL' })
  assert.match(html, /ficou abaixo do aporte/)
  assert.match(html, /&lt;img src=x&gt;/)
  assert.doesNotMatch(html, /<img src=x>/)
  assert.equal(plan.monthlyContribution, 2500)
})

test('analysis blocks suspected duplicates instead of silently excluding legitimate repeated payments', async () => {
  const { prepareStatementAnalysis } = await import('../src/features/statements/statements.js')
  const form = new FormData()
  form.set('statement', new File(['data;descricao;valor\n02/01/2026;Salario;3000\n02/01/2026;Salario;3000'], 'statement.csv'))
  await assert.rejects(prepareStatementAnalysis(form, { plan: {}, currency: 'BRL' }), /possivelmente duplicados/)
})
