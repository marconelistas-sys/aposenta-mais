import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileOwnTransfers, transferBudgetAmount } from '../src/domain/own-transfers.js'
import { summarizeCashFlowItems } from '../src/domain/cash-flow.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'
import { mergeStatementItem } from '../src/domain/statement-batch.js'
import { renderOwnTransfers } from '../src/features/cash-flow/own-transfers.js'
const item = (id, type, account, amount = 100, currency = 'CHF', description = 'Wise') => ({ id, type, statementAccount: account, statementImportKey: `reference:${JSON.stringify([account, id])}`, description, statementDescription: description, recordKind: 'actual', imported: true, amount, currency, startDate: '2026-01-10', frequency: 'occasional', categoryId: type === 'income' ? 'other-income' : 'other-expense' })
const pair = () => [item('out', 'expense', 'TKB'), item('in', 'income', 'BB')]
test('requer duas contas próprias distintas e preserva o valor original', () => {
  for (const own of [[], ['TKB']]) assert.ok(reconcileOwnTransfers(pair(), own).every(row => !row.transferMatch))
  const result = reconcileOwnTransfers(pair(), ['TKB', 'BB'])
  assert.deepEqual(result.map(transferBudgetAmount), [0, 0])
  assert.equal(result[0].amount, 100)
  assert.equal(result[0].transferMatch.counterpart, result[1].statementImportKey)
  assert.ok(pair().every(row => !row.transferMatch))
  const same = pair(); same[1].statementAccount = 'TKB'
  assert.ok(reconcileOwnTransfers(same, ['TKB']).every(row => !row.transferMatch))
})
test('câmbio usa referência ou valor recebido explícito, nunca estimativa de cotação', () => {
  const rows = [item('out', 'expense', 'TKB', 100, 'CHF', 'Wise ref: ABC12345'), item('in', 'income', 'BB', 620, 'BRL', 'Wise ref: ABC12345')]
  assert.deepEqual(reconcileOwnTransfers(rows, ['TKB', 'BB']).map(transferBudgetAmount), [0, 0])
  rows[1].statementDescription = 'Wise ref: OTHER123'
  assert.ok(reconcileOwnTransfers(rows, ['TKB', 'BB']).every(row => !row.transferMatch))
  rows[0].statementDescription = 'Wise enviado CHF 100 recebido BRL 620'
  assert.deepEqual(reconcileOwnTransfers(rows, ['TKB', 'BB']).map(transferBudgetAmount), [0, 0])
})
test('tarifa explícita na moeda debitada entra como despesa sem modificar os saldos', () => {
  const rows = [item('out', 'expense', 'TKB', 102, 'CHF', 'Wise transferência, fee CHF 2.00'), item('in', 'income', 'BB', 100)]
  const result = reconcileOwnTransfers(rows, ['TKB', 'BB'])
  assert.deepEqual(result.map(transferBudgetAmount), [2, 0])
  assert.equal(result[0].amount, 102)
  const summary = summarizeCashFlowItems({ items: result }, 'CHF', {}, [], new Date('2026-01-15'), 'actual')
  assert.equal(summary.summary.occasionalExpenses, 2)
  assert.equal(summary.summary.occasionalIncome, 0)
  const fee = item('fee', 'expense', 'TKB', 2, 'CHF', 'Wise fee')
  assert.equal(transferBudgetAmount(reconcileOwnTransfers([...pair(), fee], ['TKB', 'BB'])[2]), 2)
})
test('pares repetidos ambíguos, datas distantes e pagamentos a terceiros permanecem no orçamento', () => {
  const rows = [...pair(), item('another', 'income', 'BB')]
  assert.ok(reconcileOwnTransfers(rows, ['TKB', 'BB']).every(row => !row.transferMatch))
  const far = pair(); far[1].startDate = '2026-01-20'
  assert.ok(reconcileOwnTransfers(far, ['TKB', 'BB']).every(row => !row.transferMatch))
  const third = pair(); third[0].transferDecision = 'payment'
  assert.deepEqual(reconcileOwnTransfers(third, ['TKB', 'BB']).map(transferBudgetAmount), [100, 100])
})
test('confirmação de conta própria exclui o movimento pendente e persiste após reimportação', () => {
  const pending = { ...pair()[0], transferDecision: 'own' }
  assert.equal(transferBudgetAmount(pending), 0)
  assert.equal(mergeStatementItem(pending, pair()[0]).transferDecision, 'own')
  const source = { items: pair(), ownStatementAccounts: ['TKB', 'BB'] }
  const restored = sanitizeCashFlow(JSON.parse(JSON.stringify(sanitizeCashFlow(source))))
  assert.deepEqual(restored.items.map(transferBudgetAmount), [0, 0])
  assert.equal(restored.items[0].statementDescription, 'Wise')
  assert.ok(sanitizeCashFlow({ ...source, ownStatementAccounts: [] }).items.every(row => !row.transferMatch))
})
test('nova importação encontra a contraparte e alteração de valor desfaz a associação', () => {
  const first = reconcileOwnTransfers([pair()[0]], ['TKB', 'BB'])
  assert.ok(!first[0].transferMatch)
  const complete = reconcileOwnTransfers([...first, pair()[1]], ['TKB', 'BB'])
  assert.ok(complete[0].transferMatch)
  assert.ok(reconcileOwnTransfers(complete.map(row => ({ ...row, amount: row.type === 'income' ? 80 : row.amount })), ['TKB', 'BB']).every(row => !row.transferMatch))
})
test('tela mostra status, moeda e câmbio sem expor valores ocultos', () => {
  const rows = reconcileOwnTransfers([item('out', 'expense', 'TKB', 100, 'CHF', 'Wise ref: ABC12345'), item('in', 'income', 'BB', 620, 'BRL', 'Wise ref: ABC12345')], ['TKB', 'BB'])
  const state = { cashFlow: { items: rows, ownStatementAccounts: ['TKB', 'BB'] }, valuesHidden: false }
  assert.match(renderOwnTransfers(state), /6.200000 BRL\/CHF/)
  const hidden = renderOwnTransfers({ ...state, valuesHidden: true })
  assert.doesNotMatch(hidden, /6.200000|620,00|100,00/)
  assert.match(hidden, /Câmbio efetivo: Oculto/)
})
test('histórico explícito de conta própria fica pendente fora do orçamento somente em conta identificada', () => {
  const pending = item('pending', 'expense', 'TKB', 100, 'CHF', 'Transferência entre minhas contas')
  assert.equal(transferBudgetAmount(reconcileOwnTransfers([pending], ['TKB'])[0]), 0)
  assert.equal(transferBudgetAmount(reconcileOwnTransfers([pending], [])[0]), 100)
  assert.equal(transferBudgetAmount(reconcileOwnTransfers([{ ...pending, transferDecision: 'payment' }], ['TKB'])[0]), 100)
})
test('tarifas sem moeda, com precisão inválida ou em moeda diferente não são inferidas', () => {
  for (const text of ['Wise fee 2.00', 'Wise fee EUR 2.00', 'Wise fee CHF 2.001']) {
    const rows = [item('out', 'expense', 'TKB', 102, 'CHF', text), item('in', 'income', 'BB', 100)]
    assert.ok(reconcileOwnTransfers(rows, ['TKB', 'BB']).every(row => !row.transferMatch))
  }
})
test('referências explícitas desambiguam pagamentos de mesmo valor', () => {
  const rows = [item('a', 'expense', 'TKB', 100, 'CHF', 'Wise ref: FIRST123'), item('b', 'expense', 'TKB', 100, 'CHF', 'Wise ref: SECOND123'), item('c', 'income', 'BB', 100, 'CHF', 'Wise ref: SECOND123'), item('d', 'income', 'BB', 100, 'CHF', 'Wise ref: FIRST123')]
  const result = reconcileOwnTransfers(rows, ['TKB', 'BB'])
  assert.ok(result.every(row => row.transferMatch))
  assert.equal(result[0].transferMatch.counterpart, rows[3].statementImportKey)
})

