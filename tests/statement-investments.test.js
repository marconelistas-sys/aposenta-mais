import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectStatementText, reviewStatementImport } from '../src/domain/statement-import.js'
import { reviewStatementBatch, planStatementUpdates } from '../src/domain/statement-batch.js'
import { transferBudgetAmount } from '../src/domain/own-transfers.js'
import { sanitizeCashFlow } from '../src/app/state-storage.js'
import { parseBbStatement } from '../src/domain/bb-statement.js'
import { syntheticBbText } from '../scripts/fixtures/bb-pdf.mjs'

function file(description, amount = -100, reference = 'investment-1') {
  const inspection = inspectStatementText(`data;descricao;valor;moeda;referencia\n2026-08-01;${description};${amount};BRL;${reference}`)
  return { fileName: 'extrato.csv', inspection, mapping: inspection.suggestedMapping }
}

test('identifica aplicações e resgates pelo histórico completo, em ambos os sentidos', () => {
  for (const description of ['BB RF LP High', 'BB Rende Fácil', 'Aplicação CDB', 'Resgate de fundos', 'Aplicações automáticas', '123 Aplicação em investimentos', `${'Detalhes '.repeat(10)}BB RF LP High`]) {
    for (const amount of [-100, 100]) {
      const row = reviewStatementImport(file(description, amount).inspection).rows[0]
      assert.equal(row.internalTransfer, true, description)
      assert.equal(row.classification.needsReview, false)
      assert.equal(row.item.statementInternalTransfer, true)
      assert.equal(transferBudgetAmount(row.item), 0)
    }
  }
})

test('mantém rendimentos, juros, dividendos e custos no orçamento', () => {
  for (const description of ['Juros CDB', 'Dividendos', 'Rendimentos BB RF LP High', 'IOF resgate BB RF LP High', 'Tarifa aplicação', 'Imposto sobre resgate', 'Salário', 'Pagamento aplicativo']) {
    const row = reviewStatementImport(file(description).inspection).rows[0]
    assert.equal(row.internalTransfer, false, description)
    assert.equal(transferBudgetAmount(row.item), 100)
  }
})

test('PDF BB reconhece BB RF LP High e conserva as referências', () => {
  const parsed = parseBbStatement(syntheticBbText().replaceAll('BB Rende Fácil', 'BB RF LP High'))
  assert.equal(parsed.internalTransferReferences.size, 4)
})

test('armazenamento e reimportação preservam investimento mesmo com histórico revisado', () => {
  const first = reviewStatementBatch([file('BB RF LP High')]).rows[0].item
  const inserted = planStatementUpdates([], [first])
  const existing = sanitizeCashFlow({ items: inserted.items }, 'BRL').items
  assert.equal(existing[0].statementInternalTransfer, true)
  const next = reviewStatementBatch([file('Histórico revisado', -150)], { existingItems: existing }).rows[0]
  assert.equal(next.internalTransfer, true)
  assert.equal(next.classification.needsReview, false)
  const updated = planStatementUpdates(existing, [next.item])
  assert.deepEqual([updated.added, updated.updated, updated.items.length], [0, 1, 1])
  assert.equal(updated.items[0].id, existing[0].id)
  assert.equal(updated.items[0].amount, 150)
  assert.equal(transferBudgetAmount(updated.items[0]), 0)
})

test('importações antigas de investimentos deixam de afetar receitas e despesas', () => {
  for (const amount of [-100, 100]) {
    const item = reviewStatementImport(file('BB RF LP High', amount).inspection).rows[0].item
    delete item.statementInternalTransfer
    assert.equal(transferBudgetAmount(item), 0)
  }
})
