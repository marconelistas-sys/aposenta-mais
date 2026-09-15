import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { state } from '../src/app/state.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { renderProjectionChecks } from '../src/shared/projection-checks.js'
import { renderProfile } from '../src/features/profile/profile.js'
import { migrationReview } from '../src/domain/review-targets.js'
import { planChecks } from '../src/domain/plan-checks.js'

const today = new Date('2026-01-01T00:00:00Z')
function fixture() {
  return createExportableState({ plan: { currentAge: 60, retirementAge: 61, targetAge: 63, horizonReferenceMonth: '2026-01', retirementMonth: '2027-01', annualRealReturn: 0, expectedMonthlyBenefit: 0, investments: [
    { id: 'court:1', name: 'Precatório <família>', amount: 10000, assetClass: 'other', liquidity: 'restricted', returnType: 'real', returnValue: 0 },
    { id: 'court:2', name: 'Precatório <família>', amount: 5000, assetClass: 'other', liquidity: 'unknown', returnType: 'real', returnValue: 0 }
  ], finappMethod: { openingConfirmed: true, pensionConfirmed: true } }, cashFlow: { retirementMonth: '2027-01', items: [], finappMigration: { source: 'finapp', pending: [
    { table: 'consortiums', id: 7, reason: 'Conferir contemplação', record: { name: 'Consórcio da casa', credit_value: 10000 } },
    { table: 'one_time_flows', id: 12, reason: '<script>Sem classificação</script>', record: { name: 'Pagamento único' } }
  ] } } })
}

test('migration reviews show the actual record and reason with stable links to originals', () => {
  const input = fixture(), before = structuredClone(input)
  const result = finappViability(input, undefined, today)
  const html = renderProjectionChecks(result)
  assert.match(html, /Consórcio da casa/)
  assert.match(html, /Conferir contemplação/)
  assert.match(html, /href="\/perfil#migration-pending-consortiums-7"/)
  assert.match(html, /href="\/perfil#migration-pending-one_time_flows-12"/)
  assert.match(html, /&lt;script&gt;Sem classificação/)
  assert.doesNotMatch(html, /<script>|Existem pendências da migração/)
  assert.equal(result.issueDetails.length, result.pendingIssues.length)
  assert.deepEqual(input, before)
  assert.equal(migrationReview(input.cashFlow.finappMigration.pending[0], 0).href, migrationReview(input.cashFlow.finappMigration.pending[0], 9).href)
})

test('each restricted balance has its own release link even when names repeat', () => {
  const input = fixture()
  input.cashFlow.finappMigration.pending = []
  const result = finappViability(input, undefined, today)
  assert.equal(result.noticeDetails.length, 2)
  for (const [index, id] of ['court:1', 'court:2'].entries()) {
    const target = new URL(result.noticeDetails[index].href, 'http://localhost')
    assert.equal(target.pathname, '/carteira')
    assert.equal(target.searchParams.get('id'), id)
    assert.equal(target.searchParams.get('field'), 'investmentReleaseYear')
  }
  const html = renderProjectionChecks(result)
  assert.match(html, /Precatório &lt;família&gt;: saldo restrito sem ano de liberação/)
  assert.match(html, /Classificar liquidez deste investimento/)
  input.plan.investments[1].liquidity = 'restricted'
  input.plan.finappMethod.releases = [{ investmentId: 'court:1', year: 2027 }]
  const corrected = finappViability(input, undefined, today)
  assert.equal(corrected.issues.length, 0)
  assert.equal(corrected.noticeDetails.length, 1)
  assert.equal(new URL(corrected.noticeDetails[0].href, 'http://localhost').searchParams.get('id'), 'court:2')
})

test('salary and undated checks name every item and open the corresponding budget field', () => {
  const input = fixture()
  input.cashFlow.items = Array.from({ length: 5 }, (_, index) => ({ id: `salary-${index}`, description: `Salário ${index}`, type: 'income', categoryId: 'salary', amount: 100, currency: 'BRL', frequency: 'monthly', startDate: '2026-01-01' }))
  input.cashFlow.items.push({ id: 'undated', description: 'Reforma do imóvel', type: 'expense', categoryId: 'housing', amount: 100, currency: 'BRL', frequency: 'occasional' })
  const result = finappViability(input, undefined, today)
  for (const details of [result.issueDetails, planChecks(input, today)]) {
    for (let i = 0; i < 5; i++) assert.ok(details.some(item => item.message.includes(`Salário ${i}`) && item.href.includes(`id=salary-${i}`)))
    assert.ok(details.some(item => item.message.includes('Reforma do imóvel') && item.href.includes('id=undated') && item.href.includes('field=startDate')))
  }
})

test('migration profile provides exact destinations and hides names and original reasons in privacy mode', () => {
  const before = structuredClone(state)
  try {
    Object.assign(state, fixture(), { valuesHidden: false })
    const html = renderProfile()
    assert.match(html, /id="migration-pending-consortiums-7"/)
    assert.match(html, /Dados originais de Consórcio “Consórcio da casa” #7/)
    assert.match(html, /href="\/consorcios" data-route/)
    state.valuesHidden = true
    assert.doesNotMatch(renderProfile(), /Consórcio da casa|Conferir contemplação|migration-pending-consortiums-7|credit_value/)
  } finally { Object.assign(state, before) }
})
