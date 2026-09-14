import test from 'node:test'
import assert from 'node:assert/strict'
const memory = new Map()
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) }
const { state, resetState, addScenario, updateScenario } = await import('../src/app/state.js')
const { sanitizePlan, createExportableState, serializeExportableState, parseStoredState } = await import('../src/app/state-storage.js')
const { confirmProjectionAssumption } = await import('../src/app/projection-confirmations.js')
const { renderProjectionChecks } = await import('../src/shared/projection-checks.js')
const { finappViability } = await import('../src/domain/finapp-viability.js')
const { simulationInputFromData, editScenario, clearScenarioEditor, simulationContext, simulationCashFlow } = await import('../src/features/simulations/scenario-editor.js')
const { renderSimulations, simulationSchedules } = await import('../src/features/simulations/simulations.js')
const { projectRetirementWithSchedules } = await import('../src/domain/retirement.js')
const { compareSavedPlan, financialSignature } = await import('../src/domain/sync-comparison.js')

function formData(plan, patch = {}) {
  const data = new FormData()
  for (const name of ['currentAge', 'retirementAge', 'currentAssets', 'monthlyContribution', 'targetMonthlyIncome', 'expectedMonthlyBenefit', 'annualRealReturn', 'annualInflation', 'annualWithdrawalRate']) data.set(name, String(name in patch ? patch[name] : plan[name] * (name.startsWith('annual') ? 100 : 1)))
  return data
}
function family() {
  resetState(); clearScenarioEditor()
  state.plan = sanitizePlan({ ...state.plan, spouseEnabled: true, spouseCurrentAge: 40, spouseRetirementAge: 65, spouseExpectedMonthlyBenefit: 2000, investments: [
    { id: 'one', name: 'Um', amount: 10000.25, monthlyContribution: 100, returnType: 'real', returnValue: .03, liquidity: 'available', annualRealReturns: [{ year: 2027, rate: .07 }] },
    { id: 'two', name: 'Dois', amount: 20000.50, monthlyContribution: 200, returnType: 'real', returnValue: .05, liquidity: 'restricted' }
  ] })
}

test('confirmação exige consentimento e altera somente a premissa selecionada', () => {
  resetState()
  state.plan.targetAge = 90
  state.plan.finappMethod.openingConfirmed = false
  const previous = structuredClone(state.plan)
  assert.throws(() => confirmProjectionAssumption('openingConfirmed', false))
  assert.throws(() => confirmProjectionAssumption('taxRegime', true))
  confirmProjectionAssumption('openingConfirmed', true)
  assert.deepEqual(state.plan, { ...previous, finappMethod: { ...previous.finappMethod, openingConfirmed: true } })
  assert.ok(!finappViability(state).confirmations.some(message => message.includes('saldos de abertura')))
})

test('formulário de confirmação explica financiamento selecionado', () => {
  const result = { issues: ['Origem'], confirmations: ['Origem'], pendingIssues: [], notices: [], confirmationDetails: [{ field: 'pensionConfirmed', message: 'Origem' }], rows: [{ year: '2026' }], settings: { pensionMode: 'cash-funded' } }
  assert.match(renderProjectionChecks(result), /pagas pelo orçamento familiar/)
  assert.match(renderProjectionChecks(result), /name="confirmed" required/)
  result.settings.pensionMode = 'external'
  assert.match(renderProjectionChecks(result), /não saem do orçamento familiar/)
})

test('cenário redistribui patrimônio e aporte, preserva casal e retorna a mesma projeção após salvar', () => {
  family()
  const original = structuredClone(state.plan)
  const plan = simulationInputFromData(formData(state.plan, { currentAssets: 60001.5, monthlyContribution: 600 }))
  assert.equal(plan.investments[0].amount, 20000.5)
  assert.equal(plan.investments[1].amount, 40001)
  assert.equal(plan.investments[0].monthlyContribution, 200)
  assert.equal(plan.investments[1].monthlyContribution, 400)
  assert.equal(plan.spouseExpectedMonthlyBenefit, 2000)
  assert.deepEqual(plan.investments[0].annualRealReturns, original.investments[0].annualRealReturns)
  const projected = projectRetirementWithSchedules(plan, [], new Date('2026-01-01'))
  addScenario('Teste', plan)
  const restored = parseStoredState(serializeExportableState(state)).scenarios[0].plan
  assert.equal(projectRetirementWithSchedules(restored, [], new Date('2026-01-01')).projectedAssets, projected.projectedAssets)
  assert.deepEqual(state.plan, original)
})