test('lançamento sem palavras de transferência e sem conta identificada pode ser revisado', () => {
  const original = item('unknown', 'expense', '', 100, 'CHF', 'Movimento bancário 123')
  const state = { cashFlow: { items: [original], ownStatementAccounts: [] }, valuesHidden: false }
  const html = renderOwnTransfers(state)
  assert.match(html, /name="decision:unknown"/)
  assert.match(html, /Transferência entre minhas contas/)
  const confirmed = sanitizeCashFlow({ items: [{ ...original, transferDecision: 'own' }] }, 'CHF').items[0]
  assert.equal(confirmed.amount, 100)
  assert.equal(transferBudgetAmount(confirmed), 0)
  assert.equal(mergeStatementItem(confirmed, original).transferDecision, 'own')
  const reverted = sanitizeCashFlow({ items: [{ ...confirmed, transferDecision: 'payment' }] }, 'CHF').items[0]
  assert.equal(transferBudgetAmount(reverted), 100)
})

test('somente realizados editáveis aparecem na revisão, sem exigir descrição específica', () => {
  const rows = [item('debit', 'expense', '', 100, 'CHF', 'Débito'), item('credit', 'income', '', 100, 'CHF', 'Crédito'), { ...item('planned', 'expense', '', 100, 'CHF', 'Wise'), recordKind: 'planned' }, item('ledger:derived', 'expense', '', 100, 'CHF', 'Wise')]
  const html = renderOwnTransfers({ cashFlow: { items: rows }, valuesHidden: false })
  assert.match(html, /decision:debit/)
  assert.match(html, /decision:credit/)
  assert.doesNotMatch(html, /decision:planned|decision:ledger/)
})

test('realizado manual sem chave de importação não aparece como conciliado', () => {
  const manual = { ...item('manual', 'expense', '', 100, 'CHF', 'Lançamento manual'), imported: false }
  delete manual.statementImportKey
  const html = renderOwnTransfers({ cashFlow: { items: [manual] }, valuesHidden: false })
  assert.match(html, /Sem confirmação de transferência própria/)
  assert.doesNotMatch(html, /Conciliada automaticamente/)
})
