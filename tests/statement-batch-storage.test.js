import test from 'node:test'
import assert from 'node:assert/strict'
import { cashFlowItemLimit } from '../src/shared/limits.js'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, upsertStatementItems, updateCashFlowItem, saveOwnTransferSettings } = await import('../src/app/state.js')
const { buildBudgetYear, budgetExpenseCategories } = await import('../src/domain/budget-overview.js')
const { sanitizeCashFlow } = await import('../src/app/state-storage.js')
const { inspectStatementText } = await import('../src/domain/statement-import.js')
const { reviewStatementBatch } = await import('../src/domain/statement-batch.js')
function incoming() {
  const inspection = inspectStatementText('data;descricao;valor;moeda\n2026-08-01;Migros;-12;CHF')
  return reviewStatementBatch([{ fileName: 'a.csv', inspection, mapping: inspection.suggestedMapping }], { existingItems: state.cashFlow.items }).rows[0].item
}

test('confirmação persiste atualizações e identidade, sem aumentar a coleção', () => {
  state.cashFlow.items = []
  assert.deepEqual(upsertStatementItems([incoming()]), { added: 1, updated: 0 })
  const id = state.cashFlow.items[0].id
  state.cashFlow.items = sanitizeCashFlow(JSON.parse(JSON.stringify(state.cashFlow)), 'CHF').items
  assert.deepEqual(upsertStatementItems([incoming()]), { added: 0, updated: 1 })
  assert.equal(state.cashFlow.items[0].id, id)
  assert.equal(state.cashFlow.items.length, 1)
})

test('atualização funciona no limite de capacidade e novos registros falham sem alterar estado', () => {
  const first = incoming()
  state.cashFlow.items = Array.from({ length: cashFlowItemLimit }, (_, index) => ({ ...first, id: `existing-${index}`, source: 'txt', statementImportKey: index ? `different-${index}` : first.statementImportKey }))
  assert.deepEqual(upsertStatementItems([first]), { added: 0, updated: 1 })
  const before = JSON.stringify(state)
  assert.throws(() => upsertStatementItems([{ ...first, statementImportKey: 'new', id: 'new' }]), /Nenhuma alteração/)
  assert.equal(JSON.stringify(state), before)
})

test('falha de armazenamento e linha inválida não confirmam parte do lote', () => {
  state.cashFlow.items = []
  const row = incoming()
  const before = JSON.stringify(state)
  assert.throws(() => upsertStatementItems([row, { ...row, statementImportKey: 'invalid', amount: 0 }]), /inválidos/)
  assert.equal(JSON.stringify(state), before)
  const save = globalThis.localStorage.setItem
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  try {
    assert.throws(() => upsertStatementItems([row]), /QuotaExceededError/)
    assert.equal(JSON.stringify(state), before)
  } finally { globalThis.localStorage.setItem = save }
})

test('edição confirma transferência sem contraparte e preserva decisão ao salvar e reimportar', () => {
  state.currency = 'CHF'
  state.cashFlow.items = []
  state.cashFlow.ownStatementAccounts = []
  upsertStatementItems([incoming()])
  const id = state.cashFlow.items[0].id
  updateCashFlowItem(id, { transferDecision: 'own' })
  assert.equal(state.cashFlow.items[0].amount, 12)
  state.cashFlow = sanitizeCashFlow(JSON.parse(JSON.stringify(state.cashFlow)), 'CHF')
  assert.equal(state.cashFlow.items[0].transferDecision, 'own')
  assert.deepEqual(upsertStatementItems([incoming()]), { added: 0, updated: 1 })
  assert.equal(state.cashFlow.items[0].transferDecision, 'own')
  assert.equal(state.cashFlow.items[0].id, id)
  const excluded = buildBudgetYear(state, 2026)
  assert.equal(excluded.annual.actual.expenses, 0)
  assert.equal(budgetExpenseCategories(excluded.months[7]).totals.actual, 0)
  updateCashFlowItem(id, { transferDecision: 'payment' })
  assert.equal(buildBudgetYear(state, 2026).annual.actual.expenses, 12)
  updateCashFlowItem(id, { transferDecision: undefined })
  assert.equal(state.cashFlow.items[0].transferDecision, undefined)
  assert.equal(buildBudgetYear(state, 2026).annual.actual.expenses, 12)
})

test('confirma os dois lados como transferências, mantendo somente a tarifa como despesa', () => {
  state.currency = 'CHF'
  state.cashFlow.items = []
  state.cashFlow.ownStatementAccounts = []
  const inspection = inspectStatementText('data;descricao;valor;moeda\n2026-08-01;Movimento fee CHF 2.00;-102;CHF\n2026-08-01;Crédito bancário;100;CHF')
  const rows = reviewStatementBatch([{ fileName: 'b.csv', inspection, mapping: inspection.suggestedMapping }]).rows
  upsertStatementItems(rows.map(row => row.item))
  const data = new FormData()
  for (const item of state.cashFlow.items) data.set(`decision:${item.id}`, 'own')
  saveOwnTransferSettings(data)
  const result = buildBudgetYear(state, 2026)
  assert.equal(result.annual.actual.income, 0)
  assert.equal(result.annual.actual.expenses, 2)
  assert.equal(budgetExpenseCategories(result.months[7]).totals.actual, 2)
})
