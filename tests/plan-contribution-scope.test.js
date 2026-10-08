import test from 'node:test'
import assert from 'node:assert/strict'
import { state, updatePlan } from '../src/app/state.js'
import { sanitizeStoredState } from '../src/app/state-storage.js'
import { projectRetirementWithSchedules } from '../src/domain/retirement.js'
import { retirementContributionSchedules } from '../src/domain/cash-flow.js'
import { finappViability } from '../src/domain/finapp-viability.js'
import { buildBudgetYear } from '../src/domain/budget-overview.js'
import { compareVariableContributions } from '../src/domain/variable-contributions.js'

const today = new Date('2026-01-01T00:00:00Z')

test('changing the plan contribution changes retirement income and portfolio contributions, while budget projections retain their own cash flows', () => {
  const original = structuredClone(state)
  try {
    Object.assign(state, sanitizeStoredState({ currency: 'BRL', plan: {
      currentAge: 40, retirementAge: 41, retirementMonth: '2027-01', targetAge: 43, horizonReferenceMonth: '2026-01',
      currentAssets: 30000, monthlyContribution: 400, annualRealReturn: 0, expectedMonthlyBenefit: 0,
      investments: [
        { id: 'one', name: 'Um', currency: 'BRL', amount: 10000, monthlyContribution: 100, liquidity: 'available', returnType: 'real', returnValue: 0 },
        { id: 'two', name: 'Dois', currency: 'BRL', amount: 20000, monthlyContribution: 300, liquidity: 'available', returnType: 'real', returnValue: 0 }
      ]
    }, cashFlow: { referenceMonth: '2026-01', currentEmergencyReserve: 0, emergencyReserveTarget: 0, annualGoals: [], commitments: [], consortia: [], items: [
      { id: 'income', type: 'income', categoryId: 'salary', amount: 1000, frequency: 'monthly', currency: 'BRL', recordKind: 'planned' },
      { id: 'expense', type: 'expense', categoryId: 'housing', amount: 500, frequency: 'monthly', currency: 'BRL', recordKind: 'planned' }
    ] } }))
    const schedules = retirementContributionSchedules(state.cashFlow, state.currency, state.exchangeRates)
    const before = projectRetirementWithSchedules(state.plan, schedules, today)
    const annual = finappViability(state, undefined, today)
    const budget = buildBudgetYear(state, 2026)
    const items = structuredClone(state.cashFlow.items)
    updatePlan({ monthlyContribution: 800 })
    const after = projectRetirementWithSchedules(state.plan, schedules, today)
    assert.deepEqual(state.plan.investments.map(item => item.monthlyContribution), [200, 600])
    assert.equal(after.projectedAssets - before.projectedAssets, 4800)
    assert.ok(Math.abs(after.projectedMonthlyIncome - before.projectedMonthlyIncome - 16) < 1e-8)
    assert.deepEqual(state.cashFlow.items, items)
    assert.deepEqual(buildBudgetYear(state, 2026), budget)
    assert.deepEqual(finappViability(state, undefined, today).rows, annual.rows)
    const limited = compareVariableContributions(state, today)
    assert.equal(limited.baseline.projectedAssets, after.projectedAssets)
    assert.equal(limited.projectedAssets, 36000)
    assert.equal(limited.contributionTotal, 6000)
  } finally {
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, original)
  }
})
