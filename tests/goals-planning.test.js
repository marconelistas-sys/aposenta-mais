import test from 'node:test'
import assert from 'node:assert/strict'
import { createExportableState } from '../src/app/state-storage.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { sanitizeAnnualRows } from '../src/domain/annual-planning.js'
import { sanitizeCommitments } from '../src/domain/financial-calendar.js'
import { analyzeGoals, confidenceStatus, goalRiskSettings, planGoals, referenceVolatility } from '../src/domain/goals-planning.js'
import { state, resetState } from '../src/app/state.js'
import { renderGoals, setGoalPriority, goalsView, cancelGoals } from '../src/features/goals/goals.js'
import { saveAnnualPlanning } from '../src/features/plan/annual-planning.js'
import { saveCommitment } from '../src/features/cash-flow/calendar.js'

const today = new Date('2026-01-01T00:00:00Z')
const item = (id, type, categoryId, amount, startDate, endDate) => ({ id, description: id, type, categoryId, amount, currency: 'BRL', frequency: 'monthly', startDate, endDate, recordKind: 'planned' })

function fixture({ volatility = 0.000001, goals = true } = {}) {
  return createExportableState({
    currency: 'BRL',
    plan: { currentAge: 60, retirementAge: 62, targetAge: 70, horizonReferenceMonth: '2026-01', retirementMonth: '2028-01', annualRealReturn: 0, investments: [{ id: 'caixa', name: 'Caixa', amount: 100000, liquidity: 'available', assetClass: 'cash' }], riskSettings: { annualVolatility: volatility, simulations: 50 }, finappMethod: { pensionMode: 'external', openingConfirmed: true, pensionConfirmed: true } },
    cashFlow: {
      retirementMonth: '2028-01',
      items: [item('salario', 'income', 'salary', 10000, '2026-01-01', '2027-12-31'), item('beneficio', 'income', 'pension', 5500, '2028-01-01', null), item('custos', 'expense', 'housing', 6000, '2026-01-01', null)],
      annualGoals: goals ? [
        { id: 'viagem', name: 'Viagem', currency: 'BRL', amount: 30000, startYear: 2027, endYear: 2036, everyYears: 1, realGrowth: 0, priority: 'aspirational' },
        { id: 'carro', name: 'Carro', currency: 'BRL', amount: 40000, startYear: 2029, endYear: 2029, everyYears: 1, realGrowth: 0 }
      ] : [],
      commitments: goals ? [{ id: 'reforma', name: 'Reforma', kind: 'goal', currency: 'BRL', date: '2027-06-01', amount: 30000, saved: 10000, priority: 'essential' }] : []
    }
  })
}

test('prioridade do objetivo é preservada só quando válida', () => {
  const base = { id: 'a', name: 'Meta', currency: 'BRL', amount: 1000, startYear: 2027, endYear: 2027, everyYears: 1, realGrowth: 0 }
  assert.equal(sanitizeAnnualRows([{ ...base, priority: 'essential' }])[0].priority, 'essential')
  assert.equal(Object.hasOwn(sanitizeAnnualRows([{ ...base, priority: 'urgente' }])[0], 'priority'), false)
  const goal = { id: 'g', name: 'Meta', kind: 'goal', currency: 'BRL', date: '2027-01-01', amount: 100, saved: 0 }
  assert.equal(sanitizeCommitments([{ ...goal, priority: 'aspirational' }])[0].priority, 'aspirational')
  const debt = { id: 'd', name: 'Dívida', kind: 'debt', currency: 'BRL', date: '2027-01-01', amount: 100, installments: 2, annualRate: 0, priority: 'essential' }
  assert.equal(Object.hasOwn(sanitizeCommitments([debt])[0], 'priority'), false)
})

test('valores das metas reproduzem as metas e custos do motor anual', () => {
  const value = fixture()
  const base = finappViability(value, value.plan.finappMethod, today)
  const goals = planGoals(value, base.rows.map(row => Number(row.year)), value.exchangeRates)
  base.rows.forEach((row, index) => {
    const annual = goals.filter(goal => goal.source === 'annual').reduce((sum, goal) => sum + goal.amounts[index], 0)
    assert.ok(Math.abs(annual - row.goals) < 0.01, `ano ${row.year}`)
  })
  const reforma = goals.find(goal => goal.id === 'calendar:reforma')
  assert.equal(reforma.total, 20000)
  assert.equal(goals.find(goal => goal.id === 'annual:carro').priority, 'important')
  assert.equal(goals.find(goal => goal.id === 'annual:carro').explicitPriority, false)
})

