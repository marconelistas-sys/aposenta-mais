import test from 'node:test'
import assert from 'node:assert/strict'
import { linkStatementInvestments, recomputeInvestmentMovements, suggestStatementInvestment } from '../src/domain/statement-investment-movements.js'
import { sanitizeCashFlowItem, sanitizeInvestment, parseStoredState } from '../src/app/state-storage.js'

const rates = { base: 'CHF', rates: { CHF: 1, EUR: 1, BRL: 0.2, USD: 1 } }
const options = { currency: 'BRL', exchangeRates: rates }
const cdb = { id: 'cdb', name: 'CDB Banco X', amount: 1000, monthlyContribution: 0, currency: 'BRL', balanceAsOf: '2026-09-30', returnType: 'default', assetClass: 'fixed-income' }
const item = (id, type, amount, startDate, statementInvestmentId = 'cdb', currency = 'BRL') => ({ id, type, amount, currency, startDate, statementInternalTransfer: true, statementInvestmentId })

test('applications add and redemptions subtract only after the base balance date', () => {
  const result = recomputeInvestmentMovements([cdb], [item('a', 'expense', 500, '2026-10-05'), item('b', 'income', 200, '2026-10-20'), item('old', 'expense', 999, '2026-09-30')], options)
  const [updated] = result.investments
  assert.equal(updated.amount, 1300)
  assert.equal(updated.balanceAsOf, '2026-10-20')
  assert.equal(updated.balanceSource, 'statement')
  assert.deepEqual(updated.movementBase, { amount: 1000, date: '2026-09-30', result: 1300, asOf: '2026-10-20' })
  assert.equal(result.bases.get('cdb'), '2026-09-30')
  // Recomputing again is stable.
  assert.equal(recomputeInvestmentMovements(result.investments, [item('a', 'expense', 500, '2026-10-05'), item('b', 'income', 200, '2026-10-20')], options).investments[0].amount, 1300)
})

// Reported bug: two purchases of "Vanguard FTSE All-World High Divide · Kauf"
// imported in separate steps kept only one amount when the second was not later.
test('movements linked in separate steps add up regardless of order or equal dates', () => {
  const description = 'Vanguard FTSE All-World High Divide · Kauf'
  const movement = (key, date) => ({ key, target: 'new', type: 'expense', currency: 'CHF', date, description })
  const chf = { currency: 'CHF', exchangeRates: rates }
  const first = linkStatementInvestments([movement('october', '2026-10-10')], [], { createId: () => 'vg' })
  const items = [item('october', 'expense', 300, '2026-10-10', 'vg', 'CHF')]
  let portfolio = recomputeInvestmentMovements(first.investments, items, chf).investments
  assert.equal(portfolio[0].amount, 300)
  // An older statement is imported afterwards.
  const second = linkStatementInvestments([{ ...movement('september', '2026-09-10'), target: 'vg' }], portfolio)
  items.push(item('september', 'expense', 500, '2026-09-10', second.links.get('september'), 'CHF'))
  portfolio = recomputeInvestmentMovements(second.investments, items, chf).investments
  assert.equal(portfolio[0].amount, 800)
  // A purchase on the same date as an existing one.
  items.push(item('same-day', 'expense', 200, '2026-10-10', 'vg', 'CHF'))
  portfolio = recomputeInvestmentMovements(portfolio, items, chf).investments
  assert.equal(portfolio[0].amount, 1000)
  assert.equal(portfolio[0].balanceAsOf, '2026-10-10')
  // Removing a link brings the balance back.
  portfolio = recomputeInvestmentMovements(portfolio, items.filter(row => row.id !== 'september'), chf).investments
  assert.equal(portfolio[0].amount, 500)
})

test('a balance typed or read from a statement becomes the new base', () => {
  const linked = [item('a', 'expense', 500, '2026-10-05'), item('b', 'expense', 100, '2026-11-02')]
  const [computed] = recomputeInvestmentMovements([cdb], linked, options).investments
  assert.equal(computed.amount, 1600)
  const [typed] = recomputeInvestmentMovements([{ ...computed, amount: 2000, balanceAsOf: '2026-10-31' }], linked, options).investments
  assert.equal(typed.amount, 2100)
  assert.deepEqual(typed.movementBase, { amount: 2000, date: '2026-10-31', result: 2100, asOf: '2026-11-02' })
  // The same amount informed at a newer date is also a new base.
  const [same] = recomputeInvestmentMovements([{ ...cdb, movementBase: { amount: 1000, date: '2026-09-30', result: 1000, asOf: '2026-09-30' }, balanceAsOf: '2026-10-31' }], [item('a', 'expense', 500, '2026-10-05')], options).investments
  assert.deepEqual([same.amount, same.balanceAsOf], [1000, '2026-10-31'])
})

