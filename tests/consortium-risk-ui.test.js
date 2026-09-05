import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { prepareRiskInput, defaultRiskSettings } from '../src/domain/risk-plan.js'
import { deterministicPath, simulateRisk, riskMatrix } from '../src/domain/risk-simulation.js'
import { renderConsortia, saveConsortium } from '../src/features/cash-flow/consortia.js'
import { renderRisk, riskView, riskRevision, startRisk, cancelRisk } from '../src/features/plan/risk.js'
import { state, selectPlanOwner } from '../src/app/state.js'
import { ownedStorage } from '../src/app/owned-storage.js'
import { consortiumFromForm } from '../src/domain/consortium.js'

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }
const settings = { ...defaultRiskSettings, months: 12, simulations: 50, aggregateLiquid: true }
function reset() {
  cancelRisk(true)
  Object.assign(state, sanitizeStoredState({ plan: { currentAssets: 12345, annualRealReturn: 0, monthlyContribution: 0, expectedMonthlyBenefit: 0 }, cashFlow: { items: [] } }))
}
const fixture = { id: 'c', name: '<b>Teste</b>', currency: 'BRL', referenceMonth: '2026-09', stage: 'pending', useType: 'asset', credit: 100000, principal: 80000, months: 80, administration: 0, reserve: 0, insurance: 0, annualAdjustment: 0, ownBid: 0, embeddedBid: 0, purchaseValue: 0, assetReturn: 0, creditReturn: 0, awardMonth: null, earlyMonth: null, lateMonth: null, useMonth: null }
test('cadastro agrupa contrato e hipóteses, escapa nome e mascara cronograma', () => {
  reset(); state.cashFlow.consortia = [fixture]
  const visible = renderConsortia()
  assert.match(visible, /<fieldset>/)
  assert.match(visible, /<legend>/)
  assert.match(visible, /&lt;b&gt;Teste&lt;\/b&gt;/)
  assert.doesNotMatch(visible, /<b>Teste<\/b>/)
  assert.match(visible, /data-consortium-pending/)
  state.valuesHidden = true
  assert.doesNotMatch(renderConsortia(), /data-consortium-form|80\.000|100\.000|1\.000/)
})
test('salvar consórcio exige confirmação e edição preserva identidade sem duplicar', () => {
  reset()
  const data = new FormData()
  const current = { ...fixture, id: '', name: 'Teste', referenceMonth: new Date().toISOString().slice(0, 7) }
  for (const [key, value] of Object.entries(current)) data.set(key, value ?? '')
  assert.throws(() => saveConsortium(data), /Confirme/)
  data.set('confirmed', 'on'); saveConsortium(data)
  assert.equal(state.cashFlow.consortia.length, 1)
  data.set('id', state.cashFlow.consortia[0].id); data.set('name', 'Corrigido'); saveConsortium(data)
  assert.equal(state.cashFlow.consortia.length, 1)
  assert.equal(state.cashFlow.consortia[0].name, 'Corrigido')
})
test('cota com bem adquirido não exige select desabilitado de destino', () => {
  const data = new FormData()
  for (const [key, value] of Object.entries({ ...fixture, stage: 'asset', purchaseValue: 100000, useType: null })) if (value !== null) data.set(key, value)
  assert.equal(consortiumFromForm(data, '2026-09').useType, 'asset')
})
test('gráfico, tabela e matriz mostram a mesma base, com dados alternativos acessíveis', () => {
  reset()
  const input = prepareRiskInput(state, settings, new Date('2026-09-05T00:00:00Z'))
  riskView.result = { input, base: deterministicPath(input), simulated: simulateRisk(input), matrix: riskMatrix(input), matrixError: '' }
  riskView.revision = riskRevision()
  const html = renderRisk()
  assert.match(html, /<svg/)
  assert.match(html, /Tabela mensal/)
  assert.match(html, /Cenário base/)
  assert.match(html, /não perdas máximas/)
  assert.match(html, /12\.345/)
  state.valuesHidden = true
  const hidden = renderRisk()
  assert.doesNotMatch(hidden, /<svg|12\.345|value="12345"/)
  assert.match(hidden, /Gráfico oculto/)
  state.plan.currentAssets = 22222
  assert.match(renderRisk(), /O plano mudou/)
  assert.doesNotMatch(renderRisk(), /Tabela mensal/)
})
test('worker pode ser cancelado e não entrega resultados após mudança de identidade', () => {
  reset()
  const OriginalWorker = globalThis.Worker
  class FakeWorker {
    static current = null
    constructor() { FakeWorker.current = this; this.terminated = false }
    postMessage(message) { this.message = message }
    terminate() { this.terminated = true }
  }
  globalThis.Worker = FakeWorker
  try {
    let calls = 0
    startRisk(settings, () => calls++)
    const first = FakeWorker.current
    assert.equal(riskView.running, true)
    cancelRisk(true)
    assert.equal(first.terminated, true)
    first.onmessage({ data: { result: { fake: true } } })
    assert.equal(riskView.result, null)
    startRisk(settings, () => calls++)
    const second = FakeWorker.current
    ownedStorage.select('different-user')
    second.onmessage({ data: { result: { fake: true } } })
    assert.equal(riskView.result, null)
    assert.equal(calls, 0)
  } finally { cancelRisk(true); globalThis.Worker = OriginalWorker; selectPlanOwner(null) }
})
test('resultado em trânsito fica inválido quando orçamento é alterado', () => {
  reset()
  const OriginalWorker = globalThis.Worker
  let current
  globalThis.Worker = class { constructor() { current = this } postMessage() {} terminate() {} }
  try {
    startRisk(settings, () => {})
    state.cashFlow.items.push({ id: 'new' })
    current.onmessage({ data: { result: { fake: true } } })
    assert.equal(riskView.result, null)
    assert.match(riskView.error, /plano mudou/)
  } finally { cancelRisk(true); globalThis.Worker = OriginalWorker }
})
