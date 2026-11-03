import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accountBalanceName, applyAccountBalances, previewAccountBalances } from '../src/domain/statement-account-balances.js'
import { previewInvestmentBalances } from '../src/domain/statement-investment-balances.js'
import { parsePdfStatement } from '../src/domain/pdf-statement.js'
import { parseN26Statement } from '../src/domain/n26-statement.js'
import { parseTkbStatement } from '../src/domain/tkb-statement.js'
import { syntheticBbText } from '../scripts/fixtures/bb-pdf.mjs'

const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, upsertStatementItems } = await import('../src/app/state.js')

const rates = { base: 'CHF', rates: { CHF: 1, EUR: 1, BRL: 0.2, USD: 1 } }
const options = { currency: 'CHF', exchangeRates: rates }
const tkb = (asOfDate, amount) => ({ bank: 'tkb', sourceAccount: 'CH0000000000000000001', currency: 'CHF', asOfDate, amount })
const legacyCash = { id: 'legacy', name: 'Saldo Suíça', assetClass: 'cash', liquidity: 'available', amount: 5000, monthlyContribution: 0, returnType: 'default' }

test('bank statements report the closing balance of each account and currency', () => {
  const header = 'Datum   Text                                                Belastung     Gutschrift      Valuta           Saldo'
  const text = ['Privatkonto CHF', 'Kontoauszug 01.08.2026 - 31.08.2026', header,
    "01.08. Saldovortrag                                                                                 10'000.00",
    "03.08. Warenbezug und Dienstleistungen                         4.20                    30.07.26       9'995.80",
    "        Umsatztotal                                            4.20         0.00"].join('\n')
  assert.deepEqual(parseTkbStatement(text).accountBalances, [{ currency: 'CHF', amount: 9995.8 }])
  assert.deepEqual(parsePdfStatement(readFileSync(new URL('./fixtures/yuh-statement.txt', import.meta.url), 'utf8')).accountBalances, [{ currency: 'CHF', amount: 805.41 }, { currency: 'EUR', amount: 0 }])
  assert.deepEqual(parsePdfStatement(syntheticBbText()).accountBalances, [{ currency: 'BRL', amount: 0 }])
})

test('N26 reports the new balance only when it matches the old balance plus the movements', () => {
  const rows = `           Kontoauszug Nr. 10/2026
           01.10.2026 bis 31.10.2026
           IBAN: DE00100110012620000000 • BIC: NTSBDEB1XXX
           Beschreibung                                                   Verbuchungsdatum             Betrag
           REWE Markt                                                             03.10.2026          -23,45€
           Mastercard • Lebensmittel
           Wertstellung 03.10.2026
           Zusammenfassung Nr. 10/2026
           Dein alter Kontostand                                                                    +100,00€
           Ausgehende Transaktionen                                                                  -23,45€
           Einkommende Transaktionen                                                                  +0,00€
           Dein neuer Kontostand                                                                     +76,55€`
  assert.deepEqual(parseN26Statement(rows).accountBalances, [{ currency: 'EUR', amount: 76.55 }])
  assert.deepEqual(parseN26Statement(rows.replace('+76,55€', '+80,00€')).accountBalances, [])
})

test('the latest statement creates a Caixa item, and reimports keep it in sync', () => {
  const [row] = previewAccountBalances([tkb('2026-09-30', 900), tkb('2026-10-31', 1200)], [], options)
  assert.deepEqual([row.status, row.target, row.amount, row.asOfDate, row.label], ['update', 'new', 1200, '2026-10-31', 'Conta TKB (CHF)'])
  const { investments, created } = applyAccountBalances([row], [], { ...options, createId: () => 'tkb' })
  assert.equal(created, 1)
  assert.deepEqual(investments[0], { id: 'tkb', name: 'Conta TKB (CHF)', assetClass: 'cash', liquidity: 'available', monthlyContribution: 0, returnType: 'default', currency: 'CHF', amount: 1200, balanceAsOf: '2026-10-31', balanceSource: 'statement', statementAccount: 'CH0000000000000000001', statementInvestmentName: accountBalanceName('CHF') })
  // Same statement again, then an older one: nothing changes.
  assert.equal(previewAccountBalances([tkb('2026-10-31', 1200)], investments, options)[0].status, 'current')
  assert.equal(previewAccountBalances([tkb('2026-09-30', 900)], investments, options)[0].status, 'older')
  // A newer statement updates the same item instead of creating another.
  const newer = previewAccountBalances([tkb('2026-11-30', 1500)], investments, options)
  assert.deepEqual([newer[0].status, newer[0].target, newer[0].linked], ['update', 'tkb', true])
  const updated = applyAccountBalances(newer, investments, options)
  assert.deepEqual([updated.investments.length, updated.investments[0].amount, updated.investments[0].balanceAsOf, updated.updated], [1, 1500, '2026-11-30', 1])
})

