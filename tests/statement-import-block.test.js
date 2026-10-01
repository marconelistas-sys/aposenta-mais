import test from 'node:test'
import assert from 'node:assert/strict'
import { statementImportBlockReason } from '../src/features/cash-flow/cash-flow.js'
const base = { mappingErrors: [], selectedCount: 1, duplicateCount: 0, invalidCount: 0, overLimit: false, availableSlots: 94, rows: [], errors: [] }
test('explica cada condição que bloqueia a confirmação', () => {
  assert.equal(statementImportBlockReason(base), '')
  assert.match(statementImportBlockReason({ ...base, overLimit: true, selectedCount: 60, availableSlots: 40 }), /Desmarque 20/)
  assert.match(statementImportBlockReason({ ...base, selectedCount: 0, duplicateCount: 60, rows: [{ duplicate: true }] }), /Nenhum lançamento novo/)
  assert.match(statementImportBlockReason({ ...base, selectedCount: 0 }), /Marque pelo menos/)
  assert.equal(statementImportBlockReason({ ...base, selectedCount: 0, invalidCount: 1, errors: ['Linha 2: moeda inválida.'] }), 'Linha 2: moeda inválida.')
  assert.equal(statementImportBlockReason({ ...base, mappingErrors: ['Selecione Valor.'] }), 'Selecione Valor.')
})

test('preserva os 101 lançamentos ao importar extrato de 60 sobre orçamento de 41', async () => {
  const { sanitizeCashFlow } = await import('../src/app/state-storage.js')
  const items = Array.from({ length: 101 }, (_, index) => ({ id: `row-${index}`, description: `Movimento ${index}`, type: 'expense', categoryId: 'groceries', amount: 1, currency: 'CHF', frequency: 'occasional', startDate: '2026-08-03', recordKind: 'actual' }))
  const saved = sanitizeCashFlow({ items }, 'CHF')
  assert.equal(saved.items.length, 101)
  assert.equal(sanitizeCashFlow(JSON.parse(JSON.stringify(saved)), 'CHF').items.length, 101)
})