test('confiança é protegida por prioridade e a meta desejável é a primeira a falhar', () => {
  const result = analyzeGoals(fixture(), today)
  const [essential, important, all] = result.tiers.map(tier => tier.probability)
  assert.ok(essential >= important && important >= all)
  assert.equal(result.tiers[0].deterministicFunded, true)
  assert.equal(result.tiers[2].deterministicFunded, false)
  assert.equal(result.probability, all)
  assert.equal(result.goals.find(goal => goal.id === 'annual:viagem').probability, all)
  assert.equal(result.status, confidenceStatus(all))
})

test('caminhos levam o plano completo ao alvo, e a margem aparece quando sobra', () => {
  const short = analyzeGoals(fixture(), today)
  assert.equal(short.levers.saving.status, 'needed')
  assert.ok(short.levers.saving.monthly > 0)
  assert.equal(short.levers.spending.status, 'needed')
  assert.ok(short.levers.spending.share > 0 && short.levers.spending.share <= 0.5)
  assert.equal(short.levers.flexibleGoals.status, 'needed')
  assert.ok(short.levers.flexibleGoals.cut > 0 && short.levers.flexibleGoals.cut <= 1)
  // The extra saving found by the solver really reaches the target.
  const boosted = fixture()
  boosted.cashFlow.items.push(item('extra', 'income', 'other-income', short.levers.saving.monthly, '2026-01-01', '2027-12-31'))
  assert.ok(analyzeGoals(boosted, today, { solve: false }).probability >= short.target)
  const relaxed = analyzeGoals(fixture({ goals: false }), today)
  assert.equal(relaxed.probability, 1)
  assert.equal(relaxed.levers.saving.status, 'met')
  assert.equal(relaxed.levers.spending.status, 'room')
  assert.ok(relaxed.levers.spending.share > 0)
})

test('balanço de objetivos soma recursos e compromissos em valor presente', () => {
  const result = analyzeGoals(fixture(), today, { solve: false })
  const { balance } = result
  // Real rate zero: present value equals the plain sum of flows.
  assert.equal(balance.resources.financial, 100000)
  assert.ok(Math.abs(balance.resources.income - (2 * 120000 + 9 * 66000)) < 0.01)
  assert.ok(Math.abs(balance.commitments.essential - 20000) < 0.01)
  assert.ok(Math.abs(balance.commitments.important - 40000) < 0.01)
  assert.ok(Math.abs(balance.commitments.aspirational - 300000) < 0.01)
  assert.ok(Math.abs(balance.surplus - (balance.totalResources - balance.totalCommitments)) < 1e-6)
  assert.ok(balance.fundedRatio < 1)
})

test('volatilidade de referência só vale quando o risco não foi configurado', () => {
  assert.equal(goalRiskSettings(fixture()).source, 'configured')
  const reference = goalRiskSettings(fixture({ volatility: 0 }))
  assert.equal(reference.source, 'reference')
  assert.equal(reference.annualVolatility, 0.01)
  assert.equal(referenceVolatility({ investments: [] }), 0.1)
  assert.equal(referenceVolatility({ investments: [{ amount: 1, assetClass: 'equity' }, { amount: 1, assetClass: 'fixed-income' }] }), 0.13)
})

test('tela de objetivos calcula sem worker, muda prioridade e respeita valores ocultos', () => {
  resetState()
  Object.assign(state, fixture())
  cancelGoals(true)
  const html = renderGoals()
  assert.match(html, /Seus objetivos e a chance de realizá-los/)
  assert.match(html, /Confiança por prioridade/)
  assert.match(html, /Caminhos para 80% de confiança/)
  assert.match(html, /Balanço dos objetivos/)
  assert.match(html, /data-goal-priority="annual:carro"/)
  assert.match(html, /Prioridade a confirmar/)
  assert.ok(goalsView.result)
  setGoalPriority('annual:carro', 'essential')
  assert.equal(state.cashFlow.annualGoals.find(row => row.id === 'carro').priority, 'essential')
  setGoalPriority('calendar:reforma', 'aspirational')
  assert.equal(state.cashFlow.commitments.find(row => row.id === 'reforma').priority, 'aspirational')
  assert.throws(() => setGoalPriority('annual:inexistente', 'essential'), /não encontrado/)
  assert.throws(() => setGoalPriority('annual:carro', 'urgente'), /inválida/)
  const updated = renderGoals()
  assert.equal(goalsView.result.goals.find(goal => goal.id === 'annual:carro').priority, 'essential')
  state.valuesHidden = true
  const hidden = renderGoals()
  assert.match(hidden, /R\$ •••••/)
  assert.match(hidden, /data-goal-priority="annual:carro" disabled/)
  assert.ok(updated.length > 0)
  state.valuesHidden = false
  resetState()
})