test('repairs investments created from movements before the base existed', () => {
  const legacy = { id: 'vg', name: 'Vanguard', statementInvestmentName: 'Vanguard', needsDetails: true, amount: 300, monthlyContribution: 0, currency: 'CHF', balanceAsOf: '2026-10-10', balanceSource: 'statement', returnType: 'default' }
  const stored = parseStoredState(JSON.stringify({ currency: 'CHF', plan: { investments: [legacy] }, cashFlow: { items: [
    { ...item('a', 'expense', 300, '2026-10-10', 'vg', 'CHF'), categoryId: 'other-expense', recordKind: 'actual', imported: true },
    { ...item('b', 'expense', 500, '2026-09-10', 'vg', 'CHF'), categoryId: 'other-expense', recordKind: 'actual', imported: true }
  ] } }))
  assert.equal(stored.plan.investments[0].amount, 800)
  assert.equal(stored.plan.currentAssets, 800)
  // Same case after its details were completed: markers are gone, but the name is
  // the statement description and the balance date is the last purchase.
  const edited = { id: 'vg', name: 'Vanguard FTSE All-World High Divide · Kauf', assetClass: 'equity', liquidity: 'available', amount: 1000, monthlyContribution: 0, currency: 'CHF', balanceAsOf: '2026-10-20', balanceSource: 'manual', returnType: 'default' }
  const purchase = (id, startDate) => ({ ...item(id, 'expense', 1000, startDate, 'vg', 'CHF'), description: edited.name, categoryId: 'other-expense', recordKind: 'actual', imported: true })
  const repaired = parseStoredState(JSON.stringify({ currency: 'CHF', plan: { investments: [edited] }, cashFlow: { items: [purchase('oct', '2026-10-20'), purchase('aug', '2026-08-20')] } }))
  assert.equal(repaired.plan.investments[0].amount, 2000)
  // A balance typed later than the last purchase is respected.
  const typed = parseStoredState(JSON.stringify({ currency: 'CHF', plan: { investments: [{ ...edited, amount: 2100, balanceAsOf: '2026-11-01' }] }, cashFlow: { items: [purchase('oct', '2026-10-20'), purchase('aug', '2026-08-20')] } }))
  assert.equal(typed.plan.investments[0].amount, 2100)
  // A manual investment keeps its balance and only adds later movements.
  const manual = parseStoredState(JSON.stringify({ currency: 'BRL', plan: { investments: [cdb] }, cashFlow: { items: [{ ...item('a', 'expense', 500, '2026-09-01'), categoryId: 'other-expense', recordKind: 'actual', imported: true }] } }))
  assert.equal(manual.plan.investments[0].amount, 1000)
})

test('new investments group movements by description, keep the statement currency and need details', () => {
  let id = 0
  const result = linkStatementInvestments([
    { key: 'a', target: 'new', type: 'expense', currency: 'EUR', date: '2026-10-01', description: 'ETF Sparplan' },
    { key: 'b', target: 'new', type: 'expense', currency: 'EUR', date: '2026-11-01', description: 'ETF Sparplan' }
  ], [], { createId: () => `new-${++id}` })
  assert.equal(result.created, 1)
  assert.deepEqual([...result.links.values()], ['new-1', 'new-1'])
  const [created] = recomputeInvestmentMovements(result.investments, [item('a', 'expense', 100, '2026-10-01', 'new-1', 'EUR'), item('b', 'expense', 100, '2026-11-01', 'new-1', 'EUR')], { currency: 'CHF', exchangeRates: rates }).investments
  assert.equal(created.nativeAmount, 200)
  assert.equal(created.currency, 'EUR')
  assert.equal(created.balanceAsOf, '2026-11-01')
  assert.equal(sanitizeInvestment(created).needsDetails, true)
  assert.deepEqual(sanitizeInvestment(created).movementBase, { amount: 0, date: '', result: 200, asOf: '2026-11-01' })
  assert.throws(() => linkStatementInvestments([{ key: 'c', target: 'new', type: 'income', currency: 'BRL', date: '2026-10-01' }], []), /resgate/)
  assert.throws(() => linkStatementInvestments([{ key: 'c', target: 'missing', type: 'expense', currency: 'BRL', date: '2026-10-01' }], []), /não existe/)
})

test('suggestion prefers an earlier link, then a unique investment named in the description', () => {
  assert.equal(suggestStatementInvestment({ description: 'Aplicação CDB Banco X 123', type: 'expense' }, [cdb]), 'cdb')
  assert.equal(suggestStatementInvestment({ description: 'Aplicação fundo', type: 'expense' }, [cdb]), '')
  const learned = suggestStatementInvestment({ description: 'Sparplan', type: 'expense', categoryMerchantKey: 'sparplan' }, [cdb], [{ type: 'expense', categoryMerchantKey: 'sparplan', statementInvestmentId: 'cdb' }])
  assert.equal(learned, 'cdb')
})

test('the investment link is stored only on movements outside the budget', () => {
  const row = { id: 'x', type: 'expense', categoryId: 'other-expense', amount: 10, currency: 'BRL', startDate: '2026-10-01', recordKind: 'actual', imported: true, statementInvestmentId: 'cdb', statementInvestmentTarget: 'new' }
  assert.equal(sanitizeCashFlowItem(row).statementInvestmentId, undefined)
  const stored = sanitizeCashFlowItem({ ...row, statementInternalTransfer: true })
  assert.equal(stored.statementInvestmentId, 'cdb')
  assert.equal(stored.statementInvestmentTarget, undefined)
})
