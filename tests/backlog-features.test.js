import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, addCashFlowItem } = await import('../src/app/state.js')
const { sanitizeCashFlowItem, serializeExportableState, parseStoredState } = await import('../src/app/state-storage.js')
const { ownedStorage } = await import('../src/app/owned-storage.js')
const { readStatementAnalysis, renderStatements } = await import('../src/features/statements/statements.js')
const { statementHistoryView, resetStatementHistoryView } = await import('../src/features/statements/history.js')
const { saveStatementAnalysis, deleteStatementAnalysis, applyStatementRecurrences } = await import('../src/app/statement-history.js')
const { compareStatementPeriods, sanitizeStatementHistory } = await import('../src/domain/statement-history.js')
const { filterByHouseholdOwner } = await import('../src/shared/household-owner.js')

function reset() { ownedStorage.select(null); resetState(); state.cashFlow.items = []; resetStatementHistoryView() }
function summary(id = 'a', start = '2026-01-01', end = '2026-02-28', currency = 'BRL') {
  const first = start.slice(0, 7), last = end.slice(0, 7)
  return { id: `analysis-${id.repeat(64)}`, currency, start, end, createdAt: '2026-03-01T00:00:00Z', months: [{ month: first, income: 3000, expense: 1000 }, { month: last, income: 4000, expense: 1000 }], recurring: [{ type: 'income', description: 'Salário', monthly: 3500, months: 2 }, { type: 'expense', description: 'Aluguel', monthly: 1000, months: 2 }], excluded: { transfer: 0, currency: 0, outside: 0 } }
}
function candidate(index = 0) { return { index, description: index === 0 ? 'Salário titular' : 'Aluguel', categoryId: index === 0 ? 'salary' : 'housing', amount: index === 0 ? 3200 : 1000, householdOwner: index === 0 ? 'primary' : 'shared', startDate: '2026-09-01', endDate: '2030-12-31' } }

test('titularidade persiste e filtra sem inferir proprietário nem alterar valores anteriores', () => {
  reset()
  const base = { id: 'salary', type: 'income', categoryId: 'salary', amount: 1000, currency: 'BRL', frequency: 'monthly' }
  assert.equal(sanitizeCashFlowItem(base).householdOwner, undefined)
  for (const householdOwner of ['primary', 'spouse', 'shared']) addCashFlowItem({ ...base, householdOwner })
  const stored = parseStoredState(serializeExportableState(state))
  assert.deepEqual(stored.cashFlow.items.map(item => item.householdOwner), ['primary', 'spouse', 'shared'])
  assert.equal(filterByHouseholdOwner(stored.cashFlow.items, 'spouse').length, 1)
  assert.equal(filterByHouseholdOwner(stored.cashFlow.items, 'all').reduce((sum, item) => sum + item.amount, 0), 3000)
  state.cashFlow.retirementMonth = '2030-01'
  assert.throws(() => addCashFlowItem({ ...base, householdOwner: 'spouse', endMode: 'retirement' }), /data final manual/)
})

test('histórico preserva somente resumos, recalcula médias e recusa duplicação e capacidade excedida', () => {
  reset()
  const entry = saveStatementAnalysis({ ...summary(), rawFile: 'secret file', income: 999999 })
  assert.equal(entry.income, 3500)
  assert.equal(entry.surplus, 2500)
  assert.equal(entry.rawFile, undefined)
  assert.throws(() => saveStatementAnalysis(summary()), /já está no histórico/)
  for (const id of ['b', 'c', 'd', 'e', 'f']) saveStatementAnalysis(summary(id))
  assert.throws(() => saveStatementAnalysis(summary('0')), /seis análises/)
  const restored = parseStoredState(serializeExportableState(state))
  assert.equal(restored.cashFlow.statementAnalyses.length, 6)
  assert.equal(restored.cashFlow.statementAnalyses[0].income, 3500)
  assert.equal(sanitizeStatementHistory([{ ...summary(), recurring: [{ type: 'income', description: 'Bad', monthly: -1, months: 2 }] }]).length, 0)
})

test('leitura gera identidade estável independente do nome do arquivo e ordem dos movimentos', async () => {
  const lines = ['02/01/2026;Salário;3000', '02/02/2026;Salário;4000', '03/01/2026;Aluguel;-1000', '03/02/2026;Aluguel;-1000']
  const form = new FormData()
  form.set('start', '2026-01-01'); form.set('end', '2026-02-28'); form.set('complete', 'on')
  form.set('statement', new File(['data;descricao;valor\n' + lines.join('\n')], 'bank.csv'))
  const a = await readStatementAnalysis(form, { currency: 'BRL' })
  form.set('statement', new File(['data;descricao;valor\n' + lines.reverse().join('\n')], 'renamed.csv'))
  const b = await readStatementAnalysis(form, { currency: 'BRL' })
  assert.equal(a.id, b.id)
  assert.equal(a.income, 3500)
})