test('editar a meta no calendário ou na provisão anual mantém a prioridade', () => {
  resetState()
  Object.assign(state, fixture())
  const commitment = new URLSearchParams({ id: 'reforma', name: 'Reforma', kind: 'goal', amount: '35000', currency: 'BRL', date: '2027-06-01', saved: '10000', installments: '0', annualRate: '0' })
  saveCommitment(commitment)
  assert.equal(state.cashFlow.commitments.find(row => row.id === 'reforma').priority, 'essential')
  const annual = new URLSearchParams({ kind: 'annualGoals', id: 'viagem', name: 'Viagem', currency: 'BRL', amount: '25000', startYear: '2027', endYear: '2036', everyYears: '1', realGrowth: '0' })
  saveAnnualPlanning(annual)
  assert.equal(state.cashFlow.annualGoals.find(row => row.id === 'viagem').priority, 'aspirational')
  annual.set('priority', 'important')
  saveAnnualPlanning(annual)
  assert.equal(state.cashFlow.annualGoals.find(row => row.id === 'viagem').priority, 'important')
  resetState()
})

test('meta de legado vira piso do patrimônio final e entra pela sua prioridade', async () => {
  const { sanitizeLegacyGoal } = await import('../src/domain/goal-settings.js')
  assert.equal(sanitizeLegacyGoal({ amount: 0, currency: 'BRL' }), null)
  assert.equal(sanitizeLegacyGoal({ amount: 10, currency: 'XYZ' }), null)
  assert.deepEqual(sanitizeLegacyGoal({ amount: 10, currency: 'BRL' }), { amount: 10, currency: 'BRL', priority: 'important' })
  const value = fixture({ goals: false })
  const without = analyzeGoals(value, today, { solve: false })
  assert.equal(without.probability, 1)
  value.plan.legacyGoal = { amount: 1e7, currency: 'BRL', priority: 'aspirational' }
  const unreachable = analyzeGoals(value, today)
  assert.equal(unreachable.tiers[0].probability, 1)
  assert.equal(unreachable.probability, 0)
  assert.ok(unreachable.goals.some(goal => goal.source === 'legacy'))
  assert.ok(unreachable.balance.commitments.legacy > 0)
  assert.equal(unreachable.levers.flexibleGoals.status, 'needed')
  value.plan.legacyGoal = { amount: 1000, currency: 'BRL', priority: 'essential' }
  assert.equal(analyzeGoals(value, today, { solve: false }).probability, 1)
})

test('simulador combinado aplica as alavancas juntas sem alterar o plano', async () => {
  const { goalScenario, sanitizeGoalScenario } = await import('../src/domain/goals-planning.js')
  assert.deepEqual(sanitizeGoalScenario({ extraMonthly: -5, costChange: 3, delayYears: 2.6, flexibleCut: 'x' }), { extraMonthly: 0, costChange: 0.5, delayYears: 3, flexibleCut: 0 })
  const value = fixture()
  const before = JSON.stringify(value)
  const analysis = analyzeGoals(value, today)
  assert.equal(goalScenario(value, today, {}).probability, analysis.probability)
  assert.ok(goalScenario(value, today, { extraMonthly: analysis.levers.saving.monthly }).probability >= analysis.target)
  const combined = goalScenario(value, today, { extraMonthly: analysis.levers.saving.monthly / 2, flexibleCut: analysis.levers.flexibleGoals.cut / 2 })
  assert.equal(combined.tiers.length, 3)
  assert.ok(goalScenario(value, today, { flexibleCut: 1 }).probability === analysis.tiers[0].probability)
  assert.equal(JSON.stringify(value), before)
})

test('reservas de liquidez, longevidade e legado repartem o patrimônio de hoje', () => {
  const value = fixture()
  value.cashFlow.emergencyReserveTarget = 0
  const { reserves } = analyzeGoals(value, today, { solve: false })
  assert.equal(reserves.financial, 100000)
  assert.equal(reserves.liquidity.emergency, 36000)
  // 2027: reforma 20.000 e viagem 30.000 sobre sobra de 48.000 → falta 2.000. 2028: 72.000 + 30.000 − 66.000.
  assert.ok(Math.abs(reserves.liquidity.nearTerm - 38000) < 0.01)
  assert.equal(reserves.liquidity.held, 100000)
  assert.ok(Math.abs(reserves.liquidity.allocated + reserves.longevity.allocated + reserves.legacy.allocated - 100000) < 1e-6)
  assert.ok(reserves.shortfall > 0)
})