test('editar cenário conserva identidade, moeda e orçamento sem mudar o plano principal', () => {
  family()
  addScenario('Original', state.plan, { currency: 'CHF', cashFlow: { ...state.cashFlow, retirementMonth: '2050-01' } })
  const main = structuredClone(state.plan), id = state.scenarios[0].id
  editScenario(id)
  assert.equal(simulationContext().currency, 'CHF')
  const draft = simulationInputFromData(formData(simulationContext().plan, { retirementAge: simulationContext().plan.retirementAge + 1 }))
  assert.equal(simulationCashFlow(draft).retirementMonth, draft.retirementMonth)
  assert.ok(Array.isArray(simulationSchedules(draft)))
  updateScenario(id, 'Editado', draft, { ...simulationContext(), cashFlow: simulationCashFlow(draft) })
  assert.equal(state.scenarios.length, 1)
  assert.equal(state.scenarios[0].id, id)
  assert.equal(state.scenarios[0].currency, 'CHF')
  assert.equal(state.scenarios[0].name, 'Editado')
  assert.deepEqual(state.plan, main)
  clearScenarioEditor()
})

test('aporte sem distribuição conserva hipótese de taxa padrão e entradas vazias não viram zero', () => {
  family()
  for (const investment of state.plan.investments) investment.monthlyContribution = 0
  state.plan.monthlyContribution = 0
  const draft = simulationInputFromData(formData(state.plan, { monthlyContribution: 99.99 }))
  assert.equal(draft.investments.at(-1).returnType, 'default')
  assert.equal(draft.investments.at(-1).monthlyContribution, 99.99)
  assert.equal(draft.investments.at(-1).amount, 0)
  assert.throws(() => simulationInputFromData(formData(state.plan, { currentAssets: '' })), /Patrimônio atual/)
})

test('comparação de cenários mostra premissas e remove gráficos e percentuais com privacidade', () => {
  family(); addScenario('Alternativa', state.plan)
  state.valuesHidden = false
  assert.match(renderSimulations(), /O que muda entre os cenários/)
  assert.match(renderSimulations(), /data-edit-scenario/)
  state.valuesHidden = true
  const html = renderSimulations()
  assert.doesNotMatch(html, /<polyline|role="progressbar"|Comparação dos saldos projetados/)
})

test('comparação de cópias ignora preferências e timestamp mas detecta alterações em todos os grupos financeiros', () => {
  family()
  const current = createExportableState(state), saved = structuredClone(current)
  saved.valuesHidden = !current.valuesHidden
  saved.lastUpdatedAt = '2000-01-01T00:00:00Z'
  assert.equal(financialSignature(current), financialSignature(saved))
  saved.plan.spouseExpectedMonthlyBenefit += 1
  saved.cashFlow.items.push({ id: 'new', type: 'expense', categoryId: 'housing', amount: 1, currency: 'BRL', frequency: 'monthly' })
  const result = compareSavedPlan(current, saved)
  assert.equal(result.identical, false)
  assert.deepEqual(result.differences, ['Plano, família e investimentos', 'Orçamento, contas e compromissos'])
  assert.equal(current.plan.spouseExpectedMonthlyBenefit, 2000)
})

test('comparação remota é somente leitura e ignora respostas após alteração do plano, destino ou conta', async () => {
  const { inspectSavedPlan, renderSyncComparison, clearSyncComparison } = await import('../src/features/profile/sync-comparison.js')
  const { ownedStorage } = await import('../src/app/owned-storage.js')
  const { authState } = await import('../src/app/auth-state.js')
  const oldFetch = globalThis.fetch, oldAuth = { ...authState }
  try {
    family(); state.valuesHidden = false
    ownedStorage.select('account-a'); authState.storageProvider = 'local'
    const saved = createExportableState(state)
    globalThis.fetch = async (url, options) => {
      assert.equal(options.method, 'GET')
      assert.equal(options.headers['X-Storage-Provider'], 'local')
      return { ok: true, json: async () => ({ state: saved, updatedAt: '2026-01-01T00:00:00Z' }) }
    }
    await inspectSavedPlan()
    assert.match(renderSyncComparison(), /conteúdo financeiro é igual/)
    state.valuesHidden = true
    assert.doesNotMatch(renderSyncComparison(), /conteúdo financeiro é igual|2026/)
    for (const mutate of [() => { state.plan.targetMonthlyIncome += 1 }, () => { authState.storageProvider = 'supabase' }, () => { ownedStorage.select('account-b') }]) {
      ownedStorage.select('account-a'); authState.storageProvider = 'local'
      globalThis.fetch = async () => { mutate(); return { ok: true, json: async () => ({ state: saved }) } }
      await assert.rejects(inspectSavedPlan, /mudou/)
      assert.equal(renderSyncComparison(), '')
    }
  } finally { globalThis.fetch = oldFetch; Object.assign(authState, oldAuth); ownedStorage.select(null); clearSyncComparison() }
})