test('comparação usa médias por período e bloqueia moedas diferentes e meses sobrepostos', () => {
  const a = summary(), b = summary('b', '2026-03-01', '2026-04-30')
  b.months[0].expense = 1500; b.months[1].expense = 1500
  const result = compareStatementPeriods(b, a)
  assert.equal(result.earlier.id, a.id)
  assert.equal(result.expenseChange, 500)
  assert.equal(result.surplusChange, -500)
  assert.throws(() => compareStatementPeriods(a, summary('c')), /sobrepostos/)
  assert.throws(() => compareStatementPeriods(a, { ...b, currency: 'CHF' }), /mesma moeda/)
})

test('aplicação em lote usa revisão, preserva realizados e bloqueia repetição sem gravação parcial', () => {
  reset(); saveStatementAnalysis(summary())
  addCashFlowItem({ type: 'expense', categoryId: 'housing', amount: 9, currency: 'BRL', frequency: 'occasional', recordKind: 'actual', startDate: '2026-01-01' })
  const id = summary().id
  assert.throws(() => applyStatementRecurrences(id, [candidate(), { ...candidate(1), endDate: '' }]), /início e fim/)
  assert.equal(state.cashFlow.items.length, 1)
  assert.equal(applyStatementRecurrences(id, [candidate(), candidate(1)]), 2)
  assert.equal(state.cashFlow.items[0].recordKind, 'actual')
  const plan = state.cashFlow.items[1]
  assert.equal(plan.amount, 3200)
  assert.equal(plan.householdOwner, 'primary')
  assert.equal(plan.recordKind, 'planned')
  assert.equal(plan.analysisOrigin, `${id}:0`)
  assert.throws(() => applyStatementRecurrences(id, [candidate()]), /já foi aplicada/)
  deleteStatementAnalysis(id)
  assert.equal(state.cashFlow.items.length, 3)
  assert.equal(parseStoredState(serializeExportableState(state)).cashFlow.items[1].analysisOrigin, `${id}:0`)
})

test('falha ao persistir não muda o histórico nem o orçamento em memória', () => {
  reset()
  const before = JSON.stringify(state)
  const original = globalThis.localStorage.setItem
  globalThis.localStorage.setItem = () => { throw new Error('quota') }
  try { assert.throws(() => saveStatementAnalysis(summary()), /quota/); assert.equal(JSON.stringify(state), before) }
  finally { globalThis.localStorage.setItem = original }
})

test('histórico e propostas respeitam privacidade e exigem seleção e prazo explícitos', () => {
  reset(); const entry = saveStatementAnalysis(summary()); statementHistoryView.activeId = entry.id
  state.valuesHidden = false
  const visible = renderStatements()
  assert.match(visible, /Histórico de análises \(1\/6\)/)
  assert.match(visible, /data-apply-recurrences/)
  assert.match(visible, /data-recurring-fields="0" disabled/)
  assert.match(visible, /name="0.endDate" required/)
  state.valuesHidden = true
  const hidden = renderStatements()
  assert.doesNotMatch(hidden, /Salário|data-apply-recurrences|data-open-analysis/)
  assert.match(hidden, /Mostre os valores para consultar análises/)
})

test('resultado lido em outra sessão não pode ser salvo na conta atual', () => {
  reset()
  ownedStorage.select('account-a')
  const generation = ownedStorage.generation
  ownedStorage.select('account-b')
  try {
    assert.throws(() => saveStatementAnalysis(summary(), generation), /conta mudou/)
    assert.equal(state.cashFlow.statementAnalyses?.length || 0, 0)
  } finally { ownedStorage.select(null) }
})

test('sugestão com valor revisado não duplica receita já planejada no mesmo período', () => {
  reset(); saveStatementAnalysis(summary())
  addCashFlowItem({ ...candidate(), type: 'income', currency: 'BRL', frequency: 'monthly', recordKind: 'planned', amount: 999 })
  assert.throws(() => applyStatementRecurrences(summary().id, [candidate()]), /semelhante/)
  assert.equal(state.cashFlow.items.length, 1)
})