test('alocação pelos prazos fica mais conservadora perto das necessidades', async () => {
  const { horizonProfile, roundShares } = await import('../src/domain/goals-planning.js')
  assert.equal(horizonProfile(0).key, 'liquidity')
  assert.equal(horizonProfile(4).key, 'conservative')
  assert.equal(horizonProfile(8).key, 'moderate')
  assert.equal(horizonProfile(30).key, 'growth')
  const rounded = roundShares({ cash: 1 / 3, 'fixed-income': 1 / 3, equity: 1 / 3 })
  assert.ok(Math.abs(Object.values(rounded).reduce((a, b) => a + b, 0) - 1) < 1e-9)
  const { allocation } = analyzeGoals(fixture(), today, { solve: false })
  assert.equal(allocation.glidePath[0].offset, 0)
  assert.deepEqual(allocation.current, { cash: 1, 'fixed-income': 0, equity: 0 })
  assert.ok(allocation.suggested.equity < 0.6)
  assert.ok(allocation.byGoal.find(row => row.id === 'calendar:reforma').profile === 'liquidity')
  const sum = Object.values(allocation.suggested).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9)
})

test('histórico guarda um ponto por mês, fora da revisão do cálculo e da demonstração', async () => {
  const { upsertGoalsHistory, goalsTrend, sanitizeGoalsHistory } = await import('../src/domain/goal-settings.js')
  const { riskRevision } = await import('../src/features/plan/risk.js')
  const { recordGoalsSnapshot } = await import('../src/app/state.js')
  const { sanitizePlan } = await import('../src/app/state-storage.js')
  let history = upsertGoalsHistory([], { month: '2026-09', probability: 0.7, essential: 0.9 })
  history = upsertGoalsHistory(history, { month: '2026-10', probability: 0.75, essential: 0.9 })
  history = upsertGoalsHistory(history, { month: '2026-10', probability: 0.8, essential: 0.95 })
  assert.equal(history.length, 2)
  assert.ok(Math.abs(goalsTrend(history).change - 0.1) < 1e-9)
  assert.equal(sanitizeGoalsHistory([{ month: '2026-13', probability: 0.5, essential: 0.5 }, { month: '2026-01', probability: 2, essential: 0 }]).length, 0)
  assert.equal(Object.hasOwn(sanitizePlan({}), 'goalsHistory'), false)
  assert.equal(sanitizePlan({ goalsHistory: history }).goalsHistory.length, 2)
  resetState()
  Object.assign(state, fixture(), { isDemo: false })
  const revision = riskRevision()
  recordGoalsSnapshot({ month: '2026-10', probability: 0.5, essential: 0.5 })
  assert.equal(riskRevision(), revision)
  cancelGoals(true)
  state.plan.goalsHistory = []
  renderGoals()
  assert.equal(state.plan.goalsHistory.length, 1)
  state.isDemo = true
  cancelGoals(true)
  state.plan.goalsHistory = []
  renderGoals()
  assert.equal(state.plan.goalsHistory.length, 0)
  resetState()
})

test('tela mostra abas, legado, simulador e cartão da visão geral', async () => {
  const { saveLegacyGoal, removeLegacyGoal, applyGoalAllocation, renderGoalsDashboardCard, runGoalScenario } = await import('../src/features/goals/goals.js')
  resetState()
  Object.assign(state, fixture(), { isDemo: false })
  cancelGoals(true)
  assert.match(renderGoalsDashboardCard(), /Qual a chance de realizar seus objetivos/)
  const html = renderGoals()
  for (const text of ['Resumo', 'Reservas e carteira', 'Balanço e evolução', 'Combine os caminhos', 'Liquidez, longevidade e legado', 'Carteira pelos prazos dos objetivos', 'Evolução da confiança', 'Incluir meta de legado', 'data-goals-scenario']) assert.ok(html.includes(text), text)
  assert.match(renderGoalsDashboardCard(), /CONFIANÇA DOS OBJETIVOS/)
  saveLegacyGoal(new URLSearchParams({ amount: '50000', priority: 'essential' }))
  assert.deepEqual(state.plan.legacyGoal, { amount: 50000, currency: 'BRL', priority: 'essential' })
  assert.throws(() => saveLegacyGoal(new URLSearchParams({ amount: '0' })), /maior que zero/)
  const withLegacy = renderGoals()
  assert.match(withLegacy, /data-goal-priority="legacy:legacy"/)
  setGoalPriority('legacy:legacy', 'aspirational')
  assert.equal(state.plan.legacyGoal.priority, 'aspirational')
  removeLegacyGoal()
  assert.equal(state.plan.legacyGoal, null)
  renderGoals()
  applyGoalAllocation()
  assert.deepEqual(Object.keys(state.plan.targetAllocation.shares).sort().every(key => ['cash', 'equity', 'fixed-income'].includes(key)), true)
  let markup = ''
  runGoalScenario({ extraMonthly: 1000 }, html => { markup = html })
  assert.match(markup, /em relação ao plano atual|Igual ao plano atual/)
  resetState()
})