test('an existing cash item can receive the balance, once per account', () => {
  const targets = new Map([[JSON.stringify(['CH0000000000000000001', 'CHF']), 'legacy']])
  const [row] = previewAccountBalances([tkb('2026-10-31', 1200)], [legacyCash], { ...options, targets })
  assert.deepEqual([row.target, row.previousAmount, row.status], ['legacy', 5000, 'update'])
  const { investments, created } = applyAccountBalances([row], [legacyCash], options)
  assert.deepEqual([created, investments.length, investments[0].name, investments[0].amount, investments[0].statementAccount], [0, 1, 'Saldo Suíça', 1200, 'CH0000000000000000001'])
  const yuh = { ...tkb('2026-10-31', 50), bank: 'yuh', sourceAccount: 'CH0000000000000000002' }
  const both = previewAccountBalances([tkb('2026-10-31', 1200), yuh], [legacyCash], { ...options, targets: new Map([...targets, [JSON.stringify([yuh.sourceAccount, 'CHF']), 'legacy']]) })
  assert.throws(() => applyAccountBalances(both, [legacyCash], options), /item diferente/)
  // Not registering is also a choice.
  const skipped = previewAccountBalances([tkb('2026-10-31', 1200)], [legacyCash], { ...options, targets: new Map([[row.key, '']]) })
  assert.equal(skipped[0].status, 'skipped')
  assert.equal(applyAccountBalances(skipped, [legacyCash], options).investments[0].amount, 5000)
})

test('overdrafts count as zero, conflicting files are not applied, and zero balances are not created', () => {
  const [negative] = previewAccountBalances([tkb('2026-10-31', 1200)], [], options).map(row => ({ ...row, amount: -30 }))
  assert.equal(applyAccountBalances([negative], [], { ...options, createId: () => 'x' }).investments[0].amount, 0)
  assert.equal(previewAccountBalances([tkb('2026-10-31', 1200), tkb('2026-10-31', 1100)], [], options)[0].status, 'conflict')
  assert.equal(previewAccountBalances([tkb('2026-10-31', 0)], [], options)[0].status, 'skipped')
})

test('application balances never match an account balance item', () => {
  const account = { ...legacyCash, id: 'bb-account', name: 'Conta BB (BRL)', currency: 'BRL', statementAccount: 'BB:1', statementInvestmentName: accountBalanceName('BRL'), balanceAsOf: '2026-09-30' }
  const preview = previewInvestmentBalances([{ name: 'BB Conta', sourceAccount: 'BB:1', currency: 'BRL', asOfDate: '2026-10-31', amount: 10 }], [account], { currency: 'BRL', exchangeRates: rates })
  assert.equal(preview.rows[0].status, 'unmatched')
})

test('importing the statements updates the Patrimônio even when every movement is already imported', () => {
  resetState()
  state.currency = 'CHF'
  state.exchangeRates = rates
  state.plan.investments = [legacyCash]
  const rows = previewAccountBalances([tkb('2026-10-31', 1200), { ...tkb('2026-10-31', 300), bank: 'n26', sourceAccount: 'DE00', currency: 'EUR' }], state.plan.investments, { ...options, targets: new Map([[JSON.stringify(['CH0000000000000000001', 'CHF']), 'legacy']]) })
  const result = upsertStatementItems([], { accountBalances: rows.filter(row => row.selected) })
  assert.equal(result.accountUpdated, 2)
  assert.deepEqual(state.plan.investments.map(item => [item.name, item.amount, item.balanceAsOf]), [['Saldo Suíça', 1200, '2026-10-31'], ['Conta N26 (EUR)', 300, '2026-10-31']])
  assert.equal(state.plan.currentAssets, 1500)
  // The same import again changes nothing.
  const again = previewAccountBalances([tkb('2026-10-31', 1200)], state.plan.investments, options)
  assert.equal(again[0].status, 'current')
})
