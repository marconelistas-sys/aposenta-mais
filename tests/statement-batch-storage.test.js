import test from 'node:test'
import assert from 'node:assert/strict'
import { cashFlowItemLimit } from '../src/shared/limits.js'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, upsertStatementItems } = await import('../src/app/state.js')
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
