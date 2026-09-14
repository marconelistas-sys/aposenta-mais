import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { renderProjectionChecks } from '../src/shared/projection-checks.js'
const today = new Date('2026-01-01T00:00:00Z')
function fixture() {
  return createExportableState({ plan: { currentAge: 60, retirementAge: 61, targetAge: 63, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, expectedMonthlyBenefit: 0, investments: [
    { id: 'cash', name: 'Caixa', amount: 10000, assetClass: 'cash', liquidity: 'available', returnType: 'real', returnValue: 0 },
    { id: 'restricted', name: 'Reserva restrita', amount: 5000, assetClass: 'pension', liquidity: 'restricted', returnType: 'real', returnValue: 0 }
  ], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2027-01', items: [] } })
}

test('saldo deliberadamente restrito informa tratamento sem impedir sustentabilidade nem criar pendência', () => {
  const state = fixture()
  const result = finappViability(state, undefined, today)
  assert.equal(result.viable, true)
  assert.equal(result.issues.length, 0)
  assert.equal(result.notices.length, 1)
  assert.equal(result.rows.at(-1).liquidAssets, 10000)
  const html = renderProjectionChecks(result)
  assert.match(html, /Como os saldos restritos entram no cálculo/)
  assert.doesNotMatch(html, /Dados a revisar|Premissas a confirmar|pendências de revisão/)
})

test('confirmações de abertura e financiamento são explícitas, separadas de erros e ainda impedem conclusão', () => {
  const state = fixture()
  state.plan.finappMethod.openingConfirmed = false
  state.plan.finappMethod.pensionConfirmed = false
  state.cashFlow.items.push({ id: 'pension', type: 'expense', categoryId: 'private-pension', frequency: 'monthly', amount: 10, currency: 'BRL', startDate: '2026-01-01', recordKind: 'planned' })
  const result = finappViability(state, undefined, today)
  assert.equal(result.confirmations.length, 2)
  assert.equal(result.pendingIssues.length, 0)
  assert.equal(result.viable, false)
  const html = renderProjectionChecks(result)
  assert.match(html, /Premissas a confirmar \(2\)/)
  assert.match(html, /saldos de abertura/)
  assert.match(html, /Confirme a origem das contribuições/)
  assert.doesNotMatch(html, /Dados a revisar/)
})

test('falta de liquidez permanece insuficiência e dado sem data continua exigindo correção', () => {
  const state = fixture()
  state.plan.investments[0].amount = 0
  state.cashFlow.items.push({ id: 'expense', type: 'expense', categoryId: 'housing', frequency: 'monthly', amount: 100, currency: 'BRL', startDate: '2026-01-01' })
  state.cashFlow.items.push({ id: 'undated', type: 'expense', categoryId: 'housing', frequency: 'occasional', amount: 100, currency: 'BRL' })
  const result = finappViability(state, undefined, today)
  assert.ok(result.firstFailure)
  assert.equal(result.viable, false)
  assert.match(renderProjectionChecks(result), /Dados a revisar \(1\)/)
  assert.match(renderProjectionChecks(result), /lançamento único sem data/)
})

test('mês de aposentadoria ausente não duplica a mesma causa no contador', () => {
  const state = fixture()
  state.plan.retirementMonth = null
  state.cashFlow.retirementMonth = null
  const result = finappViability(state, undefined, today)
  assert.equal(result.pendingIssues.length, 1)
  assert.match(result.pendingIssues[0], /Confirme o mês/)
})
