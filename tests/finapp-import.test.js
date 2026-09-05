import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFinappImport, mergeFinappImport } from '../src/domain/finapp-import.js'
import { sanitizeCashFlowItem, sanitizeInvestment, createExportableState } from '../src/app/state-storage.js'
import { renderProfile } from '../src/features/profile/profile.js'
import { authState } from '../src/app/auth-state.js'

function bundle() {
  return { format: 'aposenta-finapp-import', version: 1, investmentCurrency: 'BRL', pending: [{ reason: 'Revisar contrato' }], items: [sanitizeCashFlowItem({ id: 'finapp:revenues:1', type: 'income', categoryId: 'salary', description: 'Receita', amount: 100, currency: 'CHF', frequency: 'monthly', startDate: '2026-01-01', endDate: '2028-12-31', recordKind: 'planned', source: 'manual' })], investments: [sanitizeInvestment({ id: 'finapp:initial_assets:1', name: 'Patrimônio', amount: 1000, returnType: 'real', returnValue: 0.05, liquidity: 'restricted' })] }
}
function current() {
  return createExportableState({ isDemo: false, currency: 'BRL', plan: { currentAssets: 0, monthlyContribution: 0, annualRealReturn: 0.03, targetMonthlyIncome: 1234 }, cashFlow: { items: [] } })
}
test('arquivo importa previstos e patrimônio sem substituir premissas ou duplicar na repetição', () => {
  const before = current(), original = structuredClone(before)
  const parsed = parseFinappImport(JSON.stringify(bundle()))
  const result = mergeFinappImport(before, parsed)
  assert.equal(result.added, 2)
  assert.equal(result.pending, 1)
  assert.equal(result.state.plan.annualRealReturn, 0.03)
  assert.equal(result.state.plan.targetMonthlyIncome, 1234)
  assert.equal(result.state.plan.currentAssets, 1000)
  assert.equal(result.state.cashFlow.items[0].recordKind, 'planned')
  assert.equal(result.state.cashFlow.items[0].currency, 'CHF')
  assert.equal(result.state.cashFlow.items[0].endDate, '2028-12-31')
  assert.deepEqual(before, original)
  const repeated = mergeFinappImport(result.state, parsed)
  assert.equal(repeated.added, 0)
  assert.equal(repeated.skipped, 2)
})
test('conflito bloqueia toda a operação sem alterar a entrada', () => {
  const parsed = parseFinappImport(JSON.stringify(bundle()))
  const first = mergeFinappImport(current(), parsed).state
  const original = structuredClone(first)
  parsed.items[0].amount = 200
  assert.throws(() => mergeFinappImport(first, parsed), /Conflito/)
  assert.deepEqual(first, original)
})
test('não mistura demonstração nem perde patrimônio ou aporte agregados', () => {
  const parsed = parseFinappImport(JSON.stringify(bundle()))
  assert.throws(() => mergeFinappImport({ ...current(), isDemo: true }, parsed), /demonstração/)
  for (const field of ['currentAssets', 'monthlyContribution']) {
    const value = current(); value.plan[field] = 100
    assert.throws(() => mergeFinappImport(value, parsed), /agregados/)
  }
})
test('converte patrimônio à moeda do destino e mantém rendimento e restrição', () => {
  const value = current(); value.currency = 'CHF'
  value.exchangeRates.rates.BRL = 6; value.exchangeRates.rates.CHF = 1
  const result = mergeFinappImport(value, parseFinappImport(JSON.stringify(bundle())))
  assert.equal(result.state.plan.investments[0].amount, 166.67)
  assert.equal(result.state.plan.investments[0].returnValue, 0.05)
  assert.equal(result.state.plan.investments[0].liquidity, 'restricted')
})
test('rejeita identidade repetida, moeda inválida, realizado e saneamento com perda', () => {
  for (const mutate of [file => file.items.push(file.items[0]), file => { file.items[0].currency = 'XYZ' }, file => { file.items[0].recordKind = 'actual' }, file => { file.items[0].endDate = '2020-01-01' }, file => { file.investments[0].amount = -1 }]) {
    const value = bundle(); mutate(value)
    assert.throws(() => parseFinappImport(JSON.stringify(value)))
  }
  assert.throws(() => parseFinappImport('a'.repeat(2000001)), /2 MB/)
  assert.throws(() => parseFinappImport('{"format":"outro"}'), /Formato/)
})
test('limite impede descarte silencioso de lançamentos existentes', () => {
  const value = current()
  value.cashFlow.items = Array.from({ length: 100 }, (_, index) => ({ ...bundle().items[0], id: `existing-${index}` }))
  assert.throws(() => mergeFinappImport(value, parseFinappImport(JSON.stringify(bundle()))), /limite/)
  assert.equal(value.cashFlow.items.length, 100)
})
test('perfil exige sessão e oferece prévia local sem envio ao Supabase', () => {
  const saved = { ...authState }
  try {
    authState.authenticated = false
    assert.match(renderProfile(), /Entre na conta de destino para importar/)
    authState.authenticated = true
    assert.match(renderProfile(), /data-finapp-import/)
    assert.match(renderProfile(), /Conferir arquivo e importar/)
    assert.match(renderProfile(), /Não substitui registros existentes nem envia dados ao Supabase/)
  } finally { Object.assign(authState, saved) }
})
